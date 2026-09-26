import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { building } from '$app/environment';
import { buildDayPlan } from '$lib/server/plan';
import { getTrack } from '$lib/server/sources/tracks';
import { simplify } from '$lib/logic/gpx';
import { nearby } from '$lib/logic/nearby';
import { getHuts } from '$lib/server/sources/osm';

export const load: PageServerLoad = async ({ params, url }) => {
	const notBefore = building ? undefined : (url.searchParams.get('ab') ?? undefined);
	const plan = await buildDayPlan({
		notBefore: /^\d{2}:\d{2}$/.test(notBefore ?? '') ? notBefore : undefined
	});

	const tourPlan = plan.tours.find((t) => t.tour.id === params.id);
	if (!tourPlan) error(404, 'Tour nicht gefunden');

	// Auf der Detailkarte darf der Verlauf genauer sein als in der Uebersicht.
	const track = await getTrack(params.id);
	const huts = nearby(await getHuts(), tourPlan.tour.lat, tourPlan.tour.lon);

	return {
		tourPlan,
		bulletin: plan.bulletin,
		mode: plan.mode,
		huts,
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
