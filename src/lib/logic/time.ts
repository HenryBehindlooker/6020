/**
 * Uhrzeiten in Innsbrucker Ortszeit - unabhaengig davon, in welcher Zeitzone
 * der Server laeuft.
 *
 * Fahrplaene nennen Wanduhrzeiten ("20:13"). Mit Date#setHours landen die in
 * der Zeitzone des Servers; auf einem UTC-Server (GitHub-Runner, die meisten
 * Hoster) war dadurch jede Zeit um ein bis zwei Stunden verschoben.
 */

export const TIME_ZONE = 'Europe/Vienna';

const partsFormat = new Intl.DateTimeFormat('en-CA', {
	timeZone: TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	weekday: 'short',
	hourCycle: 'h23'
});

interface ViennaParts {
	year: number;
	month: number; // 1-12
	day: number;
	hour: number;
	minute: number;
	second: number;
	weekday: number; // 0 = Sonntag
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function viennaParts(date: Date): ViennaParts {
	const map: Record<string, string> = {};
	for (const p of partsFormat.formatToParts(date)) map[p.type] = p.value;
	return {
		year: Number(map.year),
		month: Number(map.month),
		day: Number(map.day),
		hour: Number(map.hour),
		minute: Number(map.minute),
		second: Number(map.second),
		weekday: WEEKDAYS.indexOf(map.weekday)
	};
}

/** Versatz von Wiener Zeit gegenueber UTC zu diesem Zeitpunkt, in Minuten. */
function offsetMinutes(date: Date): number {
	const p = viennaParts(date);
	const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
	return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000);
}

/**
 * Der Zeitpunkt, an dem in Innsbruck am Kalendertag von `day` die Uhr
 * `hhmm` zeigt.
 */
export function viennaTime(day: Date, hhmm: string): Date {
	const [h, m] = hhmm.split(':').map(Number);
	const { year, month, day: d } = viennaParts(day);
	const naive = Date.UTC(year, month - 1, d, h, m);
	// Zweimal, damit auch Tage mit Zeitumstellung stimmen.
	let ts = naive - offsetMinutes(new Date(naive)) * 60_000;
	ts = naive - offsetMinutes(new Date(ts)) * 60_000;
	return new Date(ts);
}

/** Wochentag in Innsbruck, 0 = Sonntag. */
export function viennaWeekday(date: Date): number {
	return viennaParts(date).weekday;
}

/** Monat in Innsbruck, 1 = Januar. */
export function viennaMonth(date: Date): number {
	return viennaParts(date).month;
}
