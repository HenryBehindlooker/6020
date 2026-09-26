<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { env } from '$env/dynamic/public';
	import type { Signal } from '$lib/logic/rating';
	import type { MapMarker, MapTrack } from './mapTypes';
	import { base } from '$app/paths';
	import { addOsmLayers } from './osmLayers';

	let {
		markers,
		tracks = [],
		osm = false,
		height = '26rem',
		zoom = 10,
		center
	}: {
		markers: MapMarker[];
		tracks?: MapTrack[];
		/** Wege, Huetten und Seilbahnen aus OpenStreetMap dazuladen. */
		osm?: boolean;
		height?: string;
		zoom?: number;
		center?: [number, number];
	} = $props();

	const TILE_URL = env.PUBLIC_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
	const TILE_ATTRIBUTION =
		env.PUBLIC_TILE_ATTRIBUTION || '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>';

	/**
	 * Leaflet braucht die Ampelfarben als Zeichenkette. Sie werden aus denselben
	 * CSS-Tokens gelesen, die auch die Oberflaeche faerbt - sonst driften die
	 * beiden Stellen auseinander, sobald jemand die Palette anfasst.
	 */
	const FALLBACK: Record<Signal, string> = {
		gruen: '#1f8a4c',
		gelb: '#c47f00',
		rot: '#c0392b',
		unbekannt: '#78909c'
	};

	let SIGNAL_COLORS: Record<Signal, string> = FALLBACK;

	function readSignalColors(): Record<Signal, string> {
		if (!browser) return FALLBACK;
		const styles = getComputedStyle(document.documentElement);
		const read = (name: Signal) => styles.getPropertyValue(`--${name}`).trim() || FALLBACK[name];
		return { gruen: read('gruen'), gelb: read('gelb'), rot: read('rot'), unbekannt: read('unbekannt') };
	}

	let container: HTMLDivElement | undefined = $state();
	let failed = $state(false);

	onMount(() => {
		if (!browser || !container) return;
		const target = container;
		let map: import('leaflet').Map | undefined;

		// Leaflet greift beim Import auf window zu und wird darum erst im
		// Browser geladen - die Seite selbst rendert serverseitig.
		(async () => {
			try {
				SIGNAL_COLORS = readSignalColors();
				const L = await import('leaflet');
				await import('leaflet/dist/leaflet.css');

				map = L.map(target, { scrollWheelZoom: false, attributionControl: true });

				L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 17 }).addTo(map);

				const points: [number, number][] = [];

				// Verlaeufe zuerst, damit die Marker darueber liegen.
				for (const track of tracks) {
					if (track.points.length < 2) continue;
					const line = L.polyline(track.points, {
						color: SIGNAL_COLORS[track.signal],
						weight: track.schematic ? 3 : 4,
						opacity: track.schematic ? 0.75 : 0.9,
						dashArray: track.schematic ? '6 7' : undefined
					}).addTo(map);

					const hinweis = track.schematic
						? '<div class="sub">Schematischer Verlauf, keine Aufzeichnung</div>'
						: '';
					const titel = track.href
						? `<a href="${escapeHtml(track.href)}">${escapeHtml(track.label)}</a>`
						: escapeHtml(track.label);

					// Eine 3 px breite Linie ist mit dem Finger nicht zu treffen,
					// darum liegt darunter eine breite, unsichtbare Trefferlinie.
					// Sie faengt nebenbei auch die Luecken der Strichelung ab, die
					// als ungemalte Flaeche sonst keinen Klick annehmen.
					L.polyline(track.points, {
						className: 'bergampel-hit',
						weight: 22,
						opacity: 0
					})
						.addTo(map)
						.bindPopup(`<strong>${titel}</strong>${hinweis}`);

					line.bindPopup(`<strong>${titel}</strong>${hinweis}`);

					points.push(...track.points);
				}
				for (const marker of markers) {
					const color = SIGNAL_COLORS[marker.signal];
					const icon =
						marker.shape === 'gipfel'
							? L.divIcon({
									className: 'bergampel-gipfel',
									html: `<span style="--marker-color:${color}"></span>`,
									iconSize: [18, 16],
									iconAnchor: [9, 14],
									popupAnchor: [0, -14]
								})
							: L.divIcon({
									className: 'bergampel-marker',
									html: `<span style="--marker-color:${color}">${marker.count ?? ''}</span>`,
									iconSize: [26, 26],
									iconAnchor: [13, 13],
									popupAnchor: [0, -14]
								});

					L.marker([marker.lat, marker.lon], { icon, title: marker.label })
						.addTo(map)
						.bindPopup(popupHtml(marker));
					points.push([marker.lat, marker.lon]);
				}

				if (center) {
					map.setView(center, zoom);
				} else if (points.length > 1) {
					map.fitBounds(points, { padding: [40, 40] });
				} else if (points.length === 1) {
					map.setView(points[0], zoom);
				} else {
					// Innsbruck, falls es nichts anzuzeigen gibt.
					map.setView([47.2692, 11.4041], zoom);
				}

				if (osm) {
					const css = getComputedStyle(document.documentElement);
					const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
					await addOsmLayers(L, map, base, {
						route: token('--sky', '#2b7fb8'),
						skitour: token('--forest', '#2f6b41'),
						aerialway: token('--text', '#17232e'),
						// Grau statt Gold: Gold laege zu nah am Ampel-Gelb "Heikel".
						hut: token('--muted', '#56697a')
					});
				}
			} catch (err) {
				console.error('[karte] Leaflet konnte nicht geladen werden:', err);
				failed = true;
			}
		})();

		return () => map?.remove();
	});

	function popupHtml(marker: MapMarker): string {
		const lines = (marker.links ?? [])
			.map(
				(link) =>
					`<li><i style="background:${SIGNAL_COLORS[link.signal]}"></i><a href="${escapeHtml(link.href)}">${escapeHtml(link.text)}</a></li>`
			)
			.join('');
		return `
			<strong>${escapeHtml(marker.label)}</strong>
			${marker.sub ? `<div class="sub">${escapeHtml(marker.sub)}</div>` : ''}
			${lines ? `<ul>${lines}</ul>` : ''}
		`;
	}

	function escapeHtml(value: string): string {
		return value.replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
		);
	}
