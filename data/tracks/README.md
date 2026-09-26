# Tourenverläufe (GPX)

Eine Datei je Tour, benannt nach der Tour-ID aus `src/fixtures/tours.json`:
`zischgeles.gpx` gehört zu `"id": "zischgeles"`. Fehlt eine Datei, zeigt die
Karte nur den Ausgangspunkt — das ist der Normalfall, kein Fehler.

Gelesen werden `<trkpt>` und `<rtept>` samt `<ele>`. Das Verzeichnis ist über
`TRACKS_DIR` umstellbar.

## Schematisch oder echt

Enthält `<desc>` das Wort *schematisch*, zeichnet die Karte die Linie
**gestrichelt** und beschriftet sie als schematisch. Alles andere gilt als echte
Aufzeichnung und wird durchgezogen dargestellt.

Früher lagen hier drei schematische Demo-Linien. Sie sind entfernt, seit die
Karte die echten Wege aus OpenStreetMap zeigt (`static/osm/`) — eine davon
gehörte zu einer Tour, die sich beim Abgleich mit OSM als falsch erwiesen hat,
die anderen begannen an ungenauen Ausgangspunkten.

## Echte Verläufe ergänzen

Erfinde keine Verläufe. Eine plausibel aussehende, aber ausgedachte Linie über
einen 38°-Hang ist gefährlicher als gar keine Linie. Brauchbare Quellen sind
eigene Aufzeichnungen, GPX-Exporte aus OpenStreetMap-Wegen oder Tracks, deren
Lizenz eine Weitergabe erlaubt.

Beim Einpflegen einer echten Aufzeichnung `<desc>` anpassen (das Wort
*schematisch* entfernen), damit die Linie durchgezogen erscheint.
