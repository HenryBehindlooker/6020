import { describe, expect, it } from 'vitest';
import { austrianHoliday, easterSunday } from './holidays';

describe('easterSunday', () => {
	it.each([
		[2024, 3, 31],
		[2025, 4, 20],
		[2026, 4, 5],
		[2027, 3, 28],
		[2038, 4, 25]
	])('Ostern %i', (year, month, day) => {
		expect(easterSunday(year)).toEqual({ month, day });
	});
});

describe('austrianHoliday', () => {
	// Bundesweite Feiertage 2026 laut date.nager.at (data/probe/tiefe.json),
	// ohne die Sonntage Ostern und Pfingsten
	const feiertage2026 = [
		['2026-01-01', 'Neujahr'],
		['2026-01-06', 'Heilige Drei Könige'],
		['2026-04-06', 'Ostermontag'],
		['2026-05-01', 'Staatsfeiertag'],
		['2026-05-14', 'Christi Himmelfahrt'],
		['2026-05-25', 'Pfingstmontag'],
		['2026-06-04', 'Fronleichnam'],
		['2026-08-15', 'Mariä Himmelfahrt'],
		['2026-10-26', 'Nationalfeiertag'],
		['2026-11-01', 'Allerheiligen'],
		['2026-12-08', 'Mariä Empfängnis'],
		['2026-12-25', 'Christtag'],
		['2026-12-26', 'Stefanitag']
	];

	it.each(feiertage2026)('%s ist %s', (tag, name) => {
		expect(austrianHoliday(new Date(`${tag}T10:00:00Z`))).toBe(name);
	});

	it('kein Feiertag an gewoehnlichen Tagen und am Tiroler Josefstag', () => {
		expect(austrianHoliday(new Date('2026-11-02T10:00:00Z'))).toBeNull();
		expect(austrianHoliday(new Date('2026-03-19T10:00:00Z'))).toBeNull();
	});

	it('nimmt den Wiener Kalendertag', () => {
		// 23:30 UTC am 7.12. ist in Wien schon der 8.12.
		expect(austrianHoliday(new Date('2026-12-07T23:30:00Z'))).toBe('Mariä Empfängnis');
	});
});
