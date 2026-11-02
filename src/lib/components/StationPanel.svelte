<script lang="ts">
	import { onMount } from 'svelte';
	import { signedCm, stationsForTour, type Station } from '#lib/logic/stations.js';
	import type { Tour } from '#lib/types.js';

	let { stations: vorgerendert, tour }: { stations: Station[]; tour: Tour } = $props();

	/** Die Messwerte erlauben den Abruf aus dem Browser (CORS) - also frisch holen */
	const LIVE_URL = 'https://wiski.tirol.gv.at/lawine/produkte/ogd.geojson';
	let live = $state<Station[] | null>(null);
	let zustand = $state<'vorgerendert' | 'laedt' | 'live' | 'fehler'>('vorgerendert');
	const stations = $derived(live ?? vorgerendert);

	// Das Alter der Messung erst im Browser: die vorgerenderte Seite kennt die Uhrzeit des Lesers nicht
	let jetzt = $state<number | null>(null);
	onMount(() => {
		jetzt = Date.now();
		const t = setInterval(() => (jetzt = Date.now()), 60_000);
		zustand = 'laedt';
		fetch(LIVE_URL, { signal: AbortSignal.timeout(10_000) })
			.then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
			.then((doc: { features?: Parameters<typeof stationsForTour>[0] }) => {
				const neu = stationsForTour(doc.features ?? [], tour);
				if (neu.length > 0) live = neu;
				zustand = neu.length > 0 ? 'live' : 'fehler';
			})
			.catch(() => {
				// Offline oder Dienst weg: der Stand des letzten Abholerlaufs bleibt stehen
				zustand = 'fehler';
			});
		return () => clearInterval(t);
	});

	function zeit(iso: string | null): string {
		if (!iso) return 'Zeitpunkt unbekannt';
		const d = new Date(iso);
		const uhr = d.toLocaleString('de-AT', {
			weekday: 'short',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'Europe/Vienna'
		});
		if (jetzt === null) return uhr;
		const min = Math.round((jetzt - d.getTime()) / 60_000);
		if (min < 0) return uhr;
		if (min < 90) return `${uhr} (vor ${min} min)`;
		const h = Math.round(min / 60);
		return `${uhr} (vor ${h} h)`;
	}

	const alt = (iso: string | null) => jetzt !== null && iso !== null && jetzt - new Date(iso).getTime() > 6 * 3_600_000;
</script>

<ul class="stationen">
	{#each stations as s (s.name)}
		<li>
			<div class="kopf">
				<strong>{s.name}</strong>
				<span class="meta">{s.ele ? `${s.ele} m · ` : ''}{s.km.toLocaleString('de-AT')} km vom Gipfel</span>
			</div>
			<dl>
				{#if s.snowCm !== null}
					<div>
						<dt>Schneehöhe</dt>
						<dd>{Math.round(s.snowCm)} cm</dd>
					</div>
				{/if}
				{#if s.snowChange24 !== null}
					<div>
						<dt>in 24 h</dt>
						<dd>{signedCm(s.snowChange24)}</dd>
					</div>
				{/if}
				{#if s.snowChange72 !== null}
					<div>
						<dt>in 72 h</dt>
						<dd>{signedCm(s.snowChange72)}</dd>
					</div>
				{/if}
				{#if s.windKmh !== null}
					<div>
						<dt>Wind</dt>
						<dd>
							{Math.round(s.windKmh)} km/h{#if s.windFrom}&nbsp;aus {s.windFrom}{/if}{#if s.gustKmh !== null}, Böen
								{Math.round(s.gustKmh)} km/h{/if}
						</dd>
					</div>
				{/if}
				{#if s.tempC !== null}
					<div>
						<dt>Temperatur</dt>
						<dd>{s.tempC.toLocaleString('de-AT')} °C</dd>
					</div>
				{/if}
			</dl>
			<span class="zeit" class:alt={alt(s.date)}>Gemessen {zeit(s.date)}</span>
		</li>
	{/each}
</ul>
<p class="herkunft">
	{#if zustand === 'live'}
		Aktuell vom Lawinenwarndienst geladen.
	{:else if zustand === 'laedt'}
		Stand des letzten Datenlaufs – aktuelle Werte werden geladen …
	{:else}
		Stand des letzten Datenlaufs{zustand === 'fehler' ? ' – aktuelle Werte gerade nicht erreichbar' : ''}.
	{/if}
</p>

<style>
	.stationen {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.8rem;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
	}

	li {
		border-left: 3px solid var(--sky);
		padding-left: 0.7rem;
		font-size: 0.88rem;
	}

	.kopf strong {
		display: block;
	}

	.meta,
	.zeit {
		color: var(--muted);
		font-size: 0.78rem;
	}

	.zeit.alt {
		color: var(--text-warnung);
	}

	.herkunft {
		margin: 0.6rem 0 0;
		color: var(--muted);
		font-size: 0.74rem;
	}

	dl {
		margin: 0.35rem 0;
		display: grid;
		gap: 0.15rem;
	}

	dl div {
		display: flex;
		justify-content: space-between;
		gap: 0.6rem;
	}

	dt {
		color: var(--muted);
	}

	dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
</style>
