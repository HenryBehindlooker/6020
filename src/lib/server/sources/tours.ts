import type { Tour } from '$lib/types';
import toursFixture from '$fixtures/tours.json' with { type: 'json' };

/**
 * Tourenliste rund um Innsbruck.
 *
 * Gipfelname, -hoehe und -lage sowie die Haltestelle am Ausgangspunkt sind mit
 * OpenStreetMap abgeglichen (scripts/verify_tours.py). Hangrichtung, Steilheit
 * und Gehzeiten sind Richtwerte ohne gepruefte Quelle - und genau die gehen in
 * die Ampel ein. Die Tourenseite sagt das dazu.
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