</script>

{#if failed}
	<p class="fallback" style:height>Karte nicht verfuegbar - die Liste zeigt dieselben Touren.</p>
{:else}
	<div class="map" bind:this={container} style:height role="application" aria-label="Karte der Ausgangspunkte"></div>
{/if}

<style>
	.map,
	.fallback {
		width: 100%;
		border-radius: 0.9rem;
		background: var(--surface);
		z-index: 0;
	}

	.fallback {
		display: grid;
		place-items: center;
		color: var(--muted);
		font-size: 0.9rem;
		margin: 0;
	}

	/* pointer-events: stroke trifft die volle Strichbreite, auch wo nichts
	   gemalt ist - die unsichtbare Trefferlinie wirkt nur so. */
	:global(path.bergampel-hit) {
		pointer-events: stroke;
		cursor: pointer;
	}

	/* Leaflet rendert Marker und Popups ausserhalb dieser Komponente. */
	:global(.bergampel-marker span) {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--marker-color);
		color: #ffffff;
		border: 2px solid var(--marker-ring);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
		font: 600 0.75rem/1 ui-sans-serif, system-ui, sans-serif;
	}

	/* Gipfel als Dreieck in der Ampelfarbe der Tour */
	:global(.bergampel-gipfel span) {
		display: block;
		width: 18px;
		height: 16px;
		background: var(--marker-color);
		clip-path: polygon(50% 0, 100% 100%, 0 100%);
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.45));
	}

	:global(.leaflet-popup-content-wrapper) {
		background: var(--surface);
		color: var(--text);
		border-radius: 0.6rem;
	}

	:global(.leaflet-popup-tip) {
		background: var(--surface);
	}

	:global(.leaflet-popup-content) {
		margin: 0.7rem 0.9rem;
		font: 0.85rem/1.5 ui-sans-serif, system-ui, sans-serif;
	}

	:global(.leaflet-popup-content .sub) {
		color: var(--muted);
		font-size: 0.78rem;
	}

	:global(.leaflet-popup-content .sub.warn) {
		color: var(--text-warnung);
	}

	:global(.leaflet-popup-content .links) {
		margin-top: 0.35rem;
		font-size: 0.78rem;
	}

	:global(.leaflet-popup-content a) {
		color: var(--sky);
	}

	:global(.leaflet-control-layers) {
		background: var(--surface);
		color: var(--text);
		border-radius: 0.5rem;
		font-size: 0.8rem;
	}

	:global(.leaflet-popup-content ul) {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.25rem;
	}

	:global(.leaflet-popup-content li) {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	:global(.leaflet-popup-content li i) {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		flex: none;
	}

	:global(.leaflet-container) {
		background: var(--map-bg);
		font-family: inherit;
	}

	:global(.leaflet-control-attribution) {
		background: var(--overlay) !important;
		color: var(--muted);
		font-size: 0.65rem;
	}

	:global(.leaflet-control-attribution a) {
		color: var(--text);
	}

	:global(.leaflet-bar a) {
		background: var(--surface);
		color: var(--text);
		border-bottom-color: var(--border);
	}

	:global(.leaflet-bar a:hover) {
		background: var(--surface-2);
	}
</style>
