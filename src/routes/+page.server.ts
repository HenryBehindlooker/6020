import type { PageServerLoad } from './$types';
import { building } from '$app/environment';
import { buildDayPlan } from '$lib/server/plan';
import { planningDate } from '$lib/logic/dayPlan';
import { parsePlanParams } from '$lib/planParams';

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	// Beim Vorrendern gibt es keine Abfrageparameter.
	const params = parsePlanParams(building ? null : url.searchParams);
	const plan = await buildDayPlan({
		date: planningDate(params.tag),
		notBefore: params.notBefore,
		bufferMinutes: params.bufferMinutes
	});

	setHeaders({ 'cache-control': 'public, max-age=300' });

	return {
		plan,
		params,
		// Vorgerendert: der Browser rechnet nach, sobald /daten/plan.json da ist
		staticPreview: building
	};
};
