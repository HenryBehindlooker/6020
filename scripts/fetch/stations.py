"""
Holt die Messwerte der automatischen Stationen des Lawinenwarndienstes Tirol.

Schneehoehe, Aenderung der Schneehoehe in 24/48/72 h, Lufttemperatur, Wind
und Boeen - stuendlich aktualisiert, von 221 Stationen in ganz Tirol. Behalten
werden die Stationen rund um Innsbruck; die App zeigt je Tour die naechsten.

Wind kommt in km/h (die Werte sind m/s mal 3,6, etwa 17,28 = 4,8 m/s).
Schneehoehen in cm. HSD24 ist die Aenderung der Schneehoehe, kein Neuschnee:
Setzung und Verfrachtung stecken mit drin.

Schreibt static/stationen/lwd.geojson. Nur Standardbibliothek.
"""
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = "https://wiski.tirol.gv.at/lawine/produkte/ogd.geojson"
OUT = Path("static/stationen")
UA = {"User-Agent": "Bergampel-Innsbruck/0.1 (github.com/HenryBehindlooker/6020; nicht-kommerziell)"}
# Wie der OSM-Abholer, etwas groesser: Sellrain, Kuehtai, Stubai-Eingang, Karwendel
BBOX = (47.02, 10.85, 47.40, 11.70)
KEEP = ["name", "LWD-Nummer", "LWD-Region", "date", "HS", "HSD24", "HSD48", "HSD72",
        "LT", "LT_MAX", "LT_MIN", "WG", "WG_BOE", "WR", "RH", "N24", "N72", "operator", "plot"]


def get(versuche=3):
    for versuch in range(versuche):
        try:
            with urllib.request.urlopen(urllib.request.Request(URL, headers=UA), timeout=60) as res:
                return json.load(res)
        except Exception as err:  # noqa: BLE001
            if versuch == versuche - 1:
                raise
            print(f"Wiederholung ({err})", file=sys.stderr)
            time.sleep(5 * (versuch + 1))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    try:
        doc = get()
    except Exception as err:  # noqa: BLE001
        print(f"Stationen nicht erreichbar ({err}) - der letzte Stand bleibt.")
        return
    features = []
    for f in doc.get("features", []):
        c = f.get("geometry", {}).get("coordinates") or []
        if len(c) < 2 or not (BBOX[0] <= c[1] <= BBOX[2] and BBOX[1] <= c[0] <= BBOX[3]):
            continue
        p = f.get("properties", {})
        props = {k: p[k] for k in KEEP if k in p and p[k] is not None}
        props["ele"] = round(c[2]) if len(c) > 2 and c[2] is not None else None
        features.append({"type": "Feature", "properties": props,
                         "geometry": {"type": "Point", "coordinates": [round(c[0], 5), round(c[1], 5)]}})
    if not features:
        print("Keine Station im Ausschnitt - der letzte Stand bleibt.")
        return
    features.sort(key=lambda f: f["properties"].get("name", ""))
    out = {"type": "FeatureCollection",
           "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "source": "Lawinenwarndienst Tirol, automatische Stationen (wiski.tirol.gv.at, Open Government Data)",
           "features": features}
    (OUT / "lwd.geojson").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(features)} Stationen von {len(doc.get('features', []))} im Ausschnitt")


if __name__ == "__main__":
    main()
