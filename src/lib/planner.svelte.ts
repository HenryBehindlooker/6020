import { resolve } from '$app/paths';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { computeDayPlan, planningDate, type DayPlan, type PlanInputs } from '#lib/logic/dayPlan.js';
import { parsePlanParams, planQuery, type PlanParams, type PlanTag } from '#lib/planParams.js';

/**
 * Planung im Browser: Tag, Aufbruch und Puffer gelten fuer alle Seiten und
 * stehen in der Adresse, damit man einen Plan teilen kann.
 *
 * Die vorgerenderte Seite bringt einen fertigen Plan mit (vom Bauzeitpunkt,
 * mit Standardwerten). Sobald /daten/plan.json geladen ist, rechnet der Browser
 * mit denselben Funktionen neu - fuer den echten heutigen Tag und die
 * gewaehlten Werte. Ohne JavaScript bleibt der vorgerenderte Plan stehen.
 */

class Planner {
	tag = $state<PlanTag>('heute');
	notBefore = $state('07:00');
	bufferMinutes = $state(30);
	/** Eingangsdaten - null, bis sie geladen sind. */
	inputs = $state<PlanInputs | null>(null);
	/** Laden fehlgeschlagen (offline und nichts im Zwischenspeicher). */
	failed = $state(false);
	/** Uhrzeit, die "jetzt" bestimmt - minutlich aktualisiert. */
	now = $state(new Date());

	#loading: Promise<void> | null = null;
	#ticking = false;

	/** Werte aus der Adresse uebernehmen und Daten laden. Nur im Browser aufrufen. */
	start(search: URLSearchParams) {
		const p = parsePlanParams(search);
		this.tag = p.tag;
		this.notBefore = p.notBefore;
		this.bufferMinutes = p.bufferMinutes;
		this.now = new Date();
		if (!this.#ticking) {
			this.#ticking = true;
			// "heute" haengt an der Uhrzeit: nach 17 Uhr gilt der Bericht fuer morgen
			setInterval(() => (this.now = new Date()), 60_000);
		}

		this.#loading ??= fetch(resolve(`daten/plan.json`))
			.then((res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res.json() as Promise<PlanInputs>;
			})
			.then((inputs) => {
				this.inputs = inputs;
			})
			.catch((err) => {
				console.error('[planer] Daten nicht geladen:', err);
				this.failed = true;
				this.#loading = null;
			});
	}

	get params(): PlanParams {
		return {
			tag: this.tag,
			notBefore: this.notBefore,
			bufferMinutes: this.bufferMinutes,
			custom: this.query !== ''
		};
	}

	get query(): string {
		return planQuery({ tag: this.tag, notBefore: this.notBefore, bufferMinutes: this.bufferMinutes });
	}

	/** Der Plan im Browser - oder null, solange die Daten fehlen. */
	plan(): DayPlan | null {
		if (!this.inputs) return null;
		return computeDayPlan(this.inputs, {
			date: planningDate(this.tag, this.now),
			notBefore: this.notBefore,
			bufferMinutes: this.bufferMinutes
		});
	}

	/** Neue Werte in die Adresse schreiben, ohne neu zu laden. */
	syncUrl() {
		const url = new URL(page.url.href);
		url.search = this.query;
		if (url.href !== page.url.href) goto(url, { shallow: true, replace: true, state: page.state });
	}
}

export const planner = new Planner();
