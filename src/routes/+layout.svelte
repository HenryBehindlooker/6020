<script lang="ts">
	import { base } from '$app/paths';
	let { children } = $props();
</script>

<svelte:head>
	<title>Bergampel Innsbruck</title>
</svelte:head>

<div class="shell">
	<header>
		<a class="brand" href="{base}/">
			<span class="mark" aria-hidden="true"></span>
			<span>
				<strong>Bergampel</strong>
				<small>Innsbruck</small>
			</span>
		</a>
		<nav>
			<a href="{base}/karte">Karte</a>
			<a href="{base}/methodik">Wie wird gerechnet?</a>
		</nav>
	</header>

	{@render children()}

	<footer>
		<p>
			Planungshilfe, keine Sicherheitsgarantie. Entscheidungen im Gelaende bleiben deine - lies
			immer den Originalbericht des
			<a href="https://lawinen.report" rel="noreferrer">Lawinenwarndienst Tirol</a>.
		</p>
	</footer>
</div>

<style>
	:global(:root) {
		--bg: #0f172a;
		--surface: #1e293b;
		--surface-2: #334155;
		--text: #e2e8f0;
		--muted: #94a3b8;
		--gruen: #22c55e;
		--gelb: #eab308;
		--rot: #ef4444;
		--unbekannt: #64748b;
		color-scheme: dark;
	}

	:global(body) {
		margin: 0;
		background: var(--bg);
		color: var(--text);
		font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
		line-height: 1.55;
	}

	:global(a) {
		color: inherit;
	}

	.shell {
		max-width: 68rem;
		margin: 0 auto;
		padding: 1rem;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-block: 0.75rem 1.25rem;
		flex-wrap: wrap;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		text-decoration: none;
	}

	.mark {
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 50%;
		background: linear-gradient(140deg, var(--gruen), var(--gelb) 55%, var(--rot));
	}

	.brand strong {
		display: block;
		font-size: 1.15rem;
		letter-spacing: -0.01em;
	}

	.brand small {
		color: var(--muted);
		font-size: 0.8rem;
	}

	nav {
		display: flex;
		gap: 1rem;
	}

	nav a {
		color: var(--muted);
		font-size: 0.9rem;
	}

	nav a:hover {
		color: var(--text);
	}

	footer {
		margin-top: 3rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--surface-2);
		color: var(--muted);
		font-size: 0.85rem;
	}
</style>
