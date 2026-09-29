"""
Ordnet jede Tour der Lawinen-Mikroregion zu, in der ihr Gipfel liegt.

Grenzen: data/lawine/regions-AT-07.geojson (EAWS, regions.avalanches.org).
Die Datei enthaelt auch veraltete Regionszuschnitte (mit end_date) - nur die
heute gueltigen zaehlen. Schreibt das Feld "eawsRegion" in
src/fixtures/tours.json.

Aufruf: python3 scripts/assign_regions.py
"""
import json
from datetime import date
from pathlib import Path

REGIONS = Path("data/lawine/regions-AT-07.geojson")
TOURS = Path("src/fixtures/tours.json")


def valid_today(props, today):
    start, end = props.get("start_date"), props.get("end_date")
    return (start is None or start <= today) and (end is None or end > today)


def in_ring(lon, lat, ring):
    """Strahlverfahren: ungerade Zahl von Kantenkreuzungen = innen."""
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def in_multipolygon(lon, lat, coords):
    for polygon in coords:
        outer, *holes = polygon
        if in_ring(lon, lat, outer) and not any(in_ring(lon, lat, h) for h in holes):
            return True
    return False


def main():
    today = date.today().isoformat()
    regions = [f for f in json.loads(REGIONS.read_text())["features"] if valid_today(f["properties"], today)]
    tours = json.loads(TOURS.read_text())
    print(f"{len(regions)} gueltige Regionen")

    for tour in tours:
        point = tour.get("summit") or {"lat": tour["lat"], "lon": tour["lon"]}
        hits = [f["properties"]["id"] for f in regions
                if in_multipolygon(point["lon"], point["lat"], f["geometry"]["coordinates"])]
        if len(hits) != 1:
            raise SystemExit(f"{tour['id']}: {len(hits)} Regionen getroffen ({hits}) - bitte pruefen")
        tour["eawsRegion"] = hits[0]
        print(f"{tour['id']:16} -> {hits[0]}")

    TOURS.write_text(json.dumps(tours, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
