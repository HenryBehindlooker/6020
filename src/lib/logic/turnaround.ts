import type { Departure, Tour, TransitConnection } from '$lib/types';

export interface TurnaroundPlan {
	/** Gewaehlte Hinfahrt. */
	outbound: Departure | null;
	/** Letzte Rueckfahrt ab dem Ausgangspunkt. */
	lastInbound: Departure | null;
	/** Spaetester Zeitpunkt, an dem man umkehren muss (ISO). */
	turnaroundAt: string | null;
	/** Rechnerisch erreichbarer Gipfelzeitpunkt (ISO). */
	summitAt: string | null;
	/** Pufferminuten, die nach dem Abstieg uebrig bleiben. Negativ = zu knapp. */
	slackMinutes: number | null;
	feasible: boolean;
	/** Erklaerung im Klartext, warum es sich ausgeht - oder eben nicht. */
	note: string;
}

/** Sicherheitspuffer am Ende: Umziehen, Verspaetung, Fussweg zur Haltestelle. */
export const DEFAULT_BUFFER_MINUTES = 30;

function addMinutes(iso: string, minutes: number): string {
	return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function diffMinutes(laterIso: string, earlierIso: string): number {
	return Math.round((new Date(laterIso).getTime() - new Date(earlierIso).getTime()) / 60_000);
}

/** Echte Abfahrt inklusive Echtzeit-Verspaetung. */
export function realDeparture(dep: Departure): string {
	return addMinutes(dep.departure, dep.delayMinutes ?? 0);
}

/** Frueheste Hinfahrt, die nicht vor dem gewuenschten Startzeitpunkt liegt. */
export function pickOutbound(connection: TransitConnection, notBefore: string): Departure | null {
	const t = new Date(notBefore).getTime();
	const candidates = connection.outbound
		.filter((d) => new Date(realDeparture(d)).getTime() >= t)
		.sort((a, b) => new Date(a.departure).getTime() - new Date(b.departure).getTime());
	return candidates[0] ?? null;
}

/** Spaeteste Rueckfahrt des Tages ab dem Ausgangspunkt. */
export function pickLastInbound(connection: TransitConnection): Departure | null {
	const sorted = [...connection.inbound].sort(
		(a, b) => new Date(a.departure).getTime() - new Date(b.departure).getTime()
	);
	return sorted[sorted.length - 1] ?? null;
}

/**
 * Rechnet vom letzten Bus rueckwaerts: Wann muss ich spaetestens umdrehen,
 * und geht sich der Gipfel ueberhaupt aus?
 */
export function planTurnaround(
	tour: Tour,
	connection: TransitConnection,
	options: { notBefore: string; bufferMinutes?: number } 
): TurnaroundPlan {
	const buffer = options.bufferMinutes ?? DEFAULT_BUFFER_MINUTES;
	const outbound = pickOutbound(connection, options.notBefore);
	const lastInbound = pickLastInbound(connection);

	if (!lastInbound) {
		const unbekannt = connection.kind === 'fehlt' || connection.kind === 'unvollstaendig';
		return {
			outbound,
			lastInbound: null,
			turnaroundAt: null,
			summitAt: null,
			slackMinutes: null,
			feasible: false,
			note: unbekannt
				? 'Fahrplan für diesen Ausgangspunkt nicht verfügbar - Rückfahrt vor der Tour selbst klären.'
				: 'An diesem Tag fährt vom Ausgangspunkt kein Bus zurück - Rückweg selbst organisieren.'
		};
	}

	// Vom letzten Bus rueckwaerts: Puffer abziehen, dann die Abstiegszeit.
	const latestAtTrailhead = addMinutes(realDeparture(lastInbound), -buffer);
	const turnaroundAt = addMinutes(latestAtTrailhead, -tour.descentMinutes);

	if (!outbound) {
		return {
			outbound: null,
			lastInbound,
			turnaroundAt,
			summitAt: null,
			slackMinutes: null,
			feasible: false,
			note: `Keine passende Hinfahrt ab ${hhmm(options.notBefore)} Uhr gefunden.`
		};
	}

	const startAt = outbound.arrival;
	const summitAt = addMinutes(startAt, tour.ascentMinutes);
	const slackMinutes = diffMinutes(turnaroundAt, summitAt);
	const feasible = slackMinutes >= 0;

	let note = feasible
		? `Gipfel rechnerisch um ${hhmm(summitAt)}, Umkehrzeit ${hhmm(turnaroundAt)} - ${formatReserve(slackMinutes)} Reserve.`
		: `Zu knapp: der Gipfel fällt ${formatReserve(Math.abs(slackMinutes))} hinter die Umkehrzeit ${hhmm(turnaroundAt)}.`;

	// Zu knapp mit dem gewaehlten Aufbruch - ginge es mit einem frueheren Bus?
	if (!feasible) {
		const frueher = earliestFeasibleOutbound(tour, connection, turnaroundAt);
		if (frueher && new Date(frueher.departure) < new Date(outbound.departure)) {
			note += ` Mit dem Bus um ${hhmm(realDeparture(frueher))} ginge es sich aus.`;
		}
	}

	return { outbound, lastInbound, turnaroundAt, summitAt, slackMinutes, feasible, note };
}

/** 506 min liest niemand gern - 8 h 26 min schon. */
export function formatReserve(minutes: number): string {
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Die spaeteste Hinfahrt, mit der der Gipfel noch vor der Umkehrzeit erreicht wird. */
export function earliestFeasibleOutbound(
	tour: Tour,
	connection: TransitConnection,
	turnaroundAt: string
): Departure | null {
	const grenze = new Date(turnaroundAt).getTime() - tour.ascentMinutes * 60_000;
	const passend = connection.outbound
		.filter((d) => new Date(d.arrival).getTime() + (d.delayMinutes ?? 0) * 60_000 <= grenze)
		.sort((a, b) => new Date(b.departure).getTime() - new Date(a.departure).getTime());
	return passend[0] ?? null;
}

export function hhmm(iso: string): string {
	return new Date(iso).toLocaleTimeString('de-AT', {
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Europe/Vienna'
	});
}
