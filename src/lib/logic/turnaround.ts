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
		return {
			outbound,
			lastInbound: null,
			turnaroundAt: null,
			summitAt: null,
			slackMinutes: null,
			feasible: false,
			note: 'Keine Rueckfahrt am Ausgangspunkt gefunden - Rueckweg selbst organisieren.'
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
			note: `Keine passende Hinfahrt ab ${options.notBefore.slice(11, 16)} Uhr gefunden.`
		};
	}

	const startAt = outbound.arrival;
	const summitAt = addMinutes(startAt, tour.ascentMinutes);
	const slackMinutes = diffMinutes(turnaroundAt, summitAt);
	const feasible = slackMinutes >= 0;

	const note = feasible
		? `Gipfel rechnerisch um ${hhmm(summitAt)}, Umkehrzeit ${hhmm(turnaroundAt)} - ${slackMinutes} min Reserve.`
		: `Zu knapp: der Gipfel faellt ${Math.abs(slackMinutes)} min hinter die Umkehrzeit ${hhmm(turnaroundAt)}.`;

	return { outbound, lastInbound, turnaroundAt, summitAt, slackMinutes, feasible, note };
}

export function hhmm(iso: string): string {
	return new Date(iso).toLocaleTimeString('de-AT', {
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Europe/Vienna'
	});
}
