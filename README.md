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
npm test           # 28 Tests für Ampel- und Umkehrzeit-Logik
npm run build && npm start
```

Ohne Konfiguration startet die App im **Demo-Modus**: Lagebericht, Wetter und
Fahrplan kommen aus mitgelieferten Beispieldateien, und ein Banner weist darauf
hin. Die Demo-Fahrplanzeiten sind erfunden und keine gültige Fahrplanauskunft.

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
│   │   └── turnaround.ts        Umkehrzeit aus dem letzten Bus + Tests
│   ├── components/              SignalBadge, TourCard
│   └── server/
│       ├── config.ts            Env-Konfiguration
│       ├── cache.ts             In-Memory-Cache für externe Antworten
│       ├── plan.ts              Aggregation zum Tagesplan
│       └── sources/             avalanche.ts, weather.ts, transit.ts, tours.ts
├── fixtures/                    Tourenliste + Demo-Fahrplan
└── routes/
    ├── +page.svelte             Tourenliste mit Ampel
    ├── tour/[id]/               Detail: Begründung, Zeitplan, Wetter, Rückfahrten
    ├── methodik/                Offenlegung der Rechenregeln
    └── api/plan/                JSON-Sicht auf denselben Tagesplan
```

Die Logik in `src/lib/logic/` ist frei von Framework- und Netzwerkabhängigkeiten
und damit direkt testbar. `src/lib/server/sources/` kapselt jede externe Quelle
hinter einer Funktion mit demselben Rückgabetyp — eine Quelle austauschen heißt,
eine Datei anzufassen.

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
- Kartenansicht der Ausgangspunkte (MapLibre + OSM-Tiles)
- Aufstiegszeit nach eigenem Tempo skalieren statt fixer Durchschnittswerte
- Zweisprachigkeit DE/EN für internationale Studierende und Gäste
- Liftstatus der Bergbahnen als zusätzliche Quelle
