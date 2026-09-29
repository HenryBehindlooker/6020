import type { Aspect, AvalancheBulletin, DangerLevel, Tour, WeatherForecast } from '$lib/types';

export type Signal = 'gruen' | 'gelb' | 'rot' | 'unbekannt';

export interface RatingReason {
	/** Kurzer Titel des Faktors, z.B. "Lawinenlage". */
	factor: string;
	/** Erklaerung im Klartext. */
	detail: string;
	/** Wie stark dieser Faktor die Ampel verschiebt. */
	impact: 'neutral' | 'warnung' | 'kritisch';
}

export interface TourRating {
	signal: Signal;
	/** Gefahrenstufe, die fuer die Gipfelhoehe der Tour gilt. */
	effectiveDangerLevel: DangerLevel;
	reasons: RatingReason[];
}

/** Reihenfolge der Ampel: gut zuerst. Von Liste, Karte und Sortierung gemeinsam genutzt. */
export const SIGNAL_ORDER: Record<Signal, number> = { gruen: 0, gelb: 1, rot: 2, unbekannt: 3 };

/** Hebt die Ampel an, senkt sie aber nie wieder ab. */
function escalate(current: Signal, next: Signal): Signal {
	if (current === 'unbekannt' || next === 'unbekannt') return 'unbekannt';
	return SIGNAL_ORDER[next] > SIGNAL_ORDER[current] ? next : current;
}

/**
 * Gefahrenstufe, die auf einer bestimmten Hoehe gilt. Der Lagebericht
 * unterscheidet ober- und unterhalb einer Hoehengrenze.
 */
export function dangerLevelForAltitude(bulletin: AvalancheBulletin, altitude: number): DangerLevel {
	const { rating } = bulletin;
	if (rating.elevationBoundary === null) return rating.above;
	return altitude >= rating.elevationBoundary ? rating.above : rating.below;
}

/**
 * Hoechste Gefahrenstufe entlang der ganzen Tour, vom Ausgangspunkt bis zum
 * Gipfel. Meist ist das die Stufe oben - bei Nassschnee im Fruehjahr kann es
 * aber unten ungemuetlicher sein.
 */
export function dangerLevelForTour(bulletin: AvalancheBulletin, tour: Tour): DangerLevel {
	return Math.max(
		dangerLevelForAltitude(bulletin, tour.summitAltitude),
		dangerLevelForAltitude(bulletin, tour.trailheadAltitude)
	) as DangerLevel;
}

/**
 * Liegt die Tour im Hoehenband eines Gefahrenmusters? Das Band reicht von
 * elevationAbove bis elevationBelow (jeweils optional), die Tour vom
 * Ausgangspunkt bis zum Gipfel - es zaehlt jede Ueberschneidung.
 */
export function tourInElevationBand(
	tour: Pick<Tour, 'trailheadAltitude' | 'summitAltitude'>,
	elevationAbove: number | null,
	elevationBelow: number | null
): boolean {
	const reachesUp = elevationAbove === null || tour.summitAltitude >= elevationAbove;
	const reachesDown = elevationBelow === null || tour.trailheadAltitude <= elevationBelow;
	return reachesUp && reachesDown;
}

/** Schnittmenge der Hangrichtungen von Tour und Gefahrenmuster. */
export function overlappingAspects(tourAspects: Aspect[], problemAspects: Aspect[]): Aspect[] {
	return tourAspects.filter((a) => problemAspects.includes(a));
}

/**
 * Leitet aus Lagebericht, Bergwetter und Tourencharakteristik eine Ampel ab.
 *
 * Das ist eine Heuristik als Planungshilfe - sie ersetzt weder den Lawinen-
 * lagebericht noch die Beurteilung vor Ort.
 */
