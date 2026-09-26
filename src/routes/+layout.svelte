<script lang="ts">
	import { base } from '$app/paths';
	import GoldenesDachl from '$lib/components/GoldenesDachl.svelte';
	let { children } = $props();
</script>

<svelte:head>
	<title>Bergampel Innsbruck</title>
</svelte:head>

<div class="shell">
	<header>
		<a class="brand" href="{base}/">
			<GoldenesDachl size={34} />
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
		/* Innsbrucker Palette: Himmelblau, Schnee, Nordkette-Grau, Waldgruen
		   und das Gold des Goldenen Dachls. */
		--sky: #2b7fb8;
		--sky-deep: #1d5c88;
		--snow: #ffffff;
		--forest: #2f6b41;
		--gold: #b8860b;
		--gold-hell: #e8c060;

		--bg: #eef4f9;
		--surface: #ffffff;
		--surface-2: #dde8f0;
		--border: #c6d6e2;
		--text: #17232e;
		--muted: #56697a;

		/* Ampel - bewusst andere Gruentoene als das Waldgruen der Oberflaeche,
		   damit Signal und Dekoration nicht verwechselbar sind. */
		--gruen: #1f8a4c;
		--gelb: #c47f00;
		--rot: #c0392b;
		--unbekannt: #78909c;

		--text-warnung: #8a5a00;
		--text-kritisch: #a02c1f;

		--hinweis-bg: #fdf3d7;
		--hinweis-text: #6b4e00;
		--hinweis-border: #e0c169;

		--map-bg: #dde8f0;
		--marker-ring: rgba(255, 255, 255, 0.9);
		--overlay: rgba(255, 255, 255, 0.85);

		color-scheme: light;
	}

	/* Nachts und frueh am Morgen - wenn man die Tour plant oder im Aufstieg
	   nachschaut - ist die dunkle Fassung angenehmer. */
	@media (prefers-color-scheme: dark) {
		:global(:root) {
			--sky: #6fb6e8;
			--sky-deep: #9ccdf0;
			--snow: #f2f7fb;
			--forest: #5fa877;
			--gold: #e0b544;
			--gold-hell: #f2d78a;

			--bg: #121a22;
			--surface: #1b2732;
			--surface-2: #2b3b48;
			--border: #35485a;
			--text: #e6eef5;
			--muted: #9aafc0;

			--gruen: #46c07a;
			--gelb: #e0a12a;
			--rot: #e8695a;
			--unbekannt: #7d94a5;

			--text-warnung: #f0c460;
			--text-kritisch: #f4a79a;

			--hinweis-bg: #3d3010;
			--hinweis-text: #f6e4b0;
			--hinweis-border: #6b5518;

			--map-bg: #1b2732;
			--marker-ring: rgba(18, 26, 34, 0.9);
			--overlay: rgba(18, 26, 34, 0.85);

			color-scheme: dark;
		}
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

	.brand strong {
		display: block;
		font-size: 1.15rem;
		letter-spacing: -0.01em;
		color: var(--sky-deep);
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
		border-top: 1px solid var(--border);
		color: var(--muted);
		font-size: 0.85rem;
	}
</style>
