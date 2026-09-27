import type { Departure } from '$lib/types';
import { viennaMonth, viennaTime, viennaWeekday } from '$lib/logic/time';

/** Eine Reise aus data/transit/connections.json (scripts/fetch/transitous.py). */
export interface SnapshotItinerary {
	departure: string | null;
	arrival: string | null;
	walk_to_stop_min?: number;
	walk_from_stop_min?: number;
	transfers?: number;
	legs: {
		mode?: string;
		line: string;
		from: string | null;
		to: string | null;
		departure: string | null;
		arrival: string | null;
		headsign?: string | null;
	}[];
}

export interface SnapshotDay {
	date: string;
	trailheads: Record<
		string,
		{ outbound: SnapshotItinerary[]; inbound: SnapshotItinerary[]; errors?: string[] }
	>;
}

export interface Snapshot {
	fetched_at: string;
	source: string;
	destination: string;
	days: Record<string, SnapshotDay>;
}

/** Dezember bis April. */
const WINTER_MONTHS = new Set([12, 1, 2, 3, 4]);

/**
 * Welcher Beispieltag passt zum gewuenschten Datum? Wochenende -> Samstag,
 * sonst Werktag. Im Winter am Wochenende der Wintersamstag, falls abgefragt -
 * unter der Woche NICHT, sonst fehlten Pendler- und Schulbusse.
 */
export function pickSnapshotDay(snapshot: Snapshot, date: Date): { label: string; day: SnapshotDay } | null {
	const weekday = viennaWeekday(date);
	const weekend = weekday === 0 || weekday === 6;
	const winter = WINTER_MONTHS.has(viennaMonth(date));
	const order = weekend
		? [...(winter ? ['winter_samstag'] : []), 'samstag', 'werktag']
		: ['werktag', 'samstag', ...(winter ? ['winter_samstag'] : [])];

	for (const label of order) {
		const day = snapshot.days[label];
		if (day) return { label, day };
	}
	return null;
}


/** Eine Reise in das App-Modell. Liefert null, wenn Zeiten fehlen. */
export function toDeparture(it: SnapshotItinerary, date: Date, direction: 'outbound' | 'inbound'): Departure | null {
	if (!it.departure || !it.arrival || it.legs.length === 0) return null;

	// Der Fahrplan wird auf den Planungstag uebertragen, in Innsbrucker Ortszeit.
	const dep = viennaTime(date, it.departure);
	let arr = viennaTime(date, it.arrival);
	if (arr < dep) arr = new Date(arr.getTime() + 24 * 3_600_000); // ueber Mitternacht

	const lines = it.legs.map((l) => l.line).filter(Boolean);
	const last = it.legs[it.legs.length - 1];

	return {
		line: lines.join(' + '),
		headsign: last.to ?? '',
		departure: dep.toISOString(),
		arrival: arr.toISOString(),
		delayMinutes: null,
		transfers: it.transfers ?? Math.max(0, it.legs.length - 1),
		// Beim Hinweg zaehlt der Weg VON der Haltestelle, beim Rueckweg der ZUR Haltestelle
		walkMinutes: direction === 'inbound' ? (it.walk_to_stop_min ?? 0) : (it.walk_from_stop_min ?? 0),
		legs: it.legs.map((l) => ({
			line: l.line,
			from: l.from ?? '',
			to: l.to ?? '',
			departure: l.departure ?? '',
			arrival: l.arrival ?? ''
		}))
	};
}
