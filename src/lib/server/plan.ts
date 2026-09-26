import type { AvalancheBulletin, Tour, TransitConnection, WeatherForecast } from '$lib/types';
import { rateTour, type TourRating } from '$lib/logic/rating';
import { planTurnaround, type TurnaroundPlan } from '$lib/logic/turnaround';
import { getBulletin } from '$lib/server/sources/avalanche';
import { getConnection } from '$lib/server/sources/transit';
import { getWeather } from '$lib/server/sources/weather';
import { listTours, trailheads } from '$lib/server/sources/tours';
import { config } from '$lib/server/config';

export interface TourPlan {
	tour: Tour;
	rating: TourRating;
	weather: WeatherForecast | null;
	transit: TransitConnection;
	turnaround: TurnaroundPlan;
}

export interface DayPlan {
	date: string;
	mode: 'demo' | 'live';
	bulletin: AvalancheBulletin;
	tours: TourPlan[];
	sources: string[];
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
	const weatherByStop = new Map<string, WeatherForecast>();
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
		sources: [...new Set([bulletin.source, ...tours.flatMap((t) => [t.weather?.source, t.transit.source])])].filter(
			(s): s is string => Boolean(s)
		)
	};
}

const SIGNAL_ORDER = { gruen: 0, gelb: 1, rot: 2, unbekannt: 3 } as const;

/** Machbares und Sicheres zuerst. */
function compareTourPlans(a: TourPlan, b: TourPlan): number {
	const bySignal = SIGNAL_ORDER[a.rating.signal] - SIGNAL_ORDER[b.rating.signal];
	if (bySignal !== 0) return bySignal;
	if (a.turnaround.feasible !== b.turnaround.feasible) return a.turnaround.feasible ? -1 : 1;
	return (b.turnaround.slackMinutes ?? -9999) - (a.turnaround.slackMinutes ?? -9999);
}

function atLocalIso(date: Date, hhmm: string): string {
	const [hours, minutes] = hhmm.split(':').map(Number);
	const local = new Date(date);
	local.setHours(hours, minutes, 0, 0);
	return local.toISOString();
}
