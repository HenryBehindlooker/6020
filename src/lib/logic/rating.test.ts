import { describe, expect, it } from 'vitest';
import type { AvalancheBulletin, Tour, WeatherForecast } from '$lib/types';
import { dangerLevelForAltitude, overlappingAspects, rateTour } from './rating';

const tour: Tour = {
	id: 'test',
	name: 'Testgipfel',
	trailhead: 'Talort',
	trailheadStop: 'Talort',
	lat: 47.2,
	lon: 11.2,
	summitAltitude: 2800,
	trailheadAltitude: 1600,
	ascentMeters: 1200,
	ascentMinutes: 200,
	descentMinutes: 80,
	aspects: ['N', 'NE'],
	steepnessMax: 32,
	type: 'skitour',
	description: ''
};

const calmWeather: WeatherForecast = {
	referenceAltitude: 1600,
	windSpeedKmh: 10,
	windGustsKmh: 18,
	windDirection: 'S',
	newSnow24hCm: 0,
	temperatureC: -6,
	cloudCoverPct: 10,
	precipProbabilityPct: 0,
	source: 'test'
};

function bulletin(overrides: Partial<AvalancheBulletin> = {}): AvalancheBulletin {
	return {
		regionId: 'AT-07',
		regionName: 'Tirol',
		publishedAt: '2026-01-15T17:00:00Z',
		validUntil: '2026-01-16T16:00:00Z',
		rating: { above: 2, below: 1, elevationBoundary: 2200, aspects: [] },
		problems: [],
		summary: '',
		source: 'test',
		...overrides
	};
}

describe('dangerLevelForAltitude', () => {
	it('nimmt die Stufe oberhalb der Hoehengrenze', () => {
		expect(dangerLevelForAltitude(bulletin(), 2800)).toBe(2);
	});

	it('nimmt die Stufe unterhalb der Hoehengrenze', () => {
		expect(dangerLevelForAltitude(bulletin(), 1800)).toBe(1);
	});

	it('faellt ohne Hoehengrenze auf die einheitliche Stufe zurueck', () => {
		const b = bulletin({ rating: { above: 3, below: 1, elevationBoundary: null, aspects: [] } });
		expect(dangerLevelForAltitude(b, 900)).toBe(3);
	});
});

describe('overlappingAspects', () => {
	it('findet die gemeinsamen Hangrichtungen', () => {
		expect(overlappingAspects(['N', 'NE', 'E'], ['NE', 'E', 'SE'])).toEqual(['NE', 'E']);
	});

	it('liefert leer, wenn sich nichts ueberschneidet', () => {
		expect(overlappingAspects(['N'], ['S', 'SW'])).toEqual([]);
	});
});

describe('rateTour', () => {
	it('gibt gruen bei niedriger Stufe und ruhigem Wetter', () => {
		expect(rateTour(tour, bulletin(), calmWeather).signal).toBe('gruen');
	});

	it('gibt unbekannt ohne Lagebericht', () => {
		expect(rateTour(tour, null, calmWeather).signal).toBe('unbekannt');
	});

	it('schaltet bei Stufe 3 auf gelb', () => {
		const b = bulletin({ rating: { above: 3, below: 2, elevationBoundary: 2200, aspects: [] } });
		expect(rateTour(tour, b, calmWeather).signal).toBe('gelb');
	});

	it('schaltet bei Stufe 4 auf rot', () => {
		const b = bulletin({ rating: { above: 4, below: 3, elevationBoundary: 2200, aspects: [] } });
		expect(rateTour(tour, b, calmWeather).signal).toBe('rot');
	});

	it('schaltet rot, wenn das Gefahrenmuster die Hangrichtungen der Tour trifft', () => {
		const b = bulletin({
			rating: { above: 3, below: 2, elevationBoundary: 2200, aspects: [] },
			problems: [
				{ type: 'wind_slab', aspects: ['N', 'NE'], elevationAbove: 2200, elevationBelow: null }
			]
		});
		const result = rateTour(tour, b, calmWeather);
		expect(result.signal).toBe('rot');
		expect(result.reasons.some((r) => r.factor === 'Gefahrenmuster')).toBe(true);
	});

	it('ignoriert ein Gefahrenmuster in anderen Hangrichtungen', () => {
		const b = bulletin({
			problems: [{ type: 'wind_slab', aspects: ['S', 'SW'], elevationAbove: 2200, elevationBelow: null }]
		});
		expect(rateTour(tour, b, calmWeather).signal).toBe('gruen');
	});

	it('schaltet bei Sturm auf rot', () => {
		const result = rateTour(tour, bulletin(), { ...calmWeather, windSpeedKmh: 65, windGustsKmh: 95 });
		expect(result.signal).toBe('rot');
	});

	it('wertet viel Neuschnee als kritisch', () => {
		const result = rateTour(tour, bulletin(), { ...calmWeather, newSnow24hCm: 35 });
		expect(result.signal).toBe('rot');
		expect(result.reasons.some((r) => r.factor === 'Neuschnee')).toBe(true);
	});

	it('kombiniert Steilheit mit erheblicher Gefahr', () => {
		const steep: Tour = { ...tour, steepnessMax: 38 };
		const b = bulletin({ rating: { above: 3, below: 2, elevationBoundary: 2200, aspects: [] } });
		const result = rateTour(steep, b, calmWeather);
		expect(result.signal).toBe('rot');
		expect(result.reasons.some((r) => r.factor === 'Steilheit')).toBe(true);
	});

	it('stuft ohne Wetterdaten vorsichtshalber hoch', () => {
		expect(rateTour(tour, bulletin(), null).signal).toBe('gelb');
	});
});
