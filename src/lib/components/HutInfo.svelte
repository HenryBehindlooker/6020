<script lang="ts">
	import { onMount } from 'svelte';
	import { openingOn, viennaDay, type OpeningResult } from '$lib/logic/openingHours';
	import type { PaymentInfo } from '$lib/logic/payment';

	let {
		openingHours,
		payment,
		seasonal = null,
		phone = null,
		checkDate = null
	}: {
		openingHours: string | null;
		payment: PaymentInfo;
		seasonal?: string | null;
		phone?: string | null;
		checkDate?: string | null;
	} = $props();

	// "Heute" erst im Browser: die Pages-Fassung ist vorgerendert, und ein beim
	// Bauen ausgerechneter Tag waere spaetestens morgen falsch.
	let heute = $state<OpeningResult | null>(null);
	let tag = $state('');
	onMount(() => {
		const now = new Date();
		heute = openingOn(openingHours, viennaDay(now));
		tag = now.toLocaleDateString('de-AT', { weekday: 'short', timeZone: 'Europe/Vienna' });
	});

	/** Ohne Monatsangabe weiss OSM nichts von Winter- oder Sommerpausen. */
	const ohneSaison = $derived(!!openingHours && !/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b|\d{4}/.test(openingHours));
	const tel = $derived(phone ? phone.replace(/[^\d+]/g, '') : null);
</script>

<span class="zeile">
	{#if heute?.status === 'offen'}
		<span class="offen">Heute ({tag}) offen: {heute.spans.join(', ')}</span>
	{:else if heute?.status === 'zu'}
		<span class="zu">Heute ({tag}) zu</span>
	{:else if openingHours}
		<span>Öffnungszeiten: {openingHours}</span>
	{:else}
		<span>Öffnungszeiten nicht in OSM</span>
	{/if}
	<span class="bar" class:nurbar={payment.kind !== 'karte'}>{payment.text}</span>
</span>
{#if heute && heute.status !== 'unklar' && (ohneSaison || seasonal)}
	<span class="hinweis">
		laut OSM{#if checkDate}, geprüft {checkDate}{/if}{#if seasonal} · Saison: {seasonal}{:else} · ohne Saisonangabe, viele Almen haben im Winter zu{/if}
	</span>
{:else if heute?.status === 'unklar' && openingHours}
	<span class="hinweis">Laut OSM: „{openingHours}“ – {heute.reason}</span>
{/if}
{#if tel}
	<a class="tel" href="tel:{tel}">Anrufen: {phone}</a>
{/if}

<style>
	.zeile { display: flex; flex-wrap: wrap; gap: 0.3rem 0.6rem; font-size: 0.8rem; margin-top: 0.15rem; }
	.offen { color: var(--forest); font-weight: 600; }
	.zu { color: var(--text-kritisch); font-weight: 600; }
	.bar {
		border-radius: 999px;
		padding: 0 0.5rem;
		background: var(--surface-2);
		color: var(--muted);
	}
	.bar.nurbar { color: var(--text-warnung); }
	.hinweis { display: block; color: var(--muted); font-size: 0.74rem; }
	.tel { display: inline-block; font-size: 0.8rem; margin-top: 0.15rem; color: var(--sky-deep); }
</style>