export function rateTour(
	tour: Tour,
	bulletin: AvalancheBulletin | null,
	weather: WeatherForecast | null
): TourRating {
	const reasons: RatingReason[] = [];

	if (!bulletin) {
		return {
			signal: 'unbekannt',
			effectiveDangerLevel: 0,
			reasons: [
				{
					factor: 'Lawinenlage',
					detail: 'Kein Lagebericht verfügbar - keine Bewertung möglich.',
					impact: 'kritisch'
				}
			]
		};
	}

	// Hat die Tour eine Lawinenregion und der Bericht eine Einschaetzung dafuer,
	// gilt diese. Sonst die unguenstigste ueber ganz Tirol.
	const regional = tour.eawsRegion ? bulletin.byRegion?.[tour.eawsRegion] : undefined;
	if (regional) {
		bulletin = { ...bulletin, rating: regional.rating, problems: regional.problems };
	}

	const level = dangerLevelForTour(bulletin, tour);
	let signal: Signal = 'gruen';

	reasons.push({
		factor: 'Region',
		detail: regional
			? `Bewertet nach der Lawinenregion ${tour.eawsRegion}.`
			: 'Keine Einschätzung für die Region dieser Tour - es gilt die ungünstigste Tirols.',
		impact: 'neutral'
	});

	if (level === 0) {
		reasons.push({
			factor: 'Lawinenlage',
			detail: 'Laut Lagebericht kein Schnee - keine Lawinengefahr ausgewiesen.',
			impact: 'neutral'
		});
	} else if (level >= 4) {
		signal = escalate(signal, 'rot');
		reasons.push({
			factor: 'Lawinenlage',
			detail: `Gefahrenstufe ${level} zwischen ${tour.trailheadAltitude} und ${tour.summitAltitude} m - große bis sehr große Gefahr.`,
			impact: 'kritisch'
		});
	} else if (level === 3) {
		signal = escalate(signal, 'gelb');
		reasons.push({
			factor: 'Lawinenlage',
			detail: `Gefahrenstufe 3 (erheblich) zwischen ${tour.trailheadAltitude} und ${tour.summitAltitude} m.`,
			impact: 'warnung'
		});
	} else {
		reasons.push({
			factor: 'Lawinenlage',
			detail: `Gefahrenstufe ${level} zwischen ${tour.trailheadAltitude} und ${tour.summitAltitude} m.`,
			impact: 'neutral'
		});
	}

	// Steilheit im Zusammenspiel mit der Gefahrenstufe, angelehnt an die
	// Reduktionsmethode: bei Stufe 2 sind Haenge ab 40 Grad heikel, ab Stufe 3
	// solche ab 35 Grad das entscheidende Kriterium.
	if (tour.steepnessMax >= 35 && level >= 3) {
		signal = escalate(signal, 'rot');
		reasons.push({
			factor: 'Steilheit',
			detail: `Schlüsselstelle bis ${tour.steepnessMax}° bei Gefahrenstufe ${level}.`,
			impact: 'kritisch'
		});
	} else if (tour.steepnessMax >= 30 && level >= 3) {
		signal = escalate(signal, 'gelb');
		reasons.push({
			factor: 'Steilheit',
			detail: `Passagen bis ${tour.steepnessMax}° bei Gefahrenstufe ${level}.`,
			impact: 'warnung'
		});
	} else if (tour.steepnessMax >= 40 && level === 2) {
		signal = escalate(signal, 'gelb');
		reasons.push({
			factor: 'Steilheit',
			detail: `Schlüsselstelle bis ${tour.steepnessMax}° - auch bei Gefahrenstufe 2 heikel.`,
			impact: 'warnung'
		});
	}

	// Gefahrenmuster des Lageberichts gegen die Hangrichtungen der Tour pruefen.
	for (const problem of bulletin.problems) {
		if (HARMLESS_PROBLEMS.has(problem.type)) continue;
		const overlap = overlappingAspects(tour.aspects, problem.aspects);
		if (overlap.length === 0) continue;

		if (!tourInElevationBand(tour, problem.elevationAbove, problem.elevationBelow)) continue;

		const critical = level >= 3;
		signal = escalate(signal, critical ? 'rot' : 'gelb');
		reasons.push({
			factor: 'Gefahrenmuster',
			detail: `${problemLabel(problem.type)} betrifft ${overlap.join('/')} - genau die Hangrichtungen dieser Tour.`,
			impact: critical ? 'kritisch' : 'warnung'
		});
	}

	if (!weather) {
		reasons.push({
			factor: 'Bergwetter',
			detail: 'Keine Wetterprognose verfügbar - vorsichtshalber strenger bewertet.',
			impact: 'warnung'
		});
		return { signal: escalate(signal, 'gelb'), effectiveDangerLevel: level, reasons };
	}

	if (weather.windSpeedKmh >= 60) {
		signal = escalate(signal, 'rot');
		reasons.push({
			factor: 'Wind',
			detail: `${weather.windSpeedKmh} km/h aus ${weather.windDirection} auf Kammhöhe, Böen bis ${weather.windGustsKmh} km/h - frischer Triebschnee.`,
			impact: 'kritisch'
		});
	} else if (weather.windSpeedKmh >= 40) {
		signal = escalate(signal, 'gelb');
		reasons.push({
			factor: 'Wind',
			detail: `${weather.windSpeedKmh} km/h aus ${weather.windDirection} - Triebschneebildung in Leehängen.`,
			impact: 'warnung'
		});
	} else {
		reasons.push({
			factor: 'Wind',
			detail: `${weather.windSpeedKmh} km/h aus ${weather.windDirection}.`,
			impact: 'neutral'
		});
	}

	if (weather.newSnow24hCm >= 30) {
		signal = escalate(signal, 'rot');
		reasons.push({
			factor: 'Neuschnee',
			detail: `${weather.newSnow24hCm} cm in 24 h - Setzung abwarten.`,
			impact: 'kritisch'
		});
	} else if (weather.newSnow24hCm >= 15) {
		signal = escalate(signal, level >= 3 ? 'rot' : 'gelb');
		reasons.push({
			factor: 'Neuschnee',
			detail: `${weather.newSnow24hCm} cm in 24 h bei Gefahrenstufe ${level}.`,
			impact: level >= 3 ? 'kritisch' : 'warnung'
		});
	}

	return { signal, effectiveDangerLevel: level, reasons };
}

/** Problemtypen nach CAAMLv6 - "persistent_weak_layers" im Plural, so steht es in den echten Berichten. */
const PROBLEM_LABELS: Record<string, string> = {
	new_snow: 'Neuschnee',
	wind_slab: 'Triebschnee',
	persistent_weak_layers: 'Altschnee',
	persistent_weak_layer: 'Altschnee',
	wet_snow: 'Nassschnee',
	gliding_snow: 'Gleitschnee',
	cornices: 'Wechten',
	favourable_situation: 'Günstige Situation',
	no_distinct_avalanche_problem: 'Kein ausgeprägtes Lawinenproblem'
};

/**
 * Diese "Probleme" beschreiben eine Entwarnung. Sie duerfen die Ampel nie
 * hochstufen, auch wenn ihre Hangrichtungen zur Tour passen.
 */
export const HARMLESS_PROBLEMS = new Set(['favourable_situation', 'no_distinct_avalanche_problem']);

export function problemLabel(type: string): string {
	return PROBLEM_LABELS[type] ?? type;
}
