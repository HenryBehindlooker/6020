import { describe, expect, it } from 'vitest';
import type { Departure, Tour, TransitConnection } from '$lib/types';
import { formatReserve, pickLastInbound, pickOutbound, planTurnaround, realDeparture } from './turnaround';

const tour: Tour = {
	id: 'test',
	name: 'Testgipfel',
	trailhead: 'Praxmar',
	trailheadStop: 'Praxmar',
	lat: 47.12,
	lon: 11.07,
	summitAltitude: 3004,
	trailheadAltitude: 1690,
	ascentMeters: 1320,
	ascentMinutes: 240,
	descentMinutes: 95,
	aspects: ['N'],
	steepnessMax: 35,
	type: 'skitour',
	description: ''
};

function dep(departure: string, travelMinutes = 60, delayMinutes: number | null = null): Departure {
	return {
		line: '4166',
		headsign: 'Praxmar',
		departure,
		arrival: new Date(new Date(departure).getTime() + travelMinutes * 60_000).toISOString(),
		delayMinutes
	};
}

const connection: TransitConnection = {
	kind: 'echt',
	originStop: 'Innsbruck Hauptbahnhof',
	destinationStop: 'Praxmar',
	outbound: [dep('2026-01-15T05:45:00Z'), dep('2026-01-15T07:45:00Z')],
	inbound: [dep('2026-01-15T13:20:00Z'), dep('2026-01-15T16:35:00Z')],
	source: 'test'
};

describe('realDeparture', () => {
	it('rechnet die Verspaetung ein', () => {
		expect(realDeparture(dep('2026-01-15T05:45:00Z', 60, 7))).toBe('2026-01-15T05:52:00.000Z');
	});

	it('laesst die Sollzeit ohne Echtzeitdaten unveraendert', () => {
		expect(realDeparture(dep('2026-01-15T05:45:00Z'))).toBe('2026-01-15T05:45:00.000Z');
	});
});

describe('pickOutbound', () => {
	it('nimmt die erste Fahrt ab dem gewuenschten Zeitpunkt', () => {
		expect(pickOutbound(connection, '2026-01-15T05:00:00Z')?.departure).toBe('2026-01-15T05:45:00Z');
	});

	it('ueberspringt Fahrten, die schon weg sind', () => {
		expect(pickOutbound(connection, '2026-01-15T06:00:00Z')?.departure).toBe('2026-01-15T07:45:00Z');
	});

	it('liefert null, wenn nichts mehr faehrt', () => {
		expect(pickOutbound(connection, '2026-01-15T20:00:00Z')).toBeNull();
	});
});

describe('pickLastInbound', () => {
	it('nimmt die spaeteste Rueckfahrt', () => {
		expect(pickLastInbound(connection)?.departure).toBe('2026-01-15T16:35:00Z');
	});
});

describe('planTurnaround', () => {
	it('rechnet die Umkehrzeit vom letzten Bus rueckwaerts', () => {
		const plan = planTurnaround(tour, connection, { notBefore: '2026-01-15T05:00:00Z' });
		// Letzter Bus 16:35, minus 30 min Puffer, minus 95 min Abstieg = 14:30.
		expect(plan.turnaroundAt).toBe('2026-01-15T14:30:00.000Z');
	});

	it('erkennt eine machbare Tour und nennt die Reserve', () => {
		const plan = planTurnaround(tour, connection, { notBefore: '2026-01-15T05:00:00Z' });
		// Ankunft 06:45 + 240 min Aufstieg = 10:45, also 225 min Reserve.
		expect(plan.feasible).toBe(true);
		expect(plan.slackMinutes).toBe(225);
	});

	it('erkennt eine zu knappe Tour', () => {
		const plan = planTurnaround(tour, connection, { notBefore: '2026-01-15T07:00:00Z' });
		// Ankunft 08:45 + 240 min = 12:45 - das passt noch.
		expect(plan.slackMinutes).toBe(105);

		const langsam = { ...tour, ascentMinutes: 400 };
		const zuKnapp = planTurnaround(langsam, connection, { notBefore: '2026-01-15T07:00:00Z' });
		expect(zuKnapp.feasible).toBe(false);
		expect(zuKnapp.note).toMatch(/Zu knapp/);
	});

	it('beruecksichtigt die Verspaetung des letzten Busses', () => {
		const verspaetet: TransitConnection = {
			...connection,
			inbound: [dep('2026-01-15T16:35:00Z', 60, 12)]
		};
		const plan = planTurnaround(tour, verspaetet, { notBefore: '2026-01-15T05:00:00Z' });
		expect(plan.turnaroundAt).toBe('2026-01-15T14:42:00.000Z');
	});

	it('respektiert einen groesseren Sicherheitspuffer', () => {
		const plan = planTurnaround(tour, connection, {
			notBefore: '2026-01-15T05:00:00Z',
			bufferMinutes: 60
		});
		expect(plan.turnaroundAt).toBe('2026-01-15T14:00:00.000Z');
	});

	it('warnt, wenn es gar keine Rueckfahrt gibt', () => {
		const ohne: TransitConnection = { ...connection, inbound: [] };
		const plan = planTurnaround(tour, ohne, { notBefore: '2026-01-15T05:00:00Z' });
		expect(plan.feasible).toBe(false);
		expect(plan.note).toMatch(/kein Bus zurück/);
	});

	it('warnt, wenn keine Hinfahrt mehr passt', () => {
		const plan = planTurnaround(tour, connection, { notBefore: '2026-01-15T11:00:00Z' });
		expect(plan.feasible).toBe(false);
		expect(plan.outbound).toBeNull();
		expect(plan.turnaroundAt).not.toBeNull();
	});
});

describe('fehlender oder unbekannter Fahrplan', () => {
	it('sagt bei fehlgeschlagener Abfrage "nicht verfuegbar" statt "kein Bus"', () => {
		const kaputt: TransitConnection = { ...connection, kind: 'unvollstaendig', inbound: [], outbound: [] };
		const plan = planTurnaround(tour, kaputt, { notBefore: '2026-01-15T05:00:00Z' });
		expect(plan.feasible).toBe(false);
		expect(plan.note).toMatch(/nicht verfügbar/);
		expect(plan.note).not.toMatch(/kein Bus/);
	});

	it('nennt die Aufbruchszeit in Innsbrucker Zeit, nicht in UTC', () => {
		// 06:00 UTC ist im Jaenner 07:00 in Innsbruck; vorher stand hier "ab 06:00"
		const plan = planTurnaround(tour, { ...connection, outbound: [] }, { notBefore: '2026-01-15T06:00:00Z' });
		expect(plan.note).toContain('ab 07:00');
	});
});

describe('formatReserve', () => {
	it('schreibt Stunden und Minuten', () => {
		expect(formatReserve(45)).toBe('45 min');
		expect(formatReserve(60)).toBe('1 h');
		expect(formatReserve(506)).toBe('8 h 26 min');
	});
});
