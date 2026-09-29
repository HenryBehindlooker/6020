/**
 * Auswertung von OSM-Oeffnungszeiten (opening_hours) fuer einen Tag.
 *
 * Bewusst nur die Formen, die an Huetten rund um Innsbruck tatsaechlich
 * vorkommen: Wochentage und -bereiche (auch ueber das Wochenende, "Fr-Tu"),
 * Zeitspannen mit "+" oder bis 24:00, "off"/"closed", "24/7" und Monats-
 * oder Datumsbereiche davor ("May-Oct:", "May 1-Oct 31:",
 * "2026 Jun 04 - 2026 Sep 20"). Spaetere Regeln ueberschreiben fruehere.
 *
 * Alles andere - Freitext in Anfuehrungszeichen, Sonnenzeiten, Wochen-
 * nummern - ergibt "unklar". Lieber keine Aussage als eine falsche: wer
 * zu einer geschlossenen Huette aufsteigt, steht ohne Wasser da.
 *
 * Feiertage (PH) kennt die Auswertung nicht; Regeln nur fuer PH werden
 * uebergangen, und die Oberflaeche weist darauf hin.
 */

export interface Day {
	year: number;
	/** 1-12 */
	month: number;
	/** 1-31 */
	day: number;
	/** 0 = Montag ... 6 = Sonntag */
	weekday: number;
}

export type OpeningResult =
	| { status: 'offen'; spans: string[] }
	| { status: 'zu' }
	| { status: 'unklar'; reason: string };

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

class Unklar extends Error {}

/** "Mo-We, Sa" -> Menge der Wochentage; PH wird gesondert gemeldet. */
function parseWeekdays(sel: string): { days: Set<number>; ph: boolean } {
	const days = new Set<number>();
	let ph = false;
	for (const raw of sel.split(',')) {
		const part = raw.trim();
		if (!part) continue;
		if (part === 'PH') {
			ph = true;
			continue;
		}
		if (part === 'SH') throw new Unklar('Schulferien');
		const m = /^([A-Z][a-z])(?:-([A-Z][a-z]))?$/.exec(part);
		if (!m) throw new Unklar(`Wochentag "${part}"`);
		const from = WEEKDAYS.indexOf(m[1]);
		const to = m[2] ? WEEKDAYS.indexOf(m[2]) : from;
		if (from < 0 || to < 0) throw new Unklar(`Wochentag "${part}"`);
		for (let d = from; ; d = (d + 1) % 7) {
			days.add(d);
			if (d === to) break;
		}
	}
	return { days, ph };
}

function toMinutes(hhmm: string): number {
	const [h, m] = hhmm.split(':').map(Number);
	return h * 60 + m;
}

/** "11:30-15:00,17:30-20:00" -> Anzeige-Spannen; wirft bei Unbekanntem. */
function parseTimes(sel: string): string[] {
	return sel.split(',').map((raw) => {
		const part = raw.trim();
		const open = /^(\d{1,2}:\d{2})\+$/.exec(part);
		if (open) return `ab ${pad(open[1])}`;
		const m = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\+?$/.exec(part);
		if (!m) throw new Unklar(`Uhrzeit "${part}"`);
		if (toMinutes(m[2]) <= toMinutes(m[1]) && m[2] !== '24:00') throw new Unklar(`Uhrzeit "${part}"`);
		return `${pad(m[1])}–${pad(m[2])}`;
	});
}

function pad(hhmm: string): string {
	return hhmm.length === 4 ? `0${hhmm}` : hhmm;
}

/** Tag im Jahr als vergleichbare Zahl (Monat*100 + Tag). */
function md(month: number, day: number): number {
	return month * 100 + day;
}

/**
 * Monats-/Datumsbereich am Anfang einer Regel. Liefert den Rest der Regel
 * und ob der Tag hineinfaellt; null, wenn die Regel keinen Bereich hat.
 */
