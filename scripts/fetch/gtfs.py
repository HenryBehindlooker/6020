"""
Sucht öffentliche GTFS-Fahrpläne für Tirol und rechnet daraus die Verbindungen
zwischen den Ausgangspunkten der Touren und Innsbruck (zentral) aus.

Läuft auf dem GitHub-Runner. Nur Standardbibliothek.

1. Katalog der Mobility Database laden, österreichische GTFS-Feeds finden
2. Jeden Kandidaten laden und prüfen, ob er Tiroler Ausgangspunkte enthält
3. Für den besten Feed Hin- und Rückfahrten an Beispieltagen ausrechnen
4. data/gtfs/PROBE.json (was gefunden wurde) und data/gtfs/connections.json
"""
import csv
import io
import json
import math
import re
import sys
import urllib.request
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

OUT = Path("data/gtfs")
UA = {"User-Agent": "Bergampel-Innsbruck/0.1 (github.com/HenryBehindlooker/6020)"}
MAX_ZIP_MB = 600

CATALOG_URLS = [
    "https://files.mobilitydatabase.org/feeds_v2.csv",
    "https://share.mobilitydata.org/catalogs-csv",
    "https://bit.ly/catalogs-csv",
]

# Ausgangspunkte: Namensmuster plus Referenzpunkt. Treffer muessen beides
# erfuellen (Name passt UND hoechstens RADIUS_KM entfernt), damit nicht ein
# gleichnamiger Halt am anderen Ende Tirols gewinnt.
RADIUS_KM = 4.0
TRAILHEADS = {
    "Praxmar Wendestelle": {"pattern": r"Praxmar", "lat": 47.1494, "lon": 11.1335},
    "Kühtai Dortmunderhütte": {"pattern": r"K(ü|ue)htai", "lat": 47.2114, "lon": 11.0089},
    "Oberperfuss Rangger Köpfl Lift": {"pattern": r"Oberperfu(ss|ß)", "lat": 47.2458, "lon": 11.2379},
    "Axams Axamer Lizum": {"pattern": r"Lizum", "lat": 47.1958, "lon": 11.303},
    "Patscherkofel": {"pattern": r"Igls|Patscherkofel", "lat": 47.2221, "lon": 11.4258},
    "Hungerburg": {"pattern": r"Hungerburg", "lat": 47.2862, "lon": 11.4002},
    "Theresienkirche": {"pattern": r"Theresienkirche", "lat": 47.2864, "lon": 11.3982},
}

# "Egal wo, Hauptsache zentral": Hauptbahnhof, Marktplatz, Altstadt.
CENTRAL = {"pattern": r"Innsbruck.*(Hauptbahnhof|Hbf|Marktplatz|Terminal|Maria-Theresien|Museumstr|Anichstr)|^(Hauptbahnhof|Marktplatz|Terminal Marktplatz|Maria-Theresien-Stra(ß|ss)e)$",
           "lat": 47.265, "lon": 11.397, "radius_km": 1.5}

RELEVANT_PROVIDER = re.compile(r"tirol|vvt|innsbruck|ivb|öbb|oebb|postbus|austria|österreich|oesterreich", re.I)


def km(lat1, lon1, lat2, lon2):
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))


def fetch(url, timeout=300):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read()


# --- Katalog -----------------------------------------------------------------

def load_catalog():
    for url in CATALOG_URLS:
        try:
            text = fetch(url, 120).decode("utf-8", "replace")
            rows = list(csv.DictReader(io.StringIO(text)))
            print(f"Katalog: {url} -> {len(rows)} Feeds")
            return url, rows
        except Exception as err:  # noqa: BLE001
            print(f"Katalog {url}: {err}", file=sys.stderr)
    return None, []


