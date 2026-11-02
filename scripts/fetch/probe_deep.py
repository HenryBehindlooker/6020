"""
Prueft weitere frei nutzbare Schnittstellen im Detail - nicht nur, ob sie
antworten, sondern was drinsteht und ob es fuer die Touren rund um Innsbruck
taugt: Messstationen in der Naehe, Reichweite der Prognosen, Kartenebenen,
Warnungen, Feiertage, Lawinenereignisse.

Schreibt data/probe/tiefe.json. Nur offene Endpunkte ohne Schluessel.
Laeuft auf dem GitHub-Runner; nur Standardbibliothek.
"""
import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

OUT = Path("data/probe")
TOURS = json.loads(Path("src/fixtures/tours.json").read_text())
UA = {"User-Agent": "Bergampel-Innsbruck/0.1 (github.com/HenryBehindlooker/6020; nicht-kommerziell)",
      "Accept": "application/json, */*"}
IBK = (47.2654, 11.3928)
PUNKTE = [(t["id"], (t.get("summit") or t)["lat"], (t.get("summit") or t)["lon"]) for t in TOURS]


def get(url, binary=False, limit=3_000_000, timeout=40):
    req = urllib.request.Request(url, headers=UA)
    started = time.time()
    with urllib.request.urlopen(req, timeout=timeout) as res:
        body = res.read(limit)
        meta = {"status": res.status, "content_type": res.headers.get("Content-Type", ""),
                "ms": int((time.time() - started) * 1000), "bytes": len(body)}
        return (body if binary else body.decode("utf-8", "replace")), meta


def get_json(url, **kw):
    text, meta = get(url, **kw)
    return json.loads(text), meta


def km(lat1, lon1, lat2, lon2):
    dy = (lat2 - lat1) * 111.2
    dx = (lon2 - lon1) * 111.2 * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot(dx, dy)


def naechste_tour(lat, lon):
    best = min(PUNKTE, key=lambda p: km(lat, lon, p[1], p[2]))
    return best[0], round(km(lat, lon, best[1], best[2]), 1)


def kurz(value, n=300):
    return json.dumps(value, ensure_ascii=False)[:n]


# --- Messstationen ---------------------------------------------------------

def lwd_stationen():
    """Lawinenwarndienst Tirol: automatische Stationen (OGD, CC BY 4.0)."""
    doc, meta = get_json("https://wiski.tirol.gv.at/lawine/produkte/ogd.geojson")
    feats = doc.get("features", [])
    nah = []
    for f in feats:
        c = f.get("geometry", {}).get("coordinates", [None, None, None])
        if c[0] is None:
            continue
        tour, dist = naechste_tour(c[1], c[0])
        if dist <= 8:
            p = f.get("properties", {})
            nah.append({"name": p.get("name"), "hoehe": c[2] if len(c) > 2 else p.get("altitude"),
                        "naechste_tour": tour, "km": dist,
                        "werte": {k: v for k, v in p.items() if not isinstance(v, (dict, list))}})
    nah.sort(key=lambda s: s["km"])
    alle_keys = sorted({k for f in feats for k in f.get("properties", {})})
    return {**meta, "stationen_gesamt": len(feats), "property_keys": alle_keys,
            "nahe_stationen": nah[:25]}


def albina_stationen():
    doc, meta = get_json("https://static.avalanche.report/weather_stations/stations.geojson")
    feats = doc.get("features", [])
    nah = []
    for f in feats:
        c = f.get("geometry", {}).get("coordinates", [None, None])
        if c[0] is None:
            continue
        tour, dist = naechste_tour(c[1], c[0])
        if dist <= 8:
            p = f.get("properties", {})
            nah.append({"name": p.get("name"), "naechste_tour": tour, "km": dist,
                        "werte": {k: v for k, v in p.items() if not isinstance(v, (dict, list))}})
    nah.sort(key=lambda s: s["km"])
    return {**meta, "stationen_gesamt": len(feats), "nahe_stationen": nah[:10]}


# --- GeoSphere Austria -------------------------------------------------------

GS = "https://dataset.api.hub.geosphere.at/v1"


def geosphere_datensaetze():
    doc, meta = get_json(f"{GS}/datasets")
    return {**meta, "datensaetze": sorted(doc.keys()) if isinstance(doc, dict) else doc}


