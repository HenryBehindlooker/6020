<script lang="ts">
	import { base } from '$app/paths';
</script>

<svelte:head><title>Methodik - Bergampel Innsbruck</title></svelte:head>

<p class="zurueck"><a href="{base}/">&larr; Alle Touren</a></p>

<h1>Wie wird gerechnet?</h1>

<p class="lead">
	Die Ampel ist eine Heuristik, kein Gutachten. Sie fasst zusammen, was in Lagebericht und
	Wetterprognose steht, und haelt es gegen die Eigenschaften der jeweiligen Tour. Jede Bewertung
	ist auf der Tourenseite vollstaendig aufgeschluesselt - es gibt keine versteckte Gewichtung.
</p>

<section>
	<h2>Ampel</h2>
	<ul>
		<li><strong>Lawinenlage:</strong> Stufe 3 setzt auf gelb, Stufe 4 und 5 auf rot. Massgeblich ist die Stufe auf Gipfelhoehe.</li>
		<li><strong>Gefahrenmuster:</strong> Ueberschneiden sich die Hangrichtungen der Tour mit denen eines Gefahrenmusters, steigt die Ampel - ab Stufe 3 direkt auf rot.</li>
		<li><strong>Steilheit:</strong> Ab Stufe 3 sind Schluesselstellen ueber 35&deg; rot, ueber 30&deg; gelb.</li>
		<li><strong>Wind:</strong> Ab 40 km/h auf Kammhoehe gelb, ab 60 km/h rot (frischer Triebschnee).</li>
		<li><strong>Neuschnee:</strong> Ab 15 cm in 24 h gelb, ab 30 cm rot.</li>
	</ul>
	<p>
		Die Ampel wird nur angehoben, nie gesenkt: der ungeguenstigste Faktor bestimmt das Ergebnis.
		Fehlt der Lagebericht, steht die Tour auf <em>unklar</em>; fehlt die Wetterprognose, wird
		vorsichtshalber hochgestuft.
	</p>
</section>

<section>
	<h2>Umkehrzeit</h2>
	<p>
		Vom letzten Bus am Ausgangspunkt wird rueckwaerts gerechnet: Abfahrtszeit (inklusive
		Echtzeit-Verspaetung) minus Sicherheitspuffer minus Abstiegszeit ergibt die spaeteste
		Umkehrzeit. Dagegen wird der rechnerische Gipfelzeitpunkt gehalten - Ankunft der Hinfahrt
		plus Aufstiegszeit. Bleibt keine Reserve, gilt die Tour als zu knapp.
	</p>
	<p>
		Der Puffer betraegt standardmaessig 30 Minuten und ist auf der Startseite einstellbar. Die
		Gehzeiten sind Durchschnittswerte ohne Pausen - wer langsamer geht, erhoeht den Puffer.
	</p>
</section>

<section>
	<h2>Datenquellen</h2>
	<table>
		<thead><tr><th>Quelle</th><th>Wofuer</th></tr></thead>
		<tbody>
			<tr><td>Lawinenwarndienst Tirol / EAWS (CAAMLv6)</td><td>Gefahrenstufe, Gefahrenmuster, Expositionen</td></tr>
			<tr><td>GeoSphere Austria (AROME, Open Data)</td><td>Wind, Neuschnee, Temperatur</td></tr>
			<tr><td>VVT / OGD Tirol (GTFS + GTFS-RT)</td><td>Fahrplan und Echtzeit-Verspaetungen</td></tr>
			<tr><td>OpenStreetMap</td><td>Ausgangspunkte, Wege, Huetten</td></tr>
			<tr><td>data.gv.at / Stadt Innsbruck OGD</td><td>Ergaenzende Geodaten</td></tr>
		</tbody>
	</table>
</section>

<style>
	.zurueck { font-size: 0.85rem; color: var(--muted); }
	.zurueck a { text-decoration: none; }
	h1 { font-size: 1.6rem; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
	.lead { color: var(--muted); }
	section { background: var(--surface); border-radius: 0.9rem; padding: 1rem 1.2rem; margin-top: 1rem; }
	h2 { font-size: 1rem; margin: 0 0 0.6rem; }
	ul { margin: 0 0 0.8rem; padding-left: 1.1rem; }
	li { margin-bottom: 0.3rem; font-size: 0.9rem; }
	p { font-size: 0.9rem; }
	table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
	th { text-align: left; color: var(--muted); font-weight: 600; }
	th, td { padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--border); }
</style>
