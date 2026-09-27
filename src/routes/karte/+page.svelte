<script lang="ts">
	import { base } from '$app/paths';
	import DataNotice from '$lib/components/DataNotice.svelte';
	import TourMap from '$lib/components/TourMap.svelte';
	import type { MapMarker, MapTrack } from '$lib/components/mapTypes';
	import SignalBadge from '$lib/components/SignalBadge.svelte';
	import { hhmm } from '$lib/logic/turnaround';
	import { planQuery } from '$lib/planParams';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const groups = $derived(data.groups);
	const query = $derived(planQuery(data.params));
	const tourHref = (id: string) => `${base}/tour/${id}${query}`;

	function anzahl(count: number, einzahl: string, mehrzahl: string): string {
		return `${count} ${count === 1 ? einzahl : mehrzahl}`;
	}

	const gipfel = $derived<MapMarker[]>(
		groups.flatMap((group) =>
			group.tours
				.filter((t) => t.tour.summit)
				.map((t) => ({
					lat: t.tour.summit!.lat,
					lon: t.tour.summit!.lon,
					signal: t.rating.signal,
					label: t.tour.summit!.name,
					sub: t.tour.summit!.ele ? `${t.tour.summit!.ele} m` : undefined,
					links: [{ text: t.tour.name, href: tourHref(t.tour.id), signal: t.rating.signal }],
					shape: 'gipfel' as const
				}))
		)
	);

	const ausgangspunkte = $derived<MapMarker[]>(
		groups.map((group) => ({
			lat: group.lat,
			lon: group.lon,
			signal: group.bestSignal,
			label: group.name,
			sub: `${anzahl(group.tours.length, 'Tour', 'Touren')} · ${group.feasibleCount} ${group.feasibleCount === 1 ? 'geht' : 'gehen'} sich zeitlich aus`,
			count: group.tours.length,
			links: group.tours.map((t) => ({ text: t.tour.name, href: tourHref(t.tour.id), signal: t.rating.signal }))
		}))
	);

	const tracks = $derived(
		(data.tracks as MapTrack[]).map((t) => ({ ...t, href: t.href ? `${t.href}${query}` : undefined }))
	);
</script>

<svelte:head><title>Karte - Bergampel Innsbruck</title></svelte:head>

<DataNotice status={data.status} />

<header class="kopf">
	<div>
		<h1>Karte</h1>
		<p class="meta">
			Ein Kreis je Ausgangspunkt, gefärbt nach der <em>besten</em> Tour von dort.
			{#if data.bulletin}
				Gefahrenstufe {data.bulletin.rating.above}{#if data.bulletin.rating.elevationBoundary}
					&nbsp;oberhalb {data.bulletin.rating.elevationBoundary} m{/if}.
			{:else}
				Lagebericht nicht verfügbar.
			{/if}
		</p>
	</div>
	<a class="wechsel" href="{base}/{query}">Als Liste</a>
</header>

<TourMap markers={[...gipfel, ...ausgangspunkte]} {tracks} osm height="min(70vh, 36rem)" />

<ul class="legende" aria-label="Legende">
	<li><span class="punkt gruen"></span>Geat</li>
	<li><span class="punkt gelb"></span>Heikl</li>
	<li><span class="punkt rot"></span>Heit nit</li>
	<li><span class="form kreis"></span>Haltestelle (Zahl = Touren)</li>
	<li><span class="form dreieck"></span>Gipfel</li>
	<li><span class="linie blau"></span>Wanderweg (Sommer)</li>
	<li><span class="linie gruen-dunkel"></span>Skitouren-Aufstieg</li>
	<li><span class="linie punktiert"></span>Seilbahn</li>
	<li><span class="punkt grau"></span>Hütte, Einkehr</li>
</ul>
<p class="hinweis">
	Wege, Hütten und Seilbahnen stammen aus OpenStreetMap und lassen sich oben rechts ein- und
	ausschalten. Wanderwege sind Sommerwege - im Winter keine Aufstiegsroute.
</p>

<ol class="liste">
	{#each groups as group (group.stop)}
		<li>
			<div class="zeile">
				<SignalBadge signal={group.bestSignal} />
				<div>
					<strong>{group.name}</strong>
					<span class="halt">Haltestelle {group.stop}</span>
				</div>
			</div>
			<ul class="touren">
				{#each group.tours as plan (plan.tour.id)}
					<li class={plan.rating.signal}>
						<a href={tourHref(plan.tour.id)}>{plan.tour.name}</a>
						<span class="zeit">
							{#if plan.turnaround.turnaroundAt}
								umkehrn um {hhmm(plan.turnaround.turnaroundAt)}
							{:else}
								koa Rückfahrt
							{/if}
						</span>
					</li>
				{/each}
			</ul>
		</li>
	{/each}
</ol>

<style>
	.kopf {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 0.9rem;
	}

	h1 { margin: 0; font-size: 1.6rem; letter-spacing: -0.02em; color: var(--sky-deep); }

	.meta { margin: 0.25rem 0 0; color: var(--muted); font-size: 0.87rem; }

	.wechsel {
		background: var(--surface);
		border-radius: 999px;
		padding: 0.5rem 0.95rem;
		font-size: 0.87rem;
		text-decoration: none;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
	}

	.wechsel:hover { color: var(--sky-deep); }

	.legende {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
		margin: 0.8rem 0 0.2rem;
		padding: 0;
		font-size: 0.78rem;
		color: var(--muted);
	}

	.legende li { display: flex; align-items: center; gap: 0.35rem; }

	.punkt { width: 0.62rem; height: 0.62rem; border-radius: 50%; display: inline-block; }
	.punkt.gruen { background: var(--gruen); }
	.punkt.gelb { background: var(--gelb); }
	.punkt.rot { background: var(--rot); }
	.punkt.grau { background: var(--muted); }

	.form.kreis { width: 0.8rem; height: 0.8rem; border-radius: 50%; border: 2px solid var(--muted); display: inline-block; }
	.form.dreieck { width: 0.8rem; height: 0.7rem; background: var(--muted); clip-path: polygon(50% 0, 100% 100%, 0 100%); display: inline-block; }

	.linie { width: 1.4rem; height: 0; display: inline-block; border-top: 3px solid; }
	.linie.blau { border-color: var(--sky); }
	.linie.gruen-dunkel { border-color: var(--forest); }
	.linie.punktiert { border-top-style: dotted; border-color: var(--text); }

	.hinweis { margin: 0.3rem 0 0; font-size: 0.78rem; color: var(--muted); }

	.liste {
		list-style: none;
		margin: 1.4rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.8rem;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
	}

	.liste > li { background: var(--surface); border-radius: 1rem; padding: 0.95rem 1.05rem; }

	.zeile { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 0.6rem; }

	.halt { display: block; color: var(--muted); font-size: 0.75rem; }

	.touren { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.35rem; font-size: 0.87rem; }

	.touren li {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		padding-left: 0.6rem;
		border-left: 3px solid var(--unbekannt);
	}

	.touren li.gruen { border-left-color: var(--gruen); }
	.touren li.gelb { border-left-color: var(--gelb); }
	.touren li.rot { border-left-color: var(--rot); }

	.touren a { text-decoration: none; }
	.touren a:hover { text-decoration: underline; color: var(--sky-deep); }

	.zeit { color: var(--muted); font-size: 0.78rem; white-space: nowrap; }
</style>