def geosphere_metadaten(pfad):
    doc, meta = get_json(f"{GS}/{pfad}/metadata")
    params = doc.get("parameters", [])
    out = {**meta, "keys": sorted(doc.keys()),
           "parameter": [{k: p.get(k) for k in ("name", "long_name", "desc", "unit")} for p in params][:80]}
    for k in ("forecast_length", "freq", "frequency", "type", "mode", "response_formats", "start_time", "end_time"):
        if k in doc:
            out[k] = doc[k]
    stationen = doc.get("stations")
    if stationen:
        nah = []
        for s in stationen:
            lat, lon = s.get("lat"), s.get("lon")
            if lat is None:
                continue
            tour, dist = naechste_tour(lat, lon)
            if dist <= 15 or km(lat, lon, *IBK) <= 10:
                nah.append({"id": s.get("id"), "name": s.get("name"), "hoehe": s.get("altitude"),
                            "aktiv": s.get("is_active"), "naechste_tour": tour, "km": dist})
        out["stationen_gesamt"] = len(stationen)
        out["nahe_stationen"] = sorted(nah, key=lambda s: s["km"])[:20]
    return out


def geosphere_tawes(meta_ergebnis):
    """Aktuelle Messwerte der nahen TAWES-Stationen."""
    ids = [s["id"] for s in meta_ergebnis.get("nahe_stationen", []) if s.get("aktiv") is not False][:8]
    if not ids:
        return {"hinweis": "keine nahe Station gefunden"}
    namen = [p["name"] for p in meta_ergebnis.get("parameter", [])]
    wunsch = [p for p in ("TL", "FF", "FFX", "DD", "SCHNEE", "RR", "SO", "TP", "RF") if p in namen]
    q = [("parameters", p) for p in wunsch] + [("station_ids", i) for i in ids] + [("output_format", "geojson")]
    doc, meta = get_json(f"{GS}/station/current/tawes-v1-10min?{urllib.parse.urlencode(q)}")
    werte = []
    for f in doc.get("features", []):
        p = f.get("properties", {})
        werte.append({"station": p.get("station"),
                      "werte": {k: (v.get("data") or [None])[-1] for k, v in p.get("parameters", {}).items()},
                      "einheiten": {k: v.get("unit") for k, v in p.get("parameters", {}).items()}})
    return {**meta, "zeit": doc.get("timestamps", [None])[-1], "parameter": wunsch, "stationen": werte}


def geosphere_nwp_v2_probe():
    """1-km-Modell an einem Gipfel: wie sind sf, tp und 10fg gemeint?"""
    tid, lat, lon = PUNKTE[0]
    q = [("parameters", p) for p in ("2t", "10u", "10v", "10fg", "sf", "tp", "snowlmt", "tcc")]
    q += [("lat_lon", f"{lat},{lon}"), ("output_format", "geojson")]
    doc, meta = get_json(f"{GS}/timeseries/forecast/nwp-v2-1h-1km?{urllib.parse.urlencode(q)}")
    ts = doc.get("timestamps", [])
    params = doc.get("features", [{}])[0].get("properties", {}).get("parameters", {})
    reihe = {k: {"name": v.get("name"), "unit": v.get("unit"), "erste_12": (v.get("data") or [])[:12],
                 "monoton_steigend": all(b >= a for a, b in zip(v.get("data") or [], (v.get("data") or [])[1:])
                                         if a is not None and b is not None)}
             for k, v in params.items()}
    return {**meta, "tour": tid, "reference_time": doc.get("reference_time"), "schritte": len(ts),
            "von": ts[:1], "bis": ts[-1:], "reihen": reihe}


def geosphere_nowcast():
    q = [("parameters", p) for p in ("rr", "t2m", "ff", "pt")] + [("lat_lon", f"{IBK[0]},{IBK[1]}"),
                                                                 ("output_format", "geojson")]
    try:
        doc, meta = get_json(f"{GS}/timeseries/forecast/nowcast-v1-15min-1km?{urllib.parse.urlencode(q)}")
    except Exception as err:  # noqa: BLE001 - Parameternamen unbekannt
        return {"fehler": str(err)[:200]}
    ts = doc.get("timestamps", [])
    params = doc.get("features", [{}])[0].get("properties", {}).get("parameters", {})
    return {**meta, "schritte": len(ts), "von": ts[:1], "bis": ts[-1:],
            "parameter": {k: v.get("unit") for k, v in params.items()}}


def geosphere_warnungen():
    """Amtliche Wetterwarnungen (Wind, Schnee, Glatteis, Gewitter) je Ort."""
    out = {}
    for tid, lat, lon in PUNKTE[:4]:
        url = f"https://warnungen.zamg.at/wsapp/api/getWarningsForCoords?lon={lon}&lat={lat}&lang=de"
        doc, meta = get_json(url)
        out[tid] = {**meta, "struktur": kurz(doc, 600)}
        time.sleep(1)
    return out


# --- Weitere Prognosen -------------------------------------------------------

