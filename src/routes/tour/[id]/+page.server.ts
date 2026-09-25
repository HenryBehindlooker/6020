import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { buildDayPlan } from '$lib/server/plan';

export const load: PageServerLoad = async ({ params, url }) => {
	const notBefore = url.searchParams.get('ab') ?? undefined;
	const plan = await buildDayPlan({
		notBefore: /^\d{2}:\d{2}$/.test(notBefore ?? '') ? notBefore : undefined
	});

	const tourPlan = plan.tours.find((t) => t.tour.id === params.id);
	if (!tourPlan) error(404, 'Tour nicht gefunden');

	return { tourPlan, bulletin: plan.bulletin, mode: plan.mode };
};
