import type { AvalancheBulletin, Tour, TransitConnection, WeatherForecast } from '$lib/types';
import { rateTour, SIGNAL_ORDER, type TourRating } from '$lib/logic/rating';
import { planTurnaround, type TurnaroundPlan } from '$lib/logic/turnaround';
import { getBulletin, lastBulletinDate } from '$lib/server/sources/avalanche';
import { getConnection } from '$lib/server/sources/transit';
import { getWeather } from '$lib/server/sources/weather';
import { listTours, trailheads } from '$lib/server/sources/tours';
import { config } from '$lib/server/config';
import { viennaTime } from '$lib/logic/time';

export interface TourPlan {
	tour: Tour;
	rating: TourRating;
	weather: WeatherForecast | null;
	transit: TransitConnection;
	turnaround: TurnaroundPlan;
}

/** Was an den Daten dieses Plans echt ist - fuer den Hinweis oben auf der Seite. */
export interface DataStatus {
	lawine: 'echt' | 'demo' | 'fehlt';
	wetter: 'echt' | 'demo' | 'fehlt' | 'teilweise';
	fahrplan: 'echt' | 'demo' | 'fehlt' | 'teilweise';
	/** Stand des echten Fahrplans, z.B. "Transitous, Fahrplan vom Sa 3.10.2026 ...". */
	fahrplanStand: string | null;
	/** Gueltigkeit des echten Lageberichts, z.B. "gültig bis Sa 17. Jän., 17:00". */
	lawineStand: string | null;
	/** Ausserhalb der Saison: Datum des letzten echten Berichts (JJJJ-MM-TT). */
	lawineLetzter: string | null;
}

export interface DayPlan {
	date: string;
	mode: 'demo' | 'live';
	/** null: Lagebericht nicht verfuegbar - die Ampel steht dann auf "unklar". */
	bulletin: AvalancheBulletin | null;
	tours: TourPlan[];
	sources: string[];
	status: DataStatus;
}

/** Standard-Aufbruchszeit, wenn die Nutzerin nichts anderes angibt. */
const DEFAULT_START = '07:00';

export async function buildDayPlan(options: {
	date?: Date;
	notBefore?: string;
	bufferMinutes?: number;
} = {}): Promise<DayPlan> {
	const date = options.date ?? new Date();
	const notBefore = atLocalIso(date, options.notBefore ?? DEFAULT_START);

	const bulletin = await getBulletin(date);

	// Wetter einmal pro Ausgangspunkt holen, nicht einmal pro Tour.
	const weatherByStop = new Map<string, WeatherForecast | null>();
	await Promise.all(
		trailheads().map(async (t) => {
			weatherByStop.set(t.stop, await getWeather(t.lat, t.lon, t.altitude));
		})
	);

	const tours = await Promise.all(
		listTours().map(async (tour): Promise<TourPlan> => {
			const weather = weatherByStop.get(tour.trailheadStop) ?? null;
			const transit = await getConnection(tour.trailheadStop, date);
			return {
				tour,
				rating: rateTour(tour, bulletin, weather),
				weather,
				transit,
				turnaround: planTurnaround(tour, transit, {
					notBefore,
					bufferMinutes: options.bufferMinutes
				})
			};
		})
	);

	tours.sort(compareTourPlans);

	return {
		date: date.toISOString(),
		mode: config.mode,
		bulletin,
		tours,
		sources: [...new Set([bulletin?.source, ...tours.flatMap((t) => [t.weather?.source, t.transit.source])])].filter(
			(s): s is string => Boolean(s)
		),
		status: dataStatus(bulletin, tours, await lastBulletinDate())
	};
}

function dataStatus(bulletin: AvalancheBulletin | null, tours: TourPlan[], letzter: string | null): DataStatus {
	const demo = config.mode === 'demo';
	const mix = <T extends string>(values: T[], all: T, none: T): T | 'teilweise' =>
		values.every((v) => v === all) ? all : values.every((v) => v === none) ? none : 'teilweise';

	const wetter = tours.map((t) => (t.weather === null ? 'fehlt' : demo ? 'demo' : 'echt'));
	const fahrplan = tours.map((t) => (t.transit.kind === 'unvollstaendig' ? 'fehlt' : t.transit.kind));
	const fahrplanArten = new Set(fahrplan);

	const gueltigBis = bulletin?.kind === 'echt'
		? new Date(bulletin.validUntil).toLocaleString('de-AT', {
				weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna'
			})
		: null;

	return {
		lawine: bulletin === null ? 'fehlt' : bulletin.kind,
		lawineStand: gueltigBis ? `gültig bis ${gueltigBis}` : null,
		lawineLetzter: bulletin?.kind === 'echt' ? null : letzter,
		wetter: demo ? 'demo' : mix(wetter, 'echt', 'fehlt'),
		fahrplan:
			fahrplanArten.size === 1 ? (fahrplan[0] as DataStatus['fahrplan']) : fahrplanArten.has('echt') ? 'teilweise' : 'fehlt',
		fahrplanStand: tours.find((t) => t.transit.kind === 'echt' && t.transit.outbound.length + t.transit.inbound.length > 0)?.transit.source ?? null
	};
}

/** Machbares und Sicheres zuerst. */
function compareTourPlans(a: TourPlan, b: TourPlan): number {
	const bySignal = SIGNAL_ORDER[a.rating.signal] - SIGNAL_ORDER[b.rating.signal];
	if (bySignal !== 0) return bySignal;
	if (a.turnaround.feasible !== b.turnaround.feasible) return a.turnaround.feasible ? -1 : 1;
	return (b.turnaround.slackMinutes ?? -9999) - (a.turnaround.slackMinutes ?? -9999);
}

function atLocalIso(date: Date, hhmm: string): string {
	return viennaTime(date, hhmm).toISOString();
}
