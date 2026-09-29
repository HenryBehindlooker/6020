"""
Holt Wege, Hütten, Seilbahnen und Gipfel rund um Innsbruck aus OpenStreetMap.

Läuft auf dem GitHub-Runner (dort gibt es freies Internet) und schreibt
vereinfachte GeoJSON-Dateien nach static/osm/. Nur Standardbibliothek.

Daten: © OpenStreetMap-Mitwirkende, ODbL 1.0.
"""
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# Unter static/, damit die Karte die Dateien direkt nachladen kann, statt sie
# in jede Seite einzubetten.
OUT = Path("static/osm")
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# Innsbruck, Nordkette, Patscherkofel, Mittelgebirge, Sellrain, Kühtai,
# Axamer Lizum. Süd, West, Nord, Ost.
BBOX = (47.08, 10.95, 47.36, 11.62)
B = ",".join(str(v) for v in BBOX)

QUERIES = {
    # Wanderweg-Relationen mit Namen. out geom(bbox) schneidet Fernwege wie
    # den Adlerweg auf die Region zu, statt halb Tirol mitzuliefern.
    "routes-hiking": f"""
        [out:json][timeout:180];
        relation["route"~"^(hiking|foot)$"]["name"]({B});
        out geom({B});
    """,
    # Skitouren sind in OSM seltener, aber es gibt sie. Nur die - Sommerwege
    # sind im Winter KEINE Aufstiegsroute.
    "routes-skitour": f"""
        [out:json][timeout:180];
        (
          relation["route"="ski"]({B});
          relation["piste:type"="skitour"]({B});
          way["piste:type"="skitour"]({B});
        );
        out geom({B});
    """,
    "huts": f"""
        [out:json][timeout:180];
        (
          nwr["tourism"~"^(alpine_hut|wilderness_hut)$"]({B});
          nwr["amenity"~"^(restaurant|cafe|biergarten|pub)$"]["name"~"(Alm|Alpe|Hütte|Huette|Haus|Stüberl|Stuben|Jausen|Gasthof|Berggasthof|Bergrestaurant|Panorama)",i]({B});
        );
        out center tags;
    """,
    # Radltouren fuer den Sommer: beschilderte MTB- und Radrouten. Der
    # Innradweg ragt weit hinaus, geom(bbox) schneidet ihn ab.
    "routes-bike": f"""
        [out:json][timeout:180];
        relation["route"~"^(mtb|bicycle)$"]["name"]({B});
        out geom({B});
    """,
    # Markante Punkte unterwegs: Sattel und Joch, Aussicht, Trinkwasser,
    # Quellen, Unterstaende, Wasserfaelle, Gipfelkreuze.
    "pois": f"""
        [out:json][timeout:180];
        (
          node["natural"="saddle"]({B});
          node["tourism"="viewpoint"]({B});
          node["amenity"="drinking_water"]({B});
          node["natural"="spring"]["name"]({B});
          node["natural"="spring"]["drinking_water"="yes"]({B});
          nwr["amenity"="shelter"]({B});
          node["waterway"="waterfall"]({B});
          node["man_made"="cross"]["summit:cross"="yes"]({B});
          node["natural"="peak"]["summit:cross"="yes"]({B});
        );
        out center tags;
    """,
    "aerialways": f"""
        [out:json][timeout:180];
        (
          way["aerialway"~"^(cable_car|gondola|chair_lift|mixed_lift|funicular)$"]({B});
          way["railway"="funicular"]({B});
        );
        out geom tags;
    """,
    "peaks": f"""
        [out:json][timeout:120];
        node["natural"="peak"]["name"]["ele"]({B});
        out;
    """,
    "bus-stops": f"""
        [out:json][timeout:120];
        (
          node["highway"="bus_stop"]["name"]({B});
          node["public_transport"="platform"]["bus"="yes"]["name"]({B});
          node["railway"~"^(station|halt|tram_stop)$"]["name"]({B});
        );
        out;
    """,
}


def overpass(query: str) -> dict:
    data = urllib.parse.urlencode({"data": query}).encode()
    last_error = None
    for endpoint in ENDPOINTS:
        for attempt in range(3):
            try:
                req = urllib.request.Request(
                    endpoint,
                    data=data,
                    headers={"User-Agent": "Bergampel-Innsbruck/0.1 (github.com/HenryBehindlooker/6020)"},
                )
                with urllib.request.urlopen(req, timeout=240) as res:
                    return json.load(res)
            except Exception as err:  # noqa: BLE001 - Netzfehler, Rate-Limit
                last_error = err
                print(f"  {endpoint} Versuch {attempt + 1}: {err}", file=sys.stderr)
                time.sleep(10 * (attempt + 1))
    raise RuntimeError(f"Overpass nicht erreichbar: {last_error}")


# --- Geometrie ---------------------------------------------------------------

