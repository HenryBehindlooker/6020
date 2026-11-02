import type { PageServerLoad } from './$types';
import { resolve } from '$app/paths';
import { getValleys } from '#lib/server/sources/photos.js';
import { listTours } from '#lib/server/sources/tours.js';
import { distanceKm } from '#lib/logic/gpx.js';

export const load: PageServerLoad = async () => {
	const tours = listTours();
	const valleys = (await getValleys()).map((v) => ({
		...v,
		// Touren, deren Gipfel oder Ausgangspunkt nahe liegt
		tours: tours
			.filter((t) =>
				[t.summit ?? t, t].some(
					(p) => distanceKm({ lat: v.lat, lon: v.lon, ele: null }, { lat: p.lat, lon: p.lon, ele: null }) <= 8
				)
			)
			.map((t) => ({ name: t.name, href: resolve(`tour/${t.id}`) }))
	}));
	return { valleys };
};
