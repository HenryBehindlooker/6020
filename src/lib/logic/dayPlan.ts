import type { AvalancheBulletin, Departure, Tour, TransitConnection, WeatherForecast } from '#lib/types.js';
import { rateTour, SIGNAL_ORDER, type TourRating } from '#lib/logic/rating.js';
import { planTurnaround, type TurnaroundPlan } from '#lib/logic/turnaround.js';
import { pickSnapshotDay, toDeparture, type Snapshot } from '#lib/logic/snapshot.js';
import { demoWeather, weatherForDay, type WeatherSnapshot } from '#lib/logic/weather.js';
import { TIME_ZONE, viennaParts, viennaTime, viennaWeekday } from '#lib/logic/time.js';

/**
 * Der Tagesplan als reine Funktion: dieselbe Rechnung laeuft beim Vorrendern,
 * auf dem Node-Server und im Browser. Die vorgerenderte Seite kann darum fuer
 * heute oder morgen und mit eigener Aufbruchszeit rechnen, ohne Server.
 *
 * Alles, was von Dateien oder Netz kommt, steckt in PlanInputs und wird vorher
 * geladen (src/lib/server/planInputs.ts) bzw. im Browser als JSON geholt.
 */

export interface PlanInputs {
	/** Wann die Eingangsdaten zusammengestellt wurden (ISO). */
	builtAt: string;
	mode: 'demo' | 'live';
	tours: Tour[];
	/** Echte, gelesene Lageberichte (heute/morgen), neuester zuerst. */
	bulletins: AvalancheBulletin[];
	/** Datum (JJJJ-MM-TT) des neuesten echten Berichts, auch wenn er abgelaufen ist. */
	lastBulletinDate: string | null;
	transit: Snapshot | null;
	/** Erfundener Beispielfahrplan - nur im Demo-Modus und nur ohne echten Abzug. */
	demoTimetable: DemoTimetable | null;
	weather: WeatherSnapshot | null;
}

export interface DemoTimetable {
	origin: string;
	stops: Record<
		string,
		{ line: string; headsign: string; travelMinutes: number; outbound: string[]; inbound: string[] }
	>;
}

export interface PlanOptions {
	/** Ein Zeitpunkt am Planungstag; fuer heute: jetzt. */
	date: Date;
	/** Frueheste Abfahrt in Innsbruck, "HH:MM". */
	notBefore?: string;
	bufferMinutes?: number;
}

export interface TourPlan {
	tour: Tour;
	rating: TourRating;
	weather: WeatherForecast | null;
	/** Warum es kein Wetter gibt, falls keins da ist. */
	weatherNote: string | null;
	transit: TransitConnection;
	turnaround: TurnaroundPlan;
}

/** Was an den Daten dieses Plans echt ist - fuer den Hinweis oben auf der Seite. */
export interface DataStatus {
	lawine: 'echt' | 'demo' | 'fehlt';
	/** Warum kein echter Bericht: Saisonpause, fuer morgen noch nicht erschienen, oder fehlt. */
	lawineGrund: 'saisonpause' | 'noch-nicht' | 'fehlt' | null;
	wetter: 'echt' | 'demo' | 'fehlt' | 'teilweise';
	/** Stand der Wetterprognose, z.B. "GeoSphere Austria, AROME 1 km ..." */
	wetterStand: string | null;
	fahrplan: 'echt' | 'demo' | 'fehlt' | 'teilweise';
	/** Stand des echten Fahrplans, z.B. "Transitous, Fahrplan vom Sa 3.10.2026 ...". */
	fahrplanStand: string | null;
	/** Gueltigkeit des echten Lageberichts, z.B. "gültig bis Sa., 17. Jän., 17:00". */
	lawineStand: string | null;
	/** Ohne gueltigen Bericht: Datum des letzten echten Berichts (JJJJ-MM-TT). */
	lawineLetzter: string | null;
}

