import { describe, expect, it } from 'vitest';
import { componentsToAspect, weatherForDay, type WeatherSnapshot } from './weather';

/**
 * Stuendliche Prognose ab Modellstart `start` (UTC), Werte je Stunde aus
 * Funktionen - so wie scripts/fetch/weather.py sie ablegt.
 */
function snapshot(
	start: string,
	hours: number,
	f: Partial<Record<'u10m' | 'v10m' | 'ugust' | 'vgust' | 't2m' | 'tcc' | 'snow_acc', (h: number) => number>>,
	units: Record<string, string> = { t2m: 'degree Celsius', tcc: '1' }
): WeatherSnapshot {
	const t0 = new Date(start).getTime();
	const timestamps = Array.from({ length: hours }, (_, h) => new Date(t0 + h * 3_600_000).toISOString());
	const series: Record<string, number[]> = {};
	for (const [name, fn] of Object.entries(f)) series[name] = Array.from({ length: hours }, (_, h) => fn(h));
	return {
		fetched_at: start,
		source: 'GeoSphere Austria, AROME 1 km (Open Data, CC BY 4.0)',
		timestamps,
		units,
		points: { saile: { lat: 47.19, lon: 11.32, ele: 2404, series } }
	};
}

// 17.1.2026, Winterzeit: 07:00-16:00 Wiener Zeit = 06:00-15:00 UTC
const tag = new Date('2026-01-17T09:00:00Z');
const ruhig = { u10m: () => 2, v10m: () => 0, ugust: () => 4, vgust: () => 0, t2m: () => -6, tcc: () => 0.4 };

describe('weatherForDay', () => {
	it('nimmt den staerksten Wind im Tourenfenster samt Richtung', () => {
		// Modellstart 16.1. 18:00 UTC; Sturm aus Westen um 12 UTC (13 Uhr in Wien)
		const s = snapshot('2026-01-16T18:00:00Z', 48, {
			...ruhig,
			u10m: (h) => (h === 18 ? 20 : 2)
		});
		const r = weatherForDay(s, 'saile', tag);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.forecast.windSpeedKmh).toBe(72);
		expect(r.forecast.windDirection).toBe('W');
		expect(r.forecast.temperatureC).toBe(-6);
		// tcc als Anteil 0-1 wird zu Prozent
		expect(r.forecast.cloudCoverPct).toBe(40);
	});

	it('Wind ausserhalb des Fensters (nachts) zaehlt nicht', () => {
		// 03 UTC am 17.1. = 04 Uhr in Wien
		const s = snapshot('2026-01-16T18:00:00Z', 48, { ...ruhig, u10m: (h) => (h === 9 ? 30 : 2) });
		const r = weatherForDay(s, 'saile', tag);
		expect(r.ok && r.forecast.windSpeedKmh).toBe(7);
	});

	it('Neuschnee vom Vorabend 18 Uhr bis Mittag', () => {
		// 1 mm Wasserwert je Stunde ab Modellstart (16.1. 17:00 UTC = 18:00 Wien)
		const s = snapshot('2026-01-16T17:00:00Z', 48, { ...ruhig, snow_acc: (h) => h });
		const r = weatherForDay(s, 'saile', tag);
		// bis 17.1. 11:00 UTC (12 Uhr Wien) sind es 18 Stunden
		expect(r.ok && r.forecast.newSnow24hCm).toBe(18);
		expect(r.ok && r.forecast.source).toContain('Vorabend');
	});

	it('sagt dazu, wenn die Prognose erst nach dem Vorabend beginnt', () => {
		const s = snapshot('2026-01-17T03:00:00Z', 30, { ...ruhig, snow_acc: () => 0 });
		const r = weatherForDay(s, 'saile', tag);
		expect(r.ok && r.forecast.source).toContain('erst ab Prognosebeginn');
	});

	it('rechnet Kelvin nur um, wenn die Einheit das sagt', () => {
		const s = snapshot('2026-01-16T18:00:00Z', 48, { ...ruhig, t2m: () => 268.15 }, { t2m: 'K' });
		const r = weatherForDay(s, 'saile', tag);
		expect(r.ok && r.forecast.temperatureC).toBe(-5);
	});

	it('meldet einen Tag ausserhalb der Prognose, statt etwas zu erfinden', () => {
		const s = snapshot('2026-01-14T00:00:00Z', 30, ruhig);
		const r = weatherForDay(s, 'saile', tag);
		expect(r.ok).toBe(false);
		expect(!r.ok && r.reason).toContain('reicht nur bis');
	});

	it('Bewoelkung in Prozent bleibt Prozent - auch bei fast klarem Himmel', () => {
		const s = snapshot('2026-01-16T18:00:00Z', 48, { ...ruhig, tcc: () => 0.5 }, { t2m: 'degree Celsius', tcc: '%' });
		const r = weatherForDay(s, 'saile', tag);
		expect(r.ok && r.forecast.cloudCoverPct).toBe(1);
	});

	it('meldet einen unbekannten Gipfel', () => {
		const s = snapshot('2026-01-16T18:00:00Z', 48, ruhig);
		expect(weatherForDay(s, 'gibts-nicht', tag).ok).toBe(false);
	});

	it('bricht ohne Winddaten ab, statt Windstille zu melden', () => {
		const s = snapshot('2026-01-16T18:00:00Z', 48, { t2m: () => -5 });
		expect(weatherForDay(s, 'saile', tag).ok).toBe(false);
	});
});

describe('componentsToAspect', () => {
	it('kennt die Hauptrichtungen', () => {
		expect(componentsToAspect(0, -5)).toBe('N');
		expect(componentsToAspect(-5, 0)).toBe('E');
		expect(componentsToAspect(0, 5)).toBe('S');
		// u = +5 heisst: Luft stroemt nach Osten, kommt also aus Westen
		expect(componentsToAspect(5, 0)).toBe('W');
	});
});
