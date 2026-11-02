import type { Aspect, AvalancheBulletin, AvalancheProblem, DangerLevel } from '$lib/types';
import { cached } from '$lib/server/cache';
import { config } from '$lib/server/config';
import { readFile } from 'node:fs/promises';
import { TIME_ZONE } from '$lib/logic/time';

const LEVEL_BY_NAME: Record<string, DangerLevel> = {
	no_snow: 0,
	low: 1,
	moderate: 2,
	considerable: 3,
	high: 4,
	very_high: 5
};

/** Region Tirol im EAWS-Schema. */
const REGION_ID = 'AT-07';

/** Vom Abholer auf dem GitHub-Runner geschrieben (scripts/fetch/avalanche.py). */
const LATEST_PATH = 'data/lawine/latest.json';
/** Die Berichte fuer heute und morgen, soweit erschienen. */
const AKTUELL_PATH = 'data/lawine/aktuell.json';

interface StoredBulletin {
	date: string;
	bulletin: unknown;
	fetched_at?: string;
}

async function readJson<T>(path: string): Promise<T | null> {
	try {
		return JSON.parse(await readFile(path, 'utf8')) as T;
	} catch {
		return null;
	}
}

function parseOrNull(raw: unknown): AvalancheBulletin | null {
	try {
		return parseCaaml(raw);
	} catch (err) {
		console.error('[avalanche] Bericht nicht lesbar:', err);
		return null;
	}
}

/** Datum des neuesten echten Berichts - fuer den Hinweis auf die Saisonpause. */
export async function lastBulletinDate(): Promise<string | null> {
	return (await readJson<StoredBulletin>(LATEST_PATH))?.date ?? null;
}

/**
 * Alle vorliegenden echten Berichte, neuester zuerst. Welcher am Planungstag
 * gilt, entscheidet bulletinFor() in $lib/logic/dayPlan - auch im Browser.
 *
 * Im Live-Modus wird zusaetzlich direkt bei avalanche.report nachgefragt,
 * wenn der Abzug fuer heute und morgen nichts Gueltiges hat.
 */
export async function loadBulletins(now = new Date()): Promise<AvalancheBulletin[]> {
	return cached('lawine:berichte', config.cacheTtlMs, async () => {
		const aktuell = await readJson<{ bulletins?: StoredBulletin[] }>(AKTUELL_PATH);
		const latest = await readJson<StoredBulletin>(LATEST_PATH);
		const stored = [...(aktuell?.bulletins ?? []), ...(latest ? [latest] : [])];
		const parsed = stored.map((s) => parseOrNull(s.bulletin)).filter((b): b is AvalancheBulletin => b !== null);

		if (config.mode === 'live' && !parsed.some((b) => new Date(b.validUntil).getTime() > now.getTime())) {
			parsed.push(...(await fetchLive(now)));
		}

		// Doppelte (latest.json ist meist auch in aktuell.json) entfernen, neuester zuerst
		const unique = new Map(parsed.map((b) => [b.validUntil, b]));
		return [...unique.values()].sort((a, b) => b.validUntil.localeCompare(a.validUntil));
	});
}

async function fetchLive(now: Date): Promise<AvalancheBulletin[]> {
	const found: AvalancheBulletin[] = [];
	// Der Bericht fuer morgen erscheint um 17 Uhr im Ordner von morgen.
	for (const offset of [1, 0]) {
		const tag = new Date(now.getTime() + offset * 86_400_000).toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
		try {
			const res = await fetch(`${config.avalancheBaseUrl}/${tag}/${tag}-AT-07.json`, {
				headers: { accept: 'application/json' },
				signal: AbortSignal.timeout(10_000)
			});
			if (!res.ok) continue;
			const bulletin = parseOrNull(await res.json());
			if (bulletin) found.push(bulletin);
		} catch (err) {
			console.error('[avalanche] Lagebericht nicht verfuegbar:', err);
		}
	}
	return found;
}

interface RegionRating {
	regions: string[];
	above: DangerLevel;
	below: DangerLevel;
	boundary: number | null;
	aspects: Aspect[];
	problems: AvalancheProblem[];
	highlights: string | null;
}

