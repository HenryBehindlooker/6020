# Bergampel Innsbruck

Tagesplaner für Skitouren und Winterwanderungen rund um Innsbruck. Die App
beantwortet eine einzige Frage: **Was geht heute, und wie komme ich hin und
zurück?**

Sie führt zusammen, was man sonst aus fünf Quellen zusammensucht — Lawinen­lage­bericht,
Bergwetter, Hangrichtung und Steilheit der Tour, Fahrplan — und rechnet daraus
zwei Dinge aus:

- **eine Ampel pro Tour** (grün / gelb / rot), vollständig aufgeschlüsselt statt als Black Box
- **die späteste Umkehrzeit**, rückwärts gerechnet aus dem letzten Bus ins Tal

Das zweite ist der eigentliche Grund für die App: Wer in Praxmar oder Kühtai den
letzten Bus verpasst, steht.

## Schnellstart

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Tests für Ampel, Umkehrzeit, Karte, GPX, Fahrplan und OSM-Popups
npm run build && npm start     # Node-Server, rechnet pro Anfrage
npm run build:pages            # vorgerenderte Demo-Fassung für GitHub Pages
```

Ohne Konfiguration startet die App im **Demo-Modus**: Lagebericht, Wetter und
Fahrplan kommen aus mitgelieferten Beispieldateien, und ein Banner weist darauf
hin.

Die Demo-Linien heißen **„Demo A/B/C"** statt 4166, J oder R. Das ist
Absicht: mit echten Liniennummern sah der erfundene Fahrplan wie eine Auskunft
aus. Echte Linien und Zeiten kommen ausschließlich aus dem GTFS-Datensatz des
VVT im Live-Modus — nichts in diesem Repository ist gegen VVT, ÖBB oder IVB
geprüft.

## Echte Daten und woher sie kommen

Aus der Entwicklungsumgebung sind die meisten Datenquellen nicht erreichbar,
auf dem GitHub-Runner schon. `.github/workflows/fetch-data.yml` holt die Daten
dort und committet sie zurück; neu auslösen über **Actions → Echte Daten holen →
Run workflow**.

| Was | Quelle | Datei | Lizenz |
|---|---|---|---|
| Gipfel, Haltestellen, Wanderwege, Skitouren-Aufstiege, Hütten und Einkehr, Seilbahnen | OpenStreetMap via Overpass (`scripts/fetch/osm.py`) | `static/osm/*.geojson` | ODbL, © OpenStreetMap-Mitwirkende |
| Busverbindungen Ausgangspunkt ↔ Innsbruck Hbf | Transitous (`scripts/fetch/transitous.py`) | `data/transit/connections.json` | offene Fahrplandaten, fair use |
| Suche nach offenen GTFS-Feeds | Mobility Database (`scripts/fetch/gtfs.py`) | `data/gtfs/PROBE.json` | — |

**Touren abgleichen:** `python3 scripts/verify_tours.py` prüft Gipfelname, -höhe
und -lage sowie die Haltestelle jeder Tour gegen OSM und schreibt
`src/fixtures/tours.json` neu. Hangrichtung, Steilheit und Gehzeiten gibt OSM
nicht her; sie bleiben Richtwerte und die Tourenseite sagt das.

**Bewusst nicht verwendet:** Komoot, Outdooractive (auch Alpenvereinaktiv) und
Bergfex. Ihre Touren sind urheberrechtlich geschützt, Outdooractive verlangt eine
kostenpflichtige API-Lizenz. In einem öffentlichen Repository wäre ein Kopieren
ein Lizenzverstoß. Die Alpenverein-Hütten und viele Wege sind ohnehin in OSM
eingetragen — oft von den Sektionen selbst.

**Fahrplan:** Die GTFS-Daten des VVT gibt es kostenlos, aber nur mit Login
(data.mobilitaetsverbuende.at). Transitous bindet die österreichischen Fahrpläne
ein und ist offen abfragbar; der Abzug gilt für die abgefragten Beispieltage und
wird auf den Planungstag übertragen. Kennt Transitous an einem Tag keine Fahrt,
zeigt die App **keine** Demo-Zeiten als Ersatz.

## Zwei Build-Ziele

| Ziel | Befehl | Was läuft |
|---|---|---|
| Node-Server | `npm run build && npm start` | rechnet pro Anfrage, Live-Daten möglich, Filter funktioniert |
| GitHub Pages | `npm run build:pages` | vorgerendert, Demodaten, Filter fest auf 07:00 / 30 min |

GitHub führt die App nicht aus — es hostet nur Dateien. Die vorgerenderte
Fassung ist deshalb eine Momentaufnahme des Build-Zeitpunkts: zum Durchklicken
gedacht, nicht als Auskunft. Der Workflow in `.github/workflows/pages.yml`
veröffentlicht sie bei jedem Push auf `main`; **Pages muss im Repository einmal
aktiviert werden** (Settings → Pages → Source: GitHub Actions), sonst schlägt
der Deploy-Schritt fehl. Danach liegt sie unter
`https://<konto>.github.io/<repo>/`.

Für Live-Daten braucht es den Node-Server: die Lawinenlage ändert sich zweimal
täglich, Verspätungen im Minutentakt.

## Live-Daten

```bash
cp .env.example .env    # DATA_MODE=live setzen
```

| Quelle | Wofür | Zugang |
|---|---|---|
| Lawinenwarndienst Tirol / EAWS (CAAMLv6) | Gefahrenstufe, Gefahrenmuster, Expositionen | offen, kein Key |
| GeoSphere Austria (AROME, Open Data Hub) | Wind, Neuschnee, Temperatur | offen, kein Key |
| VVT / OGD Tirol (GTFS + GTFS-RT) | Fahrplan, Echtzeit-Verspätungen | GTFS offen, GTFS-RT braucht i.d.R. einen kostenlosen Key |
| OpenStreetMap | Ausgangspunkte, Wege, Hütten | offen |
| data.gv.at / Stadt Innsbruck OGD | ergänzende Geodaten | offen |
| OpenStreetMap-Kacheln (oder basemap.at) | Kartenhintergrund | offen, via `PUBLIC_TILE_URL` austauschbar |

Jeder Adapter fällt bei Fehler oder Timeout auf die Demodaten zurück und
protokolliert das — die App bleibt bedienbar, wenn eine Quelle ausfällt.

> Hinweis: Die Live-Endpunkte konnten in der Entwicklungsumgebung nicht
> aufgerufen werden (ausgehender Netzverkehr war auf Paket-Registries
> beschränkt). Die Parser sind gegen die dokumentierten Formate geschrieben und
> per Unit-Test abgedeckt, aber noch nicht gegen die echten Antworten verifiziert.
> Das ist der erste Schritt beim Umstellen auf `DATA_MODE=live`.

## Aufbau

```
src/
├── lib/
│   ├── types.ts                 Domänenmodell (Tour, Bulletin, Wetter, Fahrt)
│   ├── logic/
│   │   ├── rating.ts            Ampel-Heuristik + Tests
│   │   ├── turnaround.ts        Umkehrzeit aus dem letzten Bus + Tests
│   │   ├── trailheads.ts        Gruppierung nach Ausgangspunkt für die Karte + Tests
│   │   └── gpx.ts               GPX-Parser, Streckenlänge, Douglas-Peucker + Tests
│   ├── components/              SignalBadge, TourCard, TourMap
│   └── server/
│       ├── config.ts            Env-Konfiguration
│       ├── cache.ts             In-Memory-Cache für externe Antworten
│       ├── plan.ts              Aggregation zum Tagesplan
│       └── sources/             avalanche.ts, weather.ts, transit.ts, tours.ts, tracks.ts
├── fixtures/                    Tourenliste + Demo-Fahrplan
└── routes/
    ├── +page.svelte             Tourenliste mit Ampel
    ├── karte/                   Karte der Ausgangspunkte
    ├── tour/[id]/               Detail: Begründung, Zeitplan, Wetter, Rückfahrten
    ├── methodik/                Offenlegung der Rechenregeln
    └── api/plan/                JSON-Sicht auf denselben Tagesplan
```

Die Logik in `src/lib/logic/` ist frei von Framework- und Netzwerkabhängigkeiten
und damit direkt testbar. `src/lib/server/sources/` kapselt jede externe Quelle
hinter einer Funktion mit demselben Rückgabetyp — eine Quelle austauschen heißt,
eine Datei anzufassen.

## Kartenansicht

`/karte` zeigt einen Punkt je Ausgangspunkt, gefärbt nach der **besten** Tour von
dort — die Karte beantwortet „wohin fahre ich heute", nicht „welche Tour ist die
heikelste". Die Zahl im Punkt ist die Anzahl der Touren ab diesem Ausgangspunkt,
das Popup verlinkt sie einzeln. Auf der Tourenseite steht eine kleine Karte des
Ausgangspunkts.

Die Karte nutzt Leaflet (~40 KB statt ~800 KB bei MapLibre — in einer PWA fürs
Gebirge zählt jedes KB) und wird erst im Browser nachgeladen; die Seite selbst
rendert serverseitig und bleibt ohne JavaScript als Liste bedienbar. Der Service
Worker hält Kacheln cache-first vor (max. 400), damit eine einmal betrachtete
Region offline verfügbar bleibt.

Standard-Kachelquelle ist OpenStreetMap. Für Österreich bietet sich basemap.at an
(CC BY 4.0) — beides über `PUBLIC_TILE_URL` und `PUBLIC_TILE_ATTRIBUTION`
umstellbar; die URLs in `.env.example` sind hier ebenfalls nicht verifizierbar gewesen.

## Gestaltung

Die Palette nimmt Innsbrucker Farben auf: Himmelblau als Leitfarbe, Schneeweiß
für die Karten, das Grau der Nordkette für Fließtext und Ränder, Waldgrün als
zweite Farbe und das Gold des Goldenen Dachls für das Wappen der App — das als
Inline-SVG gezeichnet ist, bewusst grob, damit es in Favicon-Größe nicht
verschmiert.

Alle Farben laufen über CSS-Tokens in `src/routes/+layout.svelte`; eine dunkle
Fassung für die Planung am Abend schaltet über `prefers-color-scheme` dieselben
Token um. Leaflet liest die Ampelfarben zur Laufzeit aus denselben Tokens, damit
Karte und Oberfläche nicht auseinanderdriften.

Das Ampelgrün ist bewusst ein anderes als das Waldgrün der Oberfläche: Signal
und Dekoration sollen nicht verwechselbar sein. Alle Text-auf-Fläche-Paare
erreichen WCAG AA (geprüft: 4.8–16.0), die Signalfarben als grafische Elemente
mindestens 3.3.

## Tourenverläufe (GPX)

Liegt in `data/tracks/` eine Datei mit dem Namen der Tour-ID, zeichnet die Karte
den Verlauf ein — auf der Übersicht ausgedünnt (Douglas-Peucker, 40 m Toleranz),
auf der Tourenseite feiner (10 m). Fehlt die Datei, bleibt es beim Ausgangspunkt;
das ist der Normalfall, kein Fehler. Verzeichnis umstellbar über `TRACKS_DIR`.

**Erfinde keine Verläufe.** Eine plausibel aussehende, aber ausgedachte Linie
über einen 38°-Hang ist gefährlicher als gar keine Linie. Enthält `<desc>` einer
Datei das Wort *schematisch*, zeichnet die Karte sie gestrichelt und beschriftet
sie als schematisch; alles andere gilt als echte Aufzeichnung. Die drei
mitgelieferten Dateien sind schematisch und existieren nur, damit die Darstellung
sichtbar ist. Details in `data/tracks/README.md`.

Der Parser liest `<trkpt>` und `<rtept>` samt `<ele>` mit Textmustern statt einer
XML-Bibliothek: GPX-Tracks sind flach aufgebaut, und die Dateien kommen aus dem
eigenen Datenverzeichnis, nicht von Nutzereingaben. Kommt das anders — etwa ein
Upload durch Nutzerinnen — gehört hier ein echter XML-Parser hin.

`data/tracks/` wird zur Laufzeit relativ zum Arbeitsverzeichnis gelesen. Wer nur
`build/` deployt, muss das Verzeichnis mitkopieren oder `TRACKS_DIR` auf einen
absoluten Pfad setzen.

## Rechenregeln

**Ampel** — wird nur angehoben, nie gesenkt; der ungünstigste Faktor gewinnt:

- Gefahrenstufe 3 → gelb, Stufe 4/5 → rot (maßgeblich ist die Stufe auf Gipfelhöhe)
- Gefahrenmuster überschneidet sich mit den Hangrichtungen der Tour → gelb, ab Stufe 3 rot
- Schlüsselstelle ≥ 35° bei Stufe ≥ 3 → rot, ≥ 30° → gelb
- Wind ≥ 40 km/h → gelb, ≥ 60 km/h → rot
- Neuschnee ≥ 15 cm/24 h → gelb, ≥ 30 cm → rot
- kein Lagebericht → *unklar*; kein Bergwetter → vorsorglich hochgestuft

**Umkehrzeit** — `letzter Bus (inkl. Verspätung) − Puffer (Standard 30 min) − Abstiegszeit`.
Dagegen wird `Ankunft der Hinfahrt + Aufstiegszeit` gehalten; bleibt keine
Reserve, gilt die Tour als zu knapp.

## Grenzen

Die Ampel ist eine Planungshilfe, kein Sicherheitsurteil. Sie kennt weder die
Schneedecke vor Ort noch Gruppengröße, Ausrüstung oder Können, und die Gehzeiten
sind Durchschnittswerte ohne Pausen. Der Lawinenlagebericht im Original bleibt
Pflichtlektüre.

Die Tourenliste (12 Touren) ist bewusst kurz und handgepflegt: lieber wenige
Touren mit geprüften Hangrichtungen und Steilheiten als ein großer, ungeprüfter Datensatz.

## Nächste Schritte

- Live-Parser gegen echte API-Antworten verifizieren (siehe Hinweis oben)
- echte GPX-Aufzeichnungen statt der schematischen Demo-Verläufe
- Höhenprofil aus den GPX-Daten, mit der Umkehrzeit als Marke darin
- Aufstiegszeit nach eigenem Tempo skalieren statt fixer Durchschnittswerte
- Zweisprachigkeit DE/EN für internationale Studierende und Gäste
- Liftstatus der Bergbahnen als zusätzliche Quelle