def austrian_candidates(rows):
    out = []
    for r in rows:
        country = (r.get("location.country_code") or "").upper()
        dtype = (r.get("data_type") or "").lower()
        if country != "AT" or dtype != "gtfs":
            continue
        if (r.get("status") or "").lower() in ("deprecated", "inactive"):
            continue
        text = " ".join(str(r.get(k, "")) for k in ("provider", "name", "location.subdivision_name", "location.municipality"))
        # Bounding Box enthaelt Innsbruck?
        try:
            covers = (float(r["location.bounding_box.minimum_latitude"]) <= 47.27 <= float(r["location.bounding_box.maximum_latitude"])
                      and float(r["location.bounding_box.minimum_longitude"]) <= 11.39 <= float(r["location.bounding_box.maximum_longitude"]))
        except (KeyError, ValueError, TypeError):
            covers = None
        out.append({
            "id": r.get("id"),
            "provider": r.get("provider"),
            "name": r.get("name"),
            "subdivision": r.get("location.subdivision_name"),
            "latest": r.get("urls.latest"),
            "direct": r.get("urls.direct_download"),
            "auth": r.get("urls.authentication_type"),
            "license": r.get("urls.license"),
            "covers_innsbruck": covers,
            "relevant_name": bool(RELEVANT_PROVIDER.search(text)),
        })
    # Innsbruck in der Bounding Box zuerst, dann passende Namen
    out.sort(key=lambda c: (c["covers_innsbruck"] is not True, not c["relevant_name"]))
    return out


# --- GTFS lesen --------------------------------------------------------------

def read_csv(zf, name):
    try:
        with zf.open(name) as f:
            yield from csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
    except KeyError:
        return


def match_stops(zf):
    """Findet Haltestellen je Ausgangspunkt und die zentralen Innsbrucker Halte."""
    trail = {k: [] for k in TRAILHEADS}
    central = []
    parents = {}
    for s in read_csv(zf, "stops.txt"):
        try:
            lat, lon = float(s["stop_lat"]), float(s["stop_lon"])
        except (KeyError, ValueError):
            continue
        name = s.get("stop_name", "")
        sid = s["stop_id"]
        if s.get("parent_station"):
            parents[sid] = s["parent_station"]
        for key, th in TRAILHEADS.items():
            d = km(lat, lon, th["lat"], th["lon"])
            if re.search(th["pattern"], name, re.I) and d <= RADIUS_KM:
                trail[key].append({"stop_id": sid, "name": name, "km": round(d, 2), "lat": lat, "lon": lon})
        if re.search(CENTRAL["pattern"], name, re.I) and km(lat, lon, CENTRAL["lat"], CENTRAL["lon"]) <= CENTRAL["radius_km"]:
            central.append({"stop_id": sid, "name": name})
    return trail, central, parents


def feed_validity(zf):
    starts, ends = [], []
    for r in read_csv(zf, "feed_info.txt"):
        if r.get("feed_start_date"):
            starts.append(r["feed_start_date"])
        if r.get("feed_end_date"):
            ends.append(r["feed_end_date"])
    for r in read_csv(zf, "calendar.txt"):
        starts.append(r["start_date"])
        ends.append(r["end_date"])
    if not starts:
        dates = [r["date"] for r in read_csv(zf, "calendar_dates.txt")]
        if dates:
            return min(dates), max(dates)
        return None, None
    return min(starts), max(ends)


def probe(zip_bytes):
    zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    agencies = [a.get("agency_name") for a in read_csv(zf, "agency.txt")]
    trail, central, _ = match_stops(zf)
    start, end = feed_validity(zf)
    return zf, {
        "agencies": agencies[:30],
        "agency_count": len(agencies),
        "valid_from": start,
        "valid_to": end,
        "trailheads_found": {k: len(v) for k, v in trail.items()},
        "trailhead_stops": {k: v[:6] for k, v in trail.items()},
        "central_stops": central[:12],
        # Ohne einen einzigen Ausgangspunkt ist ein Feed wertlos, auch wenn er
        # "Innsbruck Hauptbahnhof" kennt (etwa ueber internationale Zuege).
        "score": (sum(1 for v in trail.values() if v) * 10 + (5 if central else 0)) if any(trail.values()) else 0,
    }


