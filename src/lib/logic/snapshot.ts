import type { Departure } from '#lib/types.js';
import { viennaMonth, viennaTime, viennaWeekday } from '#lib/logic/time.js';
import { austrianHoliday } from '#lib/logic/holidays.js';

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
	trailheads: Record<string, { outbound: SnapshotItinerary[]; inbound: SnapshotItinerary[]; errors?: string[] }>;
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
 * Welcher Beispieltag passt zum gewuenschten Datum?
 *
 * - Sonn- und Feiertag: Sonntag, sonst Samstag (naeher dran als der Werktag)
 * - Samstag: Samstag
 * - Werktag: Werktag - NIE der Samstag, sonst fehlten Pendler- und Schulbusse
 *
 * Im Winter jeweils zuerst der Wintertag, falls abgefragt. Der Abholer fragt
 * ihn nur vor der Saison ab; in der Saison sind Samstag und Sonntag selbst
 * Wintertage.
 */
export function pickSnapshotDay(
	snapshot: Snapshot,
	date: Date
): { label: string; day: SnapshotDay; feiertag: string | null } | null {
	const weekday = viennaWeekday(date);
	const feiertag = weekday === 0 ? null : austrianHoliday(date);
	const winter = WINTER_MONTHS.has(viennaMonth(date));
	const w = (label: string) => (winter ? [`winter_${label}`, label] : [label]);
	// Rueckfall nur zur vorsichtigen Seite: am Werktag notfalls der Samstag
	// (weniger Busse), am Wochenende und Feiertag NIE der Werktag - der kennt
	// Busse, die dann nicht fahren. Lieber "Fahrplan fehlt" als ein Phantombus.
	const order =
		weekday === 0 || feiertag
			? [...w('sonntag'), ...w('samstag')]
			: weekday === 6
				? [...w('samstag'), ...w('sonntag')]
				: ['werktag', ...w('samstag')];

	for (const label of order) {
		const day = snapshot.days[label];
		if (day) return { label, day, feiertag };
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
