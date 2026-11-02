import { describe, expect, it } from 'vitest';
import { degreesToAspect, signedCm, stationsForTour } from './stations';
import type { Tour } from '#lib/types.js';

// Echte Werte vom 2.11.2026, 16:00 (data/probe/tiefe.json)
const station = (name: string, lon: number, lat: number, ele: number, p: Record<string, number>) => ({
	type: 'Feature',
	geometry: { type: 'Point', coordinates: [lon, lat] },
	properties: { name, ele, date: '2026-11-02T16:00:00+01:00', ...p }
});

const lampsenspitze: Tour = {
	id: 'lampsenspitze',
	name: 'Lampsenspitze',
	trailhead: 'Praxmar',
	trailheadStop: 'Praxmar Wendestelle',
	lat: 47.1556,
	lon: 11.1311,
	summitAltitude: 2875,
	trailheadAltitude: 1690,
	ascentMeters: 1185,
	ascentMinutes: 215,
	descentMinutes: 90,
	aspects: ['NE'],
	steepnessMax: 34,
	type: 'skitour',
	description: '',
	summit: { name: 'Lampsenspitze', lat: 47.1466, lon: 11.1466, ele: 2875, osm: null }
};

const stationen = [
	station('Lampsenspitze Windstation', 11.1466, 47.1466, 2870, { WG: 8.022, WG_BOE: 14.652, WR: 52.2, LT: -4.9 }),
	station('Lampsenspitze Schneestation', 11.13, 47.16, 2111, { HS: 9.9, HSD24: -0.591, LT: -3.8 }),
	station('Zwölferkogel', 11.06, 47.17, 2988, { WG: 0, WG_BOE: 0, LT: -5.9 }),
	station('Hafelekar', 11.38, 47.31, 2270, { WG: 6.6, WG_BOE: 28.6, LT: -1.7 }),
	station('Sehr hoch', 11.147, 47.147, 3400, { WG: 50 })
];

describe('stationsForTour', () => {
	const r = stationsForTour(stationen, lampsenspitze);

	it('nimmt die Wind- und die Schneestation in der Naehe, nicht die weit entfernte', () => {
		expect(r.map((s) => s.name)).toContain('Lampsenspitze Windstation');
		expect(r.map((s) => s.name)).toContain('Lampsenspitze Schneestation');
		expect(r.map((s) => s.name)).not.toContain('Hafelekar');
	});

	it('laesst Stationen weit ueber dem Gipfel weg', () => {
		expect(r.map((s) => s.name)).not.toContain('Sehr hoch');
	});

	it('liest die Werte', () => {
		const wind = r.find((s) => s.name === 'Lampsenspitze Windstation')!;
		expect(wind.km).toBe(0);
		expect(wind.gustKmh).toBeCloseTo(14.652);
		expect(wind.windFrom).toBe('NE');
		const schnee = r.find((s) => s.name === 'Lampsenspitze Schneestation')!;
		expect(schnee.snowCm).toBe(9.9);
		expect(schnee.windKmh).toBeNull();
	});
});

describe('Anzeige', () => {
	it('Schneehoehenaenderung mit Vorzeichen', () => {
		expect(signedCm(12.4)).toBe('+12 cm');
		expect(signedCm(-0.591)).toBe('−1 cm');
		expect(signedCm(0.2)).toBe('±0 cm');
		expect(signedCm(null)).toBeNull();
	});

	it('Windrichtung aus Grad', () => {
		expect(degreesToAspect(52)).toBe('NE');
		expect(degreesToAspect(359)).toBe('N');
		expect(degreesToAspect(270)).toBe('W');
		expect(degreesToAspect(null)).toBeNull();
	});
});