# --- Service-Kalender --------------------------------------------------------

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def active_services(zf, day: date):
    ymd = day.strftime("%Y%m%d")
    wd = WEEKDAYS[day.weekday()]
    active = set()
    for r in read_csv(zf, "calendar.txt"):
        if r["start_date"] <= ymd <= r["end_date"] and r.get(wd) == "1":
            active.add(r["service_id"])
    for r in read_csv(zf, "calendar_dates.txt"):
        if r["date"] != ymd:
            continue
        if r["exception_type"] == "1":
            active.add(r["service_id"])
        elif r["exception_type"] == "2":
            active.discard(r["service_id"])
    return active


def sample_days(valid_from, valid_to):
    """Beispieltage: ein Mittwoch und ein Samstag im Winter, dazu der naechste
    Mittwoch und Samstag ab heute - jeweils nur, wenn der Feed sie abdeckt."""
    lo = datetime.strptime(valid_from, "%Y%m%d").date()
    hi = datetime.strptime(valid_to, "%Y%m%d").date()
    days = {}

    def first(weekday, start):
        d = start + timedelta(days=(weekday - start.weekday()) % 7)
        return d if lo <= d <= hi else None

    today = date.today()
    # Wintertag: zweite Februarwoche im Feed-Zeitraum (Hochsaison Skitouren)
    for year in range(lo.year, hi.year + 1):
        for wd, label in ((2, "winter_werktag"), (5, "winter_samstag")):
            d = first(wd, date(year, 2, 8))
            if d and label not in days:
                days[label] = d
    for wd, label in ((2, "naechster_werktag"), (5, "naechster_samstag")):
        d = first(wd, max(today, lo))
        if d:
            days[label] = d
    return days


def gtfs_time_to_min(t):
    h, m, *_ = (int(x) for x in t.split(":"))
    return h * 60 + m


