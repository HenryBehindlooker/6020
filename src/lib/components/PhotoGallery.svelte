<script lang="ts">
	import type { Photo } from '$lib/server/sources/photos';

	let { photos, alt }: { photos: Photo[]; alt: string } = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let offen = $state<Photo | null>(null);

	function zeige(photo: Photo) {
		offen = photo;
		dialog?.showModal();
	}
</script>

<ul class="galerie">
	{#each photos as photo (photo.file)}
		<li>
			<button type="button" onclick={() => zeige(photo)} aria-label="Foto groß anzeigen: {photo.caption ?? alt}">
				<img src={photo.thumb} alt={photo.caption ?? alt} loading="lazy" width={photo.width} height={photo.height} />
			</button>
			<span class="credit">{photo.author} · {photo.license}</span>
		</li>
	{/each}
</ul>

<dialog bind:this={dialog} onclose={() => (offen = null)} onclick={(e) => e.target === dialog && dialog?.close()}>
	{#if offen}
		<figure>
			<img src={offen.thumb} alt={offen.caption ?? alt} />
			<figcaption>
				{#if offen.caption}<span>{offen.caption}</span>{/if}
				<span class="credit">
					Foto: {offen.author}{#if offen.date}, {offen.date}{/if} ·
					{#if offen.licenseUrl}<a href={offen.licenseUrl} target="_blank" rel="noopener noreferrer license">{offen.license}</a>{:else}{offen.license}{/if}
					· <a href={offen.page} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>
				</span>
			</figcaption>
		</figure>
		<form method="dialog"><button class="zu">Schließen</button></form>
	{/if}
</dialog>

<style>
	.galerie {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
		gap: 0.6rem;
	}
	.galerie button {
		display: block;
		width: 100%;
		padding: 0;
		border: 0;
		border-radius: 0.6rem;
		overflow: hidden;
		cursor: zoom-in;
		background: var(--surface-2);
	}
	.galerie img { display: block; width: 100%; height: 7rem; object-fit: cover; transition: transform 0.2s; }
	.galerie button:hover img { transform: scale(1.04); }
	.credit { display: block; color: var(--muted); font-size: 0.7rem; margin-top: 0.2rem; overflow-wrap: anywhere; }

	dialog {
		max-width: min(60rem, 94vw);
		padding: 0.8rem;
		border: 0;
		border-radius: 1rem;
		background: var(--surface);
		color: var(--text);
	}
	dialog::backdrop { background: rgba(0, 0, 0, 0.7); }
	figure { margin: 0; }
	figure img { display: block; max-width: 100%; max-height: 75vh; margin: 0 auto; border-radius: 0.5rem; }
	figcaption { display: grid; gap: 0.2rem; font-size: 0.85rem; margin-top: 0.5rem; }
	figcaption a { color: var(--sky-deep); }
	.zu {
		margin-top: 0.6rem;
		padding: 0.4rem 1rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text);
		cursor: pointer;
	}
	@media (prefers-reduced-motion: reduce) {
		.galerie img { transition: none; }
	}
</style>
