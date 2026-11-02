# Bergampel Innsbruck

Tagesplaner für Skitouren, Winterwanderungen und Radltouren rund um Innsbruck.
Die App beantwortet eine Frage: **Was geht heute (oder morgen), und wie komme
ich mit dem Bus hin und zurück?**

Sie führt zusammen, was man sonst aus fünf Quellen zusammensucht –
Lawinenlagebericht, Bergwetter, Hangrichtung und Steilheit der Tour, Fahrplan –
und rechnet daraus:

- **eine Ampel pro Tour** (grün / gelb / rot), vollständig aufgeschlüsselt statt als Black Box
- **die späteste Umkehrzeit**, rückwärts gerechnet aus dem letzten Bus ins Tal

Dazu: Karte mit Wegen, Hütten (heute offen? Bargeld?), Seilbahnen und markanten
Punkten, Fotos, Google-Earth-Export, Sonnenuntergang, Radl- und Täler-Seite.

Öffentliche Fassung: <https://henrybehindlooker.github.io/6020/>

## Schnellstart

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # Vitest: Ampel, Umkehrzeit, Tagesplan, Wetter, Öffnungszeiten …
npm run check          # svelte-check (TypeScript)
npm run format         # Prettier
npm run build && npm start   # Node-Server
npm run build:pages          # vorgerenderte Fassung für GitHub Pages
```

Voraussetzungen: Node 22.17 oder neuer. SvelteKit 3, Svelte 5, Vite 8, Leaflet.

## Wie die Daten fließen

```
GitHub Actions (3× täglich)          Repository                    Browser
─────────────────────────────        ─────────────────────         ──────────────────────────
scripts/fetch/avalanche.py   ──►     data/lawine/aktuell.json ─┐
scripts/fetch/weather.py     ──►     data/wetter/prognose.json ├─► /daten/plan.json ─► computeDayPlan()
scripts/fetch/transitous.py  ──►     data/transit/…           ─┘   (vorgerendert)       für heute/morgen,
scripts/fetch/osm.py         ──►     static/osm/*.geojson     ───► Karte                 Aufbruch, Puffer
scripts/fetch/photos.py      ──►     static/photos/photos.json ──► Tour- und Täler-Seite
```

Der Workflow `.github/workflows/fetch-data.yml` läuft um 08:23, 17:23 und
21:23 Uhr (Wiener Winterzeit; GitHub startet geplante Läufe oft deutlich
später), committet die Abzüge nach `main` und baut danach die Pages-Fassung
neu (`pages.yml`, als wiederverwendbarer Workflow aufgerufen). Von Hand: **Actions
→ Echte Daten holen → Run workflow**.

Der Tagesplan ist eine reine Funktion (`src/lib/logic/dayPlan.ts`). Dieselbe
Rechnung läuft beim Vorrendern, auf dem Node-Server und im Browser – darum kann
die statische Seite für den echten heutigen Tag, für morgen und mit eigener
Aufbruchszeit rechnen. Tag, Aufbruch und Puffer stehen in der Adresse
(`?tag=morgen&ab=08:00&puffer=45`).

| Was | Quelle | Datei | Lizenz |
|---|---|---|---|
| Lawinenlagebericht Tirol (CAAMLv6, je Mikroregion) | Lawinenwarndienst Tirol / EAWS, `static.avalanche.report` | `data/lawine/` | offen |
| Mikroregionen (Zuordnung der Touren) | `regions.avalanches.org` | `data/lawine/regions-AT-07.geojson` | offen |
| Bergwetter am Gipfel (AROME 2,5 km, stündlich) | GeoSphere Austria Data Hub | `data/wetter/prognose.json` | CC BY 4.0 |
| Busverbindungen Ausgangspunkt ↔ Innsbruck Hbf | Transitous | `data/transit/connections.json` | offene Fahrplandaten |
| Wege, Skitouren, Rad/MTB, Hütten, Seilbahnen, markante Punkte | OpenStreetMap via Overpass | `static/osm/*.geojson` | ODbL |
| Fotos, Täler | Wikimedia Commons, Wikipedia | `static/photos/photos.json` | je Bild; Texte CC BY-SA |

Keine API-Schlüssel. **Bewusst nicht verwendet:** Komoot, Outdooractive
(auch Alpenvereinaktiv) und Bergfex – ihre Touren sind urheberrechtlich
geschützt.

## Was echt ist und was nicht

Die Seite sagt oben immer, was an den Daten echt ist.

- **Lagebericht:** echt, sobald einer gilt. Ein Bericht gilt ab dem Vorabend
  (17 Uhr) bis 17 Uhr am Tag. **In der Saisonpause** (letzter echter Bericht
  länger als zehn Tage her) zeigt die öffentliche Fassung einen gestempelten
  Beispielbericht, damit man sieht, wie die Ampel rechnet. **In der Saison**
  füllt sie eine Lücke nie mit Beispieldaten – dann steht die Ampel auf
  *Unklar*.
- **Wetter:** echte Prognose; Beispielwerte nur zum Beispielbericht, nie neben
  einem echten.
- **Fahrplan:** echt (Transitous-Abzug für Werktag, Samstag und Wintersamstag,
  auf den Planungstag übertragen). Fährt an dem Tag nichts, gibt es keinen Bus –
  keine erfundenen Zeiten.
- **Richtwerte ohne geprüfte Quelle:** Hangrichtung, Steilheit und Gehzeiten der
  Touren. Gipfel, Höhen und Haltestellen sind gegen OSM abgeglichen
  (`scripts/verify_tours.py`), die Mikroregion ist zugeordnet
  (`scripts/assign_regions.py`).
- **Alter der Daten:** Sind sie älter als 36 Stunden, warnt die Seite.

`DATA_MODE=live` (siehe `.env.example`) schaltet Beispieldaten ganz ab.

## Aufbau

```
src/
├── lib/
│   ├── logic/          reine Funktionen, alle mit Tests
│   │   ├── dayPlan.ts       Tagesplan aus den Eingangsdaten (Server und Browser)
│   │   ├── rating.ts        Ampel
│   │   ├── turnaround.ts    Umkehrzeit aus dem letzten Bus
│   │   ├── weather.ts       Wetter je Planungstag aus der Stundenprognose
│   │   ├── snapshot.ts      Fahrplan-Abzug auf den Planungstag übertragen
│   │   ├── openingHours.ts  OSM-Öffnungszeiten für heute auswerten
│   │   ├── payment.ts       Bargeld-Hinweis aus payment:*
│   │   ├── landmarks.ts     markante Punkte zwischen Haltestelle und Gipfel
│   │   ├── sun.ts           Sonnenuntergang (NOAA)
│   │   ├── kml.ts           Export für Google Earth
│   │   └── time.ts          Wanduhrzeiten in Europe/Vienna
│   ├── planner.svelte.ts    Planung im Browser: Tag, Aufbruch, Puffer, Daten laden
│   ├── components/          TourCard, TourMap (Leaflet), DataNotice, HutInfo …
│   └── server/
│       ├── plan.ts          Eingangsdaten laden (loadPlanInputs)
│       └── sources/         je Quelle eine Datei
├── routes/
│   ├── +page.svelte         Touren mit Ampel, Heit/Morgn
│   ├── karte/  tour/[id]/  radl/  taeler/  methodik/
│   ├── daten/plan.json/     Eingangsdaten für den Browser
│   └── api/plan/            fertiger Tagesplan als JSON
└── service-worker/          offline: App vorab, Daten zuerst aus dem Netz, Kacheln aus dem Cache
scripts/fetch/               die Abholer (Python, nur Standardbibliothek)
```

## Rechenregeln

Ausführlich auf der Seite **Wia grechnet wird** (`/methodik`). Kurz:

- Gefahrenstufe der Mikroregion, höchste zwischen Ausgangspunkt und Gipfel:
  Stufe 3 → gelb, 4 und 5 → rot.
- Lawinenproblem trifft Hangrichtung **und** Höhenband der Tour → hoch, ab
  Stufe 3 rot. Entwarnungen („günstige Situation“) stufen nicht hoch.
- Steilheit: Stufe 2 ab 40° gelb; ab Stufe 3 ab 30° gelb, ab 35° rot.
- Wind (stärkster 07–16 Uhr) ab 40 km/h gelb, ab 60 km/h rot; Neuschnee ab 15 cm
  gelb, ab 30 cm rot. Ohne Wetter vorsorglich hochgestuft.
- Umkehrzeit = letzter Bus − Puffer − Abstiegszeit; dagegen steht die
  rechnerische Gipfelzeit.

Die Ampel wird nur angehoben, nie gesenkt. Sie ist eine Planungshilfe, kein
Sicherheitsurteil: Sie kennt weder die Schneedecke vor Ort noch Gruppe,
Ausrüstung oder Können. Der Originalbericht auf
[lawinen.report](https://lawinen.report) bleibt Pflichtlektüre.

## GitHub Pages einrichten

Einmal im Repository: **Settings → Pages → Source: GitHub Actions**. Danach
veröffentlicht jeder Push auf `main` und jeder Lauf des Abholers die Seite.

Den Zeitplan abschalten: **Actions → Echte Daten holen → ⋯ → Disable workflow**.
GitHub pausiert geplante Läufe auch von selbst, wenn im Repository 60 Tage
lang nichts passiert.

## Offene Punkte

- Das 1-km-Modell von GeoSphere (`nwp-v2-1h-1km`) nutzen; es benennt seine
  Parameter anders (`10u`, `2t`, `sf`), die Beschreibungen legt der Abholer in
  `data/wetter/PROBE.json` ab.
- Echte GPX-Aufzeichnungen (`data/tracks/`); erfundene Verläufe gibt es bewusst
  keine.
- Hangrichtung, Steilheit und Gehzeiten der Touren gegen eine geprüfte Quelle
  abgleichen.