function takeDateRange(rule: string, day: Day): { rest: string; matches: boolean } | null {
	const mon = MONTHS.join('|');
	// 2026 Jun 04 - 2026 Sep 20
	let m = new RegExp(`^(\\d{4}) (${mon}) (\\d{1,2}) ?- ?(\\d{4}) (${mon}) (\\d{1,2}):?\\s*`).exec(rule);
	if (m) {
		const from = Number(m[1]) * 10000 + md(MONTHS.indexOf(m[2]) + 1, Number(m[3]));
		const to = Number(m[4]) * 10000 + md(MONTHS.indexOf(m[5]) + 1, Number(m[6]));
		const today = day.year * 10000 + md(day.month, day.day);
		return { rest: rule.slice(m[0].length), matches: today >= from && today <= to };
	}
	// May 1-Oct 31 / Nov 01-Apr 30 / May-Oct / Dec-Apr / Jun
	m = new RegExp(`^(${mon})(?: (\\d{1,2}))?(?: ?- ?(${mon})(?: (\\d{1,2}))?)?:?\\s*`).exec(rule);
	if (m) {
		const fromMonth = MONTHS.indexOf(m[1]) + 1;
		const toMonth = m[3] ? MONTHS.indexOf(m[3]) + 1 : fromMonth;
		const from = md(fromMonth, m[2] ? Number(m[2]) : 1);
		const to = md(toMonth, m[4] ? Number(m[4]) : 31);
		const today = md(day.month, day.day);
		// Bereiche ueber den Jahreswechsel (Nov-Apr)
		const matches = from <= to ? today >= from && today <= to : today >= from || today <= to;
		return { rest: rule.slice(m[0].length), matches };
	}
	return null;
}

export function openingOn(value: string | null | undefined, day: Day): OpeningResult {
	const text = (value ?? '').trim();
	if (!text) return { status: 'unklar', reason: 'keine Angabe' };
	if (text.includes('"')) return { status: 'unklar', reason: 'nur als Text angegeben' };
	if (text === '24/7') return { status: 'offen', spans: ['rund um die Uhr'] };

	let result: OpeningResult | null = null;
	try {
		// Innerhalb einer Regel trennt ", " auch Wochentage ("Mo-We, Sa 10:00");
		// neue Regeln beginnen erst mit ";" oder mit einem Monatsbereich.
		const rules = text.split(/\s*;\s*|\s*,\s*(?=(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b)/);
		for (let rule of rules) {
			rule = rule.trim();
			if (!rule) continue;
			const range = takeDateRange(rule, day);
			// Ein Monatsbereich gilt fuer die ganze Regel samt ihren Zusatzregeln
			if (range) {
				if (!range.matches) continue;
				rule = range.rest.trim();
			}
			// "Mo-Sa 09:00-20:00, Su 09:00-18:00": nach einer Uhrzeit beginnt mit
			// ", <Wochentag>" eine Zusatzregel. "Mo-We, Sa 10:00" dagegen ist eine
			// Liste von Tagen - dort steht vor dem Komma keine Uhrzeit.
			for (const sub of rule.split(/(?<=[\d+])\s*,\s*(?=[A-Z][A-Za-z])/)) {
				const next = evaluateRule(sub.trim(), day);
				if (next) result = next;
			}
		}
	} catch (err) {
		if (err instanceof Unklar) return { status: 'unklar', reason: `nicht auswertbar (${err.message})` };
		throw err;
	}
	return result ?? { status: 'zu' };
}

/** Eine Regel ohne Datumsbereich; null, wenn sie fuer den Tag nicht gilt. */
function evaluateRule(rule: string, day: Day): OpeningResult | null {
	if (rule === '') return { status: 'offen', spans: ['ganztags laut OSM'] };
	// Wochentage | Zeiten | off
	const m = /^((?:(?:[A-Z][A-Za-z](?:-[A-Z][a-z])?)\s*,?\s*)+)?\s*(.*)$/.exec(rule)!;
	const daysPart = (m[1] ?? '').trim().replace(/,$/, '');
	const rest = m[2].trim();
	// Nur-Feiertag-Regeln gelten nie: welcher Tag Feiertag ist, weiss die App nicht
	if (daysPart && !parseWeekdays(daysPart).days.has(day.weekday)) return null;
	if (rest === 'off' || rest === 'closed') return { status: 'zu' };
	if (rest === '' || rest === 'open') return { status: 'offen', spans: ['ganztags laut OSM'] };
	return { status: 'offen', spans: parseTimes(rest) };
}

/** Kalendertag in Wien fuer "heute". */
export function viennaDay(date: Date): Day {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/Vienna',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		weekday: 'short'
	}).formatToParts(date);
	const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
	return {
		year: Number(get('year')),
		month: Number(get('month')),
		day: Number(get('day')),
		weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'))
	};
}
