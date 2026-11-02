import type { PageServerLoad } from './$types';
import { building } from '$app/env';
import { buildDayPlan } from '#lib/server/plan.js';
import { planningDate } from '#lib/logic/dayPlan.js';
import { parsePlanParams } from '#lib/planParams.js';

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
