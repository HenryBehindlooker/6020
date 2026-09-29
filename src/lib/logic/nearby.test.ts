import { describe, expect, it } from 'vitest';
import { nearby, toPointFeature, type PointFeature } from './nearby';

const huette = (name: string, lat: number, lon: number): PointFeature => ({
	name, lat, lon, ele: null, kind: 'einkehr', openingHours: null, website: null, osm: null,
	payment: { kind: 'unbekannt', text: '' }, phone: null, seasonal: null, checkDate: null
});

describe('nearby', () => {
	const punkte = [
		huette('weit weg', 47.5, 11.9),
		huette('nah', 47.201, 11.301),
		huette('mittel', 47.215, 11.3)
	];

	it('liefert nur Punkte im Umkreis', () => {
		expect(nearby(punkte, 47.2, 11.3).map((p) => p.name)).toEqual(['nah', 'mittel']);
	});

	it('sortiert nach Entfernung und rundet auf 100 m', () => {
		const [erster, zweiter] = nearby(punkte, 47.2, 11.3);
		expect(erster.km).toBeLessThan(zweiter.km);
		expect(zweiter.km).toBeCloseTo(1.7, 1);
	});

	it('begrenzt die Anzahl', () => {
		const viele = Array.from({ length: 10 }, (_, i) => huette(`h${i}`, 47.2 + i * 0.001, 11.3));
		expect(nearby(viele, 47.2, 11.3, 5, 3)).toHaveLength(3);
	});
});

describe('toPointFeature', () => {
	it('uebersetzt eine Schutzhuette', () => {
		const p = toPointFeature({
			geometry: { type: 'Point', coordinates: [11.45, 47.33] },
			properties: { name: 'Pfeishuette', tourism: 'alpine_hut', ele: '1922', osm: 'way/1' }
		});
		expect(p).toMatchObject({ name: 'Pfeishuette', kind: 'schutzhuette', ele: 1922, lat: 47.33, lon: 11.45 });
	});

	it('liest Hoehen mit Komma und Einheit', () => {
		const p = toPointFeature({ geometry: { type: 'Point', coordinates: [11, 47] }, properties: { name: 'A', ele: '1067,5 m' } });
		expect(p?.ele).toBe(1068);
	});

	it('verwirft Punkte ohne Namen oder Geometrie', () => {
		expect(toPointFeature({ geometry: { type: 'Point', coordinates: [11, 47] }, properties: {} })).toBeNull();
		expect(toPointFeature({ properties: { name: 'A' } })).toBeNull();
	});
});