def extract_connections(zf, trail, central, day: date):
    """Direkte Fahrten Ausgangspunkt <-> Innsbruck zentral an einem Tag."""
    services = active_services(zf, day)
    if not services:
        return {}

    routes = {r["route_id"]: (r.get("route_short_name") or r.get("route_long_name") or "?") for r in read_csv(zf, "routes.txt")}
    trips = {}
    for t in read_csv(zf, "trips.txt"):
        if t["service_id"] in services:
            trips[t["trip_id"]] = {"route": routes.get(t["route_id"], "?"), "headsign": t.get("trip_headsign", "")}

    stop_to_trail = {}
    for key, stops in trail.items():
        for s in stops:
            stop_to_trail[s["stop_id"]] = (key, s["name"])
    central_ids = {s["stop_id"]: s["name"] for s in central}
    relevant = set(stop_to_trail) | set(central_ids)

    visits = {}
    for st in read_csv(zf, "stop_times.txt"):
        tid = st["trip_id"]
        if tid not in trips or st["stop_id"] not in relevant:
            continue
        t = st.get("departure_time") or st.get("arrival_time")
        if not t:
            continue
        visits.setdefault(tid, []).append((int(st["stop_sequence"]), st["stop_id"],
                                           st.get("arrival_time") or t, st.get("departure_time") or t))

    result = {k: {"outbound": [], "inbound": []} for k in TRAILHEADS}
    for tid, vs in visits.items():
        vs.sort()
        trip = trips[tid]
        for i, (seq_a, stop_a, arr_a, dep_a) in enumerate(vs):
            for seq_b, stop_b, arr_b, dep_b in vs[i + 1:]:
                if stop_a in central_ids and stop_b in stop_to_trail:
                    key, name = stop_to_trail[stop_b]
                    result[key]["outbound"].append({"line": trip["route"], "headsign": trip["headsign"],
                                                    "from": central_ids[stop_a], "to": name,
                                                    "departure": dep_a[:5], "arrival": arr_b[:5]})
                if stop_a in stop_to_trail and stop_b in central_ids:
                    key, name = stop_to_trail[stop_a]
                    result[key]["inbound"].append({"line": trip["route"], "headsign": trip["headsign"],
                                                   "from": name, "to": central_ids[stop_b],
                                                   "departure": dep_a[:5], "arrival": arr_b[:5]})

    # Pro Fahrt nur die erste passende Kombination; nach Abfahrt sortieren
    for key in result:
        for direction in ("outbound", "inbound"):
            seen, uniq = set(), []
            for c in sorted(result[key][direction], key=lambda c: (gtfs_time_to_min(c["departure"]), gtfs_time_to_min(c["arrival"]))):
                k = (c["line"], c["departure"])
                if k not in seen:
                    seen.add(k)
                    uniq.append(c)
            result[key][direction] = uniq
    return result


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = {"fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "catalog": None,
              "candidates": [], "probed": [], "chosen": None, "notes": []}

    catalog_url, rows = load_catalog()
    report["catalog"] = catalog_url
    candidates = austrian_candidates(rows)
    report["candidates"] = candidates
    print(f"{len(candidates)} österreichische GTFS-Feeds im Katalog")

    best = None
    for c in candidates[:15]:
        url = c["latest"] or c["direct"]
        if not url:
            continue
        print(f"== {c['provider']} ({c['id']})  {url}")
        try:
            data = fetch(url)
        except Exception as err:  # noqa: BLE001
            print(f"  Download fehlgeschlagen: {err}")
            report["probed"].append({**c, "error": str(err)})
            continue
        mb = len(data) / 1e6
        if mb > MAX_ZIP_MB:
            report["probed"].append({**c, "error": f"zu gross ({mb:.0f} MB)"})
            continue
        try:
            zf, info = probe(data)
        except Exception as err:  # noqa: BLE001
            report["probed"].append({**c, "error": f"kein gueltiges GTFS: {err}"})
            continue
        info.update(c)
        info["size_mb"] = round(mb, 1)
        report["probed"].append(info)
        print(f"  {mb:.1f} MB, gültig {info['valid_from']}-{info['valid_to']}, Ausgangspunkte: {info['trailheads_found']}, zentral: {len(info['central_stops'])}")
        if info["score"] > 0 and (best is None or info["score"] > best[1]["score"]):
            best = (zf, info, data)

    if not best:
        report["notes"].append("Kein öffentlicher Feed enthält die Tiroler Ausgangspunkte.")
        (OUT / "PROBE.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
        print("Kein passender Feed gefunden.")
        return

    zf, info, _ = best
    report["chosen"] = {k: info.get(k) for k in ("id", "provider", "name", "license", "valid_from", "valid_to", "latest")}
    trail, central, _ = match_stops(zf)

    connections = {"source": report["chosen"], "generated_at": report["fetched_at"],
                   "trailhead_stops": trail, "central_stops": central, "days": {}}
    if info["valid_from"] and info["valid_to"]:
        hi = datetime.strptime(info["valid_to"], "%Y%m%d").date()
        for label, day in sample_days(info["valid_from"], info["valid_to"]).items():
            # Feiertag oder Ausfall erwischt? Dann dieselbe Wochentag eine Woche spaeter.
            for _ in range(4):
                conns = extract_connections(zf, trail, central, day)
                if any(v["outbound"] or v["inbound"] for v in conns.values()) or day + timedelta(days=7) > hi:
                    break
                day += timedelta(days=7)
            print(f"-- {label}: {day}")
            connections["days"][label] = {"date": day.isoformat(), "connections": conns}
            for k, v in conns.items():
                print(f"   {k:28} hin {len(v['outbound']):3}  zurück {len(v['inbound']):3}")

    (OUT / "connections.json").write_text(json.dumps(connections, ensure_ascii=False, indent=1))
    (OUT / "PROBE.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
