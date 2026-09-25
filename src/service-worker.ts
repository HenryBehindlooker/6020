/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

// Im Sellrain- und Halltal gibt es streckenweise kein Netz. Die App muss den
// zuletzt geladenen Tagesplan deshalb auch offline anzeigen koennen.
const APP_CACHE = `app-${version}`;
const DATA_CACHE = `data-${version}`;
const ASSETS = [...build, ...files];

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(ASSETS)).then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== APP_CACHE && k !== DATA_CACHE).map((k) => caches.delete(k))))
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
