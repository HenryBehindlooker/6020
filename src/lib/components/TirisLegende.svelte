<script lang="ts">
	import { NEIGUNG_KLASSEN, WILDSCHUTZ_SYMBOL } from './tirisLegende.js';
</script>

<!-- Legende zu den zuschaltbaren Landesebenen (Ebenen-Knopf oben rechts in der Karte) -->
<div class="legende" aria-label="Legende Hangneigung und Wildschutzzonen">
	<span class="titel">Hangneigung:</span>
	{#each NEIGUNG_KLASSEN as k (k.label)}
		<span class="eintrag"><span class="feld" style="background: {k.farbe}"></span>{k.label}</span>
	{/each}
	<span class="eintrag"
		><img src={WILDSCHUTZ_SYMBOL} alt="" width="16" height="16" />Wald- und Wildschutzzone – nicht betreten</span
	>
</div>

<style>
	.legende {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 0.9rem;
		align-items: center;
		margin-top: 0.6rem;
		font-size: 0.78rem;
		color: var(--muted);
	}

	.titel {
		font-weight: 600;
	}

	.eintrag {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.feld {
		width: 0.9rem;
		height: 0.9rem;
		border-radius: 0.2rem;
		opacity: 0.75;
		border: 1px solid var(--border);
	}
</style>
