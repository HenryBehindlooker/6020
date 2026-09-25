<script lang="ts">
	import { base } from '$app/paths';
	import TourMap from '$lib/components/TourMap.svelte';
	import type { MapMarker, MapTrack } from '$lib/components/mapTypes';
	import SignalBadge from '$lib/components/SignalBadge.svelte';
	import { hhmm } from '$lib/logic/turnaround';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const groups = $derived(data.groups);

	function plural(count: number, singular: string, plural: string): string {
		return `${count} ${count === 1 ? singular : plural}`;
	}

	const markers = $derived<MapMarker[]>(
		groups.map((group) => ({
			lat: group.lat,
			lon: group.lon,
			signal: group.bestSignal,
			label: group.name,
			sub: `${plural(group.tours.length, 'Tour', 'Touren')} · ${group.feasibleCount} ${group.feasibleCount === 1 ? 'geht' : 'gehen'} sich zeitlich aus`,
			count: group.tours.length,
			links: group.tours.map((t) => ({
				text: t.tour.name,
				href: `${base}/tour/${t.tour.id}`,
				signal: t.rating.signal
			}))
		}))
	);
</script>

<svelte:head><title>Karte - Bergampel Innsbruck</title></svelte:head>

{#if data.mode === 'demo'}
	<p class="demo" role="status">
		<strong>Demodaten.</strong> Lawinenlage, Wetter und Fahrplan stammen aus Beispieldateien.
	</p>
{/if}

<header class="kopf">
	<div>
		<h1>Karte</h1>
		<p class="meta">
			Ein Punkt je Ausgangspunkt, gefaerbt nach der <em>besten</em> Tour von dort.
			Gefahrenstufe {data.bulletin.rating.above}
			{#if data.bulletin.rating.elevationBoundary}
				ueber {data.bulletin.rating.elevationBoundary} m
			{/if}
		</p>
	</div>
	<a class="wechsel" href="{base}/">Als Liste</a>
</header>

<TourMap {markers} tracks={data.tracks as MapTrack[]} height="30rem" />

<p class="legende">
	<span class="gruen">Geht</span>
	<span class="gelb">Heikel</span>
	<span class="rot">Heute nicht</span>
	<span class="hinweis">Die Zahl im Punkt ist die Anzahl der Touren ab diesem Ausgangspunkt.</span>
	{#if data.tracks.some((t) => t.schematic)}
		<span class="hinweis gestrichelt">Gestrichelte Linien sind schematisch, keine Wegaufzeichnung.</span>
	{/if}
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
						<a href="{base}/tour/{plan.tour.id}">{plan.tour.name}</a>
						<span class="zeit">
							{#if plan.turnaround.turnaroundAt}
								Umkehr {hhmm(plan.turnaround.turnaroundAt)}
							{:else}
								keine Rueckfahrt
							{/if}
						</span>
					</li>
				{/each}
			</ul>
		</li>
	{/each}
</ol>

<style>
	.demo {
		background: #78350f;
		color: #fef3c7;
		padding: 0.7rem 0.9rem;
		border-radius: 0.6rem;
		font-size: 0.85rem;
		margin-bottom: 1.25rem;
	}

	.kopf {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 0.9rem;
	}

	h1 { margin: 0; font-size: 1.5rem; letter-spacing: -0.02em; }

	.meta { margin: 0.25rem 0 0; color: var(--muted); font-size: 0.85rem; }

	.wechsel {
		background: var(--surface-2);
		border-radius: 0.45rem;
		padding: 0.45rem 0.8rem;
		font-size: 0.85rem;
		text-decoration: none;
	}

	.legende {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.9rem;
		margin: 0.7rem 0 0;
		font-size: 0.78rem;
		color: var(--muted);
	}

	.legende span::before {
		content: '';
		display: inline-block;
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		margin-right: 0.35rem;
	}

	.legende .gruen::before { background: var(--gruen); }
	.legende .gelb::before { background: var(--gelb); }
	.legende .rot::before { background: var(--rot); }
	.legende .hinweis::before { display: none; }

	.legende .gestrichelt::before {
		display: inline-block;
		width: 1.4rem;
		height: 0;
		border-radius: 0;
		border-top: 2px dashed var(--muted);
		margin-bottom: 0.25rem;
	}

	.liste {
		list-style: none;
		margin: 1.25rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
	}

	.liste > li {
		background: var(--surface);
		border-radius: 0.9rem;
		padding: 0.9rem 1rem;
	}

	.zeile {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		margin-bottom: 0.6rem;
	}

	.halt { display: block; color: var(--muted); font-size: 0.75rem; }

	.touren { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; font-size: 0.85rem; }

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
	.touren a:hover { text-decoration: underline; }

	.zeit { color: var(--muted); font-size: 0.78rem; white-space: nowrap; }
</style>
