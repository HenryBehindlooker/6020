"""
Holt frei lizenzierte Fotos der Taeler und der Tourenziele von Wikimedia.

- Taeler und Gebiete: das Artikelbild des deutschen Wikipedia-Artikels
  samt Koordinaten und den ersten zwei Saetzen (CC BY-SA).
- Touren: Fotos von Wikimedia Commons, die im Umkreis des Gipfels
  aufgenommen wurden (Geotag).

Uebernommen wird nur, was eine freie Lizenz (CC, gemeinfrei) nennt, immer mit
Urheber, Lizenz und Link zur Dateiseite. Die Bilder selbst werden nicht
kopiert: die App bindet die Vorschaubilder von upload.wikimedia.org ein.

Schreibt static/photos/photos.json. Nur Standardbibliothek.
"""
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUT = Path("static/photos")
TOURS = Path("src/fixtures/tours.json")
UA = {"User-Agent": "Bergampel-Innsbruck/0.1 (github.com/HenryBehindlooker/6020; nicht-kommerziell)"}
WIKI = "https://de.wikipedia.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"
THUMB = 960

# Taeler und Gebiete rund um die Touren - Titel der deutschen Wikipedia.
# Fehlt ein Artikel oder sein Bild, wird er uebersprungen.
VALLEYS = [
    "Nordkette", "Patscherkofel", "Stubaital", "Sellraintal", "Lüsenstal",
    "Kühtai", "Axamer Lizum", "Wipptal", "Gschnitztal", "Halltal (Karwendel)",
    "Fotscher Tal", "Senderstal", "Kalkkögel", "Oberinntal", "Mieminger Plateau",
    "Seegrube", "Glungezer", "Serles", "Tuxer Alpen", "Karwendel",
]

# Gemaelde und Zeichnungen sind keine Fotos der Verhaeltnisse
ARTWORK = re.compile(r"(Mischtechnik|Öl auf|auf Papier|Leinwand|Aquarell|Radierung|Lithograph|painting|drawing|signiert)", re.I)

FREE = re.compile(r"^(CC|Public domain|PD|CC0|GFDL|Attribution|FAL)", re.I)


def api(base, params, versuche=4):
    params = {**params, "format": "json", "formatversion": "2"}
    url = f"{base}?{urllib.parse.urlencode(params)}"
    for versuch in range(versuche):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as res:
                return json.load(res)
        except Exception as err:  # noqa: BLE001
            if versuch == versuche - 1:
                raise
            print(f"  Wiederholung ({err})", file=sys.stderr)
            # Commons drosselt mit 429 - dann deutlich laenger warten
            warten = 20 * (versuch + 1) if "429" in str(err) else 3 * (versuch + 1)
            time.sleep(warten)


