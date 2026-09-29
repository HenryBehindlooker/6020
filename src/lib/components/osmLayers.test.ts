import { describe, expect, it } from 'vitest';
import { aerialwayPopup, escapeHtml, hutPopup, poiPopup, routePopup, safeUrl } from './osmLayers';

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
		const html = hutPopup({ name: 'Alm', opening_hours: 'Mo-Su 10:00-18:00', 'payment:cash': 'only' }, new Date('2026-07-15T10:00:00Z'));
		expect(html).toContain('Heute offen laut OSM: 10:00–18:00');
		expect(html).toContain('Nur Bargeld');
	});
});
