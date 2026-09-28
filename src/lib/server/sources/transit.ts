import { readFile } from 'node:fs/promises';
import type { Departure, TransitConnection } from '$lib/types';
import timetable from '$fixtures/timetable.json' with { type: 'json' };
import { pickSnapshotDay, toDeparture as snapshotDeparture, type Snapshot } from '$lib/logic/snapshot';
import { TIME_ZONE, viennaTime, viennaWeekday } from '$lib/logic/time';
import { cached } from '$lib/server/cache';
import { config } from '$lib/server/config';

interface StopSchedule {
	line: string;
	headsign: string;
	travelMinutes: number;
	outbound: string[];
	inbound: string[];
}

const SCHEDULES = timetable.stops as unknown as Record<string, StopSchedule>;

/**
 * Hin- und Rueckfahrten zwischen Innsbruck und dem Ausgangspunkt einer Tour.
 *
 * Der Demo-Modus erzeugt die Zeiten aus dem mitgelieferten Fahrplanauszug.
 * Im Live-Modus werden dieselben Fahrten mit GTFS-RT-Verspaetungen angereichert.
 */
/** Von scripts/fetch/transitous.py auf dem GitHub-Runner geschrieben. */
const SNAPSHOT_PATH = 'data/transit/connections.json';

async function loadSnapshot(): Promise<Snapshot | null> {
	return cached('transit:snapshot', config.cacheTtlMs, async () => {
		try {
			return JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8')) as Snapshot;
		} catch {
			return null;
		}
	});
}

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/**
 * Echte Verbindungen aus dem Transitous-Abzug, falls vorhanden.
 *
 * Kennt der Abzug die Haltestelle, aber an dem Tag keine Fahrt, kommt eine
 * LEERE Verbindung zurueck - keine Demo-Zeiten als Ersatz. Ist die Abfrage fuer
 * den Halt dagegen fehlgeschlagen, heisst leer nur "unbekannt", nicht "kein Bus".
 */
async function fromSnapshot(stop: string, date: Date): Promise<TransitConnection | null> {
	const snapshot = await loadSnapshot();
	if (!snapshot) return null;
	const picked = pickSnapshotDay(snapshot, date);
	if (!picked) return null;
	const entry = picked.day.trailheads[stop];
	if (!entry) return null;

	const tag = new Date(picked.day.date + 'T12:00:00Z');
	const stand = `${WOCHENTAG[viennaWeekday(tag)]} ${tag.toLocaleDateString('de-AT', { timeZone: TIME_ZONE })}`;
	const convert = (direction: 'outbound' | 'inbound') =>
		entry[direction]
			.map((it) => snapshotDeparture(it, date, direction))
			.filter((d): d is Departure => d !== null);

	const outbound = convert('outbound');
	const inbound = convert('inbound');
	const failed = (entry.errors?.length ?? 0) > 0;
	const empty = outbound.length === 0 && inbound.length === 0;

	return {
		kind: failed && empty ? 'unvollstaendig' : 'echt',
		originStop: snapshot.destination,
		destinationStop: stop,
		outbound,
		inbound,
		source: failed && empty
			? `Fahrplanabfrage für diesen Halt fehlgeschlagen (${stand}) - bitte in der VVT-App nachschauen`
			: empty
				? `Transitous: keine Verbindung am ${stand} gefunden`
				: `Transitous, Fahrplan vom ${stand}, auf heute übertragen`
	};
}

/**
 * Verbindungen zwischen Innsbruck und dem Ausgangspunkt einer Tour.
 *
 * 1. Echter Abzug vorhanden: der gilt - im Live-Modus mit Echtzeit, falls
 *    eingerichtet.
 * 2. Kein Abzug, Demo-Modus: der erfundene Beispielfahrplan, als Demo markiert.
 * 3. Kein Abzug, Live-Modus: nichts. Demo-Zeiten als echten Fahrplan
 *    auszugeben waere gefaehrlich - die Umkehrzeit haenge an einem Bus, den es
 *    nicht gibt.
 */
export async function getConnection(stop: string, date: Date): Promise<TransitConnection> {
	const real = await fromSnapshot(stop, date);
	if (real) {
		if (config.mode !== 'live' || !config.vvtRealtimeUrl || real.kind !== 'echt') return real;
		return cached(`transit:${stop}:${dayKey(date)}`, config.cacheTtlMs, async () => {
			try {
				return applyDelays(real, await fetchRealtimeDelays(stop));
			} catch (err) {
				console.error('[transit] Echtzeitdaten nicht verfuegbar, nutze Soll-Fahrplan:', err);
				return real;
			}
		});
	}

	const schedule = SCHEDULES[stop];
	if (config.mode === 'live' || !schedule) {
		return {
			kind: 'fehlt',
			originStop: timetable.origin,
			destinationStop: stop,
			outbound: [],
			inbound: [],
			source: 'Für diesen Halt liegt kein Fahrplan vor'
		};
	}

	return {
		kind: 'demo',
		originStop: timetable.origin,
		destinationStop: stop,
		outbound: schedule.outbound.map((t) => toDeparture(schedule, t, date, schedule.travelMinutes)),
		inbound: schedule.inbound.map((t) => toDeparture(schedule, t, date, schedule.travelMinutes)),
		source: 'Demo-Fahrplan - keine gültige Fahrplanauskunft'
	};
}

function toDeparture(
	schedule: StopSchedule,
	hhmm: string,
	date: Date,
	travelMinutes: number
): Departure {
	const departure = atLocalTime(date, hhmm);
	return {
		line: schedule.line,
		headsign: schedule.headsign,
		departure: departure.toISOString(),
		arrival: new Date(departure.getTime() + travelMinutes * 60_000).toISOString(),
		delayMinutes: null
	};
}

/** Setzt "HH:MM" auf das gegebene Datum in Innsbrucker Ortszeit. */
export function atLocalTime(date: Date, hhmm: string): Date {
	return viennaTime(date, hhmm);
}

/** Kalendertag in Innsbruck - nicht der UTC-Tag, sonst teilen sich kurz vor
 * Mitternacht zwei Tage einen Cache-Eintrag. */
function dayKey(date: Date): string {
	return date.toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
}

/** Verspaetungen je Liniennummer aus dem GTFS-RT-Feed des VVT. */
async function fetchRealtimeDelays(stop: string): Promise<Record<string, number>> {
	const url = new URL(config.vvtRealtimeUrl);
	url.searchParams.set('stop', stop);

	const res = await fetch(url, {
		headers: config.vvtApiKey ? { Authorization: `Bearer ${config.vvtApiKey}` } : {},
		signal: AbortSignal.timeout(8_000)
	});
	if (!res.ok) throw new Error(`GTFS-RT antwortete mit ${res.status}`);

	const feed = (await res.json()) as { entity?: any[] };
	const delays: Record<string, number> = {};
	for (const entity of feed.entity ?? []) {
		const line = entity?.trip_update?.trip?.route_id;
		const delaySec = entity?.trip_update?.stop_time_update?.[0]?.departure?.delay;
		if (line && typeof delaySec === 'number') delays[line] = Math.round(delaySec / 60);
	}
	return delays;
}

export function applyDelays(
	connection: TransitConnection,
	delays: Record<string, number>
): TransitConnection {
	const decorate = (d: Departure): Departure => ({ ...d, delayMinutes: delays[d.line] ?? null });
	return {
		...connection,
		outbound: connection.outbound.map(decorate),
		inbound: connection.inbound.map(decorate)
	};
}
