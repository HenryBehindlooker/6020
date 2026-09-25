<script lang="ts">
	import type { Signal } from '$lib/logic/rating';

	let { signal, size = 'normal' }: { signal: Signal; size?: 'normal' | 'gross' } = $props();

	const LABELS: Record<Signal, string> = {
		gruen: 'Geht',
		gelb: 'Heikel',
		rot: 'Heute nicht',
		unbekannt: 'Unklar'
	};
</script>

<span class="badge {signal}" class:gross={size === 'gross'}>
	<span class="dot" aria-hidden="true"></span>
	{LABELS[signal]}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 600;
		background: var(--surface-2);
		white-space: nowrap;
	}

	.gross {
		font-size: 0.95rem;
		padding: 0.35rem 0.85rem;
	}

	.dot {
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		background: var(--unbekannt);
	}

	.gruen .dot { background: var(--gruen); }
	.gelb .dot { background: var(--gelb); }
	.rot .dot { background: var(--rot); }
</style>
