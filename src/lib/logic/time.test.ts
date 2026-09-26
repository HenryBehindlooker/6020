import { afterEach, describe, expect, it } from 'vitest';
import { viennaMonth, viennaTime, viennaWeekday } from './time';

// Node liest TZ zur Laufzeit neu ein. Die Funktionen duerfen davon nicht
// abhaengen - darum laeuft jeder Test unter mehreren Serverzeitzonen.
const ZONEN = ['UTC', 'Europe/Vienna', 'America/New_York', 'Asia/Tokyo'];
const original = process.env.TZ;
afterEach(() => {
	process.env.TZ = original;
});

describe.each(ZONEN)('Serverzeitzone %s', (zone) => {
	it('setzt 20:13 Sommerzeit auf 18:13 UTC', () => {
		process.env.TZ = zone;
		const tag = new Date('2026-10-03T10:00:00Z');
		expect(viennaTime(tag, '20:13').toISOString()).toBe('2026-10-03T18:13:00.000Z');
	});

	it('setzt 14:59 Winterzeit auf 13:59 UTC', () => {
		process.env.TZ = zone;
		const tag = new Date('2026-12-05T10:00:00Z');
		expect(viennaTime(tag, '14:59').toISOString()).toBe('2026-12-05T13:59:00.000Z');
	});

	it('nimmt den Innsbrucker Kalendertag, nicht den des Servers', () => {
		process.env.TZ = zone;
		// 23:30 UTC ist in Innsbruck schon der naechste Tag
		const spaet = new Date('2026-10-03T23:30:00Z');
		expect(viennaTime(spaet, '07:00').toISOString()).toBe('2026-10-04T05:00:00.000Z');
	});

	it('kennt Wochentag und Monat in Innsbruck', () => {
		process.env.TZ = zone;
		const samstagNacht = new Date('2026-10-03T22:30:00Z'); // Innsbruck: So 00:30
		expect(viennaWeekday(samstagNacht)).toBe(0);
		expect(viennaMonth(new Date('2026-11-30T23:30:00Z'))).toBe(12);
	});

	it('uebersteht die Zeitumstellung im Oktober', () => {
		process.env.TZ = zone;
		// 25.10.2026: um 03:00 wird auf 02:00 zurueckgestellt
		const tag = new Date('2026-10-25T12:00:00Z');
		expect(viennaTime(tag, '08:00').toISOString()).toBe('2026-10-25T07:00:00.000Z');
		expect(viennaTime(tag, '01:00').toISOString()).toBe('2026-10-24T23:00:00.000Z');
	});
});
