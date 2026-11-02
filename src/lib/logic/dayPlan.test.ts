import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bulletinFor, computeDayPlan, planningDate, type PlanInputs } from './dayPlan';
import { parseCaaml } from '$lib/server/sources/avalanche';
import type { Tour } from '$lib/types';

// Echter Bericht: gilt vom 16.1.2026 16:00 bis 17.1. 16:00 UTC
const echt17 = parseCaaml(JSON.parse(readFileSync('src/fixtures/lawine/2026-01-17.json', 'utf8')));

const tour: Tour = {
	id: 'saile',
	name: 'Nockspitze',
	trailhead: 'Axamer Lizum',
	trailheadStop: 'Axams Axamer Lizum',
	lat: 47.19,
	lon: 11.3,
	summitAltitude: 2404,
	trailheadAltitude: 1580,
	ascentMeters: 824,
	ascentMinutes: 150,
	descentMinutes: 70,
	aspects: ['N', 'NE'],
	steepnessMax: 30,
	type: 'skitour',
	description: ''
};

function inputs(over: Partial<PlanInputs> = {}): PlanInputs {
	return {
		builtAt: '2026-01-16T08:00:00Z',
		mode: 'demo',
		tours: [tour],
		bulletins: [],
		lastBulletinDate: null,
		transit: null,
		demoTimetable: null,
		weather: null,
		...over
	};
}

describe('bulletinFor', () => {
	it('nimmt den echten Bericht, der zum Zeitpunkt gilt', () => {
		const r = bulletinFor(inputs({ bulletins: [echt17], lastBulletinDate: '2026-01-17' }), new Date('2026-01-17T08:00:00Z'));
		expect(r.bulletin?.kind).toBe('echt');
	});

	it('gilt schon am Vorabend, sobald er erschienen ist', () => {
		const r = bulletinFor(inputs({ bulletins: [echt17], lastBulletinDate: '2026-01-17' }), new Date('2026-01-16T18:00:00Z'));
		expect(r.bulletin?.kind).toBe('echt');
	});

	it('in der Saison: kein Beispielbericht, wenn der fuer morgen noch fehlt', () => {
		// Morgen frueh am 18.1. - der Bericht dafuer erscheint erst am 17.1. um 17 Uhr
		const r = bulletinFor(
			inputs({ bulletins: [echt17], lastBulletinDate: '2026-01-17' }),
			new Date('2026-01-18T08:00:00Z')
		);
		expect(r.bulletin).toBeNull();
		expect(r.grund).toBe('noch-nicht');
	});

	it('in der Saison auch im Demo-Modus nie erfundene Daten', () => {
		const r = bulletinFor(inputs({ bulletins: [], lastBulletinDate: '2026-01-16', mode: 'demo' }), new Date('2026-01-17T08:00:00Z'));
		expect(r.bulletin).toBeNull();
	});

	it('Saisonpause im Demo-Modus: gekennzeichneter Beispielbericht', () => {
		const r = bulletinFor(inputs({ lastBulletinDate: '2026-05-02' }), new Date('2026-11-02T08:00:00Z'));
		expect(r.bulletin?.kind).toBe('demo');
		expect(r.grund).toBe('saisonpause');
	});

	it('Saisonpause im Live-Modus: nichts', () => {
		const r = bulletinFor(inputs({ lastBulletinDate: '2026-05-02', mode: 'live' }), new Date('2026-11-02T08:00:00Z'));
		expect(r.bulletin).toBeNull();
		expect(r.grund).toBe('saisonpause');
	});
});

describe('computeDayPlan', () => {
	it('kein Beispielwetter neben einem echten Bericht - dann lieber strenger bewerten', () => {
		const plan = computeDayPlan(inputs({ bulletins: [echt17], lastBulletinDate: '2026-01-17' }), {
			date: new Date('2026-01-17T08:00:00Z')
		});
		expect(plan.tours[0].weather).toBeNull();
		expect(plan.tours[0].rating.reasons.some((r) => r.factor === 'Bergwetter')).toBe(true);
		expect(plan.status.lawine).toBe('echt');
		expect(plan.status.wetter).toBe('fehlt');
	});

	it('zum Beispielbericht gehoert Beispielwetter, gekennzeichnet', () => {
		const plan = computeDayPlan(inputs({ lastBulletinDate: '2026-05-02' }), { date: new Date('2026-11-02T08:00:00Z') });
		expect(plan.status.lawine).toBe('demo');
		expect(plan.status.lawineGrund).toBe('saisonpause');
		expect(plan.status.wetter).toBe('demo');
	});

	it('ohne Fahrplan: fehlt, nicht "kein Bus"', () => {
		const plan = computeDayPlan(inputs({ mode: 'live' }), { date: new Date('2026-01-17T08:00:00Z') });
		expect(plan.tours[0].transit.kind).toBe('fehlt');
	});
});

describe('planningDate', () => {
	it('heute ist jetzt', () => {
		const now = new Date('2026-11-02T15:00:00Z');
		expect(planningDate('heute', now)).toBe(now);
	});

	it('morgen ist der naechste Wiener Kalendertag um 9 Uhr - auch kurz vor Mitternacht', () => {
		// 23:30 Wiener Zeit am 2.11.
		expect(planningDate('morgen', new Date('2026-11-02T22:30:00Z')).toISOString()).toBe('2026-11-03T08:00:00.000Z');
	});

	it('ueber die Zeitumstellung hinweg', () => {
		// Sa 24.10.2026 abends -> So 25.10., Winterzeit ab 03:00
		expect(planningDate('morgen', new Date('2026-10-24T20:00:00Z')).toISOString()).toBe('2026-10-25T08:00:00.000Z');
	});
});
