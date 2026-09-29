import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { toPointFeature, type PointFeature } from '$lib/logic/nearby';
import { cached } from '$lib/server/cache';
import { config } from '$lib/server/config';
import { safeUrl } from '$lib/components/osmLayers';

/** Von scripts/fetch/osm.py befuellt; dieselben Dateien laedt die Karte nach. */
const OSM_DIR = 'static/osm';

async function readCollection(file: string): Promise<{ features?: unknown[] } | null> {
	try {
		return JSON.parse(await readFile(join(OSM_DIR, file), 'utf8'));
	} catch {
		return null;
	}
}

/** Huetten und Einkehr aus OpenStreetMap - leer, solange nichts abgeholt wurde. */
export async function getHuts(): Promise<PointFeature[]> {
	return cached('osm:huts', config.cacheTtlMs, async () => {
		const collection = await readCollection('huts.geojson');
		return (collection?.features ?? [])
			.map((f) => toPointFeature(f as Parameters<typeof toPointFeature>[0]))
			.filter((p): p is PointFeature => p !== null);
	});
}

export async function getOsmSource(): Promise<{ fetched_at?: string; attribution?: string } | null> {
	try {
		return JSON.parse(await readFile(join(OSM_DIR, 'SOURCE.json'), 'utf8'));
	} catch {
		return null;
	}
}

type RawFeature = { geometry?: { type?: string; coordinates?: number[] }; properties?: Record<string, unknown> };

/** Markante Punkte (Sattel, Wasser, Aussicht ...) als rohe GeoJSON-Features. */
export async function getPois(): Promise<RawFeature[]> {
	return cached('osm:pois', config.cacheTtlMs, async () => {
		const collection = await readCollection('pois.geojson');
		return (collection?.features ?? []) as RawFeature[];
	});
}

export interface BikeRoute {
	name: string;
	ref: string | null;
	kind: 'mtb' | 'rad';
	network: string | null;
	lengthKm: number;
	mtbScale: string | null;
	ascent: string | null;
	roundtrip: boolean;
	website: string | null;
	osm: string | null;
	/** Mittelpunkt der Linien, fuer "wo ungefaehr" */
	lat: number;
	lon: number;
}

/** Rad- und MTB-Routen aus OSM fuer die Radl-Seite. */
export async function getBikeRoutes(): Promise<BikeRoute[]> {
	return cached('osm:bike', config.cacheTtlMs, async () => {
		const collection = await readCollection('routes-bike.geojson');
		const out: BikeRoute[] = [];
		for (const raw of (collection?.features ?? []) as {
			geometry?: { coordinates?: number[][][] };
			properties?: Record<string, unknown>;
		}[]) {
			const p = raw.properties ?? {};
			const name = typeof p.name === 'string' ? p.name.trim() : '';
			const lines = raw.geometry?.coordinates ?? [];
			const pts = lines.flat();
			if (!name || pts.length === 0) continue;
			const s = (k: string) => (typeof p[k] === 'string' && (p[k] as string).trim() ? (p[k] as string).trim() : null);
			out.push({
				name,
				ref: s('ref'),
				kind: p.route === 'mtb' ? 'mtb' : 'rad',
				network: s('network'),
				lengthKm: Number(p.length_km_in_region) || 0,
				mtbScale: s('mtb:scale'),
				ascent: s('ascent'),
				roundtrip: p.roundtrip === 'yes',
				website: safeUrl(s('website')),
				osm: s('osm'),
				lat: pts.reduce((a, c) => a + c[1], 0) / pts.length,
				lon: pts.reduce((a, c) => a + c[0], 0) / pts.length
			});
		}
		return out.sort((a, b) => a.name.localeCompare(b.name, 'de'));
	});
}
