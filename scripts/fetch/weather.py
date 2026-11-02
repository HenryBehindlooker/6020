"""
Holt die Bergwetter-Prognose von GeoSphere Austria (Open Data, ohne Schluessel).

Fuer jeden Gipfel der Tourenliste die stuendliche AROME-Prognose: Wind,
Boeen, Temperatur, Bewoelkung und aufsummierter Schnee. Bevorzugt das
1-km-Modell (nwp-v2), sonst das 2,5-km-Modell (nwp-v1). Die Auswertung je Tag
macht die App (src/lib/logic/weather.ts) - hier wird nur gesammelt.

Schreibt:
- data/wetter/prognose.json  Zeitreihen je Tour, gerundet
- data/wetter/PROBE.json     Datensatz, verfuegbare Parameter, Rohprobe

Lizenz der Daten: GeoSphere Austria, CC BY 4.0. Nur Standardbibliothek.
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://dataset.api.hub.geosphere.at/v1"
DATASETS = ["timeseries/forecast/nwp-v2-1h-1km", "timeseries/forecast/nwp-v1-1h-2500m"]
TOURS = Path("src/fixtures/tours.json")
OUT = Path("data/wetter")
UA = {"User-Agent": "Bergampel-Innsbruck/0.1 (github.com/HenryBehindlooker/6020; nicht-kommerziell)",
      "Accept": "application/json"}

# Gewuenschte Parameter; genommen wird, was der Datensatz laut Metadaten kennt.
# snow_acc ist seit Modellstart aufsummiert (kg/m2 = mm Wasserwert).
WANTED = ["t2m", "u10m", "v10m", "ugust", "vgust", "snow_acc", "tcc", "rr_acc", "rain_acc", "snowlmt", "sy"]


def get_json(url, versuche=3):
    for versuch in range(versuche):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as res:
                return json.load(res)
        except Exception as err:  # noqa: BLE001
            if versuch == versuche - 1:
                raise
            print(f"  Wiederholung ({err})", file=sys.stderr)
            time.sleep(5 * (versuch + 1))


def available_parameters(dataset):
    meta = get_json(f"{BASE}/{dataset}/metadata")
    params = meta.get("parameters", [])
    names = [p.get("name") for p in params if isinstance(p, dict)]
    units = {p.get("name"): p.get("unit") for p in params if isinstance(p, dict)}
    return names, units, meta, params


def rnd(value):
    return None if value is None else round(float(value), 1)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    tours = json.loads(TOURS.read_text())
    points = []
    for tour in tours:
        s = tour.get("summit") or {"lat": tour["lat"], "lon": tour["lon"], "ele": tour.get("summitAltitude")}
        points.append((tour["id"], s["lat"], s["lon"], s.get("ele") or tour.get("summitAltitude")))

    probe = {"fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "versuche": []}
    result = None
    for dataset in DATASETS:
        try:
            names, units, meta, details = available_parameters(dataset)
            params = [p for p in WANTED if p in names]
            # Mit Beschreibung und Einheit - das 1-km-Modell benennt anders (10u, 2t, sf ...)
            probe["versuche"].append({"dataset": dataset, "parameters_all": names, "parameters_used": params,
                                      "parameters_detail": details, "meta_keys": sorted(meta.keys())})
            if not {"u10m", "v10m", "t2m"} <= set(params):
                print(f"{dataset}: Wind oder Temperatur fehlen - naechster Datensatz")
                continue
            query = [("parameters", p) for p in params]
            query += [("lat_lon", f"{lat},{lon}") for _, lat, lon, _ in points]
            query += [("output_format", "geojson")]
            raw = get_json(f"{BASE}/{dataset}?{urllib.parse.urlencode(query)}")
            features = raw.get("features", [])
            if len(features) != len(points):
                raise RuntimeError(f"{len(features)} Antworten fuer {len(points)} Punkte")
            # Eine Rohprobe fuer den Parser-Test
            probe["raw_sample"] = {k: raw[k] for k in raw if k != "features"}
            probe["raw_sample"]["feature0"] = features[0]
            result = {
                "fetched_at": probe["fetched_at"],
                "source": "GeoSphere Austria, AROME " + ("1 km" if "1km" in dataset else "2,5 km") + " (Open Data, CC BY 4.0)",
                "dataset": dataset,
                "reference_time": raw.get("reference_time"),
                "timestamps": raw.get("timestamps", []),
                "units": {p: units.get(p) for p in params},
                "points": {},
            }
            for (tid, lat, lon, ele), feature in zip(points, features):
                series = feature.get("properties", {}).get("parameters", {})
                coords = feature.get("geometry", {}).get("coordinates")
                result["points"][tid] = {
                    "lat": lat, "lon": lon, "ele": ele,
                    "gridLonLat": coords,
                    "series": {p: [rnd(v) for v in series.get(p, {}).get("data", [])] for p in params},
                }
            print(f"{dataset}: {len(points)} Gipfel, {len(result['timestamps'])} Zeitschritte ab {result['reference_time']}")
            break
        except Exception as err:  # noqa: BLE001
            probe["versuche"].append({"dataset": dataset, "error": str(err)})
            print(f"{dataset}: {err}", file=sys.stderr)

    (OUT / "PROBE.json").write_text(json.dumps(probe, ensure_ascii=False, indent=1))
    if result is None:
        print("Keine Prognose geholt - der letzte Stand bleibt.")
        return
    (OUT / "prognose.json").write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
