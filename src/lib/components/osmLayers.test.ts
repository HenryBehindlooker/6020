import { describe, expect, it } from 'vitest';
import { aerialwayPopup, escapeHtml, hutPopup, routePopup, safeUrl } from './osmLayers';

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
		expect(hutPopup({ name: 'Pfeishuette', tourism: 'alpine_hut', ele: '1922' })).toContain('Schutzhuette · 1922 m');
		expect(hutPopup({ name: 'Arzler Alm', amenity: 'restaurant' })).toContain('Einkehr');
	});

	it('warnt, wenn Oeffnungszeiten fehlen', () => {
		expect(hutPopup({ name: 'A' })).toContain('vorher pruefen');
	});

	it('uebersetzt die Seilbahnart', () => {
		expect(aerialwayPopup({ name: 'Seegrubenbahn', aerialway: 'cable_car' })).toContain('Pendelbahn');
		expect(aerialwayPopup({ name: 'Hungerburgbahn', railway: 'funicular' })).toContain('Standseilbahn');
	});

	it('escapeHtml deckt alle Sonderzeichen ab', () => {
		expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
	});
});