def _dist_m(a, b):
    lat = math.radians((a[1] + b[1]) / 2)
    dx = (b[0] - a[0]) * 111_320 * math.cos(lat)
    dy = (b[1] - a[1]) * 110_540
    return math.hypot(dx, dy)


def _perp_m(p, a, b):
    lat = math.radians(a[1])
    sx = 111_320 * math.cos(lat)
    sy = 110_540
    px, py = (p[0] - a[0]) * sx, (p[1] - a[1]) * sy
    ex, ey = (b[0] - a[0]) * sx, (b[1] - a[1]) * sy
    l2 = ex * ex + ey * ey
    if l2 == 0:
        return math.hypot(px, py)
    t = max(0.0, min(1.0, (px * ex + py * ey) / l2))
    return math.hypot(px - t * ex, py - t * ey)


def simplify(coords, tol_m=12.0):
    """Douglas-Peucker, iterativ (tiefe Rekursion vermeiden)."""
    if len(coords) <= 2:
        return coords
    keep = [False] * len(coords)
    keep[0] = keep[-1] = True
    stack = [(0, len(coords) - 1)]
    while stack:
        i, j = stack.pop()
        best, idx = 0.0, -1
        for k in range(i + 1, j):
            d = _perp_m(coords[k], coords[i], coords[j])
            if d > best:
                best, idx = d, k
        if best > tol_m and idx > 0:
            keep[idx] = True
            stack.append((i, idx))
            stack.append((idx, j))
    return [c for c, k in zip(coords, keep) if k]


def rnd(c):
    return [round(c[0], 5), round(c[1], 5)]


def length_km(lines):
    return round(sum(_dist_m(l[i - 1], l[i]) for l in lines for i in range(1, len(l))) / 1000, 1)


# --- Umwandlung --------------------------------------------------------------

KEEP_ROUTE_TAGS = ["name", "ref", "network", "operator", "osmc:symbol", "from", "to",
                   "description", "website", "distance", "sac_scale", "piste:type",
                   "piste:difficulty", "wikipedia", "route", "mtb:scale", "mtb:scale:uphill",
                   "mtb:type", "ascent", "descent", "roundtrip", "state"]


def route_features(elements):
    features = []
    for el in elements:
        lines = []
        if el["type"] == "relation":
            for m in el.get("members", []):
                geom = m.get("geometry")
                if m.get("type") == "way" and geom:
                    lines.append([[p["lon"], p["lat"]] for p in geom if p])
        elif el["type"] == "way" and el.get("geometry"):
            lines.append([[p["lon"], p["lat"]] for p in el["geometry"] if p])
        lines = [simplify(l) for l in lines if len(l) >= 2]
        lines = [[rnd(c) for c in l] for l in lines if len(l) >= 2]
        if not lines:
            continue
        tags = el.get("tags", {})
        props = {k: tags[k] for k in KEEP_ROUTE_TAGS if k in tags}
        props["osm"] = f"{el['type']}/{el['id']}"
        props["length_km_in_region"] = length_km(lines)
        features.append({
            "type": "Feature",
            "properties": props,
            "geometry": {"type": "MultiLineString", "coordinates": lines},
        })
    return features


KEEP_POI_TAGS = ["name", "tourism", "amenity", "ele", "operator", "opening_hours",
                 "website", "contact:website", "phone", "contact:phone", "beds",
                 "capacity", "seasonal", "description", "wikipedia", "access",
                 "opening_hours:kitchen", "check_date", "check_date:opening_hours",
                 "reservation", "drinking_water", "shelter_type", "summit:cross",
                 "image", "wikimedia_commons", "wikidata", "direction"]


# Einkehr-Filter. Overpass liefert zu den Huetten auch Gasthoefe und Cafes
# in Doerfern und der Innenstadt, weil Namen wie "...haus" oder "Gasthof"
# mehrdeutig sind. Ohne Hoehenangabe in OSM bleibt das eine Heuristik.
import re as _re

MOUNTAIN_WORDS = _re.compile(
    r"(Alm|Alpe|Hütte|Huette|Schutzhaus|Berggasthof|Bergrestaurant|Bergheim|Stüberl|Jausen|"
    r"Panorama|Gipfel|Seegrube|Hafelekar|Waldgasthaus|[\w-]{3,}haus$)",
    _re.I,
)
INNSBRUCK_CENTER = (47.2654, 11.3928)
CITY_RADIUS_KM = 2.0


def _km(lat1, lon1, lat2, lon2):
    return _dist_m([lon1, lat1], [lon2, lat2]) / 1000


