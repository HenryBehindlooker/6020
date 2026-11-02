import type { Aspect, WeatherForecast } from '$lib/types';
import { viennaTime } from '$lib/logic/time';

/**
 * Bergwetter je Planungstag aus der stuendlichen GeoSphere-Prognose
 * (data/wetter/prognose.json, geschrieben von scripts/fetch/weather.py).
 *
 * Bewertet wird das Tourenfenster 07:00-16:00 Wiener Zeit am Gipfel:
 * staerkster Wind, staerkste Boee, Temperatur zu Mittag, mittlere Bewoelkung.
 * Neuschnee ist der Zuwachs der aufsummierten Schneemenge vom Vorabend
 * 18:00 bis 12:00 - soweit die Prognose so weit zurueckreicht. Was vor dem
 * Modellstart gefallen ist, kennt sie nicht; das steht dann dabei.
 */

export interface WeatherSnapshot {
	fetched_at: string;
	source: string;
	reference_time?: string | null;
	timestamps: string[];
	units: Record<string, string | null | undefined>;
	points: Record<
		string,
		{ lat: number; lon: number; ele: number | null; series: Record<string, (number | null)[]> }
	>;
}

export type WeatherResult =
	| { ok: true; forecast: WeatherForecast }
	| { ok: false; reason: string };

const FENSTER = { von: '07:00', bis: '16:00', mittag: '12:00', vorabend: '18:00' };

export function weatherForDay(snapshot: WeatherSnapshot, tourId: string, day: Date): WeatherResult {
	const point = snapshot.points[tourId];
	if (!point) return { ok: false, reason: 'Für diesen Gipfel liegt keine Prognose vor.' };

	const times = snapshot.timestamps.map((t) => new Date(t).getTime());
	const von = viennaTime(day, FENSTER.von).getTime();
	const bis = viennaTime(day, FENSTER.bis).getTime();
	const mittag = viennaTime(day, FENSTER.mittag).getTime();
	const vorabend = viennaTime(new Date(day.getTime() - 86_400_000), FENSTER.vorabend).getTime();

	const fenster = times.map((t, i) => [t, i] as const).filter(([t]) => t >= von && t <= bis).map(([, i]) => i);
	const letzte = times.length ? times[times.length - 1] : 0;
	if (fenster.length === 0) {
		const bisWann = letzte
			? new Date(letzte).toLocaleString('de-AT', {
					weekday: 'short',
					hour: '2-digit',
					minute: '2-digit',
					timeZone: 'Europe/Vienna'
				})
			: '';
		return { ok: false, reason: `Die Prognose reicht nur bis ${bisWann} – für diesen Tag noch keine Wetterdaten.` };
	}

	const s = (name: string) => point.series[name] ?? [];
	const at = (name: string, i: number) => {
		const v = s(name)[i];
		return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
	};
	const kmh = (u: number, v: number) => Math.hypot(u, v) * 3.6;

	// Staerkster Wind im Fenster - und von dort die Richtung
	let maxWind = -1;
	let maxIdx = fenster[0];
	let maxGust = 0;
	for (const i of fenster) {
		const w = kmh(at('u10m', i), at('v10m', i));
		if (Number.isFinite(w) && w > maxWind) {
			maxWind = w;
			maxIdx = i;
		}
		const g = kmh(at('ugust', i), at('vgust', i));
		if (Number.isFinite(g)) maxGust = Math.max(maxGust, g);
	}
	if (maxWind < 0) return { ok: false, reason: 'Wind fehlt in der Prognose.' };

	const naechster = (ziel: number) =>
		times.reduce((best, t, i) => (Math.abs(t - ziel) < Math.abs(times[best] - ziel) ? i : best), 0);
	const tRaw = at('t2m', naechster(mittag));
	const tUnit = String(snapshot.units.t2m ?? '').toLowerCase();
	const tempC = tUnit === 'k' || tUnit.includes('kelvin') ? tRaw - 273.15 : tRaw;

	const wolken = fenster.map((i) => at('tcc', i)).filter(Number.isFinite);
	// tcc kommt je nach Datensatz als Anteil (0-1) oder Prozent
	const wolkenMittel = wolken.length ? wolken.reduce((a, b) => a + b, 0) / wolken.length : NaN;
	const wolkenPct = Number.isFinite(wolkenMittel) ? (wolkenMittel <= 1.0001 ? wolkenMittel * 100 : wolkenMittel) : 0;

	// Neuschnee: aufsummierter Schnee, 1 mm Wasserwert ~ 1 cm Neuschnee
	const start = Math.max(vorabend, times[0]);
	const iStart = times.findIndex((t) => t >= start);
	const iEnde = naechster(mittag);
	const schneeA = at('snow_acc', iStart);
	const schneeB = at('snow_acc', iEnde);
	const neuschnee = Number.isFinite(schneeA) && Number.isFinite(schneeB) ? Math.max(0, schneeB - schneeA) : 0;
	const unvollstaendig = times[0] > vorabend;

	const modell = new Date(times[0]).toLocaleString('de-AT', {
		weekday: 'short',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Europe/Vienna'
	});

	return {
		ok: true,
		forecast: {
			referenceAltitude: point.ele ?? 0,
			windSpeedKmh: Math.round(maxWind),
			windGustsKmh: Math.round(maxGust > 0 ? maxGust : maxWind * 1.6),
			windDirection: componentsToAspect(at('u10m', maxIdx), at('v10m', maxIdx)),
			newSnow24hCm: Math.round(neuschnee),
			temperatureC: Math.round(tempC * 10) / 10,
			cloudCoverPct: Math.round(wolkenPct),
			precipProbabilityPct: neuschnee > 0.5 ? 80 : 20,
			source:
				`${snapshot.source}, am Gipfel-Gitterpunkt. Wind und Böen: stärkster Wert 07–16 Uhr.` +
				(unvollstaendig ? ` Neuschnee erst ab Prognosebeginn (${modell}).` : ' Neuschnee: Vorabend 18 Uhr bis Mittag.')
		}
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
		source: 'Beispielwerte im Format von GeoSphere Austria'
	};
}
