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

const ORDER: Record<Signal, number> = { gruen: 0, gelb: 1, rot: 2, unbekannt: 3 };

/** Hebt die Ampel an, senkt sie aber nie wieder ab. */
function escalate(current: Signal, next: Signal): Signal {
	if (current === 'unbekannt' || next === 'unbekannt') return 'unbekannt';
	return ORDER[next] > ORDER[current] ? next : current;
}

/**
 * Gefahrenstufe, die auf Gipfelhoehe der Tour gilt. Der Lagebericht
 * unterscheidet ober- und unterhalb einer Hoehengrenze.
 */
export function dangerLevelForAltitude(bulletin: AvalancheBulletin, altitude: number): DangerLevel {
	const { rating } = bulletin;
	if (rating.elevationBoundary === null) return rating.above;
	return altitude >= rating.elevationBoundary ? rating.above : rating.below;
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
					detail: 'Kein Lagebericht verfuegbar - keine Bewertung moeglich.',
					impact: 'kritisch'
				}
			]
		};
	}

	const level = dangerLevelForAltitude(bulletin, tour.summitAltitude);
	let signal: Signal = 'gruen';

	if (level >= 4) {
		signal = escalate(signal, 'rot');
		reasons.push({
			factor: 'Lawinenlage',
			detail: `Gefahrenstufe ${level} auf ${tour.summitAltitude} m - grosse bis sehr grosse Gefahr.`,
			impact: 'kritisch'
		});
	} else if (level === 3) {
		signal = escalate(signal, 'gelb');
		reasons.push({
			factor: 'Lawinenlage',
			detail: `Gefahrenstufe 3 (erheblich) auf ${tour.summitAltitude} m.`,
			impact: 'warnung'
		});
	} else {
		reasons.push({
			factor: 'Lawinenlage',
			detail: `Gefahrenstufe ${level} auf ${tour.summitAltitude} m.`,
			impact: 'neutral'
		});
	}

	// Steilheit im Zusammenspiel mit der Gefahrenstufe: ab Stufe 3 sind
	// Hangneigungen ueber 35 Grad das entscheidende Kriterium.
	if (tour.steepnessMax >= 35 && level >= 3) {
		signal = escalate(signal, 'rot');
		reasons.push({
			factor: 'Steilheit',
			detail: `Schluesselstelle bis ${tour.steepnessMax} Grad bei Gefahrenstufe ${level}.`,
			impact: 'kritisch'
		});
	} else if (tour.steepnessMax >= 30 && level >= 3) {
		signal = escalate(signal, 'gelb');
		reasons.push({
			factor: 'Steilheit',
			detail: `Passagen bis ${tour.steepnessMax} Grad bei Gefahrenstufe ${level}.`,
			impact: 'warnung'
		});
	}

	// Gefahrenmuster des Lageberichts gegen die Hangrichtungen der Tour pruefen.
	for (const problem of bulletin.problems) {
		const overlap = overlappingAspects(tour.aspects, problem.aspects);
		if (overlap.length === 0) continue;

		const aboveOk = problem.elevationAbove === null || tour.summitAltitude >= problem.elevationAbove;
		const belowOk = problem.elevationBelow === null || tour.trailheadAltitude <= problem.elevationBelow;
		if (!aboveOk && !belowOk) continue;

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
			detail: 'Keine Wetterprognose verfuegbar.',
			impact: 'warnung'
		});
		return { signal: escalate(signal, 'gelb'), effectiveDangerLevel: level, reasons };
	}

	if (weather.windSpeedKmh >= 60) {
		signal = escalate(signal, 'rot');
		reasons.push({
			factor: 'Wind',
			detail: `${weather.windSpeedKmh} km/h aus ${weather.windDirection} auf Kammhoehe, Boeen bis ${weather.windGustsKmh} km/h - frischer Triebschnee.`,
			impact: 'kritisch'
		});
	} else if (weather.windSpeedKmh >= 40) {
		signal = escalate(signal, 'gelb');
		reasons.push({
			factor: 'Wind',
			detail: `${weather.windSpeedKmh} km/h aus ${weather.windDirection} - Triebschneebildung in Leehaengen.`,
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

const PROBLEM_LABELS: Record<string, string> = {
	wind_slab: 'Triebschnee',
	new_snow: 'Neuschnee',
	persistent_weak_layer: 'Altschnee',
	wet_snow: 'Nassschnee',
	gliding_snow: 'Gleitschnee',
	favourable_situation: 'Guenstige Situation'
};

export function problemLabel(type: string): string {
	return PROBLEM_LABELS[type] ?? type;
}
