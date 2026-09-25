/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

// Im Sellrain- und Halltal gibt es streckenweise kein Netz. Die App muss den
// zuletzt geladenen Tagesplan deshalb auch offline anzeigen koennen.
const APP_CACHE = `app-${version}`;
const DATA_CACHE = `data-${version}`;
// Kartenkacheln ueberleben den Versionswechsel: sie aendern sich kaum, sind
// aber teuer nachzuladen - und im Tal gibt es oft kein Netz mehr.
const TILE_CACHE = 'tiles-v1';
const TILE_LIMIT = 400;
const ASSETS = [...build, ...files];

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(ASSETS)).then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((k) => k !== APP_CACHE && k !== DATA_CACHE && k !== TILE_CACHE)
						.map((k) => caches.delete(k))
				)
			)
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET' || !request.url.startsWith('http')) return;

	const url = new URL(request.url);

	// Statische Assets kommen unveraendert aus dem Cache.
	if (ASSETS.includes(url.pathname)) {
		event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
		return;
	}

	// Kartenkacheln: erst der Cache, damit eine einmal betrachtete Region
	// offline verfuegbar bleibt.
	if (isTileRequest(url)) {
		event.respondWith(serveTile(request));
		return;
	}

	// Seiten und Tagesplan: erst das Netz, bei Funkloch die letzte Fassung.
	event.respondWith(
		fetch(request)
			.then((response) => {
				if (response.ok) {
					const copy = response.clone();
					caches.open(DATA_CACHE).then((cache) => cache.put(request, copy));
				}
				return response;
			})
			.catch(async () => {
				const hit = await caches.match(request);
				if (hit) return hit;
				return new Response('Offline und nichts im Zwischenspeicher.', {
					status: 503,
					headers: { 'content-type': 'text/plain; charset=utf-8' }
				});
			})
	);
});

/** Kachel-Requests erkennt man am Pfadmuster der ueblichen Tile-Server. */
function isTileRequest(url: URL): boolean {
	return /\/\d+\/\d+\/\d+(@\dx)?\.(png|jpg|jpeg|webp|pbf)$/.test(url.pathname);
}

async function serveTile(request: Request): Promise<Response> {
	const cache = await caches.open(TILE_CACHE);
	const hit = await cache.match(request);
	if (hit) return hit;

	const response = await fetch(request);
	if (response.ok) {
		await cache.put(request, response.clone());
		void trimTileCache(cache);
	}
	return response;
}

/** Haelt den Kachel-Cache klein - aelteste Eintraege zuerst raus. */
async function trimTileCache(cache: Cache): Promise<void> {
	const keys = await cache.keys();
	if (keys.length <= TILE_LIMIT) return;
	await Promise.all(keys.slice(0, keys.length - TILE_LIMIT).map((key) => cache.delete(key)));
}
