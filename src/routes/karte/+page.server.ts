import type { PageServerLoad } from './$types';
import { base } from '$app/paths';
import { building } from '$app/environment';
import { buildDayPlan } from '$lib/server/plan';
import { planningDate } from '$lib/logic/dayPlan';
import { getSimplifiedTracks } from '$lib/server/sources/tracks';
import { parsePlanParams } from '$lib/planParams';

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const params = parsePlanParams(building ? null : url.searchParams);
	const [plan, tracks] = await Promise.all([
		buildDayPlan({ date: planningDate(params.tag), notBefore: params.notBefore, bufferMinutes: params.bufferMinutes }),
		getSimplifiedTracks()
	]);

	const signalByTour = new Map(plan.tours.map((t) => [t.tour.id, t.rating.signal]));
	const nameByTour = new Map(plan.tours.map((t) => [t.tour.id, t.tour.name]));

	setHeaders({ 'cache-control': 'public, max-age=300' });

	return {
		plan,
		tracks: tracks
			.filter((track) => signalByTour.has(track.tourId))
			.map((track) => ({
				tourId: track.tourId,
				points: track.points.map((p) => [p.lat, p.lon] as [number, number]),
				signal: signalByTour.get(track.tourId)!,
				label: nameByTour.get(track.tourId) ?? track.name,
				schematic: track.schematic,
				href: `${base}/tour/${track.tourId}`
			})),
		params
	};
};
