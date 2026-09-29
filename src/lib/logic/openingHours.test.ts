import { describe, expect, it } from 'vitest';
import { openingOn, viennaDay, type Day } from './openingHours';

// 2026-07-15 ist ein Mittwoch, 2026-01-17 ein Samstag
const mi: Day = { year: 2026, month: 7, day: 15, weekday: 2 };
const sa: Day = { year: 2026, month: 1, day: 17, weekday: 5 };
const so: Day = { year: 2026, month: 7, day: 19, weekday: 6 };

describe('openingOn', () => {
	it('liest einfache Wochentagsbereiche', () => {
		expect(openingOn('Mo-Su 10:00-18:00', mi)).toEqual({ status: 'offen', spans: ['10:00–18:00'] });
		expect(openingOn('Tu-Su 09:00-17:00', { ...mi, weekday: 0 })).toEqual({ status: 'zu' });
	});

	it('Bereiche ueber das Wochenende', () => {
		expect(openingOn('Fr-Tu 10:00-22:00', so).status).toBe('offen');
		expect(openingOn('Fr-Tu 10:00-22:00', mi).status).toBe('zu');
		expect(openingOn('We-Mo 10:00-20:00', { ...mi, weekday: 1 }).status).toBe('zu');
	});

	it('Listen von Tagen und mehreren Regeln', () => {
		expect(openingOn('Mo-We, Sa 10:00-19:00; Su, Fr 10:00-18:00', so)).toEqual({ status: 'offen', spans: ['10:00–18:00'] });
		expect(openingOn('Mo-Su 09:00-18:00; We off', mi)).toEqual({ status: 'zu' });
		expect(openingOn('Mo-Fr 11:30-15:00, 17:30-20:00; Sa-Su 11:30-20:00, PH 11:30-20:00', mi)).toEqual({
			status: 'offen',
			spans: ['11:30–15:00', '17:30–20:00']
		});
	});

	it('offenes Ende und 24:00', () => {
		expect(openingOn('Mo-Su, PH 11:00+', mi)).toEqual({ status: 'offen', spans: ['ab 11:00'] });
		expect(openingOn('Tu-Sa 15:00-24:00; PH off', mi)).toEqual({ status: 'offen', spans: ['15:00–24:00'] });
		expect(openingOn('08:00-24:00', mi).status).toBe('offen');
	});

	it('Monatsbereiche, auch ueber den Jahreswechsel', () => {
		const oh = 'May 1-Oct 31: Mo-Sa 09:00-20:00, Su 09:00-18:00; Nov 01-Apr 30: off';
		expect(openingOn(oh, mi)).toEqual({ status: 'offen', spans: ['09:00–20:00'] });
		expect(openingOn(oh, sa)).toEqual({ status: 'zu' });
		expect(openingOn('Jun-Aug: Sa-Su 14:00-18:00', sa)).toEqual({ status: 'zu' });
		expect(openingOn('Su; PH; Dec-Apr off', { ...sa, weekday: 6 })).toEqual({ status: 'zu' });
		expect(openingOn('Su; PH; Dec-Apr off', so).status).toBe('offen');
	});

	it('Sommer- und Winterzeiten mit eigenen Regeln', () => {
		const oh =
			'May-Oct: Mo, Tu, Th-Sa 09:00-18:00; Su 09:00-18:00; We off; Nov-Apr: Mo-Tu, Th-Su 09:00-17:00; We off';
		expect(openingOn(oh, sa)).toEqual({ status: 'offen', spans: ['09:00–17:00'] });
		expect(openingOn(oh, so)).toEqual({ status: 'offen', spans: ['09:00–18:00'] });
		expect(openingOn(oh, mi)).toEqual({ status: 'zu' });
	});

	it('festes Datum', () => {
		const oh = '2026 Jun 04 - 2026 Sep 20 Mo-Su 09:00-17:00';
		expect(openingOn(oh, mi).status).toBe('offen');
		expect(openingOn(oh, sa)).toEqual({ status: 'zu' });
		expect(openingOn(oh, { ...mi, year: 2027 })).toEqual({ status: 'zu' });
	});

	it('sagt lieber "unklar" als etwas Falsches', () => {
		expect(openingOn('"bei Gelegenheit"', mi).status).toBe('unklar');
		expect(openingOn('Mo-Fr 09:00-19:00, Sa,Su 21:00-18:00', so).status).toBe('unklar');
		expect(openingOn('sunrise-sunset', mi).status).toBe('unklar');
		expect(openingOn('Mo-Fr 10:00-18:00; SH off', mi).status).toBe('unklar');
		expect(openingOn(null, mi).status).toBe('unklar');
	});

	it('off, closed, 24/7 und Tage ohne Uhrzeit', () => {
		expect(openingOn('off', mi)).toEqual({ status: 'zu' });
		expect(openingOn('closed', mi)).toEqual({ status: 'zu' });
		expect(openingOn('24/7', mi).status).toBe('offen');
		expect(openingOn('Sa-Su', so)).toEqual({ status: 'offen', spans: ['ganztags laut OSM'] });
		expect(openingOn('Sa-Su', mi)).toEqual({ status: 'zu' });
	});
});

describe('viennaDay', () => {
	it('nimmt den Wiener Kalendertag, nicht UTC', () => {
		// 23:30 UTC am 18.1. ist in Wien schon Montag, der 19.1.
		expect(viennaDay(new Date('2026-01-18T23:30:00Z'))).toEqual({ year: 2026, month: 1, day: 19, weekday: 0 });
	});
});
