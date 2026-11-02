import { describe, expect, it } from 'vitest';
import {
	aerialwayPopup,
	escapeHtml,
	hutPopup,
	poiPopup,
	routePopup,
	safeUrl,
	stationPopup,
	tileBbox3857
} from './osmLayers';

describe('safeUrl', () => {
	it('laesst https durch', () => {
		expect(safeUrl('https://www.pfeishuette.at')).toBe('https://www.pfeishuette.at/');
	});

	it('ergaenzt https bei www.-Adressen', () => {
		expect(safeUrl('www.arzleralm.at')).toBe('https://www.arzleralm.at/');
	});

	it('verwirft javascript:-Links', () => {
		expect(safeUrl('javascript:alert(1)')).toBeNull();
	});

	it('verwirft data:-Links', () => {
		expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
	});

	it('verwirft Unsinn', () => {
		expect(safeUrl('keine url')).toBeNull();
		expect(safeUrl(42)).toBeNull();
	});
});

describe('Popups', () => {
	it('escaped Namen aus OSM', () => {
		const html = hutPopup({ name: '<img src=x onerror=alert(1)>', tourism: 'alpine_hut' });
		expect(html).not.toContain('<img');
		expect(html).toContain('&lt;img');
	});

	it('baut keinen Link aus einer javascript:-Website', () => {
		const html = hutPopup({ name: 'Huette', website: 'javascript:alert(1)' });
		expect(html).not.toContain('javascript:');
	});

	it('verlinkt nur gueltige OSM-Referenzen', () => {
		expect(hutPopup({ name: 'A', osm: 'node/123' })).toContain('openstreetmap.org/node/123');
		expect(hutPopup({ name: 'A', osm: 'node/1"onclick="x' })).not.toContain('openstreetmap.org');
	});

	it('markiert Wanderwege als Sommerwege', () => {
		expect(routePopup({ name: 'Goetheweg' }, 'Wanderweg')).toContain('Sommerweg');
	});

	it('benennt die Huettenart', () => {
		expect(hutPopup({ name: 'Pfeishütte', tourism: 'alpine_hut', ele: '1922' })).toContain('Schutzhütte · 1922 m');
		expect(hutPopup({ name: 'Arzler Alm', amenity: 'restaurant' })).toContain('Einkehr');
	});

	it('warnt, wenn Oeffnungszeiten fehlen', () => {
		expect(hutPopup({ name: 'A' })).toContain('vorher prüfen');
	});

	it('uebersetzt die Seilbahnart', () => {
		expect(aerialwayPopup({ name: 'Seegrubenbahn', aerialway: 'cable_car' })).toContain('Pendelbahn');
		expect(aerialwayPopup({ name: 'Hungerburgbahn', railway: 'funicular' })).toContain('Standseilbahn');
	});

	it('escapeHtml deckt alle Sonderzeichen ab', () => {
		expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
	});
});

describe('poiPopup und hutPopup', () => {
	it('benennt Punkte und warnt bei Wasser im Winter', () => {
		expect(poiPopup({ amenity: 'drinking_water' })).toContain('Trinkwasser');
		expect(poiPopup({ amenity: 'drinking_water' })).toContain('eingeschneit');
		expect(poiPopup({ natural: 'peak', 'summit:cross': 'yes', name: '<b>X</b>' })).toContain('&lt;b&gt;X');
	});
	it('Huette: heute offen und Bargeld', () => {
		// Mittwoch, 15.7.2026, Mittag in Wien
		const html = hutPopup(
			{ name: 'Alm', opening_hours: 'Mo-Su 10:00-18:00', 'payment:cash': 'only' },
			new Date('2026-07-15T10:00:00Z')
		);
		expect(html).toContain('Heute offen laut OSM: 10:00–18:00');
		expect(html).toContain('Nur Bargeld');
	});
});

describe('stationPopup', () => {
	it('zeigt Messwerte, escaped den Namen und warnt bei alten Werten', () => {
		const html = stationPopup(
			{
				name: 'Hafelekar <b>',
				ele: 2270,
				WG: 6.652,
				WG_BOE: 28.584,
				WR: 71.5,
				LT: -1.7,
				HSD72: 12.4,
				date: '2026-11-02T16:00:00+01:00'
			},
			new Date('2026-11-03T08:00:00Z')
		);
		expect(html).toContain('Hafelekar &lt;b&gt;');
		expect(html).toContain('Wind 7 km/h aus E, Böen 29 km/h');
		expect(html).toContain('+12 cm in 72 h');
		expect(html).toContain('älter als 6 Stunden');
	});
});

describe('tileBbox3857', () => {
	it('Zoom 0 ist die ganze Welt', () => {
		expect(tileBbox3857(0, 0, 0)).toEqual([-20037508.3, -20037508.3, 20037508.3, 20037508.3]);
	});
	it('Kachel ueber Innsbruck enthaelt Innsbruck', () => {
		// Innsbruck 11.39 E, 47.27 N: Kachel 8710/5744 bei Zoom 14, in Web-Mercator x 1267929, y 5986257
		const [minX, minY, maxX, maxY] = tileBbox3857(8710, 5744, 14);
		expect(minX).toBeLessThan(1267929);
		expect(maxX).toBeGreaterThan(1267929);
		expect(minY).toBeLessThan(5986257);
		expect(maxY).toBeGreaterThan(5986257);
		// Eine Kachel bei Zoom 14 ist knapp 2,45 km breit
		expect(maxX - minX).toBeCloseTo(2445.98, 1);
	});
});
