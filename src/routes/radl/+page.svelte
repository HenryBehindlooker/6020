<script lang="ts">
	import TourMap from '$lib/components/TourMap.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let art = $state<'alle' | 'mtb' | 'rad'>('alle');
	let sortierung = $state<'name' | 'laenge'>('laenge');
	let suche = $state('');
	let alle = $state(false);
	const ERSTE = 25;

	const MTB_SCALE: Record<string, string> = {
		'0': 'S0 leicht',
		'1': 'S1 leicht–mittel',
		'2': 'S2 mittel',
		'3': 'S3 schwer',
		'4': 'S4 sehr schwer',
		'5': 'S5 extrem'
	};

	const liste = $derived(
		data.routes
			.filter((r) => art === 'alle' || r.kind === art)
			.filter((r) => {
				const q = suche.trim().toLowerCase();
				return !q || `${r.name} ${r.ref ?? ''} ${r.network ?? ''}`.toLowerCase().includes(q);
			})
			.toSorted((a, b) => (sortierung === 'laenge' ? b.lengthKm - a.lengthKm : a.name.localeCompare(b.name, 'de')))
	);
	const sichtbar = $derived(alle ? liste : liste.slice(0, ERSTE));
	const anzahl = $derived({
		mtb: data.routes.filter((r) => r.kind === 'mtb').length,
		rad: data.routes.filter((r) => r.kind === 'rad').length
	});
</script>

<svelte:head>
	<title>Radl & MTB - Bergampel Innsbruck</title>
</svelte:head>

<h1>Aufi aufs Radl</h1>
<p class="lead">
	Beschilderte Mountainbike- und Radrouten rund um Innsbruck aus OpenStreetMap – für den Sommer, wenn
	die Skitouren Pause haben.
</p>

{#if data.routes.length === 0}
	<p class="leer">
		Die Radrouten sind noch nicht abgeholt. Sie kommen mit dem nächsten Lauf des Daten-Abholers.
	</p>
{:else}
	<section class="panel">
		<TourMap markers={[]} osm osmVisible={{ bike: true, hiking: false, skitour: false, aerialways: true, huts: true }} height="26rem" zoom={11} />
		<p class="quelle">
			Lila: Radl- und MTB-Routen (MTB durchgezogen, Radrouten gestrichelt). Hütten und Seilbahnen oben
			rechts zuschaltbar.
		</p>
	</section>

	<section class="panel">
		<div class="filter" role="group" aria-label="Routen filtern">
			<button type="button" aria-pressed={art === 'alle'} onclick={() => (art = 'alle')}>Alle ({data.routes.length})</button>
			<button type="button" aria-pressed={art === 'mtb'} onclick={() => (art = 'mtb')}>MTB ({anzahl.mtb})</button>
			<button type="button" aria-pressed={art === 'rad'} onclick={() => (art = 'rad')}>Radwege ({anzahl.rad})</button>
			<input type="search" bind:value={suche} placeholder="Suchen, z.B. Mutters" aria-label="Routen suchen" />
			<label>
				Sortieren
				<select bind:value={sortierung}>
					<option value="name">nach Name</option>
					<option value="laenge">nach Länge</option>
				</select>
			</label>
		</div>
		<ul class="routen">
			{#each sichtbar as route (route.osm ?? route.name)}
				<li>
					<div>
						<strong>{route.name}</strong>{#if route.ref}<span class="ref">{route.ref}</span>{/if}
						<span class="art">
							{route.kind === 'mtb' ? 'Mountainbike' : 'Radroute'}
							{#if route.mtbScale} · {MTB_SCALE[route.mtbScale] ?? route.mtbScale}{/if}
							{#if route.ascent} · {route.ascent} Hm{/if}
							{#if route.roundtrip} · Rundtour{/if}
							{#if route.network} · Netz {route.network}{/if}
						</span>
						<span class="links">
							{#if route.osm}<a href="https://www.openstreetmap.org/{route.osm}" target="_blank" rel="noopener noreferrer">OSM</a>{/if}
							{#if route.website}<a href={route.website} target="_blank" rel="noopener noreferrer">Website</a>{/if}
						</span>
					</div>
					<span class="km">{route.lengthKm} km</span>
				</li>
			{/each}
		</ul>
		{#if liste.length === 0}
			<p class="leer">Nix gfundn. Anderer Suchbegriff?</p>
		{:else if !alle && liste.length > ERSTE}
			<button type="button" class="mehr" onclick={() => (alle = true)}>Olle zoagn ({liste.length})</button>
		{/if}
		<p class="quelle">
			Länge = Anteil der Route im Kartenausschnitt rund um Innsbruck; lange Radwege wie der Innradweg
			gehen darüber hinaus. Schwierigkeit (Singletrail-Skala) nur, wo sie in OSM steht. Radmitnahme in
			Bus und Bahn vorher beim VVT prüfen. Daten © OpenStreetMap-Mitwirkende (ODbL){#if data.osmStand},
			Stand {data.osmStand.slice(0, 10)}{/if}.
		</p>
	</section>
{/if}

<style>
	h1 { margin: 0; color: var(--sky-deep); letter-spacing: -0.02em; }
	.lead { color: var(--muted); margin: 0.3rem 0 1rem; }
	.leer { color: var(--muted); }
	.panel {
		background: var(--surface);
		border-radius: 1rem;
		padding: 1.05rem 1.25rem;
		margin-top: 1rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}
	.filter { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 0.9rem; }
	.filter button {
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		border-radius: 999px;
		padding: 0.35rem 0.9rem;
		cursor: pointer;
		font: inherit;
		font-size: 0.87rem;
	}
	.filter button[aria-pressed='true'] { background: var(--sky-deep); border-color: var(--sky-deep); color: var(--snow); }
	.filter label { margin-left: auto; font-size: 0.85rem; color: var(--muted); display: flex; gap: 0.4rem; align-items: center; }
	.filter select { font: inherit; padding: 0.25rem; border-radius: 0.4rem; border: 1px solid var(--border); background: var(--surface); color: var(--text); }
	.filter input[type='search'] {
		font: inherit;
		font-size: 0.87rem;
		padding: 0.35rem 0.7rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		min-width: 12rem;
	}
	.mehr {
		margin-top: 0.9rem;
		border: 1px solid var(--sky-deep);
		background: transparent;
		color: var(--sky-deep);
		border-radius: 999px;
		padding: 0.4rem 1rem;
		font: inherit;
		cursor: pointer;
	}
	.routen { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; font-size: 0.9rem; }
	.routen li { display: flex; justify-content: space-between; gap: 1rem; padding-left: 0.7rem; border-left: 3px solid #8e44ad; }
	.ref { margin-left: 0.4rem; color: var(--sky-deep); font-weight: 650; font-size: 0.82rem; }
	.art { display: block; color: var(--muted); font-size: 0.8rem; }
	.links { display: flex; gap: 0.8rem; font-size: 0.8rem; }
	.links a { color: var(--sky-deep); }
	.km { color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
	.quelle { margin: 0.9rem 0 0; color: var(--muted); font-size: 0.76rem; }
</style>
