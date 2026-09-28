<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { TEXT } from '$lib/copy';
</script>

<svelte:head><title>Verstiegn - Bergampel Innsbruck</title></svelte:head>

<section class="fehler">
	{#if page.status === 404}
		<h1>Do hot's di verstiegn.</h1>
		<p>Diese Seite gibt es nicht - vielleicht ist die Tour umbenannt worden oder der Link ist alt.</p>
	{:else}
		<h1>Do is wos schiafgangen.</h1>
		<p>Beim Laden ist ein Fehler aufgetreten ({page.status}). Bitte versuch es in einem Moment noch einmal.</p>
	{/if}
	<p><a href="{base}/">{TEXT.zurueck}</a></p>
</section>

<style>
	.fehler {
		background: var(--surface);
		border-radius: 1rem;
		padding: 2rem 1.5rem;
		text-align: center;
	}

	h1 { margin: 0 0 0.5rem; color: var(--sky-deep); letter-spacing: -0.02em; }
	p { color: var(--muted); }
	a { color: var(--sky-deep); font-weight: 600; }
</style>
