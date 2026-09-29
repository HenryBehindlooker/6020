import { describe, expect, it } from 'vitest';
import { buildKml, googleEarthUrl } from './kml';

describe('buildKml', () => {
	it('escaped Namen aus OSM und zeichnet ohne Aufzeichnung keine Linie', () => {
		const kml = buildKml({
			name: 'Test',
			description: 'd',
			points: [{ name: 'Alm <script>&', lat: 47.2, lon: 11.3, style: 'huette' }]
		});
		expect(kml).toContain('Alm &lt;script&gt;&amp;');
		expect(kml).toContain('<coordinates>11.3,47.2,0</coordinates>');
		expect(kml).not.toContain('LineString');
	});
	it('Verlauf als lon,lat', () => {
		const kml = buildKml({ name: 'T', description: '', points: [], track: [[47.1, 11.1], [47.2, 11.2]] });
		expect(kml).toContain('11.1,47.1,0 11.2,47.2,0');
	});
});

describe('googleEarthUrl', () => {
	it('baut den Blick auf den Punkt', () => {
		expect(googleEarthUrl(47.19207, 11.32472, 2404)).toBe('https://earth.google.com/web/@47.19207,11.32472,2404a,4500d,35y,0h,60t,0r');
	});
});
