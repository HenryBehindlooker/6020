<script lang="ts">
	import { base } from '$app/paths';
	import SignalBadge from '$lib/components/SignalBadge.svelte';
	import TourMap from '$lib/components/TourMap.svelte';
	import type { MapMarker, MapTrack } from '$lib/components/mapTypes';
	import { hhmm } from '$lib/logic/turnaround';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const tour = $derived(data.tourPlan.tour);
	const rating = $derived(data.tourPlan.rating);
	const weather = $derived(data.tourPlan.weather);
	const transit = $derived(data.tourPlan.transit);
	const turnaround = $derived(data.tourPlan.turnaround);

	const track = $derived<MapTrack[]>(
		data.track
			? [
					{
						points: data.track.points,
						signal: rating.signal,
						label: tour.name,
						schematic: data.track.schematic
					}
				]
			: []
	);

	const marker = $derived<MapMarker[]>([
		{
			lat: tour.lat,
			lon: tour.lon,
			signal: rating.signal,
			label: tour.trailheadStop,
			sub: `Haltestelle am Ausgangspunkt`
		},
		...(tour.summit
			? [
					{
						lat: tour.summit.lat,
						lon: tour.summit.lon,
						signal: rating.signal,
						label: tour.summit.name,
						sub: tour.summit.ele ? `${tour.summit.ele} m laut OpenStreetMap` : 'Gipfel laut OpenStreetMap',
						shape: 'gipfel' as const
					}
				]
			: [])
	]);
</script>

<svelte:head>
	<title>{tour.name} - Bergampel Innsbruck</title>
</svelte:head>

<p class="zurueck"><a href="{base}/">&larr; Alle Touren</a></p>

<header class="kopf">
	<div>
		<h1>{tour.name}</h1>
		<p class="meta">
			{tour.trailhead} · {tour.summitAltitude} m · {tour.ascentMeters} hm ·
			Exposition {tour.aspects.join('/')} · bis {tour.steepnessMax}&deg;
		</p>
	</div>
	<SignalBadge signal={rating.signal} size="gross" />
</header>

<p class="beschreibung">{tour.description}</p>

