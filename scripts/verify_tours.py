"""
Gleicht die Tourenliste mit OpenStreetMap ab und korrigiert sie.

- Gipfel: Name, Hoehe und Lage aus OSM (static/osm/peaks.geojson bzw. fuer
  Almen huts.geojson). Touren ohne eindeutigen OSM-Gipfel fliegen raus.
- Ausgangspunkt: die echte Haltestelle aus OSM (static/osm/bus-stops.geojson).

Was OSM NICHT hergibt, bleibt als Richtwert stehen und wird so markiert:
Hangrichtung, Steilheit, Gehzeiten.

Aufruf: python3 scripts/verify_tours.py   (schreibt src/fixtures/tours.json)
"""
import json
import math
from pathlib import Path

TOURS = Path("src/fixtures/tours.json")
OSM = Path("static/osm")

# Tour-ID -> (Datei, exakter OSM-Name, Haltestelle laut OSM)
# None = in OSM nicht eindeutig belegbar -> Tour wird entfernt.
MAPPING = {
    "nockspitze":     ("peaks", "Saile (Nockspitze)", "Axams Axamer Lizum"),
    "rangger-koepfl": ("peaks", "Rangger Köpfl", "Oberperfuss Rangger Köpfl Lift"),
    "pirchkogel":     ("peaks", "Pirchkogel", "Kühtai Dortmunderhütte"),
    "zischgeles":     ("peaks", "Zischgeles", "Praxmar Wendestelle"),
    "lampsenspitze":  ("peaks", "Lampsenspitze", "Praxmar Wendestelle"),
    "rosskogel":      ("peaks", "Roßkogel", "Oberperfuss Rangger Köpfl Lift"),
    "patscherkofel":  ("peaks", "Patscherkofel", "Patscherkofel"),
    "hafelekar":      ("peaks", "Hafelekarspitze", "Hungerburg"),
    "sulzkogel":      ("peaks", "Sulzkogel", "Kühtai Dortmunderhütte"),
    "arzler-alm":     ("huts", "Arzler Alm", None),  # Haltestelle: naechste in Arzl
    # Drei Gamskogel in der Region; die App-Werte (2659 m ab Kuehtai) passen zu
    # keinem davon zusammen.
    "gamskogel":      None,
    # Ein Pfriemeskoepfl mit 2896 m ab Praxmar gibt es nicht. Pfriemeskopf
    # (1870 m) und der Lift Pfriemeskoepfl liegen in der Axamer Lizum.
    "pfriemesknoepfl": None,
}

MAX_KM_SUMMIT = 8.0


def km(a, b, c, d):
    return 6371 * 2 * math.asin(math.sqrt(
        math.sin(math.radians(c - a) / 2) ** 2
        + math.cos(math.radians(a)) * math.cos(math.radians(c)) * math.sin(math.radians(d - b) / 2) ** 2))


def load(name):
    return json.loads((OSM / f"{name}.geojson").read_text())["features"]


def ele(props):
    try:
        return round(float(str(props.get("ele", "")).replace(",", ".").split()[0]))
    except (ValueError, IndexError):
        return None


def main():
    tours = json.loads(TOURS.read_text())
    features = {"peaks": load("peaks"), "huts": load("huts")}
    stops = load("bus-stops")
    verified, removed = [], []

    for tour in tours:
        entry = MAPPING.get(tour["id"])
        if entry is None:
            removed.append(tour["id"])
            continue
        source, osm_name, stop_name = entry

        # Gipfel: exakter Name, der naechste zum bisherigen Tourpunkt
        candidates = [f for f in features[source] if f["properties"].get("name") == osm_name]
        candidates.sort(key=lambda f: km(tour["lat"], tour["lon"], f["geometry"]["coordinates"][1], f["geometry"]["coordinates"][0]))
        if not candidates:
            raise SystemExit(f"{tour['id']}: '{osm_name}' nicht in OSM gefunden")
        summit = candidates[0]
        s_lon, s_lat = summit["geometry"]["coordinates"]
        dist = km(tour["lat"], tour["lon"], s_lat, s_lon)
        if dist > MAX_KM_SUMMIT:
            raise SystemExit(f"{tour['id']}: '{osm_name}' liegt {dist:.1f} km vom Tourgebiet - falscher Gipfel?")

        # Haltestelle: exakter Name, sonst die naechste Haltestelle zum Ziel
        if stop_name:
            stop_candidates = [f for f in stops if f["properties"].get("name") == stop_name]
        else:
            stop_candidates = [f for f in stops if f["properties"].get("highway") == "bus_stop"]
        stop_candidates.sort(key=lambda f: km(s_lat, s_lon, f["geometry"]["coordinates"][1], f["geometry"]["coordinates"][0]))
        stop = stop_candidates[0]
        t_lon, t_lat = stop["geometry"]["coordinates"]

        summit_ele = ele(summit["properties"])
        old_alt = tour["summitAltitude"]
        tour.update({
            "trailheadStop": stop["properties"]["name"],
            "lat": t_lat,
            "lon": t_lon,
            "summitAltitude": summit_ele or old_alt,
            "ascentMeters": (summit_ele or old_alt) - tour["trailheadAltitude"],
            "summit": {
                "name": osm_name,
                "lat": s_lat,
                "lon": s_lon,
                "ele": summit_ele,
                "osm": summit["properties"].get("osm"),
            },
            "trailheadOsm": stop["properties"].get("osm"),
            "verification": {
                "osm": "Gipfelname, -höhe und -lage sowie die Haltestelle aus OpenStreetMap",
                "estimate": "Hangrichtung, Steilheit und Gehzeiten sind Richtwerte, nicht aus geprüften Quellen",
            },
        })
        print(f"{tour['id']:16} Gipfel {osm_name:20} {summit_ele} m (vorher {old_alt}) | Haltestelle {stop['properties']['name']} "
              f"| Punkt vorher {dist:.1f} km vom Gipfel")
        verified.append(tour)

    TOURS.write_text(json.dumps(verified, ensure_ascii=False, indent=2) + "\n")
    print(f"\n{len(verified)} Touren belegt, entfernt: {', '.join(removed) or 'keine'}")


if __name__ == "__main__":
    main()
