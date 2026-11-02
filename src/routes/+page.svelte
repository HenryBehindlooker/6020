<script lang="ts">
	import { base } from '$app/paths';
	import DataNotice from '$lib/components/DataNotice.svelte';
	import TourCard from '$lib/components/TourCard.svelte';
	import { problemLabel } from '$lib/logic/rating';
	import { planQuery } from '$lib/planParams';
	import { planner } from '$lib/planner.svelte';
	import { TEXT } from '$lib/copy';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Vorgerendert bzw. vom Server - bis der Browser selbst rechnen kann
	const plan = $derived(planner.plan() ?? data.plan);
	const params = $derived(planner.inputs ? planner.params : data.params);
	const query = $derived(planQuery(params));
	const bulletin = $derived(plan.bulletin);
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

	/** Mit JavaScript rechnet der Browser; ohne schickt das Formular an den Server. */
	function abschicken(event: SubmitEvent) {
		if (!planner.inputs) return;
		event.preventDefault();
		planner.syncUrl();
	}
</script>

<svelte:head>
	<title>{params.tag === 'morgen' ? TEXT.frageMorgen : TEXT.frage} - Bergampel Innsbruck</title>
</svelte:head>

<DataNotice status={plan.status} builtAt={plan.builtAt} />

<section class="lage" aria-labelledby="frage">
	<div class="kopf">
		<h1 id="frage">{params.tag === 'morgen' ? TEXT.frageMorgen : TEXT.frage}</h1>
		<span class="datum">{datum}</span>
	</div>

	{#if bulletin}
		<p class="stufe" class:beispiel={bulletin.kind === 'demo'}>
			<span class="zahl stufe-{bulletin.rating.above}">{bulletin.rating.above}</span>
			<span>
				{#if bulletin.kind === 'demo'}<span class="stempel">Beispiel</span>{/if}
				<strong>Gefahrenstufe {bulletin.rating.above} ({STUFE[bulletin.rating.above]})</strong>
				{#if bulletin.rating.elevationBoundary && bulletin.rating.below !== bulletin.rating.above}
					oberhalb {bulletin.rating.elevationBoundary} m, darunter {bulletin.rating.below}
					({STUFE[bulletin.rating.below]})
				{/if}
			</span>
		</p>
		{#if bulletin.kind === 'echt'}
			<p class="summary">
				<span lang="en">{bulletin.summary}</span>
				<span class="herkunft">
					Englischer Originaltext des Lawinenwarndienstes Tirol · {plan.status.lawineStand} ·
					<a href="https://lawinen.report" rel="noreferrer">deutsche Fassung auf lawinen.report</a>
				</span>
			</p>
		{:else}
			<p class="summary">
				{bulletin.summary}
				<span class="herkunft">
					Erfundener Beispielbericht, damit man sieht, wie die Ampel rechnet – keine Auskunft über
					die heutige Lage.
				</span>
			</p>
		{/if}
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
	{:else if plan.status.lawineGrund === 'noch-nicht'}
		<p class="fehlt">
			<strong>Der Lagebericht für diesen Tag ist noch nicht erschienen.</strong> Der
			Lawinenwarndienst Tirol veröffentlicht ihn um 17 Uhr am Vortag. Bis dahin bewertet die
			Bergampel keine Tour.
		</p>
	{:else if plan.status.lawineGrund === 'saisonpause'}
		<p class="fehlt">
			<strong>Saisonpause:</strong> Der Lawinenwarndienst Tirol berichtet etwa von Dezember bis Mai.
			Ohne Bericht bewertet die Bergampel keine Tour.
		</p>
	{:else}
		<p class="fehlt">
			<strong>Der Lawinenlagebericht ist gerade nicht verfügbar.</strong> Ohne ihn bewertet die
			Bergampel keine Tour. Bitte direkt auf
			<a href="https://lawinen.report" rel="noreferrer">lawinen.report</a> nachschauen.
		</p>
	{/if}
</section>

<form class="filter" method="get" onsubmit={abschicken} onchange={() => planner.inputs && planner.syncUrl()}>
	<fieldset class="tage">
		<legend class="visually-hidden">Planungstag</legend>
		{#if planner.inputs}
			<label><input type="radio" name="tag" value="heute" bind:group={planner.tag} /><span>{TEXT.heute}</span></label>
			<label><input type="radio" name="tag" value="morgen" bind:group={planner.tag} /><span>{TEXT.morgen}</span></label>
		{:else}
			<label><input type="radio" name="tag" value="heute" checked={data.params.tag === 'heute'} /><span>{TEXT.heute}</span></label>
			<label><input type="radio" name="tag" value="morgen" checked={data.params.tag === 'morgen'} /><span>{TEXT.morgen}</span></label>
		{/if}
	</fieldset>
	<label>
		<span>{TEXT.aufbruch}</span>
		{#if planner.inputs}
			<input type="time" name="ab" bind:value={planner.notBefore} step="300" required />
		{:else}
			<input type="time" name="ab" value={data.params.notBefore} step="300" />
		{/if}
	</label>
	<label>
		<span>{TEXT.puffer}</span>
		<span class="mit-einheit">
			{#if planner.inputs}
				<input type="number" name="puffer" min="0" max="180" step="5" bind:value={planner.bufferMinutes} inputmode="numeric" required />
			{:else}
				<input type="number" name="puffer" min="0" max="180" step="5" value={data.params.bufferMinutes} inputmode="numeric" />
			{/if}
			min
		</span>
	</label>
	{#if !planner.inputs}
		<button type="submit">{TEXT.rechnen}</button>
	{/if}
</form>
{#if planner.failed && data.staticPreview}
	<p class="statisch">
		Offline: Die Daten zum Neurechnen ließen sich nicht laden. Angezeigt wird der Plan vom
		Bauzeitpunkt mit Aufbruch {data.params.notBefore} Uhr und {data.params.bufferMinutes} min Puffer.
	</p>
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

	.herkunft {
		display: block;
		margin-top: 0.35rem;
		font-size: 0.78rem;
	}

	.herkunft a {
		color: var(--sky-deep);
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

	.tage {
		display: inline-flex;
		border: 1px solid var(--border);
		border-radius: 0.65rem;
		padding: 0.2rem;
		margin: 0;
		background: var(--surface);
		align-self: flex-end;
	}

	.tage label {
		flex-direction: row;
		position: relative;
	}

	.tage input {
		position: absolute;
		opacity: 0;
		inset: 0;
		min-height: 0;
		cursor: pointer;
	}

	.tage span {
		padding: 0.45rem 1rem;
		border-radius: 0.5rem;
		font-weight: 600;
		color: var(--muted);
	}

	.tage input:checked + span {
		background: var(--sky-deep);
		color: var(--snow);
	}

	.tage input:focus-visible + span {
		outline: 2px solid var(--sky);
		outline-offset: 2px;
	}

	.beispiel .zahl {
		background: repeating-linear-gradient(-45deg, var(--surface-2) 0 6px, var(--surface) 6px 12px);
		color: var(--muted);
		border: 2px dashed var(--border);
	}

	.stempel {
		display: inline-block;
		margin-right: 0.4rem;
		padding: 0.05rem 0.5rem;
		border: 1.5px solid var(--text-warnung);
		border-radius: 0.35rem;
		color: var(--text-warnung);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		vertical-align: 0.1em;
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
