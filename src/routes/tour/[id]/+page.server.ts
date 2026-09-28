import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { building } from '$app/environment';
import { buildDayPlan } from '$lib/server/plan';
import { getTrack } from '$lib/server/sources/tracks';
import { simplify } from '$lib/logic/gpx';
import { nearby } from '$lib/logic/nearby';
import { getHuts } from '$lib/server/sources/osm';
import { parsePlanParams } from '$lib/planParams';

export const load: PageServerLoad = async ({ params: route, url }) => {
	// Dieselben Werte wie auf der Liste - sonst zeigt die Tourenseite eine
	// andere Umkehrzeit als die Karte, von der man gerade kam.
	const params = parsePlanParams(building ? null : url.searchParams);
	const plan = await buildDayPlan({ notBefore: params.notBefore, bufferMinutes: params.bufferMinutes });

	const tourPlan = plan.tours.find((t) => t.tour.id === route.id);
	if (!tourPlan) error(404, 'Tour nicht gefunden');

	// Auf der Detailkarte darf der Verlauf genauer sein als in der Uebersicht.
	const track = await getTrack(route.id);
	const huts = nearby(await getHuts(), tourPlan.tour.lat, tourPlan.tour.lon);

	return {
		tourPlan,
		bulletin: plan.bulletin,
		status: plan.status,
		mode: plan.mode,
		params,
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