export interface DayPlan {
	/** Der Planungstag (ISO-Zeitpunkt an diesem Tag). */
	date: string;
	mode: 'demo' | 'live';
	/** null: kein gueltiger Lagebericht - die Ampel steht dann auf "unklar". */
	bulletin: AvalancheBulletin | null;
	tours: TourPlan[];
	status: DataStatus;
	/** Wann die Daten zusammengestellt wurden. */
	builtAt: string;
}

/** Standard-Aufbruchszeit, wenn nichts anderes angegeben ist. */
export const DEFAULT_START = '07:00';

/** So lange nach dem letzten echten Bericht gilt: Saisonpause, nicht Luecke. */
const SAISONPAUSE_TAGE = 10;

export function computeDayPlan(inputs: PlanInputs, options: PlanOptions): DayPlan {
	const date = options.date;
	const notBefore = viennaTime(date, options.notBefore ?? DEFAULT_START).toISOString();
	const { bulletin, grund } = bulletinFor(inputs, date);

	const tours = inputs.tours.map((tour): TourPlan => {
		const { weather, note } = weatherFor(inputs, tour, date, bulletin?.kind === 'echt');
		const transit = connectionFor(inputs, tour.trailheadStop, date);
		return {
			tour,
			rating: rateTour(tour, bulletin, weather),
			weather,
			weatherNote: note,
			transit,
			turnaround: planTurnaround(tour, transit, { notBefore, bufferMinutes: options.bufferMinutes })
		};
	});
	tours.sort(compareTourPlans);

	return {
		date: date.toISOString(),
		mode: inputs.mode,
		bulletin,
		tours,
		status: dataStatus(inputs, bulletin, grund, tours),
		builtAt: inputs.builtAt
	};
}

/**
 * Der Bericht, der am Planungstag gilt.
 *
 * Ein echter Bericht gilt von 24 h vor seiner Veroeffentlichung (er erscheint
 * am Vorabend) bis zu seinem Ende. Gibt es keinen:
 * - Saisonpause (letzter echter Bericht laenger her) und Demo-Modus: der
 *   Beispielbericht, als solcher gekennzeichnet.
 * - Sonst nichts. Mitten in der Saison darf eine Luecke - etwa weil der
 *   Bericht fuer morgen erst um 17 Uhr erscheint - nie mit erfundenen Daten
 *   gefuellt werden: die saehen aus wie eine echte Lage.
 */
export function bulletinFor(
	inputs: Pick<PlanInputs, 'bulletins' | 'lastBulletinDate' | 'mode'>,
	date: Date
): { bulletin: AvalancheBulletin | null; grund: DataStatus['lawineGrund'] } {
	const t = date.getTime();
	const gueltig = inputs.bulletins.find((b) => {
		const start = new Date(b.publishedAt).getTime() - 24 * 3_600_000;
		return t >= start && t <= new Date(b.validUntil).getTime();
	});
	if (gueltig) return { bulletin: gueltig, grund: null };

	const letzter = inputs.lastBulletinDate ? new Date(`${inputs.lastBulletinDate}T12:00:00Z`).getTime() : null;
	const saisonpause = letzter === null || t - letzter > SAISONPAUSE_TAGE * 86_400_000;
	if (saisonpause) {
		return { bulletin: inputs.mode === 'demo' ? demoBulletin(date) : null, grund: 'saisonpause' };
	}
	// In der Saison: liegt der Planungstag nach dem neuesten Bericht, ist er noch nicht erschienen
	const neuester = inputs.bulletins[0];
	const nochNicht = !neuester || t > new Date(neuester.validUntil).getTime();
	return { bulletin: null, grund: nochNicht ? 'noch-nicht' : 'fehlt' };
}

