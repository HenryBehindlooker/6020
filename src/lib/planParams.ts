/**
 * Aufbruchszeit und Puffer aus der Adresse lesen - an einer Stelle, fuer alle
 * Seiten, mit Grenzen. Vorher parste jede Seite selbst, die Tourenseite
 * vergass den Puffer, und ?puffer=1e12 liess den Server abstuerzen.
 */

export const DEFAULT_START = '07:00';
export const DEFAULT_BUFFER = 30;
export const MIN_BUFFER = 0;
export const MAX_BUFFER = 180;

export interface PlanParams {
	/** "HH:MM" in Innsbrucker Ortszeit. */
	notBefore: string;
	bufferMinutes: number;
	/** Wurde etwas vom Standard Abweichendes gewaehlt? Dann in Links mitgeben. */
	custom: boolean;
}

export function parsePlanParams(search: URLSearchParams | null): PlanParams {
	const ab = search?.get('ab') ?? '';
	const puffer = search?.get('puffer') ?? '';

	const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(ab);
	const notBefore = match ? ab : DEFAULT_START;

	const n = Number.parseInt(puffer, 10);
	const bufferMinutes =
		/^\d{1,3}$/.test(puffer) && n >= MIN_BUFFER && n <= MAX_BUFFER ? n : DEFAULT_BUFFER;

	return {
		notBefore,
		bufferMinutes,
		custom: notBefore !== DEFAULT_START || bufferMinutes !== DEFAULT_BUFFER
	};
}

/** Abfrageteil fuer Links, damit die Einstellung beim Klick erhalten bleibt. */
export function planQuery(params: Pick<PlanParams, 'notBefore' | 'bufferMinutes'>): string {
	const q = new URLSearchParams();
	if (params.notBefore !== DEFAULT_START) q.set('ab', params.notBefore);
	if (params.bufferMinutes !== DEFAULT_BUFFER) q.set('puffer', String(params.bufferMinutes));
	const s = q.toString();
	return s ? `?${s}` : '';
}
