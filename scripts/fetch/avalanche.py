"""
Holt den Tiroler Lawinenlagebericht von avalanche.report.

Die Bulletins liegen als Verzeichnis je Tag unter
https://static.avalanche.report/eaws_bulletins/<JJJJ-MM-TT>/. Die Dateinamen
sind nicht dokumentiert, darum liest das Skript das Verzeichnis und nimmt die
Datei fuer Tirol (AT-07) im CAAMLv6-JSON-Format.

Schreibt:
- data/lawine/latest.json     neuester Bericht samt Metadaten
- data/lawine/samples/*.json  einige Wintertage, damit der Parser gegen echte
                              Berichte getestet werden kann (einmalig)
- data/lawine/PROBE.json      was im Verzeichnis gefunden wurde
"""
import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE = "https://static.avalanche.report/eaws_bulletins/"
OUT = Path("data/lawine")
UA = {"User-Agent": "Bergampel-Innsbruck/0.1 (github.com/HenryBehindlooker/6020; nicht-kommerziell)"}

# Wintertage fuer Parser-Tests: Hochwinter, Fruehjahr, Fruehwinter
SAMPLE_DAYS = ["2026-01-17", "2026-02-14", "2026-03-21", "2025-12-27"]


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.read().decode("utf-8", "replace")


def list_links(url):
    """Eintraege einer Verzeichnisseite als Namen ('2026-02-14/' oder 'datei.json').

    Relative ('./x', 'x') und absolute ('/eaws_bulletins/x') Links werden auf
    ihr letztes Pfadstueck reduziert; Links nach aussen und nach oben entfallen.
    """
    names = []
    for href in re.findall(r'href="([^"?#]+)"', get(url)):
        if href.startswith(("http:", "https:", "mailto:", "..")):
            continue
        is_dir = href.endswith("/")
        last = href.rstrip("/").rsplit("/", 1)[-1]
        if last and last != ".":
            names.append(last + ("/" if is_dir else ""))
    return names