/** Beispielbericht: erhebliche Lage mit Triebschneeproblem in Nordsektoren. */
export function demoBulletin(date: Date): AvalancheBulletin {
	return {
		kind: 'demo',
		regionId: 'AT-07',
		regionName: 'Tirol (Beispiel)',
		publishedAt: date.toISOString(),
		validUntil: viennaTime(date, '17:00').toISOString(),
		rating: { above: 3, below: 2, elevationBoundary: 2200, aspects: ['N', 'NE', 'E', 'NW'] },
		problems: [
			{ type: 'wind_slab', aspects: ['N', 'NE', 'E', 'NW'], elevationAbove: 2200, elevationBelow: null },
			{ type: 'persistent_weak_layers', aspects: ['N', 'NW', 'W'], elevationAbove: 2400, elevationBelow: null }
		],
		summary:
			'Frischer Triebschnee ist die Hauptgefahr. Störanfällig sind kammnahe Bereiche der Expositionen Nordwest über Nord bis Ost oberhalb von 2200 m.',
		source: 'Beispielbericht im Format des Lawinenwarndienstes Tirol'
	};
}

/**
 * Beispielwetter nur zum Beispielbericht. Neben einem echten Lagebericht
 * waere es eine erfundene Entwarnung - dann lieber kein Wetter, und die Ampel
 * stuft vorsichtshalber hoch.
 */
function weatherFor(
	inputs: PlanInputs,
	tour: Tour,
	date: Date,
	echteLage: boolean
): { weather: WeatherForecast | null; note: string | null } {
	const result = inputs.weather ? weatherForDay(inputs.weather, tour.id, date) : null;
	if (result?.ok) return { weather: result.forecast, note: null };
	const note = result?.reason ?? 'Keine Wetterprognose verfügbar.';
	if (inputs.mode === 'demo' && !echteLage) {
		return { weather: { ...demoWeather(tour.summitAltitude), source: `Beispielwerte – ${note}` }, note };
	}
	return { weather: null, note };
}

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/**
 * Verbindungen zwischen Innsbruck und dem Ausgangspunkt.
 *
 * 1. Echter Abzug (Transitous) kennt den Halt: der gilt. Kein Bus an dem Tag
 *    heisst dann wirklich kein Bus - keine Demo-Zeiten als Ersatz.
 * 2. Kein Abzug, Demo-Modus: der erfundene Beispielfahrplan, als Demo markiert.
 * 3. Sonst: nichts. Eine Umkehrzeit an einem erfundenen Bus waere gefaehrlich.
 */
export function connectionFor(inputs: PlanInputs, stop: string, date: Date): TransitConnection {
	const snapshot = inputs.transit;
	const picked = snapshot ? pickSnapshotDay(snapshot, date) : null;
	const entry = picked?.day.trailheads[stop];
	if (snapshot && picked && entry) {
		const tag = new Date(picked.day.date + 'T12:00:00Z');
		const stand =
			`${WOCHENTAG[viennaWeekday(tag)]} ${tag.toLocaleDateString('de-AT', { timeZone: TIME_ZONE })}` +
			(picked.feiertag ? ` (Feiertag ${picked.feiertag}: Sonntagsfahrplan)` : '');
		const convert = (direction: 'outbound' | 'inbound') =>
			entry[direction].map((it) => toDeparture(it, date, direction)).filter((d): d is Departure => d !== null);
		const outbound = convert('outbound');
		const inbound = convert('inbound');
		const failed = (entry.errors?.length ?? 0) > 0;
		const empty = outbound.length === 0 && inbound.length === 0;
		return {
			kind: failed && empty ? 'unvollstaendig' : 'echt',
			originStop: snapshot.destination,
			destinationStop: stop,
			outbound,
			inbound,
			source:
				failed && empty
					? `Fahrplanabfrage für diesen Halt fehlgeschlagen (${stand}) – bitte in der VVT-App nachschauen`
					: empty
						? `Transitous: keine Verbindung am ${stand} gefunden`
						: `Transitous, Fahrplan vom ${stand}, auf den Planungstag übertragen`
		};
	}

	const schedule = inputs.demoTimetable?.stops[stop];
	if (inputs.mode === 'demo' && inputs.demoTimetable && schedule) {
		const toDep = (hhmm: string): Departure => {
			const departure = viennaTime(date, hhmm);
			return {
				line: schedule.line,
				headsign: schedule.headsign,
				departure: departure.toISOString(),
				arrival: new Date(departure.getTime() + schedule.travelMinutes * 60_000).toISOString(),
				delayMinutes: null
			};
		};
		return {
			kind: 'demo',
			originStop: inputs.demoTimetable.origin,
			destinationStop: stop,
			outbound: schedule.outbound.map(toDep),
			inbound: schedule.inbound.map(toDep),
			source: 'Demo-Fahrplan – keine gültige Fahrplanauskunft'
		};
	}

	return {
		kind: 'fehlt',
		originStop: snapshot?.destination ?? 'Innsbruck',
		destinationStop: stop,
		outbound: [],
		inbound: [],
		source: 'Für diesen Halt liegt kein Fahrplan vor'
	};
}

