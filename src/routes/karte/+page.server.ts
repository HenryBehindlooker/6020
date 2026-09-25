import type { PageServerLoad } from './$types';
import { buildDayPlan } from '$lib/server/plan';
import { groupByTrailhead } from '$lib/logic/trailheads';

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const notBefore = url.searchParams.get('ab') ?? undefined;
	const plan = await buildDayPlan({
		notBefore: /^\d{2}:\d{2}$/.test(notBefore ?? '') ? notBefore : undefined
	});

	setHeaders({ 'cache-control': 'public, max-age=300' });

	return {
		groups: groupByTrailhead(plan.tours),
		bulletin: plan.bulletin,
		mode: plan.mode,
		notBefore: notBefore ?? '07:00'
	};
};
