<script lang="ts">
	import type { Signal } from '$lib/logic/rating';
	import { SIGNAL_TEXT } from '$lib/copy';

	let { signal, size = 'normal' }: { signal: Signal; size?: 'normal' | 'gross' } = $props();
	const text = $derived(SIGNAL_TEXT[signal]);
</script>

<span class="badge {signal}" class:gross={size === 'gross'} aria-label="Ampel: {text.hochdeutsch}" title={text.hochdeutsch}>
	<span class="dot" aria-hidden="true"></span>
	<span aria-hidden="true">{text.kurz}</span>
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.22rem 0.65rem;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 650;
		background: var(--surface-2);
		white-space: nowrap;
	}

	.gross {
		font-size: 0.98rem;
		padding: 0.4rem 0.95rem;
	}

	.dot {
		width: 0.62rem;
		height: 0.62rem;
		border-radius: 50%;
		background: var(--unbekannt);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--surface) 70%, transparent);
	}

	.gruen .dot { background: var(--gruen); }
	.gelb .dot { background: var(--gelb); }
	.rot .dot { background: var(--rot); }
</style>
