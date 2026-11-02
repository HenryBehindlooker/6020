import { computeDayPlan, type DayPlan, type PlanInputs } from '$lib/logic/dayPlan';
import { lastBulletinDate, loadBulletins } from '$lib/server/sources/avalanche';
import { demoTimetable, loadTransitSnapshot } from '$lib/server/sources/transit';
import { loadWeatherSnapshot } from '$lib/server/sources/weather';
import { listTours } from '$lib/server/sources/tours';
import { config } from '$lib/server/config';

/**
 * Alle Eingangsdaten des Tagesplans. Beim Vorrendern landen sie zusaetzlich als
 * /daten/plan.json in der statischen Fassung - dort rechnet der Browser den
 * Plan fuer heute oder morgen selbst.
 */
export async function loadPlanInputs(now = new Date()): Promise<PlanInputs> {
	const [bulletins, letzter, transit, weather] = await Promise.all([
		loadBulletins(now),
		lastBulletinDate(),
		loadTransitSnapshot(),
		loadWeatherSnapshot()
	]);
	return {
		builtAt: now.toISOString(),
		mode: config.mode,
		tours: listTours(),
		// Abgelaufene Berichte braucht niemand - der Hinweis auf die Saisonpause
		// kommt aus lastBulletinDate
		bulletins: bulletins.filter((b) => new Date(b.validUntil).getTime() > now.getTime() - 36 * 3_600_000),
		lastBulletinDate: letzter,
		transit,
		demoTimetable: config.mode === 'demo' && !transit ? demoTimetable() : null,
		weather
	};
}

export async function buildDayPlan(
	options: { date?: Date; notBefore?: string; bufferMinutes?: number } = {}
): Promise<DayPlan> {
	const date = options.date ?? new Date();
	return computeDayPlan(await loadPlanInputs(date), {
		date,
		notBefore: options.notBefore,
		bufferMinutes: options.bufferMinutes
	});
}
