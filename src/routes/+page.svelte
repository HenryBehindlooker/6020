<script lang="ts">
	import { base } from '$app/paths';
	import DataNotice from '$lib/components/DataNotice.svelte';
	import TourCard from '$lib/components/TourCard.svelte';
	import { problemLabel } from '$lib/logic/rating';
	import { planQuery } from '$lib/planParams';
	import { TEXT } from '$lib/copy';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const plan = $derived(data.plan);
	const bulletin = $derived(plan.bulletin);
	const query = $derived(planQuery(data.params));
	const machbar = $derived(plan.tours.filter((t) => t.rating.signal !== 'rot' && t.turnaround.feasible));
	const rest = $derived(plan.tours.filter((t) => !machbar.includes(t)));

	const datum = $derived(
		new Date(plan.date).toLocaleDateString('de-AT', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			timeZone: 'Europe/Vienna'
		})
	);

	const STUFE = ['kein Schnee', 'gering', 'mäßig', 'erheblich', 'groß', 'sehr groß'];

	/** Formular sofort abschicken, sobald sich ein Wert aendert - ohne Knopfdruck. */
	function sofort(event: Event) {
		(event.currentTarget as HTMLFormElement).requestSubmit();
	}
</script>

<svelte:head>
	<title>Wos geat heit? - Bergampel Innsbruck</title>
</svelte:head>

<DataNotice status={plan.status} />

