import type { Aspect, WeatherForecast } from '$lib/types';
import { cached } from '$lib/server/cache';
import { config } from '$lib/server/config';

/** AROME-Kurzfristprognose, 1 h Aufloesung, 2.5 km Gitter. */
const RESOURCE = 'timeseries/forecast/nwp-v1-1h-2500m';
const PARAMETERS = ['t2m', 'ugust', 'vgust', 'u10m', 'v10m', 'rr_acc', 'tcc'];

/**
 * Bergwetter am Ausgangspunkt der Tour. Im Demo-Modus liefert die Funktion
 * eine plausible Winterlage; bei Live-Fehlern faellt sie darauf zurueck.
 */
export async function getWeather(lat: number, lon: number, altitude: number): Promise<WeatherForecast> {
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
			console.error('[weather] Live-Abruf fehlgeschlagen, nutze Demodaten:', err);
			return demoWeather(altitude);
		}
	});
}

/**
 * Nimmt aus der GeoSphere-Zeitreihe den naechstliegenden Prognosezeitpunkt und
 * rechnet die u/v-Windkomponenten in Geschwindigkeit und Richtung um.
 */
export function parseGeosphere(raw: unknown, altitude: number, index = 0): WeatherForecast {
	const doc = raw as Record<string, any>;
	const params = doc?.features?.[0]?.properties?.parameters ?? {};
	const at = (name: string): number => Number(params?.[name]?.data?.[index] ?? 0);

	const u = at('u10m');
	const v = at('v10m');
	const speed = Math.hypot(u, v) * 3.6;
	const gust = Math.hypot(at('ugust'), at('vgust')) * 3.6;

	// Niederschlag in mm -> grobe Neuschneehoehe. Faustregel 1 mm ~ 1 cm bei
	// Temperaturen deutlich unter null.
	const precipMm = at('rr_acc');
	const tempC = at('t2m') - 273.15;
	const snowFactor = tempC < -2 ? 1.2 : tempC < 1 ? 0.8 : 0;

	return {
		referenceAltitude: altitude,
		windSpeedKmh: Math.round(speed),
		windGustsKmh: Math.round(gust || speed * 1.6),
		windDirection: componentsToAspect(u, v),
		newSnow24hCm: Math.round(precipMm * snowFactor),
		temperatureC: Math.round(tempC * 10) / 10,
		cloudCoverPct: Math.round(at('tcc')),
		precipProbabilityPct: precipMm > 0.2 ? 80 : 20,
		source: 'GeoSphere Austria, AROME (Open Data)'
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
