import type { Tour } from '$lib/types';
import toursFixture from '$fixtures/tours.json' with { type: 'json' };

/**
 * Kuratierte Tourenliste rund um Innsbruck. Hangrichtungen, Steilheit und
 * Gehzeiten stammen aus Fuehrerliteratur und OpenStreetMap; die Liste ist
 * bewusst klein gehalten und wird per Hand gepflegt.
 */
const TOURS = toursFixture as Tour[];

export function listTours(): Tour[] {
	return TOURS;
}

export function findTour(id: string): Tour | undefined {
	return TOURS.find((t) => t.id === id);
}

/** Alle Ausgangspunkte, nach Haltestelle gruppiert - spart Wetterabfragen. */
export function trailheads(): { stop: string; lat: number; lon: number; altitude: number }[] {
	const seen = new Map<string, { stop: string; lat: number; lon: number; altitude: number }>();
	for (const tour of TOURS) {
		if (!seen.has(tour.trailheadStop)) {
			seen.set(tour.trailheadStop, {
				stop: tour.trailheadStop,
				lat: tour.lat,
				lon: tour.lon,
				altitude: tour.trailheadAltitude
			});
		}
	}
	return [...seen.values()];
}