def open_meteo():
    """Mehrere Modelle, 7 Tage, Hoehenkorrektur und Nullgradgrenze."""
    tid, lat, lon = PUNKTE[0]
    ele = next(t for t in TOURS if t["id"] == tid)["summitAltitude"]
    url = ("https://api.open-meteo.com/v1/forecast?"
           f"latitude={lat}&longitude={lon}&elevation={ele}"
           "&hourly=temperature_2m,snowfall,wind_speed_10m,wind_gusts_10m,freezing_level_height,"
           "wind_speed_700hPa,wind_direction_700hPa,cloud_cover,visibility"
           "&daily=sunrise,sunset,snowfall_sum,wind_speed_10m_max"
           "&models=icon_d2,icon_eu,ecmwf_ifs025,best_match&forecast_days=7&timezone=Europe%2FVienna")
    doc, meta = get_json(url)
    hourly = doc.get("hourly", {})
    reichweite = {}
    for k, v in hourly.items():
        if k == "time" or not isinstance(v, list):
            continue
        letzte = max((i for i, x in enumerate(v) if x is not None), default=-1)
        reichweite[k] = hourly["time"][letzte] if letzte >= 0 else None
    return {**meta, "tour": tid, "modell_hoehe": doc.get("elevation"), "keys": list(hourly.keys())[:60],
            "letzter_wert_je_reihe": dict(list(reichweite.items())[:40]),
            "daily": kurz(doc.get("daily"), 500)}


def open_meteo_ensemble():
    tid, lat, lon = PUNKTE[0]
    url = (f"https://ensemble-api.open-meteo.com/v1/ensemble?latitude={lat}&longitude={lon}"
           "&hourly=snowfall,wind_speed_10m&models=icon_seamless&forecast_days=3")
    doc, meta = get_json(url)
    return {**meta, "anzahl_reihen": len(doc.get("hourly", {})), "keys": list(doc.get("hourly", {}).keys())[:8]}


# --- Lawinenereignisse und Schneeprofile ------------------------------------

def lawis():
    """LAWIS (Lawinenwarndienste Tirol, Salzburg, Kaernten ...): Ereignisse, Schneeprofile."""
    heute = date.today()
    vor = heute - timedelta(days=200)
    out = {}
    kandidaten = {
        "ereignisse_v2_2": f"https://lawis.at/lawis_api/v2_2/incident/?startDate={vor}&endDate={heute}",
        "profile_v2_2": f"https://lawis.at/lawis_api/v2_2/profile/?startDate={vor}&endDate={heute}",
        "ereignisse_public": f"https://lawis.at/lawis_api/public/incident?startDate={vor}&endDate={heute}",
        "profile_public": f"https://lawis.at/lawis_api/public/profile?startDate={vor}&endDate={heute}",
    }
    for name, url in kandidaten.items():
        try:
            doc, meta = get_json(url)
            eintraege = doc if isinstance(doc, list) else doc.get("data") or doc.get("items") or []
            beispiel = eintraege[0] if eintraege else None
            out[name] = {**meta, "anzahl": len(eintraege), "beispiel": kurz(beispiel, 700)}
        except Exception as err:  # noqa: BLE001
            out[name] = {"fehler": str(err)[:200]}
        time.sleep(1)
    return out


# --- Karten ------------------------------------------------------------------

def tiris_wms():
    """Land Tirol: Gelaende-WMS - welche Ebenen gibt es (Hangneigung, Schummerung)?"""
    text, meta = get("https://gis.tirol.gv.at/arcgis/services/Service_Public/terrain/MapServer/WMSServer?"
                     "request=GetCapabilities&service=WMS")
    names = re.findall(r"<Layer[^>]*>\s*<Name>([^<]+)</Name>\s*<Title>([^<]*)</Title>", text)
    lizenz = re.findall(r"<(AccessConstraints|Fees)>([^<]*)<", text)
    return {**meta, "ebenen": [{"name": n, "titel": t} for n, t in names][:60], "lizenz": lizenz[:4]}


def tiris_dienste():
    """Weitere oeffentliche Kartendienste des Landes (Lawinen, Gefahrenzonen ...)."""
    doc, meta = get_json("https://gis.tirol.gv.at/arcgis/rest/services/Service_Public?f=json")
    return {**meta, "dienste": [s.get("name") for s in doc.get("services", [])][:80],
            "ordner": doc.get("folders")}


# --- Sonstiges ---------------------------------------------------------------

def feiertage():
    """Oesterreichische Feiertage - an Feiertagen fahren Busse nach Sonntagsfahrplan."""
    doc, meta = get_json(f"https://date.nager.at/api/v3/PublicHolidays/{date.today().year}/AT")
    return {**meta, "feiertage": [(d.get("date"), d.get("localName"), d.get("counties")) for d in doc]}