{#if tour.verification}
	<p class="belegt">
		<strong>Belegt:</strong> {tour.verification.osm}.
		<strong>Richtwerte:</strong> {tour.verification.estimate} - und genau sie gehen in die Ampel
		ein.
	</p>
{/if}

<section class="panel">
	<h2>Warum diese Ampel?</h2>
	<ul class="gruende">
		{#each rating.reasons as reason}
			<li class={reason.impact}>
				<strong>{reason.factor}</strong>
				<span>{reason.detail}</span>
			</li>
		{/each}
	</ul>
</section>

<section class="panel">
	<h2>Zeitplan</h2>
	<p class="note" class:eng={!turnaround.feasible}>{turnaround.note}</p>
	<dl class="zeiten">
		{#if turnaround.outbound}
			<div>
				<dt>Hinfahrt ab {transit.originStop}</dt>
				<dd>
					{hhmm(turnaround.outbound.departure)} · Linie {turnaround.outbound.line}
					&rarr; an {hhmm(turnaround.outbound.arrival)}
					{#if turnaround.outbound.delayMinutes}
						<span class="delay">+{turnaround.outbound.delayMinutes} min</span>
					{/if}
				</dd>
			</div>
		{/if}
		{#if turnaround.summitAt}
			<div>
				<dt>Gipfel rechnerisch</dt>
				<dd>{hhmm(turnaround.summitAt)} nach {Math.round(tour.ascentMinutes / 60 * 10) / 10} h</dd>
			</div>
		{/if}
		{#if turnaround.turnaroundAt}
			<div class="hervor">
				<dt>Spaeteste Umkehrzeit</dt>
				<dd>{hhmm(turnaround.turnaroundAt)}</dd>
			</div>
		{/if}
		{#if turnaround.lastInbound}
			<div>
				<dt>Letzter Bus ab {transit.destinationStop}</dt>
				<dd>{hhmm(turnaround.lastInbound.departure)} · Linie {turnaround.lastInbound.line}</dd>
			</div>
		{/if}
	</dl>
</section>

{#if weather}
	<section class="panel">
		<h2>Bergwetter</h2>
		<dl class="zeiten">
			<div><dt>Wind</dt><dd>{weather.windSpeedKmh} km/h aus {weather.windDirection}, Boeen {weather.windGustsKmh} km/h</dd></div>
			<div><dt>Neuschnee 24 h</dt><dd>{weather.newSnow24hCm} cm</dd></div>
			<div><dt>Temperatur</dt><dd>{weather.temperatureC} &deg;C auf {weather.referenceAltitude} m</dd></div>
			<div><dt>Bewoelkung</dt><dd>{weather.cloudCoverPct} %</dd></div>
		</dl>
		<p class="quelle">{weather.source}</p>
	</section>
{/if}

<section class="panel">
	<h2>Lage</h2>
	<TourMap
		markers={marker}
		tracks={track}
		osm
		height="22rem"
		zoom={12}
		center={data.track || tour.summit ? undefined : [tour.lat, tour.lon]}
	/>
	<p class="quelle">
		Kreis: Haltestelle {tour.trailheadStop} · Dreieck: {tour.summit?.name ?? 'Ziel'}
		· Linien: Wege und Seilbahnen aus OpenStreetMap, oben rechts umschaltbar. Wanderwege
		sind Sommerwege, keine Skitouren-Aufstiege.
		{#if data.track}
			· Verlauf {data.track.lengthKm} km, {data.track.ascentMeters} hm
			{#if data.track.schematic}
				<strong class="warnung">schematisch, keine Wegaufzeichnung</strong>
			{/if}
		{/if}
	</p>
</section>

{#if data.huts.length > 0}
	<section class="panel">
		<h2>Einkehr und Huetten in der Naehe</h2>
		<ul class="huetten">
			{#each data.huts as huette (huette.osm ?? huette.name)}
				<li>
					<div>
						<strong>{huette.name}</strong>
						<span class="art">
							{huette.kind === 'schutzhuette' ? 'Schutzhuette' : huette.kind === 'selbstversorger' ? 'Selbstversorgerhuette' : 'Einkehr'}{#if huette.ele}
								· {huette.ele} m{/if}
						</span>
						{#if huette.openingHours}
							<span class="zeiten">Geoeffnet laut OSM: {huette.openingHours}</span>
						{/if}
					</div>
					<span class="entfernung">{huette.km} km</span>
				</li>
			{/each}
		</ul>
		<p class="quelle">
			Luftlinie vom Tourengebiet, nicht Gehweg. Oeffnungszeiten stehen selten in OSM und aendern
			sich saisonal - vor dem Aufbruch bei der Huette nachfragen. Daten: &copy;
			OpenStreetMap-Mitwirkende (ODbL).
		</p>
	</section>
{/if}

<section class="panel">
	<h2>Alle Rueckfahrten ab {transit.destinationStop}</h2>
	<ul class="fahrten">
		{#each transit.inbound as fahrt}
			<li>
				<div>
					<strong>{hhmm(fahrt.departure)}</strong> &rarr; {hhmm(fahrt.arrival)}
					<span class="linie">{fahrt.line}</span>
					{#if fahrt.delayMinutes}<span class="delay">+{fahrt.delayMinutes} min</span>{/if}
				</div>
				<div class="detail">
					{#if fahrt.walkMinutes}{fahrt.walkMinutes} min Fussweg zur Haltestelle · {/if}
					{#if fahrt.transfers === 0}direkt{:else if fahrt.transfers}{fahrt.transfers} Umstieg{fahrt.transfers > 1 ? 'e' : ''}{/if}
					{#if fahrt.legs && fahrt.legs.length > 1}
						({fahrt.legs.map((l) => `${l.line} ab ${l.from} ${l.departure}`).join(', ')})
					{:else if fahrt.legs?.length === 1}
						ab {fahrt.legs[0].from}
					{/if}
					&rarr; {fahrt.headsign}
				</div>
			</li>
		{:else}
			<li>Keine Rueckfahrt an diesem Tag gefunden.</li>
		{/each}
	</ul>
	<p class="quelle">{transit.source}</p>
</section>

<style>
	.zurueck { font-size: 0.85rem; color: var(--muted); }
	.zurueck a { text-decoration: none; }

	.kopf {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}

	h1 { margin: 0; font-size: 1.6rem; letter-spacing: -0.02em; }

	.meta { margin: 0.3rem 0 0; color: var(--muted); font-size: 0.85rem; }

	.beschreibung { color: var(--muted); }

	.belegt {
		font-size: 0.82rem;
		color: var(--muted);
		border-left: 3px solid var(--sky);
		padding-left: 0.7rem;
	}

	.panel {
		background: var(--surface);
		border-radius: 0.9rem;
		padding: 1rem 1.2rem;
		margin-top: 1rem;
	}

	.panel h2 { margin: 0 0 0.75rem; font-size: 1rem; }

	.gruende { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; }

	.gruende li {
		display: grid;
		grid-template-columns: 9rem 1fr;
		gap: 0.75rem;
		font-size: 0.88rem;
		padding-left: 0.7rem;
		border-left: 3px solid var(--border);
	}

	.gruende li.warnung { border-left-color: var(--gelb); }
	.gruende li.kritisch { border-left-color: var(--rot); }

	@media (max-width: 40rem) {
		.gruende li { grid-template-columns: 1fr; gap: 0.15rem; }
	}

	.note { margin: 0 0 0.9rem; font-size: 0.9rem; }
	.note.eng { color: var(--text-kritisch); }

	.zeiten { margin: 0; display: grid; gap: 0.55rem; }
	.zeiten div { display: grid; grid-template-columns: 14rem 1fr; gap: 0.75rem; font-size: 0.88rem; }
	.zeiten .hervor dd { font-weight: 700; color: var(--text-warnung); }
	dt { color: var(--muted); }
	dd { margin: 0; }

	@media (max-width: 40rem) {
		.zeiten div { grid-template-columns: 1fr; gap: 0.1rem; }
	}

	.huetten { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; font-size: 0.88rem; }
	.huetten li { display: flex; justify-content: space-between; gap: 1rem; padding-left: 0.7rem; border-left: 3px solid var(--muted); }
	.huetten .art, .huetten .zeiten { display: block; color: var(--muted); font-size: 0.8rem; }
	.huetten .entfernung { color: var(--muted); white-space: nowrap; }

	.fahrten { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; font-size: 0.88rem; }
	.fahrten .linie { margin-left: 0.4rem; color: var(--sky-deep); font-weight: 600; }
	.fahrten .detail { color: var(--muted); font-size: 0.78rem; }

	.delay { color: var(--text-kritisch); margin-left: 0.4rem; }

	.quelle { margin: 0.9rem 0 0; color: var(--muted); font-size: 0.75rem; }

	.quelle .warnung {
		color: var(--text-warnung);
		font-weight: 600;
	}
</style>
