/**
 * Markante Punkte zwischen Ausgangspunkt und Gipfel: Sattel und Joch,
 * Aussichtspunkte, Trinkwasser, Quellen, Unterstaende, Wasserfaelle und
 * Gipfelkreuze aus OpenStreetMap.
 *
 * Ohne aufgezeichneten Verlauf ist das ein Korridor um die Luftlinie, keine
 * Route. Die Oberflaeche sagt das dazu - ein Brunnen 400 m neben der Linie
 * kann auf der anderen Talseite liegen.
 */

export type LandmarkKind = 'sattel' | 'aussicht' | 'wasser' | 'quelle' | 'unterstand' | 'wasserfall' | 'gipfelkreuz';

export interface Landmark {
	kind: LandmarkKind;
	name: string | null;
	lat: number;
	lon: number;
	ele: number | null;
	osm: string | null;
	/** 0 = Ausgangspunkt, 1 = Gipfel */
	along: number;
	/** Abstand zur Luftlinie in Metern */
	offM: number;
}

export const LANDMARK_LABEL: Record<LandmarkKind, string> = {
	sattel: 'Sattel/Joch',
	aussicht: 'Aussichtspunkt',
	wasser: 'Trinkwasser',
	quelle: 'Quelle',
	unterstand: 'Unterstand',
	wasserfall: 'Wasserfall',
	gipfelkreuz: 'Gipfelkreuz'
};

export function landmarkKind(props: Record<string, unknown>): LandmarkKind | null {
	if (props['summit:cross'] === 'yes' || props.man_made === 'cross') return 'gipfelkreuz';
	if (props.natural === 'saddle') return 'sattel';
	if (props.tourism === 'viewpoint') return 'aussicht';
	if (props.amenity === 'drinking_water') return 'wasser';
	if (props.natural === 'spring') return 'quelle';
	if (props.amenity === 'shelter') return 'unterstand';
	if (props.waterway === 'waterfall') return 'wasserfall';
	return null;
}

type Pt = { lat: number; lon: number };

/** Lage relativ zur Strecke a->b: Anteil entlang und seitlicher Abstand in m. */
function project(p: Pt, a: Pt, b: Pt): { t: number; offM: number } {
	const sx = 111_320 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
	const sy = 110_540;
	const ex = (b.lon - a.lon) * sx;
	const ey = (b.lat - a.lat) * sy;
	const px = (p.lon - a.lon) * sx;
	const py = (p.lat - a.lat) * sy;
	const l2 = ex * ex + ey * ey;
	const t = l2 === 0 ? 0 : (px * ex + py * ey) / l2;
	const tc = Math.max(0, Math.min(1, t));
	return { t, offM: Math.hypot(px - tc * ex, py - tc * ey) };
}

export function landmarksAlong(
	features: { geometry?: { type?: string; coordinates?: number[] }; properties?: Record<string, unknown> }[],
	start: Pt,
	summit: Pt,
	corridorM = 500,
	limit = 12
): Landmark[] {
	const out: Landmark[] = [];
	for (const f of features) {
		const c = f.geometry?.coordinates;
		if (f.geometry?.type !== 'Point' || !c) continue;
		const props = f.properties ?? {};
		const kind = landmarkKind(props);
		if (!kind) continue;
		const { t, offM } = project({ lat: c[1], lon: c[0] }, start, summit);
		// Etwas ueber Start und Gipfel hinaus zulassen, nicht aber das ganze Tal
		if (t < -0.05 || t > 1.05 || offM > corridorM) continue;
		const ele = Number.parseFloat(String(props.ele ?? '').replace(',', '.'));
		out.push({
			kind,
			name: typeof props.name === 'string' && props.name.trim() ? props.name.trim() : null,
			lat: c[1],
			lon: c[0],
			ele: Number.isFinite(ele) ? Math.round(ele) : null,
			osm: typeof props.osm === 'string' ? props.osm : null,
			along: Math.round(Math.max(0, Math.min(1, t)) * 100) / 100,
			offM: Math.round(offM)
		});
	}
	// Unbenannte Aussichtspunkte und Unterstaende gibt es viele - benannte zuerst
	return out
		.sort((a, b) => Number(!a.name) - Number(!b.name) || a.offM - b.offM)
		.slice(0, limit)
		.sort((a, b) => a.along - b.along);
}
