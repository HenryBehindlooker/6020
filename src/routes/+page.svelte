<script lang="ts">
	import { base } from '$app/paths';
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
	<div class="demo" role="status">
		<p>
			<strong>Lawinenlage und Wetter sind Demodaten</strong> aus Beispieldateien - keine gueltige
			Auskunft. Fuer echte Daten <code>DATA_MODE=live</code> setzen.
		</p>
		{#if data.transit.real}
			<p>
				<strong>Die Busverbindungen sind echt</strong> ({data.transit.stand}). Fahrplaene aendern
				sich - vor der Fahrt in der VVT- oder OeBB-App pruefen.
			</p>
		{/if}
		{#if data.transit.demo}
			<p>Fuer einzelne Haltestellen fehlt ein echter Fahrplan; dort stehen Demo-Linien.</p>
		{/if}
	</div>
{/if}

<section class="bulletin">
	<div class="head">
		<h1>Was geht heute?</h1>
		<span class="datum">{datum} · <a href="{base}/karte">auf der Karte</a></span>
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

{#if data.staticPreview}
	<p class="statisch">
		Vorgerenderte Fassung: Aufbruchszeit und Puffer sind auf
		{data.notBefore} Uhr und {data.buffer} min festgelegt. Zum Umrechnen braucht es den
		Server (<code>npm run dev</code>).
	</p>
{:else}
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
{/if}

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
		background: var(--hinweis-bg);
		color: var(--hinweis-text);
		border: 1px solid var(--hinweis-border);
		padding: 0.7rem 0.9rem;
		border-radius: 0.6rem;
		font-size: 0.85rem;
		margin-bottom: 1.25rem;
	}

	.demo p {
		margin: 0;
	}

	.demo p + p {
		margin-top: 0.35rem;
	}

	.demo code {
		background: rgba(0, 0, 0, 0.08);
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
		border: 1px solid var(--border);
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
		background: var(--border);
	}

	.statisch {
		margin: 1.5rem 0 0.5rem;
		font-size: 0.82rem;
		color: var(--muted);
	}

	.statisch code {
		background: var(--surface);
		padding: 0.1rem 0.3rem;
		border-radius: 0.25rem;
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