<section class="lage" aria-labelledby="frage">
	<div class="kopf">
		<h1 id="frage">{TEXT.frage}</h1>
		<span class="datum">{datum}</span>
	</div>

	{#if bulletin}
		<p class="stufe">
			<span class="zahl stufe-{bulletin.rating.above}">{bulletin.rating.above}</span>
			<span>
				<strong>Gefahrenstufe {bulletin.rating.above} ({STUFE[bulletin.rating.above]})</strong>
				{#if bulletin.rating.elevationBoundary && bulletin.rating.below !== bulletin.rating.above}
					oberhalb {bulletin.rating.elevationBoundary} m, darunter {bulletin.rating.below}
					({STUFE[bulletin.rating.below]})
				{/if}
			</span>
		</p>
		<p class="summary">{bulletin.summary}</p>
		{#if bulletin.problems.length > 0}
			<ul class="problems" aria-label="Lawinenprobleme">
				{#each bulletin.problems as problem}
					<li>
						<strong>{problemLabel(problem.type)}</strong>
						{problem.aspects.join(' · ')}
						{#if problem.elevationAbove}ab {problem.elevationAbove} m{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{:else}
		<p class="fehlt">
			<strong>Der Lawinenlagebericht ist gerade nicht verfügbar.</strong> Ohne ihn bewertet die
			Bergampel keine Tour. Bitte direkt auf
			<a href="https://lawinen.report" rel="noreferrer">lawinen.report</a> nachschauen.
		</p>
	{/if}
</section>

{#if data.staticPreview}
	<p class="statisch">
		Vorgerenderte Fassung: gerechnet mit Aufbruch um {data.params.notBefore} Uhr und
		{data.params.bufferMinutes} min Puffer bis zum letzten Bus.
	</p>
{:else}
	<form class="filter" method="get" onchange={sofort} data-sveltekit-keepfocus data-sveltekit-noscroll>
		<label>
			<span>{TEXT.aufbruch}</span>
			<input type="time" name="ab" value={data.params.notBefore} step="300" />
		</label>
		<label>
			<span>{TEXT.puffer}</span>
			<span class="mit-einheit">
				<input type="number" name="puffer" min="0" max="180" step="5" value={data.params.bufferMinutes} inputmode="numeric" />
				min
			</span>
		</label>
		<button type="submit">{TEXT.rechnen}</button>
	</form>
{/if}

<section aria-labelledby="gruppe-geht">
	<h2 class="gruppe" id="gruppe-geht">{TEXT.gruppeGeht} <span class="anzahl">{machbar.length}</span></h2>
	{#if machbar.length > 0}
		<div class="grid">
			{#each machbar as tourPlan (tourPlan.tour.id)}
				<TourCard plan={tourPlan} {query} />
			{/each}
		</div>
	{:else}
		<p class="leer">{TEXT.leerGeht}</p>
	{/if}
</section>

{#if rest.length > 0}
	<section aria-labelledby="gruppe-nicht">
		<h2 class="gruppe" id="gruppe-nicht">{TEXT.gruppeNicht} <span class="anzahl">{rest.length}</span></h2>
		<div class="grid">
			{#each rest as tourPlan (tourPlan.tour.id)}
				<TourCard plan={tourPlan} {query} />
			{/each}
		</div>
	</section>
{/if}

<p class="weiter"><a href="{base}/karte{query}">Alle Touren auf der Karte &rarr;</a></p>

<style>
	.lage {
		background: var(--surface);
		border-radius: 1rem;
		padding: 1.2rem 1.3rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}

	.kopf {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.5rem, 4vw, 2rem);
		letter-spacing: -0.02em;
		color: var(--sky-deep);
	}

	.datum {
		color: var(--muted);
		font-size: 0.9rem;
	}

	.stufe {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		margin: 0.9rem 0 0.4rem;
	}

	.zahl {
		display: grid;
		place-items: center;
		flex: none;
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 0.6rem;
		font-weight: 800;
		font-size: 1.3rem;
		color: #fff;
		background: var(--unbekannt);
	}

	/* Farben der europaeischen Lawinengefahrenskala */
	.stufe-1 { background: #ccff66; color: #17232e; }
	.stufe-2 { background: #ffff00; color: #17232e; }
	.stufe-3 { background: #ff9900; color: #17232e; }
	.stufe-4 { background: #ff0000; }
	.stufe-5 { background: #a00000; }

	.summary {
		margin: 0;
		color: var(--muted);
		font-size: 0.92rem;
	}

	.fehlt {
		margin: 0.8rem 0 0;
		color: var(--text-kritisch);
	}

	.problems {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0.9rem 0 0;
		padding: 0;
		font-size: 0.8rem;
	}

	.problems li {
		background: var(--surface-2);
		padding: 0.28rem 0.7rem;
		border-radius: 999px;
	}

	.filter {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.9rem 1.2rem;
		margin: 1.4rem 0 0.4rem;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.filter label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.mit-einheit {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	input {
		background: var(--surface);
		border: 1px solid var(--border);
		color: var(--text);
		border-radius: 0.55rem;
		padding: 0.5rem 0.65rem;
		font: inherit;
		min-height: 2.6rem;
	}

	input[type='number'] {
		width: 5.5rem;
	}

	button {
		background: var(--sky);
		border: 0;
		color: #fff;
		border-radius: 0.55rem;
		padding: 0.6rem 1.05rem;
		font: inherit;
		font-weight: 600;
		min-height: 2.6rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	button:hover {
		background: var(--sky-deep);
	}

	.statisch {
		margin: 1.4rem 0 0.4rem;
		font-size: 0.82rem;
		color: var(--muted);
	}

	.gruppe {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.05rem;
		color: var(--text);
		margin: 2rem 0 0.8rem;
	}

	.anzahl {
		font-size: 0.78rem;
		background: var(--surface-2);
		color: var(--muted);
		border-radius: 999px;
		padding: 0.05rem 0.55rem;
	}

	.grid {
		display: grid;
		gap: 0.9rem;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 21rem), 1fr));
	}

	.leer {
		color: var(--muted);
		background: var(--surface);
		border-radius: 1rem;
		padding: 1rem 1.2rem;
		margin: 0;
	}

	.weiter {
		margin-top: 1.8rem;
	}

	.weiter a {
		color: var(--sky-deep);
		font-weight: 600;
	}
</style>
