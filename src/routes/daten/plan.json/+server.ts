import type { RequestHandler } from './$types';
import { BUILD_TARGET } from '$app/env/private';
import { loadPlanInputs } from '#lib/server/plan.js';

// In der statischen Fassung eine feste Datei, die der Browser einmal laedt.
export const prerender = BUILD_TARGET === 'pages';

/**
 * Die Eingangsdaten des Tagesplans: Touren, Lageberichte, Fahrplanabzug,
 * Wetterprognose. Daraus rechnet der Browser den Plan fuer heute oder morgen
 * und mit eigener Aufbruchszeit - auch in der vorgerenderten Fassung.
 */
export const GET: RequestHandler = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=300' });
	return new Response(JSON.stringify(await loadPlanInputs()), {
		headers: { 'content-type': 'application/json; charset=utf-8' }
	});
};
