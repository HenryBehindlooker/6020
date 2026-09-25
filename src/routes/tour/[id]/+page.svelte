<script lang="ts">
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
			label: tour.name,
			sub: `Ausgangspunkt ${tour.trailhead}`
		}
	]);
</script>

<svelte:head>
	<title>{tour.name} - Bergampel Innsbruck</title>
</svelte:head>

<p class="zurueck"><a href="/">&larr; Alle Touren</a></p>

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
		height="18rem"
		zoom={12}
		center={data.track ? undefined : [tour.lat, tour.lon]}
	/>
	<p class="quelle">
		Ausgangspunkt {tour.trailhead}, Haltestelle {tour.trailheadStop}
		{#if data.track}
			· Verlauf {data.track.lengthKm} km, {data.track.ascentMeters} hm
			{#if data.track.schematic}
				<strong class="warnung">schematisch, keine Wegaufzeichnung</strong>
			{/if}
		{/if}
	</p>
</section>

<section class="panel">
	<h2>Alle Rueckfahrten ab {transit.destinationStop}</h2>
	<ul class="fahrten">
		{#each transit.inbound as fahrt}
			<li>
				<strong>{hhmm(fahrt.departure)}</strong> Linie {fahrt.line} &rarr; {fahrt.headsign}
				{#if fahrt.delayMinutes}<span class="delay">+{fahrt.delayMinutes} min</span>{/if}
			</li>
		{:else}
			<li>Keine Rueckfahrten hinterlegt.</li>
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
		border-left: 3px solid var(--surface-2);
	}

	.gruende li.warnung { border-left-color: var(--gelb); }
	.gruende li.kritisch { border-left-color: var(--rot); }

	@media (max-width: 40rem) {
		.gruende li { grid-template-columns: 1fr; gap: 0.15rem; }
	}

	.note { margin: 0 0 0.9rem; font-size: 0.9rem; }
	.note.eng { color: #fca5a5; }

	.zeiten { margin: 0; display: grid; gap: 0.55rem; }
	.zeiten div { display: grid; grid-template-columns: 14rem 1fr; gap: 0.75rem; font-size: 0.88rem; }
	.zeiten .hervor dd { font-weight: 700; color: #fde047; }
	dt { color: var(--muted); }
	dd { margin: 0; }

	@media (max-width: 40rem) {
		.zeiten div { grid-template-columns: 1fr; gap: 0.1rem; }
	}

	.fahrten { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.35rem; font-size: 0.88rem; }

	.delay { color: #fca5a5; margin-left: 0.4rem; }

	.quelle { margin: 0.9rem 0 0; color: var(--muted); font-size: 0.75rem; }

	.quelle .warnung {
		color: #fde047;
		font-weight: 600;
	}
</style>
