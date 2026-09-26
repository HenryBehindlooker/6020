import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { toPointFeature, type PointFeature } from '$lib/logic/nearby';
import { cached } from '$lib/server/cache';
import { config } from '$lib/server/config';

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
