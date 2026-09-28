<script lang="ts">
	import { base } from '$app/paths';
	import type { TourPlan } from '$lib/server/plan';
	import { formatReserve, hhmm } from '$lib/logic/turnaround';
	import { TEXT } from '$lib/copy';
	import SignalBadge from './SignalBadge.svelte';

	let { plan, query = '' }: { plan: TourPlan; query?: string } = $props();

	const tour = $derived(plan.tour);
	const rating = $derived(plan.rating);
	const turnaround = $derived(plan.turnaround);
	const transit = $derived(plan.transit);
	const hinweise = $derived(rating.reasons.filter((r) => r.impact !== 'neutral'));
	const stunden = $derived(Math.round((tour.ascentMinutes / 60) * 10) / 10);
</script>

<a class="card {rating.signal}" href="{base}/tour/{tour.id}{query}">
	<header>
		<div>
			<h3>{tour.name}</h3>
			<p class="meta">
				{tour.trailhead} · {tour.summitAltitude} m · {tour.ascentMeters} Hm · {stunden} h Aufstieg
			</p>
		</div>
		<SignalBadge signal={rating.signal} />
	</header>

	{#if hinweise.length > 0}
		<ul class="reasons">
			{#each hinweise.slice(0, 2) as reason}
				<li class={reason.impact}>{reason.detail}</li>
			{/each}
		</ul>
	{:else}
		<p class="reasons-ok">Keine erhöhten Warnfaktoren für diese Tour.</p>
	{/if}

	<footer class="transit" class:eng={!turnaround.feasible}>
		{#if turnaround.lastInbound}
			<div>
				<span class="label">{TEXT.letzterBus}</span>
				<strong>{hhmm(turnaround.lastInbound.departure)}</strong>
				<span class="line">{turnaround.lastInbound.line}</span>
			</div>
			<div>
				<span class="label">{TEXT.umkehr}</span>
				<strong>{turnaround.turnaroundAt ? hhmm(turnaround.turnaroundAt) : '-'}</strong>
				{#if turnaround.slackMinutes !== null}
					<span class="line">
						{turnaround.slackMinutes >= 0 ? `+${formatReserve(turnaround.slackMinutes)}` : `-${formatReserve(-turnaround.slackMinutes)}`}
					</span>
				{/if}
			</div>
		{:else}
			<p>{turnaround.note}</p>
		{/if}
		{#if transit.kind === 'demo'}<span class="tag">Demo-Fahrplan</span>{/if}
	</footer>
</a>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: var(--surface);
		border-radius: 1rem;
		padding: 1rem 1.15rem;
		border-left: 4px solid var(--unbekannt);
		color: inherit;
		text-decoration: none;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.card:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
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

	h3 {
		margin: 0;
		font-size: 1.06rem;
		line-height: 1.3;
	}

	.card:hover h3 {
		color: var(--sky-deep);
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

	.reasons li.kritisch { color: var(--text-kritisch); }
	.reasons li.warnung { color: var(--text-warnung); }

	.reasons-ok {
		margin: 0;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.transit {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.5rem 1.5rem;
		margin-top: auto;
		padding-top: 0.65rem;
		border-top: 1px solid var(--border);
		font-size: 0.86rem;
	}

	.transit.eng strong { color: var(--text-kritisch); }

	.transit p { margin: 0; color: var(--muted); font-size: 0.82rem; }

	.label {
		display: block;
		color: var(--muted);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.line {
		color: var(--muted);
		margin-left: 0.3rem;
	}

	.tag {
		margin-left: auto;
		font-size: 0.7rem;
		color: var(--hinweis-text);
		background: var(--hinweis-bg);
		border-radius: 999px;
		padding: 0.1rem 0.5rem;
	}
</style>