function readBulletin(bulletin: any): RegionRating {
	const ratings: any[] = bulletin?.dangerRatings ?? [];
	if (ratings.length === 0) throw new Error('Bulletin ohne Gefahrenstufe');

	const level = (value: unknown): DangerLevel => {
		const mapped = LEVEL_BY_NAME[String(value)];
		// Unbekannter Wert: lieber abbrechen als ihn als Stufe 0 gruen zu zeigen.
		if (mapped === undefined) throw new Error(`Unbekannte Gefahrenstufe: ${String(value)}`);
		return mapped;
	};

	// Im Fruehjahr gibt es getrennte Stufen fuer Vormittag und Nachmittag
	// (validTimePeriod "earlier"/"later"). Eine Tour dauert in den Nachmittag
	// hinein - darum zaehlt je Hoehenband die hoehere Stufe.
	const upper = ratings.filter((r) => r?.elevation?.lowerBound !== undefined);
	const lower = ratings.filter((r) => r?.elevation?.upperBound !== undefined);
	const whole = ratings.filter((r) => !r?.elevation || (r.elevation.lowerBound === undefined && r.elevation.upperBound === undefined));
	const worst = (list: any[]) => Math.max(...list.map((r) => level(r?.mainValue))) as DangerLevel;

	const aboveList = upper.length ? upper : whole.length ? whole : ratings;
	const belowList = lower.length ? lower : aboveList;

	return {
		regions: (bulletin.regions ?? []).map((r: any) => String(r?.regionID ?? '')),
		above: worst([...aboveList, ...whole]),
		below: worst([...belowList, ...whole]),
		boundary: parseElevation(upper[0]?.elevation?.lowerBound, 'lower') ?? parseElevation(lower[0]?.elevation?.upperBound, 'upper'),
		aspects: [...new Set(aboveList.flatMap((r) => (r?.aspects ?? []) as Aspect[]))],
		problems: (bulletin.avalancheProblems ?? []).map(
			(p: any): AvalancheProblem => ({
				type: p?.problemType ?? 'unknown',
				aspects: (p?.aspects ?? []) as Aspect[],
				elevationAbove: parseElevation(p?.elevation?.lowerBound, 'lower'),
				elevationBelow: parseElevation(p?.elevation?.upperBound, 'upper')
			})
		),
		highlights: bulletin.highlights ?? bulletin.avalancheActivity?.highlights ?? null
	};
}

/**
 * Uebersetzt ein CAAMLv6-Dokument (EAWS) in das interne Modell.
 *
 * Tirol ist in Mikroregionen geteilt, und das Dokument enthaelt ein Bulletin je
 * Regionsgruppe - oft mit verschiedenen Stufen. byRegion haelt die
 * Einschaetzung je Mikroregion; rating und problems oben sind die
 * unguenstigste aller Tiroler Bulletins (hoechste Stufe ober- und unterhalb,
 * tiefste Hoehengrenze, alle Gefahrenmuster) - fuer Touren ohne Region.
 */
export function parseCaaml(raw: unknown): AvalancheBulletin {
	const doc = raw as Record<string, any>;
	const list: any[] = Array.isArray(doc?.bulletins) ? doc.bulletins : Array.isArray(doc) ? doc : [];
	const tirol = list.filter((b) =>
		(b?.regions ?? []).some((r: any) => String(r?.regionID ?? '').startsWith(REGION_ID))
	);
	if (tirol.length === 0) throw new Error('Kein Tiroler Bulletin im CAAML-Dokument gefunden');

	const parts = tirol.map(readBulletin);
	const max = (values: DangerLevel[]) => Math.max(...values) as DangerLevel;
	const boundaries = parts.map((p) => p.boundary).filter((b): b is number => b !== null);

	return {
		kind: 'echt',
		regionId: REGION_ID,
		regionName: parts.length > 1 ? `Tirol (ungünstigste von ${parts.length} Regionen)` : 'Tirol',
		publishedAt: requireTime(tirol[0].publicationTime, 'publicationTime'),
		validUntil: requireTime(tirol[0].validTime?.endTime, 'validTime.endTime'),
		rating: {
			above: max(parts.map((p) => p.above)),
			below: max(parts.map((p) => p.below)),
			elevationBoundary: boundaries.length ? Math.min(...boundaries) : null,
			aspects: [...new Set(parts.flatMap((p) => p.aspects))]
		},
		problems: parts.flatMap((p) => p.problems),
		byRegion: Object.fromEntries(
			parts.flatMap((p) =>
				p.regions
					.filter((id) => id.startsWith(REGION_ID))
					.map((id) => [
						id,
						{
							rating: { above: p.above, below: p.below, elevationBoundary: p.boundary, aspects: p.aspects },
							problems: p.problems
						}
					])
			)
		),
		summary:
			parts.find((p) => p.highlights)?.highlights ??
			'Details siehe Originalbericht des Lawinenwarndienstes Tirol.',
		source: 'Lawinenwarndienst Tirol / EAWS (CAAMLv6)'
	};
}

/**
 * Hoehenangabe aus CAAML. "treeline" (Waldgrenze) liegt in Tirol irgendwo
 * zwischen 1800 und 2200 m - ausgelegt wird sie immer zur sicheren Seite:
 * "oberhalb der Waldgrenze" ab 1800 m, "unterhalb der Waldgrenze" bis 2200 m.
 * So faellt keine Tour durch die Unschaerfe aus einer Warnung heraus.
 */
export function parseElevation(value: unknown, bound: 'lower' | 'upper'): number | null {
	if (value === undefined || value === null) return null;
	if (typeof value === 'number') return value;
	const text = String(value).toLowerCase();
	if (text === 'treeline') return bound === 'lower' ? 1800 : 2200;
	const parsed = Number.parseInt(text, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

/** Ohne Gueltigkeitszeitraum ist ein Bericht nicht verwendbar - nicht "ab jetzt". */
function requireTime(value: unknown, name: string): string {
	if (typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) {
		throw new Error(`Bericht ohne gueltiges ${name}`);
	}
	return value;
}
