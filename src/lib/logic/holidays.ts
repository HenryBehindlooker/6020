import { viennaParts } from '#lib/logic/time.js';

/**
 * Gesetzliche Feiertage in Oesterreich. An ihnen fahren die Busse nach dem
 * Sonntagsfahrplan - mit dem Werktagsfahrplan rechnete die Umkehrzeit mit
 * Bussen, die gar nicht fahren (etwa am 8. Dezember, mitten in der Saison).
 *
 * Nur die bundesweiten Feiertage. Der Josefstag (19. Maerz) ist in Tirol ein
 * Landesfeiertag ohne allgemeinen freien Tag; die Busse fahren dann normal.
 */

/** Ostersonntag nach dem Gaussschen Verfahren (Anonymus/Meeus), gregorianisch. */
export function easterSunday(year: number): { month: number; day: number } {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return { month, day };
}

const FEST = [
	[1, 1, 'Neujahr'],
	[1, 6, 'Heilige Drei Könige'],
	[5, 1, 'Staatsfeiertag'],
	[8, 15, 'Mariä Himmelfahrt'],
	[10, 26, 'Nationalfeiertag'],
	[11, 1, 'Allerheiligen'],
	[12, 8, 'Mariä Empfängnis'],
	[12, 25, 'Christtag'],
	[12, 26, 'Stefanitag']
] as const;

/** Abstand zum Ostersonntag in Tagen. */
const BEWEGLICH = [
	[1, 'Ostermontag'],
	[39, 'Christi Himmelfahrt'],
	[50, 'Pfingstmontag'],
	[60, 'Fronleichnam']
] as const;

/** Name des Feiertags am Wiener Kalendertag von `date`, sonst null. */
export function austrianHoliday(date: Date): string | null {
	const { year, month, day } = viennaParts(date);
	const fest = FEST.find(([m, d]) => m === month && d === day);
	if (fest) return fest[2];
	const ostern = easterSunday(year);
	const ostertag = Date.UTC(year, ostern.month - 1, ostern.day);
	const heute = Date.UTC(year, month - 1, day);
	const abstand = Math.round((heute - ostertag) / 86_400_000);
	return BEWEGLICH.find(([tage]) => tage === abstand)?.[1] ?? null;
}
