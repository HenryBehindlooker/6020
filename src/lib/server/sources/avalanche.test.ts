import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCaaml, parseElevation } from './avalanche';
import { rateTour } from '$lib/logic/rating';
import type { Tour, WeatherForecast } from '$lib/types';

/**
 * Echte Tiroler Lawinenberichte der Saison 2025/26 von avalanche.report.
 * Die Erwartungswerte sind unabhaengig in Python aus den Rohdaten nachgerechnet.
 */
const echt = (tag: string) => JSON.parse(readFileSync(`src/fixtures/lawine/${tag}.json`, 'utf8'));

describe('parseCaaml mit echten Berichten', () => {
	it.each([
		['2025-12-27', 1, 1, null, 5],
		['2026-01-17', 3, 1, 2000, 7],
		// Hier liegt eine Grenze auf der Waldgrenze: vorsichtig als 1800 m gelesen (Python mit 2000 m: sonst gleich)
		['2026-02-14', 3, 1, 1800, 5],
		['2026-03-21', 2, 1, 2200, 6]
	])('%s: oben %i, unten %i, Grenze %s, %i Regionen', (tag, oben, unten, grenze, regionen) => {
		const b = parseCaaml(echt(tag));
		expect(b.rating.above).toBe(oben);
		expect(b.rating.below).toBe(unten);
		expect(b.rating.elevationBoundary).toBe(grenze);
		expect(b.regionName).toContain(`${regionen} Regionen`);
	});

	it('liest Altschnee unter seinem echten Namen (Plural)', () => {
		const typen = parseCaaml(echt('2026-01-17')).problems.map((p) => p.type);
		expect(typen).toContain('persistent_weak_layers');
	});

	it('uebernimmt nur Tiroler Bulletins', () => {
		const doc = echt('2026-02-14');
		const fremd = { ...doc, bulletins: [{ ...doc.bulletins[0], regions: [{ regionID: 'AT-02-01' }] }] };
		expect(() => parseCaaml(fremd)).toThrow(/Kein Tiroler Bulletin/);
	});
});

function bulletin(dangerRatings: unknown[], avalancheProblems: unknown[] = []) {
	return { bulletins: [{ regions: [{ regionID: 'AT-07-14-01' }], dangerRatings, avalancheProblems }] };
}

describe('parseCaaml - Sonderfaelle', () => {
	it('nimmt im Fruehjahr die hoehere Stufe von Vormittag und Nachmittag', () => {
		const b = parseCaaml(
			bulletin([
				{ mainValue: 'moderate', validTimePeriod: 'earlier', elevation: { lowerBound: '2000' } },
				{ mainValue: 'low', validTimePeriod: 'earlier', elevation: { upperBound: '2000' } },
				{ mainValue: 'considerable', validTimePeriod: 'later', elevation: { lowerBound: '2000' } },
				{ mainValue: 'moderate', validTimePeriod: 'later', elevation: { upperBound: '2000' } }
			])
		);
		expect(b.rating.above).toBe(3);
		expect(b.rating.below).toBe(2);
	});

	it('bricht bei einer unbekannten Stufe ab, statt gruen zu zeigen', () => {
		expect(() => parseCaaml(bulletin([{ mainValue: 'unbekannt' }]))).toThrow(/Unbekannte Gefahrenstufe/);
	});
});

describe('parseElevation', () => {
	it('legt die Waldgrenze zur sicheren Seite aus', () => {
		expect(parseElevation('treeline', 'lower')).toBe(1800);
		expect(parseElevation('treeline', 'upper')).toBe(2200);
	});

	it('liest Zahlen als Text', () => {
		expect(parseElevation('2400', 'lower')).toBe(2400);
		expect(parseElevation(undefined, 'lower')).toBeNull();
	});
});

describe('Entwarnungen stufen die Ampel nicht hoch', () => {
	const tour: Tour = {
		id: 't', name: 'T', trailhead: '', trailheadStop: '', lat: 47, lon: 11, summitAltitude: 2500,
		trailheadAltitude: 1600, ascentMeters: 900, ascentMinutes: 180, descentMinutes: 70,
		aspects: ['N'], steepnessMax: 25, type: 'skitour', description: ''
	};
	const ruhig: WeatherForecast = {
		referenceAltitude: 1600, windSpeedKmh: 5, windGustsKmh: 10, windDirection: 'S',
		newSnow24hCm: 0, temperatureC: -5, cloudCoverPct: 0, precipProbabilityPct: 0, source: ''
	};

	it.each(['favourable_situation', 'no_distinct_avalanche_problem'])('%s', (typ) => {
		const b = parseCaaml(
			bulletin([{ mainValue: 'low' }], [{ problemType: typ, aspects: ['N'], elevation: { lowerBound: '2000' } }])
		);
		// Vorher: passende Hangrichtung -> gelb, obwohl der Bericht Entwarnung gibt
		expect(rateTour(tour, b, ruhig).signal).toBe('gruen');
	});
});
