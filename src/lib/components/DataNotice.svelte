<script lang="ts">
	import type { DataStatus } from '$lib/server/plan';
	import { TEXT } from '$lib/copy';

	/**
	 * Sagt oben auf jeder Seite, was an den Daten echt ist. Sicherheitsrelevant
	 * und darum auf Hochdeutsch - nur das "Obacht" ist Tirolerisch.
	 */
	let { status }: { status: DataStatus } = $props();

	const letzter = $derived(
		status.lawineLetzter
			? new Date(status.lawineLetzter + 'T12:00:00Z').toLocaleDateString('de-AT', {
					day: 'numeric',
					month: 'long',
					year: 'numeric',
					timeZone: 'Europe/Vienna'
				})
			: null
	);

	const warnungen = $derived(
		[
			status.lawine === 'demo'
				? letzter
					? `Der Lawinenwarndienst Tirol berichtet etwa von Dezember bis Mai. Der letzte Bericht ist vom ${letzter}; bis zum Saisonstart zeigt die Bergampel eine Beispiel-Lawinenlage - keine gültige Auskunft.`
					: 'Die Lawinenlage ist ein Beispiel aus einer mitgelieferten Datei - keine gültige Auskunft.'
				: null,
			status.lawine === 'fehlt'
				? 'Der Lawinenlagebericht ist gerade nicht verfügbar. Ohne ihn steht die Ampel auf „Unklar".'
				: null,
			status.wetter === 'demo' ? 'Das Bergwetter ist ein Beispiel, keine Prognose.' : null,
			status.wetter === 'fehlt' || status.wetter === 'teilweise'
				? 'Die Wetterprognose fehlt für einige Ausgangspunkte; dort ist die Ampel vorsichtshalber strenger.'
				: null,
			status.fahrplan === 'demo' ? 'Der Fahrplan ist ein Demo-Fahrplan mit erfundenen Linien.' : null,
			status.fahrplan === 'fehlt' ? 'Für die Ausgangspunkte liegt gerade kein Fahrplan vor.' : null,
			status.fahrplan === 'teilweise'
				? 'Für einzelne Ausgangspunkte fehlt der Fahrplan; das steht dann bei der Tour.'
				: null
		].filter((t): t is string => t !== null)
	);

	const echt = $derived(
		[
			status.lawine === 'echt'
				? `Lawinenlage: echter Bericht des Lawinenwarndienstes Tirol (${status.lawineStand}).`
				: null,
			status.fahrplan === 'echt' || status.fahrplan === 'teilweise'
				? `Busverbindungen: echt (${status.fahrplanStand ?? 'Transitous'}). Fahrpläne ändern sich - vor der Fahrt in der VVT- oder ÖBB-App prüfen.`
				: null
		].filter((t): t is string => t !== null)
	);
</script>

{#if warnungen.length > 0}
	<aside class="notice" role="note">
		<strong>{TEXT.obacht}</strong>
		{#each warnungen as text}<span>{text}</span>{/each}
		{#each echt as text}<span class="gut">{text}</span>{/each}
	</aside>
{:else if echt.length > 0}
	<aside class="notice echt" role="note">
		{#each echt as text}<span>{text}</span>{/each}
	</aside>
{/if}

<style>
	.notice {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		background: var(--hinweis-bg);
		color: var(--hinweis-text);
		border: 1px solid var(--hinweis-border);
		padding: 0.75rem 0.95rem;
		border-radius: 0.75rem;
		font-size: 0.85rem;
		line-height: 1.5;
		margin-bottom: 1.25rem;
	}

	.notice.echt {
		background: var(--surface);
		color: var(--muted);
		border-color: var(--border);
	}

	.gut {
		opacity: 0.9;
	}
</style>
