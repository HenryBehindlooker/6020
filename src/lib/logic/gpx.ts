export interface TrackPoint {
	lat: number;
	lon: number;
	/** Hoehe in Metern, falls die Datei sie enthaelt. */
	ele: number | null;
}

export interface Track {
	/** Tour-ID, zu der der Verlauf gehoert. */
	tourId: string;
	name: string;
	points: TrackPoint[];
	/** Schematischer Verlauf statt echter Aufzeichnung - wird gestrichelt gezeichnet. */
	schematic: boolean;
	lengthKm: number;
	ascentMeters: number;
}

/**
 * Liest die Trackpunkte aus einer GPX-Datei.
 *
 * Bewusst ein schlanker Parser statt einer XML-Bibliothek: GPX-Tracks sind
 * flach aufgebaut, und die Dateien kommen aus dem eigenen Datenverzeichnis,
 * nicht von Nutzereingaben. Routen (<rtept>) werden wie Tracks behandelt;
 * Wegpunkte (<wpt>) ignoriert der Parser.
 */
export function parseGpx(xml: string): { name: string; points: TrackPoint[]; schematic: boolean } {
	const points: TrackPoint[] = [];
	const pointPattern = /<(?:trkpt|rtept)\s+([^>]*?)\/?>([\s\S]*?)(?:<\/(?:trkpt|rtept)>|(?=<(?:trkpt|rtept)\s)|$)/g;

	for (const match of xml.matchAll(pointPattern)) {
		const lat = Number(match[1].match(/\blat\s*=\s*"([^"]+)"/)?.[1]);
		const lon = Number(match[1].match(/\blon\s*=\s*"([^"]+)"/)?.[1]);
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

		const eleText = match[2]?.match(/<ele>([^<]+)<\/ele>/)?.[1];
		const ele = eleText === undefined ? null : Number(eleText);

		points.push({ lat, lon, ele: ele !== null && Number.isFinite(ele) ? ele : null });
	}

	const name = xml.match(/<name>([^<]*)<\/name>/)?.[1]?.trim() ?? '';
	const description = xml.match(/<desc>([^<]*)<\/desc>/)?.[1] ?? '';

	return { name, points, schematic: /schematisch|schematic/i.test(description) };
}

/** Streckenlaenge in Kilometern nach der Haversine-Formel. */
export function lengthKm(points: TrackPoint[]): number {
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		total += distanceKm(points[i - 1], points[i]);
	}
	return Math.round(total * 10) / 10;
}

/** Summe aller Anstiege - Abstiege dazwischen zaehlen nicht mit. */
export function ascentMeters(points: TrackPoint[]): number {
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		const previous = points[i - 1].ele;
		const current = points[i].ele;
		if (previous === null || current === null) continue;
		if (current > previous) total += current - previous;
	}
	return Math.round(total);
}

const EARTH_RADIUS_KM = 6371;

export function distanceKm(a: TrackPoint, b: TrackPoint): number {
	const dLat = toRadians(b.lat - a.lat);
	const dLon = toRadians(b.lon - a.lon);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function toRadians(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

/**
 * Duennt einen Track nach Douglas-Peucker aus. Eine GPX-Aufzeichnung hat
 * leicht ein paar tausend Punkte; fuer die Uebersichtskarte reichen wenige
 * Dutzend, und das spart Bytes auf der Mobilverbindung.
 *
 * toleranceMeters ist der groesste Abstand, um den die vereinfachte Linie vom
 * Original abweichen darf.
 */
export function simplify(points: TrackPoint[], toleranceMeters = 25): TrackPoint[] {
	if (points.length <= 2) return [...points];

	const toleranceKm = toleranceMeters / 1000;
	let maxDistance = 0;
	let index = 0;

	for (let i = 1; i < points.length - 1; i++) {
		const distance = perpendicularDistanceKm(points[i], points[0], points[points.length - 1]);
		if (distance > maxDistance) {
			maxDistance = distance;
			index = i;
		}
	}

	if (maxDistance <= toleranceKm) return [points[0], points[points.length - 1]];

	const left = simplify(points.slice(0, index + 1), toleranceMeters);
	const right = simplify(points.slice(index), toleranceMeters);
	return [...left.slice(0, -1), ...right];
}

/** Abstand eines Punktes von der Geraden zwischen Start und Ende, in km. */
function perpendicularDistanceKm(point: TrackPoint, start: TrackPoint, end: TrackPoint): number {
	// Auf diesen Distanzen genuegt eine ebene Naeherung; der Laengengrad wird
	// mit dem Kosinus der Breite gestaucht.
	const scale = Math.cos(toRadians(start.lat));
	const px = (point.lon - start.lon) * scale;
	const py = point.lat - start.lat;
	const ex = (end.lon - start.lon) * scale;
	const ey = end.lat - start.lat;

	const lengthSquared = ex * ex + ey * ey;
	if (lengthSquared === 0) return distanceKm(point, start);

	const t = Math.max(0, Math.min(1, (px * ex + py * ey) / lengthSquared));
	const nearest: TrackPoint = {
		lat: start.lat + t * ey,
		lon: start.lon + (t * ex) / scale,
		ele: null
	};
	return distanceKm(point, nearest);
}
