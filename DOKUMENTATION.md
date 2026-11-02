# Bergampel Innsbruck – Dokumentation

Stand: November 2026 · Öffentliche Fassung: <https://henrybehindlooker.github.io/6020/>
· Quellcode: <https://github.com/HenryBehindlooker/6020>

Diese Dokumentation beschreibt, **was** die Bergampel kann, **woher** ihre Daten
kommen, **wie** sie rechnet und **wie** man sie betreibt und weiterentwickelt.
Für den schnellen Einstieg reicht die [README](README.md); die Rechenregeln stehen
für Nutzerinnen und Nutzer auch in der App unter **Wia grechnet wird**.

---

## Inhalt

1. [Was die App ist](#1-was-die-app-ist)
2. [Die Seiten im Überblick](#2-die-seiten-im-überblick)
3. [Datenquellen](#3-datenquellen)
4. [Wie die Daten in die App kommen](#4-wie-die-daten-in-die-app-kommen)
5. [Rechenregeln](#5-rechenregeln)
6. [Sicherheitsgrundsätze](#6-sicherheitsgrundsätze)
7. [Technischer Aufbau](#7-technischer-aufbau)
8. [Betrieb](#8-betrieb)
9. [Entwicklung](#9-entwicklung)
10. [Grenzen und offene Punkte](#10-grenzen-und-offene-punkte)
11. [Verlauf](#11-verlauf)

---

## 1. Was die App ist

Ein Tagesplaner für Skitouren, Winterwanderungen und Radltouren rund um
Innsbruck – für alle, die **mit dem Bus** in die Berge fahren. Die App beantwortet:

> **Wos geat heit (oder morgn), und wie kimm i hin und wieder hoam?**

Dafür führt sie zusammen, was man sonst aus fünf Quellen zusammensucht:

| Frage | Antwort der App |
|---|---|
| Ist die Tour heute vertretbar? | **Ampel** (Geat / Heikl / Heit nit / Unklar), vollständig begründet |
| Wann muss ich spätestens umkehren? | **Umkehrzeit**, rückwärts gerechnet vom letzten Bus ins Tal |
| Wie komme ich hin und zurück? | Echte Busverbindungen ab/bis Innsbruck Hauptbahnhof |
| Wie ist es am Berg gerade wirklich? | Messwerte der Stationen des Lawinenwarndienstes |
| Wo ist es steil, wo darf ich nicht hin? | Hangneigungs- und Wildschutzzonen-Karte des Landes Tirol |
| Kann ich einkehren? | Hütten mit „heute offen?“ und Bargeld-Hinweis |

Sprache: Überschriften, Knöpfe und die Ampel sind Tirolerisch („Heit nit“,
„Hoamfahrn“). **Warnungen und Sicherheitshinweise sind immer Hochdeutsch** –
wer am Berg eine Warnung liest, soll nicht über die Schreibweise stolpern.

---

## 2. Die Seiten im Überblick

### Touren (Startseite)

- Oben: was an den Daten echt ist („Obacht!“-Kasten) und der Lagebericht mit
  Gefahrenstufe, Lawinenproblemen und Originaltext.
- **Heit / Morgn**, **Aufbruchszeit** und **Puffer bis zum Bus** – die App
  rechnet sofort neu. Die Werte stehen in der Adresse
  (`?tag=morgen&ab=08:00&puffer=45`) und gelten auf allen Seiten.
- Die Touren in zwei Gruppen: **„Des geat si aus“** (Ampel nicht rot und zeitlich
  machbar) und **„Heit lei nit“**. Jede Karte zeigt die zwei wichtigsten Gründe,
  den letzten Bus und die Umkehrzeit samt Reserve.

### Tourenseite

| Abschnitt | Inhalt |
|---|---|
| Kopf | Ampel, Höhe, Höhenmeter, Exposition, Steilheit, „Plan für …“ |
| Kacheln | Umkehrzeit, letzter Bus, rechnerische Gipfelzeit |
| Warum de Ampel? | Jeder Faktor einzeln: Region, Lawinenlage, Steilheit, Gefahrenmuster, Wind, Neuschnee |
| Zeitplan | Abfahrt, Ankunft, Gipfel, späteste Umkehr, letzter Bus; Sonnenuntergang mit Warnung, wenn man erst im Dunkeln zurück wäre |
| Bergwetter | Prognose am Gipfel für den Planungstag |
| **Gmessn** | Die nächsten Messstationen: Schneehöhe, Änderung 24/72 h, Wind, Böen, Temperatur – beim Öffnen frisch geladen |
| Wo's is | Karte mit Haltestelle, Gipfel, Wegen, Hütten, Messstationen und **Hangneigung**; zuschaltbar Exposition und **Wald- und Wildschutzzonen**; Google Earth (3D-Link und KML) |
| Bilder | Fotos von Wikimedia Commons rund um den Gipfel, Talbild mit Wikipedia-Text |
| Markante Punkte | Sattel, Aussicht, Trinkwasser, Quellen, Unterstände, Gipfelkreuze im 500-m-Streifen um die Luftlinie Haltestelle–Gipfel |
| Einkehrn | Hütten im Umkreis: heute offen laut OSM, Bargeld-Hinweis, Telefon |
| Hoamfahrn | Die letzten Verbindungen zurück nach Innsbruck, frühere eingeklappt |

### Karte

Ein Kreis je Ausgangspunkt, gefärbt nach der **besten** Tour von dort; Dreiecke
für die Gipfel. Zuschaltbare Ebenen (Knopf oben rechts):

| Ebene | Quelle | Standard |
|---|---|---|
| Wanderwege (Sommer), Skitouren, Seilbahnen, Hütten & Einkehr | OpenStreetMap | an |
| Radl & MTB, Markante Punkte | OpenStreetMap | aus |
| Messstationen | Lawinenwarndienst Tirol | aus (Tourenseite: an) |
| Hangneigung (Wintersport) | Land Tirol – tiris | aus (Tourenseite: an) |
| Exposition | Land Tirol – tiris | aus |
| Wald- und Wildschutzzonen | Land Tirol – tiris | aus |

Hangneigung: **30–35° gelb, 35–40° orange, ab 40° rot**, darunter durchsichtig.

### Radl, Täler, Wia grechnet wird

- **Radl:** rund 190 Rad- und MTB-Routen aus OSM mit Karte, Suche, Filter (MTB/Radweg)
  und Sortierung.
- **Täler:** neun Täler und Gebiete mit Foto, Wikipedia-Auszug, Touren in der
  Nähe und Google-Earth-Link.
- **Wia grechnet wird:** die Rechenregeln, was belegt ist und was nicht, alle Quellen.

---

## 3. Datenquellen

Alle Quellen sind ohne API-Schlüssel frei abrufbar. **Bewusst nicht verwendet:**
Komoot, Outdooractive/Alpenvereinaktiv und Bergfex – deren Touren sind
urheberrechtlich geschützt.

| Was | Quelle | Datei im Repository | Aktualisierung | Lizenz / Hinweis |
|---|---|---|---|---|
| Lawinenlagebericht Tirol, je Mikroregion | Lawinenwarndienst Tirol / EAWS (CAAMLv6), `static.avalanche.report` | `data/lawine/aktuell.json`, `latest.json` | 3× täglich | offen; Text im EAWS-Verzeichnis nur Englisch |
| Grenzen der Mikroregionen | `regions.avalanches.org` | `data/lawine/regions-AT-07.geojson` | einmalig | offen |
| Bergwetter am Gipfel, stündlich | GeoSphere Austria, AROME 2,5 km (`nwp-v1-1h-2500m`) | `data/wetter/prognose.json` | 3× täglich | CC BY 4.0 |
| Busverbindungen Ausgangspunkt ↔ Innsbruck Hbf | Transitous (MOTIS) | `data/transit/connections.json` | 3× täglich | offene Fahrplandaten |
| Messstationen | Lawinenwarndienst Tirol (`wiski.tirol.gv.at`, Open Government Data) | `static/stationen/lwd.geojson` | 3× täglich, im Browser stündlich frisch | Quelle nennen |
| Hangneigung, Exposition | Land Tirol – tiris, WMS `terrain` | – (live als Kartenkacheln) | – | Quelle nennen |
| Wald- und Wildschutzzonen | Land Tirol – tiris, ArcGIS `ogd_sport` (Ebene 10) | – (live als Kartenkacheln) | – | Quelle nennen |
| Wege, Skitouren, Rad/MTB, Hütten, Seilbahnen, Gipfel, Haltestellen, markante Punkte | OpenStreetMap via Overpass | `static/osm/*.geojson` | wöchentlich | ODbL |
| Fotos, Täler | Wikimedia Commons, Wikipedia | `static/photos/photos.json` | wöchentlich | je Bild; Texte CC BY-SA |
| Kartenhintergrund | OpenStreetMap-Kacheln | – | – | ODbL; über `PUBLIC_TILE_URL` austauschbar |

**Geprüft, aber (noch) nicht eingebunden** – Ergebnisse in `data/probe/tiefe.json`:

| Quelle | Befund |
|---|---|
| GeoSphere AROME 1 km (`nwp-v2-1h-1km`) | funktioniert; andere Parameternamen (`10u`, `2t`, `10fg`, `sf` je Stunde) – Umstieg vorbereitet |
| GeoSphere Ensemble (10/50/90 %-Werte) | funktioniert – für „10 bis 40 cm Neuschnee möglich“ |
| GeoSphere Wetterwarnungen je Gemeinde | funktioniert |
| GeoSphere SNOWGRID (modellierte Schneehöhe, täglich, 1 km) | funktioniert |
| GeoSphere TAWES (u. a. Station Patscherkofel) | funktioniert |
| Open-Meteo (bis 7 Tage, Wind auf 700 hPa) | funktioniert; frei nur nicht-kommerziell |
| foto-webcam.eu (u. a. Seegrube) | nur verlinken, Bildrechte beim Betreiber |
| LAWIS (Lawinenereignisse, Schneeprofile) | keine öffentliche Schnittstelle gefunden |
| VVT-Fahrplanauskunft (EFA) | verweigert Verbindungen von außen |
| Echtzeit-Verspätungen der Tiroler Busse | über Transitous nicht vorhanden |

### Einheiten und Eigenheiten

- **Stationen:** Wind und Böen in km/h (die Werte sind m/s × 3,6), Schneehöhe in cm.
  `HSD24`/`HSD72` ist die **Änderung** der Schneehöhe, nicht der Neuschnee –
  Setzung und Verfrachtung stecken mit drin.
- **GeoSphere AROME 2,5 km:** `snow_acc` ist seit Modellstart aufsummiert (mm
  Wasserwert ≈ cm Neuschnee), `tcc` ist ein Anteil 0–1. Die Zeitreihe beginnt mit
  der aktuellen Stunde, nicht mit dem Modellstart.
- **Lagebericht:** erscheint um 17 Uhr für den nächsten Tag im Ordner dieses
  Tages (`<Tag>/<Tag>-AT-07.json`) und gilt bis 17 Uhr; Aktualisierung um 8 Uhr möglich.
- **Fahrplan:** Transitous liefert Verbindungen für konkrete Tage. Der Abholer
  fragt Beispieltage ab (Werktag, Samstag, Sonntag; vor der Saison zusätzlich ein
  Winter-Wochenende Anfang Dezember) und die App überträgt sie auf den Planungstag.

---

## 4. Wie die Daten in die App kommen

```
GitHub Actions, 3× täglich           Repository (main)               Browser
──────────────────────────           ─────────────────               ───────────────────────────
avalanche.py   ──► data/lawine/        ┐
weather.py     ──► data/wetter/        ├─► /daten/plan.json ───────► computeDayPlan()
transitous.py  ──► data/transit/       ┘   (beim Bauen erzeugt)       für heute/morgen, Aufbruch, Puffer
stations.py    ──► static/stationen/  ─────────────────────────────► Tourenseite, Karte (+ live nachgeladen)
osm.py         ──► static/osm/        ─────────────────────────────► Karte, Hütten, markante Punkte
photos.py      ──► static/photos/     ─────────────────────────────► Tourenseite, Täler
                                        Land Tirol (tiris) ────────► Kartenkacheln, direkt
```

1. **Abholen** – `.github/workflows/fetch-data.yml` läuft um **07:23, 16:23 und
   20:23 UTC** (08:23 / 17:23 / 21:23 Wiener Winterzeit). GitHub startet geplante
   Läufe oft deutlich später; die krummen Minuten und der dritte Lauf fangen das
   ab. Jeder Schritt ist für sich robust: schlägt einer fehl, bleibt der letzte
   gute Stand seiner Datei erhalten.
2. **Speichern** – die Ergebnisse werden als Commit „Daten aktualisiert …“ nach
   `main` geschrieben. Bei Konflikten zwischen zwei Läufen gewinnt der frischere.
3. **Veröffentlichen** – direkt danach ruft der Abholer `.github/workflows/pages.yml`
   auf: Tests, statischer Build, Deploy auf GitHub Pages. (Ein Push auf `main` löst
   denselben Workflow aus.)
4. **Rechnen** – die Seite wird vorgerendert ausgeliefert. Im Browser lädt
   `src/lib/planner.svelte.ts` die Datei `/daten/plan.json` (gut 20 KB komprimiert)
   und rechnet den Plan mit denselben Funktionen neu – für den echten heutigen
   Tag oder morgen und die gewählten Werte. Ohne JavaScript bleibt der
   vorgerenderte Plan stehen.
5. **Offline** – der Service Worker legt die App vorab ab, holt Daten zuerst aus
   dem Netz (mit der letzten Fassung als Rückfall) und hält bis zu 400
   Kartenkacheln vor.

Sind die Daten älter als **36 Stunden**, zeigt die Seite oben eine Warnung.

---

## 5. Rechenregeln

### Ampel

Die Ampel wird **nur angehoben, nie gesenkt** – der ungünstigste Faktor entscheidet.

| Faktor | Regel |
|---|---|
| Kein gültiger Lagebericht | **Unklar** |
| Region | Bewertet wird die Einschätzung der Mikroregion der Tour; fehlt sie, die ungünstigste Tirols |
| Gefahrenstufe | höchste Stufe zwischen Ausgangspunkt und Gipfel: **3 → gelb, 4 und 5 → rot**; Stufe 0 (kein Schnee) neutral |
| Lawinenproblem | trifft Hangrichtung **und** Höhenband der Tour → gelb, ab Stufe 3 rot; Entwarnungen („günstige Situation“) zählen nicht |
| Steilheit | Stufe 2: ab 40° gelb · ab Stufe 3: ab 30° gelb, ab 35° rot |
| Wind | stärkster Wind 07–16 Uhr am Gipfel: ab 40 km/h gelb, ab 60 km/h rot |
| Neuschnee | Vorabend 18 Uhr bis Mittag: ab 15 cm gelb (rot ab Stufe 3), ab 30 cm rot |
| Kein Bergwetter | vorsorglich auf gelb |

„Waldgrenze“ im Bericht wird zur sicheren Seite ausgelegt: oberhalb ab 1800 m,
unterhalb bis 2200 m. Bei Vormittag/Nachmittag zählt die höhere Stufe.

### Umkehrzeit

```
Umkehrzeit = Abfahrt letzter Bus − Puffer (Standard 30 min) − Abstiegszeit
Gipfelzeit = Ankunft der gewählten Hinfahrt + Aufstiegszeit
Reserve    = Umkehrzeit − Gipfelzeit        (negativ = zu knapp)
```

Ist die Tour zu knapp, nennt die App den spätesten Bus, mit dem es sich noch
ausgeht. Kommt man rechnerisch erst nach Sonnenuntergang (NOAA-Formel, freier
Horizont) zum Ausgangspunkt zurück, warnt die Tourenseite.

### Welcher Fahrplan für welchen Tag

| Planungstag | Fahrplan | Rückfall |
|---|---|---|
| Werktag | Werktag | Samstag (weniger Busse – vorsichtig) |
| Samstag | Samstag (im Winter Winter-Samstag) | Sonntag |
| Sonntag und **Feiertag** | Sonntag (im Winter Winter-Sonntag) | Samstag |

Am Wochenende und an Feiertagen wird **nie** der Werktag genommen – lieber
„Fahrplan fehlt“ als ein Bus, der nicht fährt. Feiertage werden berechnet
(`src/lib/logic/holidays.ts`, Ostern nach Gauß); der Tiroler Josefstag zählt nicht.

### Heit oder morgn

- **Heit:** gilt der Bericht, der jetzt gilt (nach 17 Uhr ist das schon der für morgen).
- **Morgn:** gilt der Bericht für morgen; vor 17 Uhr gibt es ihn noch nicht →
  Ampel *Unklar* mit Hinweis.

---

## 6. Sicherheitsgrundsätze

Diese Regeln stehen über allem anderen. Wer an der App arbeitet, hält sie ein.

1. **Nichts erfinden, was wie echt aussieht.** Keine ausgedachten Routen oder
   GPX-Verläufe, keine erfundenen Busse. Eine plausible Linie über einen 38°-Hang
   ist gefährlicher als gar keine.
2. **Beispieldaten nur in der Saisonpause** und nur gestempelt: Der
   Beispiel-Lagebericht erscheint nur, wenn der letzte echte Bericht mehr als zehn
   Tage zurückliegt. In der Saison bleibt eine Lücke eine Lücke (*Unklar*).
3. **Beispielwetter nie neben einem echten Lagebericht.**
4. **Im Zweifel zur vorsichtigen Seite:** fehlendes Wetter stuft hoch, unbekannte
   Gefahrenstufen ergeben *Unklar*, Fahrplan-Rückfälle nur zu weniger Bussen.
5. **Offenlegen, was belegt ist:** Hangrichtung, Steilheit und Gehzeiten der Touren
   sind Richtwerte ohne geprüfte Quelle – die Tourenseite sagt das.
6. **Messwerte zeigen, nicht bewerten:** Die Stationsdaten fließen (noch) nicht in
   die Ampel ein.
7. **Planungshilfe, kein Sicherheitsurteil.** Der Originalbericht auf
   [lawinen.report](https://lawinen.report) bleibt Pflichtlektüre.

---

## 7. Technischer Aufbau

**Technik:** SvelteKit 3 (Svelte 5 mit Runes), Vite 8, TypeScript 6, Vitest 5,
Leaflet, Prettier. Abholer in Python (nur Standardbibliothek). Node 22.17 oder neuer.

**Zwei Build-Ziele aus derselben Quelle:**

| Ziel | Befehl | Was entsteht |
|---|---|---|
| GitHub Pages | `npm run build:pages` | statische Seiten unter `/<repo>/`, Plan wird im Browser gerechnet |
| Node-Server | `npm run build && npm start` | rechnet pro Anfrage; `DATA_MODE=live` schaltet Beispieldaten ganz ab |

### Verzeichnisse

```
src/
├── lib/
│   ├── logic/                 reine Funktionen, jede mit Tests
│   │   ├── dayPlan.ts           Tagesplan aus den Eingangsdaten (Server und Browser)
│   │   ├── rating.ts            Ampel
│   │   ├── turnaround.ts        Umkehrzeit
│   │   ├── weather.ts           Wetter je Planungstag aus der Stundenprognose
│   │   ├── snapshot.ts          Fahrplan-Abzug auf den Planungstag übertragen
│   │   ├── holidays.ts          österreichische Feiertage
│   │   ├── stations.ts          Messstationen je Tour
│   │   ├── openingHours.ts      OSM-Öffnungszeiten für heute
│   │   ├── payment.ts           Bargeld-Hinweis
│   │   ├── landmarks.ts         markante Punkte
│   │   ├── sun.ts               Sonnenuntergang
│   │   ├── kml.ts               Google-Earth-Export
│   │   ├── nearby.ts, trailheads.ts, gpx.ts, time.ts
│   ├── planner.svelte.ts      Planung im Browser (Tag, Aufbruch, Puffer, Daten laden)
│   ├── planParams.ts          Werte aus der Adresse, mit Grenzen
│   ├── copy.ts                Texte der Oberfläche (Dialekt)
│   ├── components/            TourCard, TourMap, osmLayers, StationPanel, TirisLegende, DataNotice, HutInfo, PhotoGallery …
│   └── server/
│       ├── plan.ts            Eingangsdaten laden (loadPlanInputs)
│       ├── config.ts          Umgebungsvariablen
│       └── sources/           je Quelle eine Datei: avalanche, weather, transit, osm, photos, tours, tracks
├── routes/
│   ├── +page.svelte           Touren
│   ├── tour/[id]/             Tourenseite, tour.kml
│   ├── karte/  radl/  taeler/  methodik/
│   ├── daten/plan.json/       Eingangsdaten für den Browser (vorgerendert)
│   └── api/plan/              fertiger Tagesplan als JSON
├── service-worker/            Offline-Betrieb (eigenes TypeScript-Projekt)
├── fixtures/                  tours.json, Demo-Fahrplan, echte Lageberichte als Testdaten
└── env.ts                     Deklaration der Umgebungsvariablen
scripts/
├── fetch/                     die Abholer: avalanche, weather, transitous, stations, osm, photos, gtfs, probe_apis, probe_deep
├── verify_tours.py            Touren gegen OSM abgleichen
└── assign_regions.py          Touren den Lawinen-Mikroregionen zuordnen
data/                          Abzüge des Abholers (nicht von Hand bearbeiten)
static/                        osm/, stationen/, photos/ – vom Abholer, für den Browser
```

**Grundidee:** Alles, was rechnet, liegt in `src/lib/logic/` und ist frei von Netz
und Dateisystem. `src/lib/server/sources/` lädt nur. Dadurch rechnen Server,
Vorrendern und Browser garantiert gleich.

### Umgebungsvariablen

Siehe `.env.example`. Alle sind optional.

| Variable | Wirkung | Standard |
|---|---|---|
| `DATA_MODE` | `demo`: in der Saisonpause Beispielbericht · `live`: nie Beispieldaten | `demo` |
| `AVALANCHE_BASE_URL` | Verzeichnis der Lageberichte (Live-Nachfrage im Node-Server) | `static.avalanche.report/eaws_bulletins` |
| `CACHE_TTL_SECONDS` | Zwischenspeicher im Server | 900 |
| `TRACKS_DIR` | Verzeichnis mit GPX-Aufzeichnungen | `data/tracks` |
| `PUBLIC_TILE_URL`, `PUBLIC_TILE_ATTRIBUTION` | anderer Kartenhintergrund, z. B. basemap.at | OpenStreetMap |
| `BUILD_TARGET`, `BASE_PATH` | Pages-Build und Basispfad | – |

---

## 8. Betrieb

### GitHub Pages einrichten (einmalig)

**Settings → Pages → Source: GitHub Actions.** Danach veröffentlicht jeder Push
auf `main` und jeder Lauf des Abholers die Seite.

### Abläufe von Hand anstoßen

- **Daten sofort holen und veröffentlichen:** Actions → *Echte Daten holen* →
  *Run workflow* (Zweig `main`). Optional *force_osm*, um OSM vor Ablauf der Woche
  neu zu holen. Läuft er von Hand, prüft er zusätzlich alle Schnittstellen
  (`data/probe/tiefe.json`).
- **Nur neu bauen:** Actions → *Demo-Fassung auf GitHub Pages* → *Run workflow*.

### Zeitplan abschalten

Actions → *Echte Daten holen* → ⋯ → **Disable workflow**. GitHub pausiert
geplante Läufe auch selbst, wenn im Repository 60 Tage lang nichts passiert –
dann dort wieder aktivieren.

### Überwachung

- Ist die öffentliche Seite älter als 36 Stunden, steht es oben auf der Seite.
- Unter **Actions** sieht man jeden Lauf; ein Lauf besteht aus *fetch* und
  *pages / build* + *pages / deploy*. Der Deploy läuft nur auf `main`.
- Rot markierte Schritte im Abholer sind meist eine kurz nicht erreichbare Quelle;
  der letzte gute Stand bleibt dann erhalten.

---

## 9. Entwicklung

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # Vitest (223 Tests)
npm run check          # svelte-check
npm run format         # Prettier (Tabs, einfache Anführungszeichen, 120 Zeichen)
npm run build:pages    # statische Fassung nach build/
```

Tests mit verschiedenen Zeitzonen laufen lassen – Wanduhrzeiten müssen überall
in Wiener Zeit stimmen:

```bash
TZ=UTC npm test && TZ=Europe/Vienna npm test
```

### Eine Tour hinzufügen

1. Eintrag in `src/fixtures/tours.json` (ID, Name, Ausgangspunkt, Haltestelle,
   Höhen, Gehzeiten, Hangrichtungen, Steilheit, Art).
2. `python3 scripts/verify_tours.py` gleicht Gipfel und Haltestelle mit OSM ab.
3. `python3 scripts/assign_regions.py` ordnet die Lawinen-Mikroregion zu.
4. Die Haltestelle in `scripts/fetch/transitous.py` (`TRAILHEADS`) eintragen, damit
   der Abholer Busse dafür holt.
5. Hangrichtung, Steilheit und Gehzeiten **nur aus belegter Quelle** – sie gehen
   direkt in die Ampel ein.

### Eine Datenquelle hinzufügen

1. Erst prüfen: eine Funktion in `scripts/fetch/probe_deep.py` ergänzen und den
   Abholer von Hand starten. Erst einbauen, was dort nachweislich funktioniert.
2. Abholer in `scripts/fetch/` (nur Standardbibliothek, bei Fehlern den alten
   Stand behalten), Schritt in `fetch-data.yml`, Pfad in den Commit-Schritt.
3. Laden in `src/lib/server/sources/`, rechnen in `src/lib/logic/` – mit Tests,
   möglichst gegen echte Rohdaten.
4. Quelle und Lizenz in Fußzeile, Methodik-Seite und dieser Dokumentation nennen.

### Konventionen

- Code-Kommentare deutsch ohne Umlaute; Oberflächentexte mit Umlauten.
- Eine Änderung, ein Commit mit Begründung im Text. Formatierung getrennt von Inhalt.
- Arbeitszweig `claude/innsbruck-webapp-proposal-qnyvew`; live geht es über einen
  Pull Request nach `main`.

---

## 10. Grenzen und offene Punkte

- **Touren-Richtwerte:** Hangrichtung, Steilheit und Gehzeiten der zehn Touren
  sind nicht gegen eine geprüfte Quelle abgeglichen.
- **Keine GPX-Verläufe:** es gibt bewusst keine erfundenen Linien; echte
  Aufzeichnungen können in `data/tracks/` abgelegt werden.
- **Wetter:** 2,5-km-Modell; das Modellgelände ist geglättet, der Gitterpunkt liegt
  meist tiefer als der Gipfel, und am Grat ist es windiger. Umstieg auf 1 km vorbereitet.
- **Fahrplan:** Beispieltage, keine Echtzeit. Fahrplanwechsel (Mitte Dezember)
  und Sonderfahrpläne zwischen den Feiertagen kennt die App nur, soweit Transitous
  sie für die abgefragten Tage liefert. Die Axamer Lizum hat im Abzug für Anfang
  Dezember noch keine Verbindung.
- **Lagebericht-Text** nur Englisch (EAWS-Verzeichnis); die deutsche Fassung ist verlinkt.
- **Öffnungszeiten** der Hütten stammen aus OSM und sind oft veraltet.

**Nächste sinnvolle Schritte:** GeoSphere 1-km-Modell und Ensemble
(Unsicherheit), amtliche Wetterwarnungen, Wochenvorschau (Open-Meteo),
Stationsmesswerte vorsichtig in die Ampel einbeziehen (z. B. starker Zuwachs
der Schneehöhe in 72 h).

---

## 11. Verlauf

| Pull Request | Inhalt |
|---|---|
| #1 | Grundgerüst: Ampel, Umkehrzeit, Tourenliste, Demo-Daten |
| #2 | Echte Daten: OSM-Wege, Hütten, Seilbahnen, Busverbindungen (Transitous) |
| #3 | Fehlerbehebung, Oberfläche überarbeitet, Tiroler Ton |
| #4 | Echter Tiroler Lagebericht, je Mikroregion bewertet |
| #5 | Hütten (heute offen, Bargeld), Radl, Täler, Fotos, markante Punkte, Google Earth, Sonnenuntergang |
| #6 | Überarbeitung: Seite aktualisiert sich wieder, Planung im Browser (heute/morgen), echtes Bergwetter, SvelteKit 3 |
| #7 | Feiertage und Sonntage mit richtigem Fahrplan; Schnittstellen-Prüfung |
| #8 | Messstationen an jeder Tour; Kartenebenen Hangneigung, Exposition, Wildschutzzonen |
| #9 | Hangneigung auf den Tourenseiten standardmäßig an; diese Dokumentation |
