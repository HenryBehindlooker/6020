import type { Aspect, WeatherForecast } from '$lib/types';
import { cached } from '$lib/server/cache';
import { config } from '$lib/server/config';

/** AROME-Kurzfristprognose, 1 h Aufloesung, 2.5 km Gitter. */
const RESOURCE = 'timeseries/forecast/nwp-v1-1h-2500m';
// snow_acc und rain_acc sind seit Modellstart aufsummiert (mm), nicht je Stunde.
const PARAMETERS = ['t2m', 'u10m', 'v10m', 'ugust', 'vgust', 'snow_acc', 'tcc'];

/**
 * Bergwetter am Ausgangspunkt der Tour.
 *
 * Demo-Modus: plausible Winterlage. Live-Modus: GeoSphere - und bei einem
 * Fehler null statt Demodaten. Die Ampel stuft ohne Wetter vorsichtshalber
 * hoch und sagt das dazu.
 */
export async function getWeather(lat: number, lon: number, altitude: number): Promise<WeatherForecast | null> {
	if (config.mode === 'demo') return demoWeather(altitude);

	const key = `weather:${lat.toFixed(3)}:${lon.toFixed(3)}`;
	return cached(key, config.cacheTtlMs, async () => {
		try {
			const url = new URL(`${config.geosphereBaseUrl}/${RESOURCE}`);
			url.searchParams.set('lat_lon', `${lat},${lon}`);
			url.searchParams.set('output_format', 'geojson');
			for (const p of PARAMETERS) url.searchParams.append('parameters', p);

			const res = await fetch(url, {
				headers: { accept: 'application/json' },
				signal: AbortSignal.timeout(10_000)
			});
			if (!res.ok) throw new Error(`GeoSphere antwortete mit ${res.status}`);
			return parseGeosphere(await res.json(), altitude);
		} catch (err) {
			console.error('[weather] Prognose nicht verfuegbar:', err);
			return null;
		}
	});
}

interface GeosphereParameter {
	unit?: string;
	data?: (number | null)[];
}

/**
 * Wertet die GeoSphere-Zeitreihe aus: aktuelle Werte zum ersten Zeitschritt,
 * Neuschnee als Differenz der aufsummierten Schneemenge ueber die naechsten
 * 24 Stunden. Einheiten werden aus der Antwort gelesen, nicht angenommen.
 */
export function parseGeosphere(raw: unknown, altitude: number): WeatherForecast {
	const doc = raw as { features?: { properties?: { parameters?: Record<string, GeosphereParameter> } }[] };
	const params = doc?.features?.[0]?.properties?.parameters ?? {};

	const series = (name: string): number[] =>
		(params[name]?.data ?? []).map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN));
	const first = (name: string): number => series(name)[0] ?? NaN;

	const u = first('u10m');
	const v = first('v10m');
	if (!Number.isFinite(u) || !Number.isFinite(v)) throw new Error('Wind fehlt in der GeoSphere-Antwort');
	const speed = Math.hypot(u, v) * 3.6;
	const gust = Math.hypot(first('ugust'), first('vgust')) * 3.6;

	// Temperatur: GeoSphere nennt die Einheit mit; Kelvin nur, wenn sie das sagt.
	const tRaw = first('t2m');
	const tUnit = (params.t2m?.unit ?? '').toLowerCase();
	const tempC = tUnit === 'k' || tUnit.includes('kelvin') ? tRaw - 273.15 : tRaw;

	// Neuschnee: Zuwachs der aufsummierten Schneemenge in den naechsten 24 h.
	// 1 mm Wasserwert entspricht bei Neuschnee grob 1 cm.
	const snow = series('snow_acc').filter(Number.isFinite);
	const snow24 = snow.length > 1 ? snow[Math.min(24, snow.length - 1)] - snow[0] : 0;

	return {
		referenceAltitude: altitude,
		windSpeedKmh: Math.round(speed),
		windGustsKmh: Math.round(Number.isFinite(gust) ? gust : speed * 1.6),
		windDirection: componentsToAspect(u, v),
		newSnow24hCm: Math.max(0, Math.round(snow24)),
		temperatureC: Math.round(tempC * 10) / 10,
		cloudCoverPct: Math.round(Number.isFinite(first('tcc')) ? first('tcc') : 0),
		precipProbabilityPct: snow24 > 0.5 ? 80 : 20,
		source: 'GeoSphere Austria, AROME (Open Data) - Neuschnee = Prognose für die nächsten 24 h'
	};
}

/**
 * Meteorologische Windrichtung: die Richtung, aus der es weht.
 * u zeigt nach Osten, v nach Norden.
 */
export function componentsToAspect(u: number, v: number): Aspect {
	const degrees = (Math.atan2(-u, -v) * 180) / Math.PI;
	const normalized = (degrees + 360) % 360;
	const sectors: Aspect[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
	return sectors[Math.round(normalized / 45) % 8];
}

export function demoWeather(altitude: number): WeatherForecast {
	return {
		referenceAltitude: altitude,
		windSpeedKmh: 35,
		windGustsKmh: 58,
		windDirection: 'W',
		newSnow24hCm: 8,
		temperatureC: -8.5,
		cloudCoverPct: 35,
		precipProbabilityPct: 20,
		source: 'Demodaten im Format von GeoSphere Austria'
	};
}
