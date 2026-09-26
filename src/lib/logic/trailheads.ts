import type { Signal } from '$lib/logic/rating';
import type { TourPlan } from '$lib/server/plan';

export interface TrailheadGroup {
	stop: string;
	name: string;
	lat: number;
	lon: number;
	/** Beste Ampel unter den Touren ab diesem Ausgangspunkt. */
	bestSignal: Signal;
	/** Wie viele Touren ab hier sich zeitlich ausgehen. */
	feasibleCount: number;
	tours: TourPlan[];
}

const SIGNAL_ORDER: Record<Signal, number> = { gruen: 0, gelb: 1, rot: 2, unbekannt: 3 };

/**
 * Fasst die Touren nach Ausgangspunkt zusammen - eine Haltestelle ist ein
 * Kartenpunkt, auch wenn von dort mehrere Touren starten.
 *
 * Fuer die Farbe des Punktes zaehlt die beste Tour: die Karte beantwortet
 * "wohin fahre ich heute", nicht "welche Tour ist die heikelste".
 */
export function groupByTrailhead(plans: TourPlan[]): TrailheadGroup[] {
	const groups = new Map<string, TrailheadGroup>();

	for (const plan of plans) {
		const { tour } = plan;
		const existing = groups.get(tour.trailheadStop);

		if (!existing) {
			groups.set(tour.trailheadStop, {
				stop: tour.trailheadStop,
				name: tour.trailhead,
				lat: tour.lat,
				lon: tour.lon,
				bestSignal: plan.rating.signal,
				feasibleCount: plan.turnaround.feasible ? 1 : 0,
				tours: [plan]
			});
			continue;
		}

		existing.tours.push(plan);
		if (plan.turnaround.feasible) existing.feasibleCount += 1;
		if (SIGNAL_ORDER[plan.rating.signal] < SIGNAL_ORDER[existing.bestSignal]) {
			existing.bestSignal = plan.rating.signal;
		}
	}

	// Die Koordinate des Ausgangspunkts ist die der ersten Tour; besser ist der
	// Mittelwert, damit der Punkt nicht an einem Gipfel klebt.
	for (const group of groups.values()) {
		group.lat = average(group.tours.map((t) => t.tour.lat));
		group.lon = average(group.tours.map((t) => t.tour.lon));
		group.tours.sort((a, b) => SIGNAL_ORDER[a.rating.signal] - SIGNAL_ORDER[b.rating.signal]);
	}

	return [...groups.values()].sort(
		(a, b) => SIGNAL_ORDER[a.bestSignal] - SIGNAL_ORDER[b.bestSignal] || b.feasibleCount - a.feasibleCount
	);
}

function average(values: number[]): number {
	return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Ausschnitt, der alle Punkte umfasst - als [[sued, west], [nord, ost]]. */
export function boundsOf(groups: TrailheadGroup[]): [[number, number], [number, number]] | null {
	if (groups.length === 0) return null;
	const lats = groups.map((g) => g.lat);
	const lons = groups.map((g) => g.lon);
	return [
		[Math.min(...lats), Math.min(...lons)],
		[Math.max(...lats), Math.max(...lons)]
	];
}
