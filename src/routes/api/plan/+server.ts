import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';
import { buildDayPlan } from '$lib/server/plan';
import { planningDate } from '$lib/logic/dayPlan';
import { parsePlanParams } from '$lib/planParams';

// In der statischen Fassung wird der Tagesplan als feste JSON-Datei abgelegt.
export const prerender = env.BUILD_TARGET === 'pages';

/** JSON-Sicht auf denselben Tagesplan - fuer Widgets, Bots oder eine native App.
 * Die Eingangsdaten zum Selberrechnen liegen unter /daten/plan.json. */
export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const params = parsePlanParams(building ? null : url.searchParams);
	const plan = await buildDayPlan({
		date: planningDate(params.tag),
		notBefore: params.notBefore,
		bufferMinutes: params.bufferMinutes
	});

	setHeaders({ 'cache-control': 'public, max-age=300' });
	return json(plan);
};
