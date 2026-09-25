<script lang="ts">
	import TourCard from '$lib/components/TourCard.svelte';
	import { problemLabel } from '$lib/logic/rating';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const plan = $derived(data.plan);
	const machbar = $derived(
		plan.tours.filter((t) => t.rating.signal !== 'rot' && t.turnaround.feasible)
	);
	const rest = $derived(plan.tours.filter((t) => !machbar.includes(t)));

	const datum = $derived(
		new Date(plan.date).toLocaleDateString('de-AT', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		})
	);
</script>

{#if plan.mode === 'demo'}
	<p class="demo" role="status">
		<strong>Demodaten.</strong> Lawinenlage, Wetter und Fahrplan stammen aus mitgelieferten
		Beispieldateien - keine gueltige Auskunft. Fuer echte Daten <code>DATA_MODE=live</code> setzen.
	</p>
{/if}

<section class="bulletin">
	<div class="head">
		<h1>Was geht heute?</h1>
		<span class="datum">{datum} · <a href="/karte">auf der Karte</a></span>
	</div>
	<p class="stufe">
		Gefahrenstufe <strong>{plan.bulletin.rating.above}</strong>
		{#if plan.bulletin.rating.elevationBoundary}
			oberhalb {plan.bulletin.rating.elevationBoundary} m, darunter
			<strong>{plan.bulletin.rating.below}</strong>
		{/if}
	</p>
	<p class="summary">{plan.bulletin.summary}</p>
	{#if plan.bulletin.problems.length > 0}
		<ul class="problems">
			{#each plan.bulletin.problems as problem}
				<li>
					<strong>{problemLabel(problem.type)}</strong>
					{problem.aspects.join('/')}
					{#if problem.elevationAbove}ab {problem.elevationAbove} m{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<form class="filter" method="get">
	<label>
		Aufbruch ab
		<input type="time" name="ab" value={data.notBefore} />
	</label>
	<label>
		Puffer vor dem Bus
		<input type="number" name="puffer" min="10" max="120" step="5" value={data.buffer} /> min
	</label>
	<button type="submit">Neu rechnen</button>
</form>

<h2 class="gruppe">Geht sich aus ({machbar.length})</h2>
<div class="grid">
	{#each machbar as tourPlan (tourPlan.tour.id)}
		<TourCard plan={tourPlan} />
	{/each}
</div>

{#if rest.length > 0}
	<h2 class="gruppe">Heute eher nicht ({rest.length})</h2>
	<div class="grid">
		{#each rest as tourPlan (tourPlan.tour.id)}
			<TourCard plan={tourPlan} />
		{/each}
	</div>
{/if}

<p class="quellen">Quellen: {plan.sources.join(' · ')}</p>

<style>
	.demo {
		background: #78350f;
		color: #fef3c7;
		padding: 0.7rem 0.9rem;
		border-radius: 0.6rem;
		font-size: 0.85rem;
		margin-bottom: 1.25rem;
	}

	.demo code {
		background: rgba(0, 0, 0, 0.3);
		padding: 0.1rem 0.3rem;
		border-radius: 0.25rem;
	}

	.bulletin {
		background: var(--surface);
		border-radius: 0.9rem;
		padding: 1.1rem 1.2rem;
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
		letter-spacing: -0.02em;
	}

	.datum {
		color: var(--muted);
		font-size: 0.9rem;
	}

	.stufe {
		margin: 0.6rem 0 0.3rem;
	}

	.summary {
		margin: 0;
		color: var(--muted);
		font-size: 0.9rem;
	}

	.problems {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0.8rem 0 0;
		padding: 0;
		font-size: 0.8rem;
	}

	.problems li {
		background: var(--surface-2);
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
	}

	.filter {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.9rem;
		margin: 1.5rem 0 0.5rem;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.filter label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	input {
		background: var(--surface);
		border: 1px solid var(--surface-2);
		color: var(--text);
		border-radius: 0.45rem;
		padding: 0.4rem 0.55rem;
		font: inherit;
	}

	button {
		background: var(--surface-2);
		border: 0;
		color: var(--text);
		border-radius: 0.45rem;
		padding: 0.5rem 0.9rem;
		font: inherit;
		cursor: pointer;
	}

	button:hover {
		background: #475569;
	}

	.gruppe {
		font-size: 1rem;
		color: var(--muted);
		margin: 1.75rem 0 0.75rem;
		font-weight: 600;
	}

	.grid {
		display: grid;
		gap: 0.9rem;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
	}

	.quellen {
		margin-top: 2rem;
		color: var(--muted);
		font-size: 0.78rem;
	}
</style>
