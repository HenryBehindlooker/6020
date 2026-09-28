<script lang="ts">
	import type { DataStatus } from '$lib/server/plan';
	import { TEXT } from '$lib/copy';

	/**
	 * Sagt oben auf jeder Seite, was an den Daten echt ist. Sicherheitsrelevant
	 * und darum auf Hochdeutsch - nur das "Obacht" ist Tirolerisch.
	 */
	let { status }: { status: DataStatus } = $props();

	const lawineText = $derived(
		status.lawine === 'demo'
			? 'Lawinenlage und Wetter sind Demodaten aus Beispieldateien - keine gültige Auskunft.'
			: status.lawine === 'fehlt'
				? 'Der Lawinenlagebericht ist gerade nicht verfügbar. Ohne ihn steht die Ampel auf „Unklar".'
				: null
	);

	const wetterText = $derived(
		status.lawine !== 'demo' && (status.wetter === 'fehlt' || status.wetter === 'teilweise')
			? 'Die Wetterprognose fehlt für einige Ausgangspunkte; dort ist die Ampel vorsichtshalber strenger.'
			: null
	);

	const fahrplanText = $derived(
		status.fahrplan === 'demo'
			? 'Der Fahrplan ist ein Demo-Fahrplan mit erfundenen Linien.'
			: status.fahrplan === 'fehlt'
				? 'Für die Ausgangspunkte liegt gerade kein Fahrplan vor.'
				: status.fahrplan === 'teilweise'
					? 'Für einzelne Ausgangspunkte fehlt der Fahrplan; das steht dann bei der Tour.'
					: null
	);

	const warnung = $derived(Boolean(lawineText || wetterText || fahrplanText));
</script>

{#if warnung}
	<aside class="notice" role="note">
		<strong>{TEXT.obacht}</strong>
		{#if lawineText}<span>{lawineText}</span>{/if}
		{#if wetterText}<span>{wetterText}</span>{/if}
		{#if fahrplanText}<span>{fahrplanText}</span>{/if}
		{#if status.fahrplan === 'echt' || status.fahrplan === 'teilweise'}
			<span class="gut">
				Die Busverbindungen sind echt ({status.fahrplanStand ?? 'Transitous'}). Fahrpläne ändern
				sich - vor der Fahrt in der VVT- oder ÖBB-App prüfen.
			</span>
		{/if}
	</aside>
{/if}

<style>
	.notice {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.5rem;
		background: var(--hinweis-bg);
		color: var(--hinweis-text);
		border: 1px solid var(--hinweis-border);
		padding: 0.75rem 0.95rem;
		border-radius: 0.75rem;
		font-size: 0.85rem;
		line-height: 1.5;
		margin-bottom: 1.25rem;
	}

	.notice span {
		flex-basis: 100%;
	}

	.notice strong {
		flex-basis: 100%;
		letter-spacing: 0.01em;
	}

	.gut {
		opacity: 0.9;
	}
</style>
