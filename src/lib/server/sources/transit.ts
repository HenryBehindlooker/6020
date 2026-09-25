import type { Departure, TransitConnection } from '$lib/types';
import timetable from '$fixtures/timetable.json' with { type: 'json' };
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
export async function getConnection(stop: string, date: Date): Promise<TransitConnection> {
	const schedule = SCHEDULES[stop];
	if (!schedule) {
		return {
			originStop: timetable.origin,
			destinationStop: stop,
			outbound: [],
			inbound: [],
			source: 'Kein Fahrplan fuer diesen Halt hinterlegt'
		};
	}

	const connection: TransitConnection = {
		originStop: timetable.origin,
		destinationStop: stop,
		outbound: schedule.outbound.map((t) => toDeparture(schedule, t, date, schedule.travelMinutes)),
		inbound: schedule.inbound.map((t) => toDeparture(schedule, t, date, schedule.travelMinutes)),
		source:
			config.mode === 'live'
				? 'VVT / OGD Tirol (GTFS + GTFS-RT)'
				: 'Demo-Fahrplan - keine gueltige Fahrplanauskunft'
	};

	if (config.mode !== 'live' || !config.vvtRealtimeUrl) return connection;

	return cached(`transit:${stop}:${dayKey(date)}`, config.cacheTtlMs, async () => {
		try {
			const delays = await fetchRealtimeDelays(stop);
			return applyDelays(connection, delays);
		} catch (err) {
			console.error('[transit] Echtzeitdaten nicht verfuegbar, nutze Soll-Fahrplan:', err);
			return connection;
		}
	});
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

/** Setzt "HH:MM" auf das gegebene Datum in oesterreichischer Ortszeit. */
export function atLocalTime(date: Date, hhmm: string): Date {
	const [hours, minutes] = hhmm.split(':').map(Number);
	const local = new Date(date);
	local.setHours(hours, minutes, 0, 0);
	return local;
}

function dayKey(date: Date): string {
	return date.toISOString().slice(0, 10);
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
