"""
Prueft, welche frei nutzbaren Schnittstellen fuer die App tatsaechlich
antworten. Laeuft auf dem GitHub-Runner und schreibt data/probe/apis.json.

Nur offene Endpunkte ohne Schluessel. Schluessel, die andere versehentlich
veroeffentlicht haben, werden bewusst nicht verwendet.
"""
import json
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

OUT = Path("data/probe")
UA = {"User-Agent": "Bergampel-Innsbruck/0.1 (github.com/HenryBehindlooker/6020; nicht-kommerziell)"}
IBK = (47.2654, 11.3928)
today = date.today()

CANDIDATES = [
    # Lawinen
    ("lawine_verzeichnis", "Lawinenlagebericht: Verzeichnis der EAWS-Bulletins",
     "https://static.avalanche.report/eaws_bulletins/"),
    ("lawine_letzte_saison", "Lawinenlagebericht: Tagesordner (Beispiel Winter)",
     "https://static.avalanche.report/eaws_bulletins/2026-02-14/"),
    ("lawine_regionen", "EAWS-Regionen (Geodaten der Warnregionen)",
     "https://regions.avalanches.org/"),
    # Messstationen
    ("lwd_stationen_ogd", "LWD Tirol Wetterstationen (OGD GeoJSON)",
     "https://wiski.tirol.gv.at/lawine/produkte/ogd.geojson"),
    ("albina_stationen", "avalanche.report Wetterstationen",
     "https://static.avalanche.report/weather_stations/stations.geojson"),
    # Wetter
    ("geosphere_nwp", "GeoSphere Austria, AROME-Prognose (ohne Schluessel)",
     f"https://dataset.api.hub.geosphere.at/v1/timeseries/forecast/nwp-v1-1h-2500m?parameters=t2m&parameters=u10m&parameters=v10m&lat_lon={IBK[0]},{IBK[1]}&output_format=geojson"),
    ("geosphere_metadaten", "GeoSphere Austria, Liste der Datensaetze",
     "https://dataset.api.hub.geosphere.at/v1/datasets"),
    ("open_meteo", "Open-Meteo (nicht-kommerziell, ohne Schluessel)",
     f"https://api.open-meteo.com/v1/forecast?latitude=47.1921&longitude=11.3247&elevation=2404&hourly=temperature_2m,snowfall,wind_speed_10m,wind_gusts_10m,freezing_level_height&forecast_days=2&timezone=Europe%2FVienna"),
    # Karten
    ("tiris_gelaende_wms", "Land Tirol: Gelaende-WMS (Hangneigung)",
     "https://gis.tirol.gv.at/arcgis/services/Service_Public/terrain/MapServer/WMSServer?request=GetCapabilities&service=WMS"),
    ("opentopomap_kachel", "OpenTopoMap-Kachel (Hoehenlinien, Schattierung)",
     "https://a.tile.opentopomap.org/12/2177/1435.png"),
    ("basemap_at_kachel", "basemap.at-Kachel (amtliche Karte Oesterreich)",
     "https://mapsneu.wien.gv.at/basemap/bmapgrau/normal/google3857/12/1435/2177.png"),
    ("basemap_at_gelaende", "basemap.at Gelaendeschummerung",
     "https://mapsneu.wien.gv.at/basemap/bmapgelaende/grau/google3857/12/1435/2177.jpeg"),
    ("openslopemap", "OpenSlopeMap (Hangneigung aus OSM)",
     "https://www.openslopemap.org/"),
    # Webcams
    ("webcam_seegrube", "foto-webcam.eu Seegrube (Einbinden mit Link erlaubt)",
     "https://www.foto-webcam.eu/webcam/innsbruck/current/400.jpg"),
    # Fahrplan
    ("transitous", "Transitous (bereits im Einsatz)",
     f"https://api.transitous.org/api/v1/geocode?text=Praxmar"),
]


def probe(url):
    req = urllib.request.Request(url, headers=UA)
    started = datetime.now()
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            body = res.read(400_000)
            ms = int((datetime.now() - started).total_seconds() * 1000)
            ctype = res.headers.get("Content-Type", "")
            sample = None
            if "json" in ctype or url.endswith(".geojson") or body[:1] in (b"{", b"["):
                try:
                    data = json.loads(body)
                    if isinstance(data, dict):
                        sample = {"keys": list(data.keys())[:15]}
                        if "features" in data:
                            sample["features"] = len(data["features"])
                            if data["features"]:
                                sample["first_properties"] = list(data["features"][0].get("properties", {}).keys())[:25]
                    elif isinstance(data, list):
                        sample = {"items": len(data), "first": str(data[0])[:300] if data else None}
                except ValueError:
                    sample = {"text": body[:300].decode("utf-8", "replace")}
            elif "text" in ctype or "xml" in ctype:
                sample = {"text": body[:1500].decode("utf-8", "replace")}
            else:
                sample = {"bytes": len(body)}
            return {"ok": True, "status": res.status, "content_type": ctype, "ms": ms, "sample": sample}
    except Exception as err:  # noqa: BLE001
        return {"ok": False, "error": str(err)[:300]}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    results = {"checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "apis": {}}
    for key, label, url in CANDIDATES:
        r = probe(url)
        results["apis"][key] = {"label": label, "url": url, **r}
        print(f"{'OK ' if r['ok'] else 'NEIN'} {key:24} {r.get('status', '')} {r.get('content_type', r.get('error', ''))[:60]}")
    (OUT / "apis.json").write_text(json.dumps(results, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
