<script lang="ts">
	import { base } from '$app/paths';
	import type { TourPlan } from '$lib/server/plan';
	import { hhmm } from '$lib/logic/turnaround';
	import SignalBadge from './SignalBadge.svelte';

	let { plan }: { plan: TourPlan } = $props();

	const tour = $derived(plan.tour);
	const rating = $derived(plan.rating);
	const turnaround = $derived(plan.turnaround);
	const kritisch = $derived(rating.reasons.filter((r) => r.impact !== 'neutral'));
</script>

<article class="card {rating.signal}">
	<header>
		<div>
			<h2><a href="{base}/tour/{tour.id}">{tour.name}</a></h2>
			<p class="meta">
				{tour.trailhead} · {tour.summitAltitude} m · {tour.ascentMeters} hm ·
				{Math.round(tour.ascentMinutes / 60 * 10) / 10} h Aufstieg
			</p>
		</div>
		<SignalBadge signal={rating.signal} />
	</header>

	{#if kritisch.length > 0}
		<ul class="reasons">
			{#each kritisch.slice(0, 2) as reason}
				<li class={reason.impact}>{reason.detail}</li>
			{/each}
		</ul>
	{:else}
		<p class="reasons-ok">Keine erhoehten Warnfaktoren fuer diese Tour.</p>
	{/if}

	<div class="transit" class:eng={!turnaround.feasible}>
		{#if turnaround.lastInbound}
			<div>
				<span class="label">Letzter Bus</span>
				<strong>{hhmm(turnaround.lastInbound.departure)}</strong>
				<span class="line">Linie {turnaround.lastInbound.line}</span>
			</div>
			<div>
				<span class="label">Umkehrzeit</span>
				<strong>{turnaround.turnaroundAt ? hhmm(turnaround.turnaroundAt) : '-'}</strong>
				{#if turnaround.slackMinutes !== null}
					<span class="line">{turnaround.slackMinutes >= 0 ? `+${turnaround.slackMinutes}` : turnaround.slackMinutes} min</span>
				{/if}
			</div>
		{:else}
			<p>{turnaround.note}</p>
		{/if}
	</div>
</article>

<style>
	.card {
		background: var(--surface);
		border-radius: 0.9rem;
		padding: 1rem 1.1rem;
		border-left: 4px solid var(--unbekannt);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.card.gruen { border-left-color: var(--gruen); }
	.card.gelb { border-left-color: var(--gelb); }
	.card.rot { border-left-color: var(--rot); }

	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
	}

	h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	h2 a {
		text-decoration: none;
	}

	h2 a:hover {
		text-decoration: underline;
	}

	.meta {
		margin: 0.2rem 0 0;
		color: var(--muted);
		font-size: 0.82rem;
	}

	.reasons {
		margin: 0;
		padding-left: 1.1rem;
		font-size: 0.85rem;
	}

	.reasons li.kritisch { color: #fca5a5; }
	.reasons li.warnung { color: #fde047; }

	.reasons-ok {
		margin: 0;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.transit {
		display: flex;
		gap: 1.5rem;
		padding-top: 0.6rem;
		border-top: 1px solid var(--surface-2);
		font-size: 0.85rem;
	}

	.transit.eng strong { color: #fca5a5; }

	.transit p { margin: 0; color: var(--muted); }

	.label {
		display: block;
		color: var(--muted);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.line {
		color: var(--muted);
		margin-left: 0.35rem;
	}
</style>
