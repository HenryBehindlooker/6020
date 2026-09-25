import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { buildDayPlan } from '$lib/server/plan';
import { getTrack } from '$lib/server/sources/tracks';
import { simplify } from '$lib/logic/gpx';

export const load: PageServerLoad = async ({ params, url }) => {
	const notBefore = url.searchParams.get('ab') ?? undefined;
	const plan = await buildDayPlan({
		notBefore: /^\d{2}:\d{2}$/.test(notBefore ?? '') ? notBefore : undefined
	});

	const tourPlan = plan.tours.find((t) => t.tour.id === params.id);
	if (!tourPlan) error(404, 'Tour nicht gefunden');

	// Auf der Detailkarte darf der Verlauf genauer sein als in der Uebersicht.
	const track = await getTrack(params.id);

	return {
		tourPlan,
		bulletin: plan.bulletin,
		mode: plan.mode,
		track: track
			? {
					points: simplify(track.points, 10).map((p) => [p.lat, p.lon] as [number, number]),
					schematic: track.schematic,
					lengthKm: track.lengthKm,
					ascentMeters: track.ascentMeters
				}
			: null
	};
};
