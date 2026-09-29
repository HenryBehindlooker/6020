<script lang="ts">
	import PhotoGallery from '$lib/components/PhotoGallery.svelte';
	import TourMap from '$lib/components/TourMap.svelte';
	import type { MapMarker } from '$lib/components/mapTypes';
	import { googleEarthUrl } from '$lib/logic/kml';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const marker = $derived<MapMarker[]>(
		data.valleys.map((v) => ({ lat: v.lat, lon: v.lon, signal: 'unbekannt', label: v.title, sub: 'Tal oder Gebiet laut Wikipedia' }))
	);
</script>

<svelte:head>
	<title>Täler - Bergampel Innsbruck</title>
</svelte:head>

<h1>Rund um Innsbruck</h1>
<p class="lead">Die Täler und Berge rund um die Touren – zum Anschauen, Nachlesen und in 3D Umschauen.</p>

{#if data.valleys.length === 0}
	<p class="leer">Die Bilder sind noch nicht abgeholt. Sie kommen mit dem nächsten Lauf des Daten-Abholers.</p>
{:else}
	<section class="panel">
		<TourMap markers={marker} height="20rem" zoom={10} />
	</section>

	<ul class="taeler">
		{#each data.valleys as tal (tal.title)}
			<li class="panel">
				<PhotoGallery photos={[tal.photo]} alt={tal.title} />
				<h2>{tal.title}</h2>
				<p>{tal.extract}</p>
				{#if tal.tours.length > 0}
					<p class="touren">
						Touren in der Nähe:
						{#each tal.tours as t, i}<a href={t.href}>{t.name}</a>{i < tal.tours.length - 1 ? ', ' : ''}{/each}
					</p>
				{/if}
				<p class="links">
					<a href={tal.article} target="_blank" rel="noopener noreferrer">Wikipedia</a>
					<a href={googleEarthUrl(tal.lat, tal.lon, 1200, 12000)} target="_blank" rel="noopener noreferrer">Google Earth (3D)</a>
				</p>
			</li>
		{/each}
	</ul>
	<p class="quelle">
		Texte: Wikipedia, CC BY-SA 4.0 · Fotos: Wikimedia Commons, Urheber und Lizenz beim Bild (antippen).
	</p>
{/if}

<style>
	h1 { margin: 0; color: var(--sky-deep); letter-spacing: -0.02em; }
	.lead { color: var(--muted); margin: 0.3rem 0 1rem; }
	.leer { color: var(--muted); }
	.panel {
		background: var(--surface);
		border-radius: 1rem;
		padding: 1rem 1.1rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}
	.taeler {
		list-style: none;
		padding: 0;
		margin: 1rem 0 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: 1rem;
	}
	.taeler :global(.galerie) { grid-template-columns: 1fr; }
	.taeler :global(.galerie img) { height: 11rem; }
	h2 { margin: 0.6rem 0 0.3rem; font-size: 1.08rem; color: var(--sky-deep); }
	.taeler p { font-size: 0.88rem; margin: 0.3rem 0; }
	.touren { color: var(--muted); }
	.taeler a { color: var(--sky-deep); }
	.links { display: flex; gap: 1rem; font-weight: 600; }
	.quelle { margin: 1rem 0 0; color: var(--muted); font-size: 0.76rem; }
</style>
