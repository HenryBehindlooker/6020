import type { Aspect, Tour } from '#lib/types.js';

/**
 * Messstationen des Lawinenwarndienstes Tirol (static/stationen/lwd.geojson,
 * geschrieben von scripts/fetch/stations.py).
 *
 * Die Prognose sagt, was kommen soll; die Station misst, was ist. Je Tour
 * werden die naechsten Stationen gezeigt - bevorzugt eine Windstation in
 * Gipfelnaehe und eine Schneestation. Angezeigt, nicht bewertet: die Ampel
 * rechnet weiter nur mit Lagebericht und Prognose.
 */

export interface StationProps {
	name?: string;
	'LWD-Region'?: string;
	date?: string;
	/** Schneehoehe in cm */
	HS?: number;
	/** Aenderung der Schneehoehe in 24/48/72 h, cm - Neuschnee minus Setzung */
	HSD24?: number;
	HSD48?: number;
	HSD72?: number;
	/** Lufttemperatur in Grad Celsius */
	LT?: number;
	/** Mittelwind und Boee in km/h */
	WG?: number;
	WG_BOE?: number;
	/** Windrichtung in Grad, aus der der Wind kommt */
	WR?: number;
	ele?: number | null;
}

export interface Station {
	name: string;
	ele: number | null;
	lat: number;
	lon: number;
	/** Entfernung zum Gipfel in km */
	km: number;
	/** Messzeitpunkt (ISO) */
	date: string | null;
	snowCm: number | null;
	snowChange24: number | null;
	snowChange72: number | null;
	tempC: number | null;
	windKmh: number | null;
	gustKmh: number | null;
	windFrom: Aspect | null;
	region: string | null;
}

type Feature = { geometry?: { type?: string; coordinates?: number[] }; properties?: StationProps };

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function degreesToAspect(deg: number | null): Aspect | null {
	if (deg === null) return null;
	const sectors: Aspect[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
	return sectors[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function km(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const dy = (lat2 - lat1) * 111.2;
	const dx = (lon2 - lon1) * 111.2 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
	return Math.hypot(dx, dy);
}

export function toStation(f: Feature, ziel: { lat: number; lon: number }): Station | null {
	const c = f.geometry?.coordinates;
	const p = f.properties ?? {};
	if (f.geometry?.type !== 'Point' || !c || c.length < 2 || !p.name) return null;
	return {
		name: p.name,
		ele: num(p.ele),
		lat: c[1],
		lon: c[0],
		km: Math.round(km(ziel.lat, ziel.lon, c[1], c[0]) * 10) / 10,
		date: typeof p.date === 'string' ? p.date : null,
		snowCm: num(p.HS),
		snowChange24: num(p.HSD24),
		snowChange72: num(p.HSD72),
		tempC: num(p.LT),
		windKmh: num(p.WG),
		gustKmh: num(p.WG_BOE),
		windFrom: degreesToAspect(num(p.WR)),
		region: typeof p['LWD-Region'] === 'string' ? p['LWD-Region'] : null
	};
}

/**
 * Die Stationen fuer eine Tour: im Umkreis von 6 km um den Gipfel, die
 * naechste Windstation und die naechste Schneestation zuerst, dann nach
 * Entfernung - hoechstens drei. Eine Station, die hoeher liegt als der
 * Gipfel plus 400 m, misst eine andere Welt und faellt weg.
 */
export function stationsForTour(features: Feature[], tour: Tour, radiusKm = 6, max = 3): Station[] {
	const ziel = tour.summit ?? { lat: tour.lat, lon: tour.lon };
	const nah = features
		.map((f) => toStation(f, ziel))
		.filter((s): s is Station => s !== null && s.km <= radiusKm)
		.filter((s) => s.ele === null || s.ele <= tour.summitAltitude + 400)
		.sort((a, b) => a.km - b.km);

	const wind = nah.find((s) => s.windKmh !== null);
	const schnee = nah.find((s) => s.snowCm !== null);
	const zuerst = [wind, schnee].filter((s): s is Station => s !== undefined);
	const rest = nah.filter((s) => !zuerst.includes(s));
	return [...new Set([...zuerst, ...rest])].slice(0, max).sort((a, b) => a.km - b.km);
}

/** "+12 cm", "−3 cm", "±0 cm" */
export function signedCm(value: number | null): string | null {
	if (value === null) return null;
	const r = Math.round(value);
	return r > 0 ? `+${r} cm` : r < 0 ? `−${-r} cm` : '±0 cm';
}