function dataStatus(
	inputs: PlanInputs,
	bulletin: AvalancheBulletin | null,
	grund: DataStatus['lawineGrund'],
	tours: TourPlan[]
): DataStatus {
	const wetterArten = new Set(
		tours.map((t) => (t.weather === null ? 'fehlt' : t.weather.source.startsWith('Beispiel') ? 'demo' : 'echt'))
	);
	const fahrplan = tours.map((t) => (t.transit.kind === 'unvollstaendig' ? 'fehlt' : t.transit.kind));
	const fahrplanArten = new Set(fahrplan);

	const gueltigBis =
		bulletin?.kind === 'echt'
			? new Date(bulletin.validUntil).toLocaleString('de-AT', {
					weekday: 'short',
					day: 'numeric',
					month: 'short',
					hour: '2-digit',
					minute: '2-digit',
					timeZone: TIME_ZONE
				})
			: null;

	return {
		lawine: bulletin === null ? 'fehlt' : bulletin.kind,
		lawineGrund: bulletin?.kind === 'echt' ? null : grund,
		lawineStand: gueltigBis ? `gültig bis ${gueltigBis}` : null,
		lawineLetzter: bulletin?.kind === 'echt' ? null : inputs.lastBulletinDate,
		wetter: wetterArten.size === 1 ? ([...wetterArten][0] as DataStatus['wetter']) : 'teilweise',
		wetterStand: wetterArten.has('echt') ? (inputs.weather?.source ?? null) : null,
		fahrplan:
			fahrplanArten.size === 1
				? (fahrplan[0] as DataStatus['fahrplan'])
				: fahrplanArten.has('echt')
					? 'teilweise'
					: 'fehlt',
		fahrplanStand:
			tours.find((t) => t.transit.kind === 'echt' && t.transit.outbound.length + t.transit.inbound.length > 0)?.transit
				.source ?? null
	};
}

/** Machbares und Sicheres zuerst. */
function compareTourPlans(a: TourPlan, b: TourPlan): number {
	const bySignal = SIGNAL_ORDER[a.rating.signal] - SIGNAL_ORDER[b.rating.signal];
	if (bySignal !== 0) return bySignal;
	if (a.turnaround.feasible !== b.turnaround.feasible) return a.turnaround.feasible ? -1 : 1;
	return (b.turnaround.slackMinutes ?? -9999) - (a.turnaround.slackMinutes ?? -9999);
}

/** Planungstag als Zeitpunkt: heute = jetzt, morgen = morgen 09:00 Wiener Zeit. */
export function planningDate(tag: 'heute' | 'morgen', now: Date = new Date()): Date {
	if (tag === 'heute') return now;
	const p = viennaParts(now);
	// Mittag als Anker, damit Zeitumstellungen den Kalendertag nicht verschieben
	const morgenMittag = new Date(Date.UTC(p.year, p.month - 1, p.day + 1, 12));
	return viennaTime(morgenMittag, '09:00');
}