def plain(text):
    """HTML aus den Commons-Metadaten zu Klartext."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", text or ""))).strip()


def norm(title):
    return title.replace("_", " ")


def file_infos(titles):
    """Lizenz, Urheber und Vorschau fuer Commons-Dateien, nur freie."""
    out = {}
    for i in range(0, len(titles), 40):
        batch = titles[i:i + 40]
        data = api(COMMONS, {
            "action": "query", "titles": "|".join(batch), "prop": "imageinfo",
            "iiprop": "url|extmetadata|size|mime", "iiurlwidth": THUMB,
        })
        for page in data.get("query", {}).get("pages", []):
            info = (page.get("imageinfo") or [None])[0]
            if not info or info.get("mime") not in ("image/jpeg", "image/png", "image/webp"):
                continue
            meta = info.get("extmetadata", {})
            lic = plain(meta.get("LicenseShortName", {}).get("value"))
            if not FREE.search(lic):
                continue
            # Wikipedia liefert Dateinamen mit "_", Commons mit Leerzeichen
            out[norm(page["title"])] = {
                "file": page["title"],
                "thumb": info.get("thumburl"),
                "width": info.get("thumbwidth"),
                "height": info.get("thumbheight"),
                "page": info.get("descriptionurl"),
                "author": plain(meta.get("Artist", {}).get("value"))[:120] or "unbekannt",
                "license": lic,
                "licenseUrl": meta.get("LicenseUrl", {}).get("value"),
                "caption": plain(meta.get("ImageDescription", {}).get("value"))[:200] or None,
                "date": plain(meta.get("DateTimeOriginal", {}).get("value"))[:10] or None,
            }
        time.sleep(2)
    return out


def valleys():
    data = api(WIKI, {
        "action": "query", "titles": "|".join(VALLEYS), "redirects": 1,
        "prop": "pageimages|coordinates|extracts|info", "piprop": "name",
        "exintro": 1, "explaintext": 1, "exsentences": 2, "inprop": "url",
    })
    pages = [p for p in data.get("query", {}).get("pages", []) if not p.get("missing")]
    files = [f"File:{p['pageimage']}" for p in pages if p.get("pageimage")]
    infos = file_infos(files)
    result = []
    for p in pages:
        info = infos.get(norm(f"File:{p.get('pageimage')}"))
        coords = (p.get("coordinates") or [None])[0]
        if not info or not coords:
            print(f"  {p['title']}: {'kein freies Bild' if not info else 'keine Koordinaten'}")
            continue
        result.append({
            "title": p["title"], "lat": round(coords["lat"], 5), "lon": round(coords["lon"], 5),
            "extract": (p.get("extract") or "").strip()[:400],
            "article": p.get("fullurl"),
            "photo": info,
        })
    result.sort(key=lambda v: VALLEYS.index(v["title"]) if v["title"] in VALLEYS else 99)
    return result


def near(lat, lon, radius=1000, limit=4):
    data = api(COMMONS, {
        "action": "query", "list": "geosearch", "gscoord": f"{lat}|{lon}",
        "gsradius": radius, "gsnamespace": 6, "gslimit": 30,
    })
    hits = data.get("query", {}).get("geosearch", [])
    infos = file_infos([h["title"] for h in hits])
    out = []
    for h in hits:
        info = infos.get(norm(h["title"]))
        # Querformat bevorzugt, sehr kleine Bilder weglassen
        if info and (info.get("width") or 0) >= 600 and not ARTWORK.search(f'{info.get("caption") or ""} {info["file"]}'):
            out.append({**info, "distM": round(h.get("dist", 0))})
        if len(out) >= limit:
            break
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    result = {"fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
              "attribution": "Fotos: Wikimedia Commons, Urheber und Lizenz je Bild; Texte: Wikipedia (CC BY-SA 4.0)",
              "valleys": [], "tours": {}}
    try:
        result["valleys"] = valleys()
        print(f"Taeler mit Bild: {len(result['valleys'])}")
    except Exception as err:  # noqa: BLE001
        print(f"Taeler: {err}", file=sys.stderr)

    path = OUT / "photos.json"
    old = json.loads(path.read_text()) if path.exists() else None

    for tour in json.loads(TOURS.read_text()):
        summit = tour.get("summit") or {"lat": tour["lat"], "lon": tour["lon"]}
        try:
            photos = near(summit["lat"], summit["lon"])
            # Entlegene Gipfel: im weiteren Umkreis suchen
            if not photos:
                time.sleep(2)
                photos = near(summit["lat"], summit["lon"], radius=3000)
        except Exception as err:  # noqa: BLE001
            print(f"{tour['id']}: {err}", file=sys.stderr)
            # Fehlschlag: den letzten Stand behalten statt die Fotos zu verlieren
            if old and tour["id"] in old.get("tours", {}):
                result["tours"][tour["id"]] = old["tours"][tour["id"]]
            continue
        result["tours"][tour["id"]] = photos
        print(f"{tour['id']}: {len(photos)} Fotos")
        time.sleep(3)

    # Ein Totalausfall soll den letzten guten Stand nicht ueberschreiben
    if not result["valleys"] and not any(result["tours"].values()) and old:
        print("Nichts geholt - alter Stand bleibt.")
        return
    path.write_text(json.dumps(result, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
