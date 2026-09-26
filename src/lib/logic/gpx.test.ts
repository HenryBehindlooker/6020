import { describe, expect, it } from 'vitest';
import { ascentMeters, distanceKm, lengthKm, parseGpx, simplify, type TrackPoint } from './gpx';

const GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test">
	<trk>
		<name>Testtour</name>
		<desc>Aufzeichnung vom 15.01.2026</desc>
		<trkseg>
			<trkpt lat="47.1233" lon="11.0731"><ele>1690</ele></trkpt>
			<trkpt lat="47.1250" lon="11.0750"><ele>1850</ele></trkpt>
			<trkpt lat="47.1270" lon="11.0770"><ele>2100</ele></trkpt>
		</trkseg>
	</trk>
</gpx>`;

describe('parseGpx', () => {
	it('liest Punkte mit Hoehe', () => {
		const track = parseGpx(GPX);
		expect(track.points).toHaveLength(3);
		expect(track.points[0]).toEqual({ lat: 47.1233, lon: 11.0731, ele: 1690 });
	});

	it('liest den Namen', () => {
		expect(parseGpx(GPX).name).toBe('Testtour');
	});

	it('erkennt schematische Verlaeufe an der Beschreibung', () => {
		expect(parseGpx(GPX).schematic).toBe(false);
		const schematisch = GPX.replace('Aufzeichnung vom 15.01.2026', 'Schematischer Verlauf');
		expect(parseGpx(schematisch).schematic).toBe(true);
	});

	it('kommt mit fehlenden Hoehenangaben zurecht', () => {
		const ohneHoehe = '<gpx><trk><trkseg><trkpt lat="47.1" lon="11.1"></trkpt></trkseg></trk></gpx>';
		expect(parseGpx(ohneHoehe).points[0].ele).toBeNull();
	});

	it('liest selbstschliessende Punkte', () => {
		const kurz = '<gpx><trk><trkseg><trkpt lat="47.1" lon="11.1"/><trkpt lat="47.2" lon="11.2"/></trkseg></trk></gpx>';
		expect(parseGpx(kurz).points).toHaveLength(2);
	});

	it('liest auch Routen statt Tracks', () => {
		const route = '<gpx><rte><rtept lat="47.1" lon="11.1"><ele>1000</ele></rtept></rte></gpx>';
		expect(parseGpx(route).points).toHaveLength(1);
	});

	it('ignoriert Punkte ohne gueltige Koordinaten', () => {
		const kaputt = '<gpx><trk><trkseg><trkpt lat="x" lon="11.1"/><trkpt lat="47.2" lon="11.2"/></trkseg></trk></gpx>';
		expect(parseGpx(kaputt).points).toHaveLength(1);
	});

	it('liefert eine leere Liste bei einer Datei ohne Punkte', () => {
		expect(parseGpx('<gpx></gpx>').points).toEqual([]);
	});
});

describe('distanceKm', () => {
	it('rechnet eine bekannte Distanz', () => {
		// Innsbruck Hbf -> Hungerburg, rund 2.4 km Luftlinie.
		const distance = distanceKm(
			{ lat: 47.2632, lon: 11.4009, ele: null },
			{ lat: 47.3125, lon: 11.3836, ele: null }
		);
		expect(distance).toBeGreaterThan(5.0);
		expect(distance).toBeLessThan(6.0);
	});

	it('liefert null fuer denselben Punkt', () => {
		const p = { lat: 47.1, lon: 11.1, ele: null };
		expect(distanceKm(p, p)).toBe(0);
	});
});

describe('lengthKm', () => {
	it('summiert die Teilstrecken', () => {
		expect(lengthKm(parseGpx(GPX).points)).toBeCloseTo(0.5, 1);
	});

	it('liefert null fuer einen einzelnen Punkt', () => {
		expect(lengthKm([{ lat: 47.1, lon: 11.1, ele: null }])).toBe(0);
	});
});

describe('ascentMeters', () => {
	it('summiert nur die Anstiege', () => {
		expect(ascentMeters(parseGpx(GPX).points)).toBe(410);
	});

	it('ignoriert Gegenanstiege nicht, Abstiege aber schon', () => {
		const auf_ab: TrackPoint[] = [
			{ lat: 47.1, lon: 11.1, ele: 1000 },
			{ lat: 47.2, lon: 11.2, ele: 1200 },
			{ lat: 47.3, lon: 11.3, ele: 1100 },
			{ lat: 47.4, lon: 11.4, ele: 1300 }
		];
		expect(ascentMeters(auf_ab)).toBe(400);
	});

	it('ueberspringt Punkte ohne Hoehe', () => {
		const luecke: TrackPoint[] = [
			{ lat: 47.1, lon: 11.1, ele: 1000 },
			{ lat: 47.2, lon: 11.2, ele: null },
			{ lat: 47.3, lon: 11.3, ele: 1500 }
		];
		expect(ascentMeters(luecke)).toBe(0);
	});
});

describe('simplify', () => {
	it('laesst kurze Tracks unveraendert', () => {
		const zwei: TrackPoint[] = [
			{ lat: 47.1, lon: 11.1, ele: null },
			{ lat: 47.2, lon: 11.2, ele: null }
		];
		expect(simplify(zwei)).toHaveLength(2);
	});

	it('entfernt Punkte auf einer Geraden', () => {
		const gerade: TrackPoint[] = [
			{ lat: 47.1, lon: 11.1, ele: null },
			{ lat: 47.15, lon: 11.15, ele: null },
			{ lat: 47.2, lon: 11.2, ele: null }
		];
		expect(simplify(gerade, 25)).toHaveLength(2);
	});

	it('behaelt Punkte, die deutlich abweichen', () => {
		const knick: TrackPoint[] = [
			{ lat: 47.1, lon: 11.1, ele: null },
			{ lat: 47.15, lon: 11.3, ele: null },
			{ lat: 47.2, lon: 11.1, ele: null }
		];
		expect(simplify(knick, 25)).toHaveLength(3);
	});

	it('behaelt immer Anfang und Ende', () => {
		const viele: TrackPoint[] = Array.from({ length: 50 }, (_, i) => ({
			lat: 47.1 + i * 0.001,
			lon: 11.1 + i * 0.001,
			ele: null
		}));
		const vereinfacht = simplify(viele, 50);
		expect(vereinfacht[0]).toEqual(viele[0]);
		expect(vereinfacht.at(-1)).toEqual(viele.at(-1));
		expect(vereinfacht.length).toBeLessThan(viele.length);
	});

	it('duennt bei groesserer Toleranz staerker aus', () => {
		const zickzack: TrackPoint[] = Array.from({ length: 40 }, (_, i) => ({
			lat: 47.1 + i * 0.002,
			lon: 11.1 + (i % 2) * 0.0015,
			ele: null
		}));
		expect(simplify(zickzack, 200).length).toBeLessThanOrEqual(simplify(zickzack, 20).length);
	});
});
