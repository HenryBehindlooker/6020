import type { PageServerLoad } from './$types';
import { base } from '$app/paths';
import { building } from '$app/environment';
import { buildDayPlan } from '$lib/server/plan';
import { groupByTrailhead } from '$lib/logic/trailheads';
import { getSimplifiedTracks } from '$lib/server/sources/tracks';

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const notBefore = building ? undefined : (url.searchParams.get('ab') ?? undefined);
	const [plan, tracks] = await Promise.all([
		buildDayPlan({ notBefore: /^\d{2}:\d{2}$/.test(notBefore ?? '') ? notBefore : undefined }),
		getSimplifiedTracks()
	]);

	const signalByTour = new Map(plan.tours.map((t) => [t.tour.id, t.rating.signal]));
	const nameByTour = new Map(plan.tours.map((t) => [t.tour.id, t.tour.name]));

	setHeaders({ 'cache-control': 'public, max-age=300' });

	return {
		groups: groupByTrailhead(plan.tours),
		tracks: tracks
			.filter((track) => signalByTour.has(track.tourId))
			.map((track) => ({
				points: track.points.map((p) => [p.lat, p.lon] as [number, number]),
				signal: signalByTour.get(track.tourId)!,
				label: nameByTour.get(track.tourId) ?? track.name,
				schematic: track.schematic,
				href: `${base}/tour/${track.tourId}`
			})),
		bulletin: plan.bulletin,
		mode: plan.mode,
		notBefore: notBefore ?? '07:00'
	};
};
