import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { buildKml, type KmlPoint } from '$lib/logic/kml';
import { nearby } from '$lib/logic/nearby';
import { getHuts } from '$lib/server/sources/osm';
import { getTrack } from '$lib/server/sources/tracks';
import { findTour } from '$lib/server/sources/tours';

export const prerender = env.BUILD_TARGET === 'pages';

export const GET: RequestHandler = async ({ params }) => {
	const tour = findTour(params.id);
	if (!tour) error(404, 'Tour nicht gefunden');

	const points: KmlPoint[] = [
		{ name: `${tour.trailheadStop} (Haltestelle)`, lat: tour.lat, lon: tour.lon, style: 'start', description: `Ausgangspunkt ${tour.trailhead}` }
	];
	if (tour.summit) {
		points.push({ name: tour.summit.name, lat: tour.summit.lat, lon: tour.summit.lon, style: 'gipfel', description: `${tour.summit.ele ?? tour.summitAltitude} m laut OpenStreetMap` });
	}
	for (const h of nearby(await getHuts(), tour.lat, tour.lon)) {
		points.push({ name: h.name, lat: h.lat, lon: h.lon, style: 'huette', description: [h.ele ? `${h.ele} m` : '', h.payment.text].filter(Boolean).join(' · ') });
	}
	const track = await getTrack(tour.id);

	const kml = buildKml({
		name: `${tour.name} – Bergampel Innsbruck`,
		description:
			'Ausgangspunkt, Gipfel und Hütten aus OpenStreetMap (© OpenStreetMap-Mitwirkende, ODbL). Kein Routenverlauf, außer es gibt eine echte Aufzeichnung. Lawinenlage und Umkehrzeit in der App prüfen.',
		points,
		track: track && !track.schematic ? track.points.map((p) => [p.lat, p.lon] as [number, number]) : null
	});
	return new Response(kml, {
		headers: {
			'content-type': 'application/vnd.google-earth.kml+xml; charset=utf-8',
			'content-disposition': `attachment; filename="${tour.id}.kml"`
		}
	});
};
