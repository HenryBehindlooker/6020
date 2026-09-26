import { distanceKm } from '$lib/logic/gpx';

export interface PointFeature {
	name: string;
	lat: number;
	lon: number;
	ele: number | null;
	kind: 'schutzhuette' | 'selbstversorger' | 'einkehr';
	openingHours: string | null;
	website: string | null;
	osm: string | null;
}

export interface Nearby extends PointFeature {
	km: number;
}

/**
 * Huetten und Einkehr im Umkreis einer Tour, naechste zuerst.
 *
 * Luftlinie, nicht Gehweg - fuer "gibt es unterwegs etwas" reicht das, fuer
 * die Planung einer Einkehr nicht. Die Oberflaeche sagt das dazu.
 */
export function nearby(points: PointFeature[], lat: number, lon: number, radiusKm = 2.5, limit = 5): Nearby[] {
	return points
		.map((p) => ({ ...p, km: Math.round(distanceKm({ lat, lon, ele: null }, { lat: p.lat, lon: p.lon, ele: null }) * 10) / 10 }))
		.filter((p) => p.km <= radiusKm)
		.sort((a, b) => a.km - b.km)
		.slice(0, limit);
}

/** GeoJSON-Punkt aus scripts/fetch/osm.py in das App-Modell. */
export function toPointFeature(feature: {
	geometry?: { type?: string; coordinates?: number[] };
	properties?: Record<string, unknown>;
}): PointFeature | null {
	const coords = feature.geometry?.coordinates;
	const props = feature.properties ?? {};
	if (feature.geometry?.type !== 'Point' || !coords || coords.length < 2) return null;
	const name = typeof props.name === 'string' ? props.name.trim() : '';
	if (!name) return null;

	const eleRaw = typeof props.ele === 'string' ? Number.parseFloat(props.ele.replace(',', '.')) : Number(props.ele);
	const kind =
		props.tourism === 'alpine_hut' ? 'schutzhuette' : props.tourism === 'wilderness_hut' ? 'selbstversorger' : 'einkehr';
	const website = props.website ?? props['contact:website'];

	return {
		name,
		lon: coords[0],
		lat: coords[1],
		ele: Number.isFinite(eleRaw) ? Math.round(eleRaw) : null,
		kind,
		openingHours: typeof props.opening_hours === 'string' ? props.opening_hours : null,
		website: typeof website === 'string' ? website : null,
		osm: typeof props.osm === 'string' ? props.osm : null
	};
}
