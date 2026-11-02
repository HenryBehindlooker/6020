import { readFile } from 'node:fs/promises';
import timetable from '#fixtures/timetable.json' with { type: 'json' };
import type { DemoTimetable } from '#lib/logic/dayPlan.js';
import type { Snapshot, SnapshotItinerary } from '#lib/logic/snapshot.js';
import { cached } from '#lib/server/cache.js';
import { config } from '#lib/server/config.js';

/** Von scripts/fetch/transitous.py auf dem GitHub-Runner geschrieben. */
const SNAPSHOT_PATH = 'data/transit/connections.json';

/**
 * Der Transitous-Abzug, auf das verkleinert, was die Planung braucht.
 *
 * Die Datei hat rund 750 KB (Betreiber, Verkehrsmittel, Ziel je Teilstrecke);
 * der Browser bekommt nur Zeiten, Linien und Haltestellen - gut ein Viertel.
 */
export async function loadTransitSnapshot(): Promise<Snapshot | null> {
	return cached('transit:snapshot', config.cacheTtlMs, async () => {
		try {
			return compactSnapshot(JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8')) as Snapshot);
		} catch {
			return null;
		}
	});
}

export function compactSnapshot(snapshot: Snapshot): Snapshot {
	const it = (i: SnapshotItinerary): SnapshotItinerary => ({
		departure: i.departure,
		arrival: i.arrival,
		walk_to_stop_min: i.walk_to_stop_min,
		walk_from_stop_min: i.walk_from_stop_min,
		transfers: i.transfers,
		legs: i.legs.map((l) => ({ line: l.line, from: l.from, to: l.to, departure: l.departure, arrival: l.arrival }))
	});
	return {
		fetched_at: snapshot.fetched_at,
		source: snapshot.source,
		destination: snapshot.destination,
		days: Object.fromEntries(
			Object.entries(snapshot.days).map(([label, day]) => [
				label,
				{
					date: day.date,
					trailheads: Object.fromEntries(
						Object.entries(day.trailheads).map(([stop, e]) => [
							stop,
							{
								outbound: e.outbound.map(it),
								inbound: e.inbound.map(it),
								...(e.errors?.length ? { errors: e.errors.slice(0, 3) } : {})
							}
						])
					)
				}
			])
		)
	};
}

/** Der erfundene Beispielfahrplan - nur fuer den Demo-Modus ohne echten Abzug. */
export function demoTimetable(): DemoTimetable {
	return timetable as unknown as DemoTimetable;
}
