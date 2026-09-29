import { readFile } from 'node:fs/promises';
import { cached } from '$lib/server/cache';
import { config } from '$lib/server/config';

/** Von scripts/fetch/photos.py befuellt: Wikimedia-Fotos mit Urheber und Lizenz. */
const PATH = 'static/photos/photos.json';

export interface Photo {
	file: string;
	thumb: string;
	width: number;
	height: number;
	page: string;
	author: string;
	license: string;
	licenseUrl?: string | null;
	caption?: string | null;
	date?: string | null;
	distM?: number;
}

export interface Valley {
	title: string;
	lat: number;
	lon: number;
	extract: string;
	article: string;
	photo: Photo;
}

interface PhotoFile {
	fetched_at?: string;
	valleys: Valley[];
	tours: Record<string, Photo[]>;
}

/** Nur Bilder von Wikimedia-Servern - die Datei kommt aus dem Repo, aber sicher ist sicher. */
function sicher(photo: Photo | undefined): photo is Photo {
	return (
		!!photo &&
		typeof photo.thumb === 'string' &&
		/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(photo.thumb)
	);
}

async function load(): Promise<PhotoFile> {
	return cached('photos', config.cacheTtlMs, async () => {
		try {
			const raw = JSON.parse(await readFile(PATH, 'utf8')) as PhotoFile;
			return {
				fetched_at: raw.fetched_at,
				valleys: (raw.valleys ?? []).filter((v) => sicher(v.photo)),
				tours: Object.fromEntries(Object.entries(raw.tours ?? {}).map(([k, v]) => [k, (v ?? []).filter(sicher)]))
			};
		} catch {
			return { valleys: [], tours: {} };
		}
	});
}

export async function getValleys(): Promise<Valley[]> {
	return (await load()).valleys;
}

export async function getTourPhotos(tourId: string): Promise<Photo[]> {
	return (await load()).tours[tourId] ?? [];
}