def is_mountain_einkehr(props, lat, lon):
    """Schutzhuetten immer; sonst nur Bergnamen oder Hoehe ab 900 m, und nie
    in der Innenstadt."""
    if props.get("tourism") in ("alpine_hut", "wilderness_hut"):
        return True
    name = props.get("name") or ""
    if not name:
        return False
    if _km(lat, lon, *INNSBRUCK_CENTER) < CITY_RADIUS_KM:
        return False
    try:
        ele = float(str(props.get("ele", "")).replace(",", ".").split()[0])
    except (ValueError, IndexError):
        ele = None
    return bool(MOUNTAIN_WORDS.search(name.strip())) or (ele is not None and ele >= 900)


def point_features(elements):
    features = []
    for el in elements:
        if "lat" in el:
            lon, lat = el["lon"], el["lat"]
        elif "center" in el:
            lon, lat = el["center"]["lon"], el["center"]["lat"]
        else:
            continue
        tags = el.get("tags", {})
        props = {k: tags[k] for k in KEEP_POI_TAGS if k in tags}
        # Bezahlarten (payment:cash, payment:debit_cards, ...) - fuer den
        # Bargeld-Hinweis bei Huetten
        props.update({k: v for k, v in tags.items() if k.startswith("payment:")})
        for k in ("natural", "man_made", "waterway", "highway", "public_transport", "railway", "bus", "tram"):
            if k in tags:
                props[k] = tags[k]
        props["osm"] = f"{el['type']}/{el['id']}"
        features.append({
            "type": "Feature",
            "properties": props,
            "geometry": {"type": "Point", "coordinates": rnd([lon, lat])},
        })
    return features


def aerialway_features(elements):
    features = []
    for el in elements:
        geom = el.get("geometry")
        if not geom:
            continue
        coords = [rnd([p["lon"], p["lat"]]) for p in geom]
        tags = el.get("tags", {})
        props = {k: tags[k] for k in ("name", "aerialway", "railway", "operator", "website",
                                      "aerialway:occupancy", "aerialway:duration", "opening_hours")
                 if k in tags}
        props["osm"] = f"way/{el['id']}"
        features.append({
            "type": "Feature",
            "properties": props,
            "geometry": {"type": "LineString", "coordinates": coords},
        })
    return features


def hut_features(elements):
    return [f for f in point_features(elements)
            if is_mountain_einkehr(f["properties"], f["geometry"]["coordinates"][1], f["geometry"]["coordinates"][0])]


CONVERT = {
    "routes-hiking": route_features,
    "routes-skitour": route_features,
    "routes-bike": route_features,
    "pois": point_features,
    "huts": hut_features,
    "aerialways": aerialway_features,
    "peaks": point_features,
    "bus-stops": point_features,
}


MAX_AGE_DAYS = 7


def fresh_enough() -> bool:
    """OSM aendert sich langsam, Overpass ist oft ausgelastet: Daten, die
    juenger als eine Woche sind, werden nicht neu geholt (FORCE_OSM=1 erzwingt)."""
    import os
    if os.environ.get("FORCE_OSM") == "1":
        return False
    try:
        meta = json.loads((OUT / "SOURCE.json").read_text())
        fetched = datetime.fromisoformat(meta["fetched_at"])
        files = meta.get("files", {})
        # Neue Abfragen (etwa nach einer Erweiterung) sofort holen
        complete = all(isinstance(files.get(k), dict) for k in QUERIES)
    except (OSError, KeyError, ValueError):
        return False
    age = datetime.now(timezone.utc) - fetched
    return complete and age.days < MAX_AGE_DAYS


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if fresh_enough():
        print(f"OSM-Daten juenger als {MAX_AGE_DAYS} Tage und vollstaendig - uebersprungen (FORCE_OSM=1 erzwingt).")
        return
    summary = {}
    for name, query in QUERIES.items():
        print(f"== {name}")
        try:
            raw = overpass(query)
        except RuntimeError as err:
            print(f"  FEHLER: {err}")
            summary[name] = f"Fehler: {err}"
            continue
        features = CONVERT[name](raw.get("elements", []))
        features.sort(key=lambda f: f["properties"].get("name", ""))
        path = OUT / f"{name}.geojson"
        path.write_text(json.dumps({"type": "FeatureCollection", "features": features},
                                   ensure_ascii=False, separators=(",", ":")))
        size_kb = path.stat().st_size // 1024
        print(f"  {len(features)} Objekte, {size_kb} KB")
        summary[name] = {"count": len(features), "kb": size_kb,
                         "osm_timestamp": raw.get("osm3s", {}).get("timestamp_osm_base")}
        time.sleep(5)  # Overpass schonen

    (OUT / "SOURCE.json").write_text(json.dumps({
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "bbox_s_w_n_e": BBOX,
        "attribution": "© OpenStreetMap-Mitwirkende, verfügbar unter der Open Database License (ODbL) 1.0",
        "license_url": "https://www.openstreetmap.org/copyright",
        "files": summary,
    }, ensure_ascii=False, indent=2))
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