def date_dirs():
    """Tagesordner bis morgen. Das Verzeichnis enthaelt auch Ordner fuer Tage in
    der Zukunft (gesehen: bis Ende November, nur mit katalanischen Berichten)."""
    limit = (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()
    names = set()
    for link in list_links(BASE):
        m = re.search(r"(\d{4}-\d{2}-\d{2})/?$", link)
        if m and m.group(1) <= limit:
            names.add(m.group(1))
    return sorted(names)


def pick_tirol_file(day):
    """Sucht im Tagesordner die Tiroler JSON-Datei. Liefert (Dateiname, alle Dateien)."""
    files = [l for l in list_links(f"{BASE}{day}/") if not l.endswith("/")]
    json_files = [f for f in files if f.lower().endswith(".json")]
    # Bevorzugt: AT-07 im Namen, CAAML/v6 im Namen, dann der kuerzeste Name
    ranked = sorted(
        (f for f in json_files if "AT-07" in f or "AT7" in f.upper()),
        key=lambda f: ("CAAML" not in f.upper() and "v6" not in f.lower(), len(f)),
    )
    return (ranked[0] if ranked else None), files


def fetch_day(day):
    name, files = pick_tirol_file(day)
    if not name:
        return None, files
    raw = get(f"{BASE}{day}/{name}")
    return {"date": day, "file": name, "url": f"{BASE}{day}/{name}", "bulletin": json.loads(raw)}, files


def summarize(doc):
    """Kurzueberblick fuer die Kontrolle - Struktur, nicht Inhalt."""
    bulletins = doc.get("bulletins", []) if isinstance(doc, dict) else doc
    out = []
    for b in bulletins[:12]:
        regions = [r.get("regionID") for r in b.get("regions", [])]
        ratings = [(r.get("mainValue"), r.get("elevation"), r.get("validTimePeriod")) for r in b.get("dangerRatings", [])]
        problems = [(p.get("problemType"), p.get("aspects"), p.get("elevation"), p.get("validTimePeriod"))
                    for p in b.get("avalancheProblems", [])]
        out.append({"regions": regions[:6], "region_count": len(regions), "ratings": ratings,
                    "problems": problems, "keys": sorted(b.keys()),
                    "validTime": b.get("validTime"), "publicationTime": b.get("publicationTime")})
    return {"bulletin_count": len(bulletins),
            "top_keys": sorted(doc.keys()) if isinstance(doc, dict) else "list",
            "bulletins": out}


REGIONS_BASE = "https://regions.avalanches.org/"


def fetch_regions(probe):
    """Grenzen der Tiroler Mikroregionen (EAWS). Auch hier sind die Dateinamen
    nicht dokumentiert - die Uebersichtsseite wird nach AT-07 durchsucht."""
    html = get(REGIONS_BASE)
    links = sorted(set(h for h in re.findall(r'href="([^"?#]+)"', html) if "AT-07" in h))
    probe["region_links"] = links[:60]
    candidates = [l for l in links if l.endswith((".geojson", ".json")) and "micro" in l.lower()
                  and "elevation" not in l.lower() and "_en" not in l and "_de" not in l]
    candidates.sort(key=lambda l: (len(l), l))
    for link in candidates:
        url = link if link.startswith("http") else REGIONS_BASE + link.lstrip("./")
        try:
            doc = json.loads(get(url))
        except Exception as err:  # noqa: BLE001
            print(f"Regionen {url}: {err}", file=sys.stderr)
            continue
        if isinstance(doc, dict) and doc.get("features"):
            (OUT / "regions-AT-07.geojson").write_text(json.dumps(doc, ensure_ascii=False))
            probe["regions"] = {"url": url, "features": len(doc["features"]),
                                "properties": sorted(doc["features"][0].get("properties", {}).keys())}
            print(f"Regionen: {url} mit {len(doc['features'])} Flaechen")
            return
    print("Keine Tiroler Regionsgrenzen gefunden.")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "samples").mkdir(exist_ok=True)
    probe = {"fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}

    days = date_dirs()
    probe["date_dirs"] = {"count": len(days), "first": days[:2], "last": days[-5:]}
    print(f"{len(days)} Tagesordner, zuletzt {days[-3:]}")
    if not days:
        print("Kein Tagesordner gefunden.")
        (OUT / "PROBE.json").write_text(json.dumps(probe, ensure_ascii=False, indent=1))
        return

    # Neuester Tiroler Bericht. Ausserhalb der Saison (etwa Mai bis November)
    # liegt der letzte im Fruehjahr - darum weit zurueck suchen, aber nur die
    # Verzeichnisliste jedes Ordners lesen, bis einer die Tiroler Datei hat.
    latest = None
    checked = 0
    for day in reversed(days[-240:]):
        name, files = pick_tirol_file(day)
        checked += 1
        if name:
            latest, _ = fetch_day(day)
            break
    probe["checked_dirs_until_found"] = checked
    if latest:
        latest["fetched_at"] = probe["fetched_at"]
        (OUT / "latest.json").write_text(json.dumps(latest, ensure_ascii=False))
        probe["latest"] = {"date": latest["date"], "file": latest["file"], "summary": summarize(latest["bulletin"])}
        print(f"Neuester Bericht: {latest['date']} {latest['file']}")
    else:
        print("In den letzten zehn Tagesordnern keine Tiroler JSON-Datei.")

    # Beispieltage einmalig ablegen
    for day in SAMPLE_DAYS:
        path = OUT / "samples" / f"{day}.json"
        if path.exists():
            continue
        try:
            sample, sfiles = fetch_day(day)
        except Exception as err:  # noqa: BLE001
            print(f"{day}: {err}", file=sys.stderr)
            continue
        if sample:
            path.write_text(json.dumps(sample["bulletin"], ensure_ascii=False))
            probe.setdefault("samples", {})[day] = {"file": sample["file"], "summary": summarize(sample["bulletin"])}
            print(f"Beispiel {day}: {sample['file']}")
        else:
            probe.setdefault("samples", {})[day] = {"files": sfiles[:40]}

    regions_path = OUT / "regions-AT-07.geojson"
    if not regions_path.exists():
        try:
            fetch_regions(probe)
        except Exception as err:  # noqa: BLE001
            probe["regions_error"] = str(err)
            print(f"Regionen: {err}", file=sys.stderr)

    (OUT / "PROBE.json").write_text(json.dumps(probe, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
