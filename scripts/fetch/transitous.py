"""
Fragt Verbindungen zwischen den Ausgangspunkten und Innsbruck bei Transitous ab.

Transitous (transitous.org) ist ein gemeinnuetziger, offener Routing-Dienst auf
Basis von MOTIS, der oeffentliche Fahrplaene zusammenfuehrt. Die API ist frei
nutzbar mit fairem Umfang; wir fragen einmal pro Lauf eine Handvoll Strecken ab.

Schreibt data/transit/connections.json und zur Kontrolle eine Rohantwort.
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

OUT = Path("data/transit")
UA = {"User-Agent": "Bergampel-Innsbruck/0.1 (github.com/HenryBehindlooker/6020; nicht-kommerziell)",
      "Accept": "application/json"}
BASES = ["https://api.transitous.org"]
PLAN_PATHS = ["/api/v5/plan", "/api/v4/plan", "/api/v3/plan", "/api/v1/plan"]
VIENNA = ZoneInfo("Europe/Vienna")

# Ziel: Innsbruck zentral (Hauptbahnhof)
INNSBRUCK = (47.2632, 11.4009)

# Ausgangspunkte: Koordinaten der Haltestellen laut OpenStreetMap
# (siehe scripts/verify_tours.py).
TRAILHEADS = {
    "Praxmar Wendestelle": (47.1494, 11.1335),
    "Kühtai Dortmunderhütte": (47.2114, 11.0089),
    "Oberperfuss Rangger Köpfl Lift": (47.2458, 11.2379),
    "Axams Axamer Lizum": (47.1958, 11.303),
    "Patscherkofel": (47.2221, 11.4258),
    "Hungerburg": (47.2862, 11.4002),
    "Theresienkirche": (47.2864, 11.3982),
}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.load(res)


def find_plan_endpoint():
    """MOTIS hat die API-Version mehrfach erhoeht - die erste, die antwortet, gewinnt."""
    probe_time = datetime.now(VIENNA).replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=1)
    for base in BASES:
        for path in PLAN_PATHS:
            url = base + path + "?" + urllib.parse.urlencode({
                "fromPlace": f"{INNSBRUCK[0]},{INNSBRUCK[1]}",
                "toPlace": f"{TRAILHEADS['Patscherkofel'][0]},{TRAILHEADS['Patscherkofel'][1]}",
                "time": probe_time.isoformat(),
            })
            try:
                data = get(url)
                if isinstance(data, dict) and "itineraries" in data:
                    print(f"Endpunkt: {base}{path}")
                    return base + path, data
                print(f"{base}{path}: Antwort ohne itineraries: {str(data)[:200]}")
            except Exception as err:  # noqa: BLE001
                print(f"{base}{path}: {err}", file=sys.stderr)
    return None, None


def itineraries(endpoint, frm, to, when, arrive_by=False):
    params = {
        "fromPlace": f"{frm[0]},{frm[1]}",
        "toPlace": f"{to[0]},{to[1]}",
        "time": when.isoformat(),
        "arriveBy": "true" if arrive_by else "false",
        "searchWindow": str(4 * 3600),
        "numItineraries": "12",
        "maxTransfers": "3",
    }
    data = get(endpoint + "?" + urllib.parse.urlencode(params))
    return data.get("itineraries", []), data


def local_hhmm(iso):
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(VIENNA).strftime("%H:%M")


def simplify_itinerary(it):
    """Fahrten mit Zeiten AM Ausgangspunkt: die Reise beginnt mit dem Fussweg
    zur ersten Haltestelle, nicht mit der Abfahrt dort."""
    legs = []
    walk_start = walk_end = 0
    all_legs = it.get("legs", [])
    for index, leg in enumerate(all_legs):
        mode = leg.get("mode", "")
        if mode in ("WALK", "BIKE", "CAR") and not leg.get("routeShortName"):
            minutes = round((leg.get("duration") or 0) / 60)
            if index == 0:
                walk_start = minutes
            elif index == len(all_legs) - 1:
                walk_end = minutes
            continue
        legs.append({
            "mode": mode,
            "line": leg.get("routeShortName") or leg.get("displayName") or leg.get("route", {}).get("shortName") or "?",
            "agency": leg.get("agencyName") or leg.get("agency", {}).get("name"),
            "from": leg.get("from", {}).get("name"),
            "to": leg.get("to", {}).get("name"),
            "departure": local_hhmm(leg["startTime"]) if leg.get("startTime") else None,
            "arrival": local_hhmm(leg["endTime"]) if leg.get("endTime") else None,
            "headsign": leg.get("headsign"),
        })
    if not legs:
        return None
    return {
        # Gesamtreise: ab Koordinate des Ausgangspunkts bis zum Ziel
        "departure": local_hhmm(it["startTime"]) if it.get("startTime") else legs[0]["departure"],
        "arrival": local_hhmm(it["endTime"]) if it.get("endTime") else legs[-1]["arrival"],
        "walk_to_stop_min": walk_start,
        "walk_from_stop_min": walk_end,
        "transfers": max(0, len(legs) - 1),
        "legs": legs,
    }


def dedupe(items):
    seen, out = set(), []
    for i in sorted(items, key=lambda x: (x["departure"] or "", x["arrival"] or "")):
        key = (i["departure"], i["arrival"], tuple(l["line"] for l in i["legs"]))
        if key not in seen:
            seen.add(key)
            out.append(i)
    return out


def geocode(base, name):
    """Kennt Transitous die Haltestelle? Unterscheidet 'keine Daten' von
    'an diesem Tag faehrt nichts'."""
    for path in ("/api/v1/geocode", "/api/v5/geocode"):
        try:
            data = get(base + path + "?" + urllib.parse.urlencode({"text": name, "type": "STOP"}))
            items = data if isinstance(data, list) else data.get("matches", [])
            return [{"name": m.get("name"), "lat": m.get("lat"), "lon": m.get("lon"), "type": m.get("type")}
                    for m in items[:3]]
        except Exception as err:  # noqa: BLE001
            print(f"geocode {path} {name}: {err}", file=sys.stderr)
    return None


def next_weekday(weekday):
    today = date.today()
    return today + timedelta(days=(weekday - today.weekday()) % 7 or 7)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    endpoint, raw = find_plan_endpoint()
    result = {"fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
              "source": "Transitous (transitous.org), MOTIS", "endpoint": endpoint,
              "destination": "Innsbruck Hauptbahnhof", "days": {}}
    if not endpoint:
        result["error"] = "Kein Transitous-Endpunkt erreichbar"
        (OUT / "connections.json").write_text(json.dumps(result, ensure_ascii=False, indent=1))
        print("Transitous nicht erreichbar.")
        return
    (OUT / "raw-sample.json").write_text(json.dumps(raw, ensure_ascii=False, indent=1)[:200_000])

    base = endpoint.split("/api/")[0]
    result["stops_known"] = {}
    for key in TRAILHEADS:
        result["stops_known"][key] = geocode(base, key)
        print(f"geocode {key:32} -> {[m['name'] for m in (result['stops_known'][key] or [])]}")
        time.sleep(1)

    # Ein Samstag Anfang Dezember: Wintersaison in Kuehtai und der Axamer Lizum,
    # aber noch im laufenden Fahrplanjahr.
    days = [("samstag", next_weekday(5)), ("werktag", next_weekday(2))]
    winter = date(date.today().year, 12, 5)
    while winter.weekday() != 5:
        winter += timedelta(days=1)
    if winter > date.today():
        days.append(("winter_samstag", winter))

    for label, day in days:
        result["days"][label] = {"date": day.isoformat(), "trailheads": {}}
        for key, coords in TRAILHEADS.items():
            entry = {"outbound": [], "inbound": [], "errors": []}
            # Hinfahrten am Morgen, Rueckfahrten am Nachmittag und Abend
            for frm, to, start_h, bucket in ((INNSBRUCK, coords, 5, "outbound"), (INNSBRUCK, coords, 9, "outbound"),
                                              (coords, INNSBRUCK, 12, "inbound"), (coords, INNSBRUCK, 16, "inbound")):
                when = datetime(day.year, day.month, day.day, start_h, 0, tzinfo=VIENNA)
                try:
                    its, _ = itineraries(endpoint, frm, to, when)
                    entry[bucket].extend(filter(None, (simplify_itinerary(i) for i in its)))
                except Exception as err:  # noqa: BLE001
                    entry["errors"].append(f"{bucket} {start_h}h: {err}")
                time.sleep(1.5)  # fair use
            entry["outbound"] = dedupe(entry["outbound"])
            entry["inbound"] = dedupe(entry["inbound"])
            result["days"][label]["trailheads"][key] = entry
            print(f"{label} {day} {key:28} hin {len(entry['outbound']):2}  zurueck {len(entry['inbound']):2}"
                  + (f"  Fehler: {entry['errors'][:1]}" if entry["errors"] else ""))

    (OUT / "connections.json").write_text(json.dumps(result, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
