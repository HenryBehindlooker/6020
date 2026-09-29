<script lang="ts">
	import { base } from '$app/paths';
	import DataNotice from '$lib/components/DataNotice.svelte';
	import HutInfo from '$lib/components/HutInfo.svelte';
	import PhotoGallery from '$lib/components/PhotoGallery.svelte';
	import { LANDMARK_LABEL } from '$lib/logic/landmarks';
	import SignalBadge from '$lib/components/SignalBadge.svelte';
	import TourMap from '$lib/components/TourMap.svelte';
	import type { MapMarker, MapTrack } from '$lib/components/mapTypes';
	import { formatReserve, hhmm } from '$lib/logic/turnaround';
	import { googleEarthUrl } from '$lib/logic/kml';
	import { planQuery } from '$lib/planParams';
	import { TEXT } from '$lib/copy';
	import type { Departure } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const tour = $derived(data.tourPlan.tour);
	const rating = $derived(data.tourPlan.rating);
	const weather = $derived(data.tourPlan.weather);
	const transit = $derived(data.tourPlan.transit);
	const turnaround = $derived(data.tourPlan.turnaround);
	const query = $derived(planQuery(data.params));

	/** Die letzten Rueckfahrten zaehlen fuer die Umkehrzeit - die zeigen wir zuerst. */
	const letzteFahrten = $derived(transit.inbound.slice(-6));
	const weitereFahrten = $derived(transit.inbound.slice(0, -6));

	const track = $derived<MapTrack[]>(
		data.track
			? [{ points: data.track.points, signal: rating.signal, label: tour.name, schematic: data.track.schematic }]
			: []
	);

	const marker = $derived<MapMarker[]>([
		{
			lat: tour.lat,
			lon: tour.lon,
			signal: rating.signal,
			label: tour.trailheadStop,
			sub: 'Haltestelle am Ausgangspunkt'
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

	const huettenArt = { schutzhuette: 'Schutzhütte', selbstversorger: 'Selbstversorgerhütte', einkehr: 'Einkehr' };
</script>

<svelte:head>
	<title>{tour.name} - Bergampel Innsbruck</title>
</svelte:head>

<p class="zurueck"><a href="{base}/{query}">&larr; {TEXT.zurueck}</a></p>

<DataNotice status={data.status} />

<header class="kopf">
	<div>
		<h1>{tour.name}</h1>
		<p class="meta">
			{tour.trailhead} · {tour.summitAltitude} m · {tour.ascentMeters} Hm · Exposition {tour.aspects.join('/')} · bis {tour.steepnessMax}&deg;
		</p>
	</div>
	<SignalBadge signal={rating.signal} size="gross" />
</header>

<!-- Das Wichtigste zuerst: wann umkehren, damit man den Bus erwischt -->
<section class="blick" aria-label="Auf einen Blick">
	<div class="kachel" class:eng={!turnaround.feasible}>
		<span class="label">{TEXT.umkehr}</span>
		<strong>{turnaround.turnaroundAt ? hhmm(turnaround.turnaroundAt) : '-'}</strong>
		<span class="klein">
			{#if turnaround.slackMinutes !== null}
				{turnaround.slackMinutes >= 0 ? `${formatReserve(turnaround.slackMinutes)} Reserve` : `${formatReserve(-turnaround.slackMinutes)} zu knapp`}
			{:else}
				keine Rückfahrt bekannt
			{/if}
		</span>
	</div>
	<div class="kachel">
		<span class="label">{TEXT.letzterBus}</span>
		<strong>{turnaround.lastInbound ? hhmm(turnaround.lastInbound.departure) : '-'}</strong>
		<span class="klein">{turnaround.lastInbound ? turnaround.lastInbound.line : transit.kind === 'echt' ? 'fährt heute nicht' : 'Fahrplan fehlt'}</span>
	</div>
	<div class="kachel">
		<span class="label">Am Gipfel</span>
		<strong>{turnaround.summitAt ? hhmm(turnaround.summitAt) : '-'}</strong>
		<span class="klein">{Math.round((tour.ascentMinutes / 60) * 10) / 10} h Aufstieg</span>
	</div>
</section>

<p class="note" class:eng={!turnaround.feasible}>{turnaround.note}</p>

<p class="beschreibung">{tour.description}</p>

{#if tour.verification}
	<p class="belegt">
		<strong>Belegt:</strong> {tour.verification.osm}. <strong>Richtwerte:</strong>
		{tour.verification.estimate} - und genau sie gehen in die Ampel ein.
	</p>
{/if}

<section class="panel">
	<h2>{TEXT.warum}</h2>
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
	<h2>{TEXT.zeitplan}</h2>
	<ol class="ablauf">
		{#if turnaround.outbound}
			<li>
				<span class="uhr">{hhmm(turnaround.outbound.departure)}</span>
				<span>Abfahrt ab {transit.originStop} · {turnaround.outbound.line}</span>
			</li>
			<li>
				<span class="uhr">{hhmm(turnaround.outbound.arrival)}</span>
				<span>Ankunft {tour.trailheadStop}, los geht's</span>
			</li>
		{/if}
		{#if turnaround.summitAt}
			<li><span class="uhr">{hhmm(turnaround.summitAt)}</span><span>Gipfel, rechnerisch</span></li>
		{/if}
		{#if turnaround.turnaroundAt}
			<li class="wichtig"><span class="uhr">{hhmm(turnaround.turnaroundAt)}</span><span>Spätestens umkehren</span></li>
		{/if}
		{#if turnaround.lastInbound}
			<li>
				<span class="uhr">{hhmm(turnaround.lastInbound.departure)}</span>
				<span>Letzter Bus ab {tour.trailheadStop} · {turnaround.lastInbound.line}</span>
			</li>
		{/if}
	</ol>
	<p class="quelle">
		Umkehrzeit = letzter Bus - {data.params.bufferMinutes} min Puffer - {tour.descentMinutes} min Abstieg.
		Gehzeiten ohne Pausen.
	</p>
</section>

{#if weather}
	<section class="panel">
		<h2>{TEXT.bergwetter}</h2>
		<dl class="werte">
			<div><dt>Wind</dt><dd>{weather.windSpeedKmh} km/h aus {weather.windDirection}, Böen {weather.windGustsKmh} km/h</dd></div>
			<div><dt>Neuschnee 24 h</dt><dd>{weather.newSnow24hCm} cm</dd></div>
			<div><dt>Temperatur</dt><dd>{weather.temperatureC} &deg;C auf {weather.referenceAltitude} m</dd></div>
			<div><dt>Bewölkung</dt><dd>{weather.cloudCoverPct} %</dd></div>
		</dl>
		<p class="quelle">{weather.source}</p>
	</section>
{/if}

<section class="panel">
	<h2>{TEXT.lage}</h2>
	<TourMap markers={marker} tracks={track} osm osmVisible={{ pois: true }} height="22rem" zoom={12} center={data.track || tour.summit ? undefined : [tour.lat, tour.lon]} />
	<p class="earth">
		<a href={googleEarthUrl(tour.summit?.lat ?? tour.lat, tour.summit?.lon ?? tour.lon, tour.summit?.ele ?? tour.summitAltitude)} target="_blank" rel="noopener noreferrer">In 3D anschauen (Google Earth)</a>
		<a href="{base}/tour/{tour.id}/tour.kml" download="{tour.id}.kml">KML für Google Earth laden</a>
	</p>
	<p class="quelle">
		Kreis: Haltestelle {tour.trailheadStop} · Dreieck: {tour.summit?.name ?? 'Ziel'} · Linien: Wege und
		Seilbahnen aus OpenStreetMap, oben rechts umschaltbar. Wanderwege sind Sommerwege, keine
		Skitouren-Aufstiege.
	</p>
</section>

{#if data.photos.length > 0 || data.valley}
	<section class="panel">
		<h2>Bilder <span class="unter">{data.valley ? `${data.valley.title} und Umgebung` : 'rund um den Gipfel'}</span></h2>
		{#if data.valley}
			<p class="tal">
				{data.valley.extract}
				<a href={data.valley.article} target="_blank" rel="noopener noreferrer">Wikipedia</a>
			</p>
		{/if}
		<PhotoGallery photos={[...(data.valley ? [data.valley.photo] : []), ...data.photos]} alt={tour.name} />
		<p class="quelle">
			Fotos von Wikimedia Commons, rund um den Gipfel aufgenommen (bis 3 km entfernt) – Jahreszeit und
			Verhältnisse auf dem Bild sagen nichts über heute. Text: Wikipedia, CC BY-SA 4.0.
		</p>
	</section>
{/if}

{#if data.landmarks.length > 0}
	<section class="panel">
		<h2>Markante Punkte <span class="unter">zwischen Ausgangspunkt und Gipfel</span></h2>
		<ol class="punkte">
			{#each data.landmarks as punkt (punkt.osm ?? `${punkt.lat},${punkt.lon}`)}
				<li>
					<span class="anteil" style="--anteil: {punkt.along}" aria-hidden="true"></span>
					<div>
						<strong>{punkt.name ?? LANDMARK_LABEL[punkt.kind]}</strong>
						<span class="art">
							{#if punkt.name}{LANDMARK_LABEL[punkt.kind]} · {/if}{#if punkt.ele}{punkt.ele} m · {/if}{punkt.offM} m neben der Luftlinie
							{#if punkt.osm}· <a href="https://www.openstreetmap.org/{punkt.osm}" target="_blank" rel="noopener noreferrer">OSM</a>{/if}
						</span>
					</div>
				</li>
			{/each}
		</ol>
		<p class="quelle">
			Aus OpenStreetMap, im Streifen von 500 m um die Luftlinie Haltestelle–Gipfel. Das ist keine
			Route: Ein Punkt kann hinter einem Grat liegen. Trinkwasser und Quellen im Winter nicht
			verlassen – sie sind oft eingeschneit oder abgedreht.
		</p>
	</section>
{/if}

{#if data.huts.length > 0}
	<section class="panel">
		<h2>{TEXT.einkehr}</h2>
		<ul class="huetten">
			{#each data.huts as huette (huette.osm ?? huette.name)}
				<li>
					<div>
						<strong>{huette.name}</strong>
						<span class="art">{huettenArt[huette.kind]}{#if huette.ele}&nbsp;· {huette.ele} m{/if}</span>
						<HutInfo
							openingHours={huette.openingHours}
							payment={huette.payment}
							seasonal={huette.seasonal}
							phone={huette.phone}
							checkDate={huette.checkDate}
						/>
					</div>
					<span class="entfernung">{huette.km} km</span>
				</li>
			{/each}
		</ul>
		<p class="quelle">
			Luftlinie vom Ausgangspunkt, nicht Gehweg. Öffnungszeiten und Zahlungsarten aus OpenStreetMap,
			von Freiwilligen eingetragen und oft veraltet – vor dem Aufstieg bei der Hütte anrufen. Am Berg
			gibt's keinen Bankomaten.
		</p>
	</section>
{/if}

<section class="panel">
	<h2>{TEXT.hoamfahrn} <span class="unter">ab {transit.destinationStop}</span></h2>
	{#if transit.inbound.length === 0}
		<p class="leer">{turnaround.note}</p>
	{:else}
		<p class="vorspann">Die letzten Verbindungen nach Innsbruck:</p>
		<ul class="fahrten">
			{#each letzteFahrten as fahrt}
				{@render verbindung(fahrt)}
			{/each}
		</ul>
		{#if weitereFahrten.length > 0}
			<details>
				<summary>Frühere Verbindungen ({weitereFahrten.length})</summary>
				<ul class="fahrten">
					{#each weitereFahrten as fahrt}
						{@render verbindung(fahrt)}
					{/each}
				</ul>
			</details>
		{/if}
	{/if}
	<p class="quelle">{transit.source}</p>
</section>

{#snippet verbindung(fahrt: Departure)}
	<li>
		<div>
			<strong>{hhmm(fahrt.departure)}</strong> &rarr; {hhmm(fahrt.arrival)}
			<span class="linie">{fahrt.line}</span>
			{#if fahrt.delayMinutes}<span class="delay">+{fahrt.delayMinutes} min</span>{/if}
		</div>
		<div class="detail">
			{#if fahrt.walkMinutes}{fahrt.walkMinutes} min zu Fuß zur Haltestelle · {/if}
			{#if fahrt.transfers === 0}direkt{:else if fahrt.transfers}{fahrt.transfers} Umstieg{fahrt.transfers > 1 ? 'e' : ''}{/if}
			{#if fahrt.legs && fahrt.legs.length > 1}
				({fahrt.legs.map((l) => `${l.line} ab ${l.from} ${l.departure}`).join(', ')})
			{/if}
			&rarr; {fahrt.headsign}
		</div>
	</li>
{/snippet}

<style>
	.zurueck { font-size: 0.87rem; margin: 0 0 0.9rem; }
	.zurueck a { text-decoration: none; color: var(--sky-deep); }
	.zurueck a:hover { text-decoration: underline; }

	.kopf {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}

	h1 { margin: 0; font-size: clamp(1.6rem, 4.5vw, 2.1rem); letter-spacing: -0.02em; color: var(--sky-deep); }

	.meta { margin: 0.3rem 0 0; color: var(--muted); font-size: 0.87rem; }

	.blick {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.7rem;
		margin: 1.2rem 0 0.6rem;
	}

	@media (max-width: 30rem) {
		.blick { grid-template-columns: 1fr 1fr; }
		.blick .kachel:first-child { grid-column: 1 / -1; }
	}

	.kachel {
		background: var(--surface);
		border-radius: 1rem;
		padding: 0.8rem 1rem;
		display: flex;
		flex-direction: column;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}

	.kachel:first-child { border: 2px solid var(--sky); }
	.kachel.eng { border-color: var(--rot); }

	.kachel strong { font-size: 1.7rem; letter-spacing: -0.02em; line-height: 1.15; }
	.kachel.eng strong { color: var(--text-kritisch); }

	.label { color: var(--muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; }
	.klein { color: var(--muted); font-size: 0.8rem; }

	.note { margin: 0.2rem 0 0; font-size: 0.92rem; }
	.note.eng { color: var(--text-kritisch); font-weight: 600; }

	.beschreibung { color: var(--muted); }

	.belegt {
		font-size: 0.82rem;
		color: var(--muted);
		border-left: 3px solid var(--sky);
		padding-left: 0.7rem;
	}

	.panel {
		background: var(--surface);
		border-radius: 1rem;
		padding: 1.05rem 1.25rem;
		margin-top: 1rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}

	.panel h2 { margin: 0 0 0.8rem; font-size: 1.08rem; color: var(--sky-deep); }
	.unter { font-weight: 400; color: var(--muted); font-size: 0.87rem; }

	.gruende { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; }

	.gruende li {
		display: grid;
		grid-template-columns: 9rem 1fr;
		gap: 0.75rem;
		font-size: 0.9rem;
		padding-left: 0.7rem;
		border-left: 3px solid var(--border);
	}

	.gruende li.warnung { border-left-color: var(--gelb); }
	.gruende li.kritisch { border-left-color: var(--rot); }

	@media (max-width: 40rem) {
		.gruende li { grid-template-columns: 1fr; gap: 0.15rem; }
	}

	.ablauf { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.1rem; }

	.ablauf li {
		display: grid;
		grid-template-columns: 4rem 1fr;
		gap: 0.75rem;
		font-size: 0.92rem;
		padding: 0.35rem 0 0.35rem 0.8rem;
		border-left: 2px solid var(--border);
	}

	.ablauf li.wichtig { border-left: 4px solid var(--text-warnung); font-weight: 650; }
	.ablauf li.wichtig .uhr { color: var(--text-warnung); }
	.uhr { font-variant-numeric: tabular-nums; font-weight: 650; }

	.werte { margin: 0; display: grid; gap: 0.55rem; }
	.werte div { display: grid; grid-template-columns: 9rem 1fr; gap: 0.75rem; font-size: 0.9rem; }
	dt { color: var(--muted); }
	dd { margin: 0; }

	@media (max-width: 40rem) {
		.werte div { grid-template-columns: 1fr; gap: 0.1rem; }
	}

	.huetten { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; font-size: 0.9rem; }
	.huetten li { display: flex; justify-content: space-between; gap: 1rem; padding-left: 0.7rem; border-left: 3px solid var(--muted); }
	.art { display: block; color: var(--muted); font-size: 0.8rem; }
	.entfernung { color: var(--muted); white-space: nowrap; }

	.vorspann { margin: 0 0 0.6rem; font-size: 0.87rem; color: var(--muted); }
	.leer { margin: 0; color: var(--text-kritisch); }

	.fahrten { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; font-size: 0.9rem; }
	.linie { margin-left: 0.4rem; color: var(--sky-deep); font-weight: 650; }
	.detail { color: var(--muted); font-size: 0.8rem; }
	.delay { color: var(--text-kritisch); margin-left: 0.4rem; }

	details { margin-top: 0.9rem; }
	summary { cursor: pointer; color: var(--sky-deep); font-size: 0.88rem; padding: 0.3rem 0; }
	details .fahrten { margin-top: 0.6rem; }

	.earth { display: flex; flex-wrap: wrap; gap: 0.4rem 1.2rem; margin: 0.7rem 0 0; font-size: 0.88rem; }
	.earth a { color: var(--sky-deep); font-weight: 600; }

	.tal { font-size: 0.88rem; color: var(--muted); margin: 0 0 0.8rem; }
	.tal a { color: var(--sky-deep); }

	.punkte { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; font-size: 0.9rem; }
	.punkte li { display: grid; grid-template-columns: 2.4rem 1fr; gap: 0.6rem; align-items: center; }
	.punkte a { color: var(--sky-deep); }
	/* Kleiner Balken: wie weit Richtung Gipfel der Punkt liegt */
	.anteil {
		height: 0.4rem;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--sky) calc(var(--anteil) * 100%), var(--surface-2) 0);
	}

	.quelle { margin: 0.9rem 0 0; color: var(--muted); font-size: 0.76rem; }
</style>