def webcams():
    """foto-webcam.eu: Kameras in der Naehe der Touren (nur Verlinken, Bildrechte beim Betreiber)."""
    doc, meta = get_json("https://www.foto-webcam.eu/webcam/include/metadata.php")
    cams = doc.get("cams", doc if isinstance(doc, list) else [])
    nah = []
    for c in cams:
        try:
            lat, lon = float(c.get("latitude")), float(c.get("longitude"))
        except (TypeError, ValueError):
            continue
        tour, dist = naechste_tour(lat, lon)
        if dist <= 10:
            nah.append({"id": c.get("id"), "name": c.get("name") or c.get("title"), "hoehe": c.get("elevation"),
                        "naechste_tour": tour, "km": dist, "link": c.get("link")})
    return {**meta, "kameras_gesamt": len(cams), "keys": list(cams[0].keys())[:30] if cams else [],
            "nahe": sorted(nah, key=lambda c: c["km"])[:20]}


def transitous_echtzeit():
    """Hat der Transitous-Abzug Echtzeit fuer die Tiroler Busse?"""
    try:
        raw = json.loads(Path("data/transit/raw-sample.json").read_text())
    except (OSError, ValueError):
        return {"hinweis": "kein raw-sample.json"}
    text = json.dumps(raw)
    return {"realTime_true": text.count('"realTime": true'), "realTime_false": text.count('"realTime": false'),
            "keys_leg": sorted(set(re.findall(r'"(\w+)":', text)))[:80]}


def vvt_efa():
    """VVT-Fahrplanauskunft (EFA): Abfahrtsmonitor - offen abfragbar?"""
    out = {}
    halt = urllib.parse.quote("Innsbruck Hauptbahnhof")
    for name, url in {
        "efa_vvt_rapidjson": f"https://efa.vvt.at/vvtadr/XML_DM_REQUEST?outputFormat=rapidJSON&type_dm=stop&name_dm={halt}&mode=direct",
        "efa_vvt_json": f"https://efa.vvt.at/vvt/XML_DM_REQUEST?outputFormat=JSON&type_dm=stop&name_dm={halt}&mode=direct",
        "smartinfo_ivb": "https://smartinfo.ivb.at/",
    }.items():
        try:
            text, meta = get(url, limit=200_000)
            out[name] = {**meta, "anfang": text[:300]}
        except Exception as err:  # noqa: BLE001
            out[name] = {"fehler": str(err)[:200]}
    return out


def hoehenmodell():
    """Open-Meteo-Hoehen (Copernicus 90 m) fuer die Gipfel - Plausibilitaet der Gitterpunkte."""
    lats = ",".join(str(p[1]) for p in PUNKTE)
    lons = ",".join(str(p[2]) for p in PUNKTE)
    doc, meta = get_json(f"https://api.open-meteo.com/v1/elevation?latitude={lats}&longitude={lons}")
    return {**meta, "hoehen": dict(zip([p[0] for p in PUNKTE], doc.get("elevation", [])))}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    ergebnis = {"checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "pruefungen": {}}
    schritte = [
        ("lwd_stationen", lwd_stationen),
        ("albina_stationen", albina_stationen),
        ("geosphere_datensaetze", geosphere_datensaetze),
        ("geosphere_tawes_meta", lambda: geosphere_metadaten("station/current/tawes-v1-10min")),
        ("geosphere_nwp_v2_meta", lambda: geosphere_metadaten("timeseries/forecast/nwp-v2-1h-1km")),
        ("geosphere_nwp_v2_probe", geosphere_nwp_v2_probe),
        ("geosphere_nowcast_meta", lambda: geosphere_metadaten("timeseries/forecast/nowcast-v1-15min-1km")),
        ("geosphere_nowcast", geosphere_nowcast),
        ("geosphere_warnungen", geosphere_warnungen),
        ("open_meteo", open_meteo),
        ("open_meteo_ensemble", open_meteo_ensemble),
        ("hoehenmodell", hoehenmodell),
        ("lawis", lawis),
        ("tiris_wms", tiris_wms),
        ("tiris_dienste", tiris_dienste),
        ("feiertage", feiertage),
        ("webcams", webcams),
        ("transitous_echtzeit", transitous_echtzeit),
        ("vvt_efa", vvt_efa),
    ]
    for name, fn in schritte:
        try:
            ergebnis["pruefungen"][name] = {"ok": True, **fn()}
            print(f"OK   {name}")
        except Exception as err:  # noqa: BLE001
            ergebnis["pruefungen"][name] = {"ok": False, "fehler": str(err)[:300]}
            print(f"NEIN {name}: {err}", file=sys.stderr)
        if name == "geosphere_tawes_meta" and ergebnis["pruefungen"][name].get("ok"):
            try:
                ergebnis["pruefungen"]["geosphere_tawes_werte"] = {"ok": True,
                                                                   **geosphere_tawes(ergebnis["pruefungen"][name])}
            except Exception as err:  # noqa: BLE001
                ergebnis["pruefungen"]["geosphere_tawes_werte"] = {"ok": False, "fehler": str(err)[:300]}
        time.sleep(1)
    (OUT / "tiefe.json").write_text(json.dumps(ergebnis, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
