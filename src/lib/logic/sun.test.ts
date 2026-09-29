import { describe, expect, it } from 'vitest';
import { sunTimes } from './sun';

/** Abweichung in Minuten zu einer Wiener Uhrzeit am selben Tag. */
function diffMin(actual: Date, expectedIso: string): number {
	return Math.abs(actual.getTime() - new Date(expectedIso).getTime()) / 60_000;
}

describe('sunTimes', () => {
	// Vergleichswerte aus der Python-Bibliothek astral fuer Innsbruck (47.2692 N, 11.4041 E)
	const faelle = [
		['2025-12-21', '2025-12-21T07:58:43+01:00', '2025-12-21T16:26:24+01:00'],
		['2026-01-17', '2026-01-17T07:55:41+01:00', '2026-01-17T16:53:37+01:00'],
		['2026-06-21', '2026-06-21T05:18:23+02:00', '2026-06-21T21:14:00+02:00']
	] as const;
	for (const [tag, auf, unter] of faelle) {
		it(`Innsbruck am ${tag} auf eine Minute genau`, () => {
			const s = sunTimes(new Date(`${tag}T12:00:00Z`), 47.2692, 11.4041)!;
			expect(diffMin(s.sunrise, auf)).toBeLessThanOrEqual(1);
			expect(diffMin(s.sunset, unter)).toBeLessThanOrEqual(1);
		});
	}
});
