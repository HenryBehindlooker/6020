import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { TRACKS_DIR } from '$app/env/private';
import type { Track } from '#lib/logic/gpx.js';
import { ascentMeters, lengthKm, parseGpx, simplify } from '#lib/logic/gpx.js';
import { cached } from '#lib/server/cache.js';
import { config } from '#lib/server/config.js';

/** Ablage der GPX-Dateien; Dateiname ohne Endung ist die Tour-ID. */
const TRACKS_PATH = TRACKS_DIR || 'data/tracks';

/**
 * Laedt alle vorhandenen Tourenverlaeufe, nach Tour-ID.
 *
 * Fehlt das Verzeichnis oder ist eine Datei unlesbar, faellt die Karte auf die
 * Ausgangspunkte zurueck - ein fehlender Track ist kein Fehler, sondern der
 * Normalfall fuer eine Tour, die noch niemand aufgezeichnet hat.
 */
export async function getTracks(): Promise<Map<string, Track>> {
	return cached('tracks', config.cacheTtlMs, async () => {
		const tracks = new Map<string, Track>();

		let files: string[];
		try {
			files = await readdir(TRACKS_PATH);
		} catch {
			return tracks;
		}

		for (const file of files) {
			if (!file.toLowerCase().endsWith('.gpx')) continue;
			const tourId = file.replace(/\.gpx$/i, '');

			try {
				const xml = await readFile(join(TRACKS_PATH, file), 'utf8');
				const parsed = parseGpx(xml);
				if (parsed.points.length < 2) continue;

				tracks.set(tourId, {
					tourId,
					name: parsed.name || tourId,
					points: parsed.points,
					schematic: parsed.schematic,
					lengthKm: lengthKm(parsed.points),
					ascentMeters: ascentMeters(parsed.points)
				});
			} catch (err) {
				console.error(`[tracks] ${file} konnte nicht gelesen werden:`, err);
			}
		}

		return tracks;
	});
}

export async function getTrack(tourId: string): Promise<Track | null> {
	return (await getTracks()).get(tourId) ?? null;
}

/**
 * Verlaeufe fuer die Uebersichtskarte: stark ausgeduennt, weil dort ein Dutzend
 * Tracks gleichzeitig ueber die Leitung gehen.
 */
export async function getSimplifiedTracks(toleranceMeters = 40): Promise<Track[]> {
	const tracks = [...(await getTracks()).values()];
	return tracks.map((track) => ({
		...track,
		points: simplify(track.points, toleranceMeters)
	}));
}
