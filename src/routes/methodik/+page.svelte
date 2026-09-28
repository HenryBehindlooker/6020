<script lang="ts">
	import { base } from '$app/paths';
	import { TEXT } from '$lib/copy';
</script>

<svelte:head><title>Wia grechnet wird - Bergampel Innsbruck</title></svelte:head>

<p class="zurueck"><a href="{base}/">&larr; {TEXT.zurueck}</a></p>

<h1>Wia grechnet wird</h1>

<p class="lead">
	Die Ampel ist eine Faustregel, kein Gutachten. Sie fasst zusammen, was im Lawinenlagebericht und in
	der Wetterprognose steht, und hält es gegen die Eigenschaften der Tour. Jede Bewertung ist auf der
	Tourenseite vollständig aufgeschlüsselt - es gibt keine versteckte Gewichtung.
</p>

<section>
	<h2>Die Ampel</h2>
	<ul>
		<li>
			<strong>Lawinenlage:</strong> Maßgeblich ist die höchste Gefahrenstufe zwischen Ausgangspunkt und
			Gipfel. Stufe 3 setzt auf gelb, Stufe 4 und 5 auf rot.
		</li>
		<li>
			<strong>Mehrere Regionen:</strong> Der Tiroler Bericht ist in Regionen geteilt. Solange die Touren
			keiner Region zugeordnet sind, gilt die ungünstigste Einschätzung aller Tiroler Regionen.
		</li>
		<li>
			<strong>Lawinenprobleme:</strong> Trifft ein Problem die Hangrichtungen der Tour <em>und</em>
			liegt die Tour in seinem Höhenband, steigt die Ampel - ab Stufe 3 direkt auf rot.
		</li>
		<li><strong>Steilheit:</strong> Ab Stufe 3 sind Schlüsselstellen über 35&deg; rot, über 30&deg; gelb.</li>
		<li><strong>Wind:</strong> Ab 40 km/h gelb, ab 60 km/h rot (frischer Triebschnee).</li>
		<li><strong>Neuschnee:</strong> Ab 15 cm in 24 h gelb, ab 30 cm rot.</li>
	</ul>
	<p>
		Die Ampel wird nur hochgestuft, nie herunter: Der ungünstigste Faktor entscheidet. Fehlt der
		Lagebericht, steht die Tour auf <em>Unklar</em>. Fehlt die Wetterprognose, wird vorsichtshalber
		hochgestuft.
	</p>
</section>

<section>
	<h2>Die Umkehrzeit</h2>
	<p>
		Gerechnet wird rückwärts vom letzten Bus am Ausgangspunkt: Abfahrt (mit Echtzeit-Verspätung,
		falls bekannt) minus Puffer minus Abstiegszeit ergibt die späteste Umkehrzeit. Dagegen steht die
		rechnerische Gipfelzeit: Ankunft mit dem Bus plus Aufstiegszeit. Bleibt keine Reserve, ist die
		Tour zu knapp.
	</p>
	<p>
		Der Puffer ist standardmäßig 30 Minuten und auf der Startseite einstellbar. Die Gehzeiten sind
		Richtwerte ohne Pausen - wer langsamer geht, erhöht den Puffer.
	</p>
	<p class="grenze">
		<strong>Noch nicht berücksichtigt:</strong> die Dunkelheit. Im Dezember ist es gegen 16:30 finster,
		oft früher als der letzte Bus fährt.
	</p>
</section>

<section>
	<h2>Was belegt ist und was nicht</h2>
	<ul>
		<li><strong>Belegt aus OpenStreetMap:</strong> Gipfelname, Gipfelhöhe und -lage, Haltestellen, Wege, Hütten, Seilbahnen.</li>
		<li><strong>Echte Busverbindungen:</strong> über Transitous, als Abzug für Beispieltage, auf den Planungstag übertragen.</li>
		<li>
			<strong>Richtwerte ohne geprüfte Quelle:</strong> Hangrichtung, Steilheit und Gehzeiten der
			Touren - und genau sie gehen in die Ampel ein.
		</li>
	</ul>
</section>

<section>
	<h2>Datenquellen</h2>
	<div class="tabelle">
		<table>
			<thead><tr><th>Quelle</th><th>Wofür</th></tr></thead>
			<tbody>
				<tr><td>Lawinenwarndienst Tirol / EAWS (CAAMLv6)</td><td>Gefahrenstufe, Lawinenprobleme, Hangrichtungen</td></tr>
				<tr><td>GeoSphere Austria (AROME, Open Data)</td><td>Wind, Neuschnee, Temperatur</td></tr>
				<tr><td>Transitous (transitous.org)</td><td>Busverbindungen zwischen Ausgangspunkt und Innsbruck</td></tr>
				<tr><td>OpenStreetMap</td><td>Gipfel, Haltestellen, Wanderwege, Skitouren-Aufstiege, Hütten, Seilbahnen</td></tr>
			</tbody>
		</table>
	</div>
</section>

<style>
	.zurueck { font-size: 0.87rem; }
	.zurueck a { text-decoration: none; color: var(--sky-deep); }
	h1 { font-size: clamp(1.6rem, 4.5vw, 2.1rem); letter-spacing: -0.02em; margin: 0 0 0.5rem; color: var(--sky-deep); }
	.lead { color: var(--muted); }
	section { background: var(--surface); border-radius: 1rem; padding: 1.05rem 1.25rem; margin-top: 1rem; }
	h2 { font-size: 1.08rem; margin: 0 0 0.6rem; color: var(--sky-deep); }
	ul { margin: 0 0 0.8rem; padding-left: 1.1rem; }
	li { margin-bottom: 0.4rem; font-size: 0.92rem; }
	p { font-size: 0.92rem; }
	.grenze { border-left: 3px solid var(--text-warnung); padding-left: 0.7rem; }
	.tabelle { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; font-size: 0.87rem; }
	th { text-align: left; color: var(--muted); font-weight: 600; }
	th, td { padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--border); vertical-align: top; }
</style>
