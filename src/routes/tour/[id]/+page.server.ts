import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { building } from '$app/env';
import { buildDayPlan } from '#lib/server/plan.js';
import { getTrack } from '#lib/server/sources/tracks.js';
import { simplify } from '#lib/logic/gpx.js';
import { nearby } from '#lib/logic/nearby.js';
import { getHuts, getPois } from '#lib/server/sources/osm.js';
import { getTourPhotos, getValleys } from '#lib/server/sources/photos.js';
import { landmarksAlong } from '#lib/logic/landmarks.js';
import { distanceKm } from '#lib/logic/gpx.js';
import { planningDate } from '#lib/logic/dayPlan.js';
import { parsePlanParams } from '#lib/planParams.js';

export const load: PageServerLoad = async ({ params: route, url }) => {
	// Dieselben Werte wie auf der Liste - sonst zeigt die Tourenseite eine
	// andere Umkehrzeit als die Karte, von der man gerade kam.
	const params = parsePlanParams(building ? null : url.searchParams);
	const plan = await buildDayPlan({
		date: planningDate(params.tag),
		notBefore: params.notBefore,
		bufferMinutes: params.bufferMinutes
	});

	const tourPlan = plan.tours.find((t) => t.tour.id === route.id);
	if (!tourPlan) error(404, 'Tour nicht gefunden');

	// Auf der Detailkarte darf der Verlauf genauer sein als in der Uebersicht.
	const track = await getTrack(route.id);
	const tour = tourPlan.tour;
	const huts = nearby(await getHuts(), tour.lat, tour.lon);
	const landmarks = tour.summit ? landmarksAlong(await getPois(), tour, tour.summit) : [];

	// Fotos: rund um den Gipfel, dazu das naechstgelegene Tal (hoechstens 8 km)
	const photos = await getTourPhotos(tour.id);
	const ziel = { lat: tour.summit?.lat ?? tour.lat, lon: tour.summit?.lon ?? tour.lon, ele: null };
	const valley =
		(await getValleys())
			.map((v) => ({ ...v, km: distanceKm(ziel, { lat: v.lat, lon: v.lon, ele: null }) }))
			.filter((v) => v.km <= 8)
			.sort((a, b) => a.km - b.km)[0] ?? null;

	return {
		tourPlan,
		status: plan.status,
		date: plan.date,
		builtAt: plan.builtAt,
		params,
		huts,
		landmarks,
		photos,
		valley,
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
