import { describe, expect, it } from 'vitest';
import { landmarksAlong, landmarkKind } from './landmarks';

const start = { lat: 47.2, lon: 11.3 };
const gipfel = { lat: 47.22, lon: 11.3 }; // gut 2 km nach Norden
const pt = (lat: number, lon: number, properties: Record<string, unknown>) => ({
	geometry: { type: 'Point', coordinates: [lon, lat] },
	properties
});

describe('landmarksAlong', () => {
	it('nimmt Punkte im Korridor, sortiert vom Start zum Gipfel', () => {
		const res = landmarksAlong(
			[
				pt(47.215, 11.301, { natural: 'saddle', name: 'Joch' }),
				pt(47.205, 11.3, { amenity: 'drinking_water' }),
				pt(47.21, 11.33, { tourism: 'viewpoint', name: 'zu weit seitlich' }),
				pt(47.25, 11.3, { natural: 'spring', name: 'hinter dem Gipfel' }),
				pt(47.21, 11.3, { amenity: 'restaurant', name: 'kein Landmark' })
			],
			start,
			gipfel
		);
		expect(res.map((l) => l.kind)).toEqual(['wasser', 'sattel']);
		expect(res[1].along).toBeCloseTo(0.75, 1);
		expect(res[1].offM).toBeLessThan(100);
	});

	it('erkennt Gipfelkreuze vor dem Gipfel selbst', () => {
		expect(landmarkKind({ natural: 'peak', 'summit:cross': 'yes' })).toBe('gipfelkreuz');
		expect(landmarkKind({ natural: 'peak' })).toBeNull();
	});
});
