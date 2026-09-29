import type { Aspect, AvalancheBulletin, AvalancheProblem, DangerLevel } from '$lib/types';
import { cached } from '$lib/server/cache';
import { config } from '$lib/server/config';
import { readFile } from 'node:fs/promises';
import { TIME_ZONE, viennaTime } from '$lib/logic/time';

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
const SNAPSHOT_PATH = 'data/lawine/latest.json';

interface Snapshot {
	date: string;
	bulletin: unknown;
	fetched_at?: string;
}

async function loadSnapshot(): Promise<Snapshot | null> {
	return cached('lawine:snapshot', config.cacheTtlMs, async () => {
		try {
			return JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8')) as Snapshot;
		} catch {
			return null;
		}
	});
}

/**
 * Nur ein gueltiger Bericht zaehlt als aktuelle Lage. Ein abgelaufener - etwa
 * der letzte vom Fruehjahr - wird nie als heutige Einschaetzung ausgegeben.
 */
export function currentBulletin(raw: unknown, now: Date): AvalancheBulletin | null {
	try {
		const bulletin = parseCaaml(raw, now);
		const start = new Date(bulletin.publishedAt).getTime();
		const end = new Date(bulletin.validUntil).getTime();
		return now.getTime() <= end && now.getTime() >= start - 24 * 3_600_000 ? bulletin : null;
	} catch (err) {
		console.error('[avalanche] Bericht nicht lesbar:', err);
		return null;
	}
}

/** Datum des letzten echten Berichts - fuer den Hinweis auf die Saisonpause. */
export async function lastBulletinDate(): Promise<string | null> {
	return (await loadSnapshot())?.date ?? null;
}

/**
 * Laedt den Lawinenlagebericht.
 *
 * 1. Gueltiger Bericht im Abzug des Runners: der gilt - auch in der
 *    oeffentlichen Demo-Fassung.
 * 2. Sonst im Demo-Modus: der mitgelieferte Beispielbericht.
 * 3. Sonst im Live-Modus: direkt bei avalanche.report nachfragen - und wenn
 *    das nichts bringt, null. Niemals still auf Demodaten ausweichen: ein
 *    erfundener Bericht, der wie ein echter aussieht, ist gefaehrlicher als
 *    gar keiner. Ohne Bericht zeigt die Ampel "unklar".
 */
export async function getBulletin(now = new Date()): Promise<AvalancheBulletin | null> {
	const snapshot = await loadSnapshot();
	const fromSnapshot = snapshot ? currentBulletin(snapshot.bulletin, now) : null;
	if (fromSnapshot) return fromSnapshot;

	if (config.mode === 'demo') return demoBulletin(now);

	return cached('bulletin', config.cacheTtlMs, async () => {
		// Der Bericht fuer morgen erscheint gegen 17 Uhr im Ordner von morgen.
		for (const offset of [1, 0]) {
			const tag = new Date(now.getTime() + offset * 86_400_000).toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
			try {
				const res = await fetch(`${config.avalancheBaseUrl}/${tag}/${tag}-AT-07.json`, {
					headers: { accept: 'application/json' },
					signal: AbortSignal.timeout(10_000)
				});
				if (!res.ok) continue;
				const bulletin = currentBulletin(await res.json(), now);
				if (bulletin) return bulletin;
			} catch (err) {
				console.error('[avalanche] Lagebericht nicht verfuegbar:', err);
			}
		}
		return null;
	});
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
 * Regionsgruppe - oft mit verschiedenen Stufen. Die Touren sind noch keiner
 * Mikroregion zugeordnet, darum gilt die unguenstigste Einschaetzung aller
 * Tiroler Bulletins: hoechste Stufe ober- und unterhalb, tiefste Hoehengrenze,
 * alle Gefahrenmuster. Lieber zu vorsichtig als eine Stufe zu niedrig.
 */
export function parseCaaml(raw: unknown, now = new Date()): AvalancheBulletin {
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
		publishedAt: tirol[0].publicationTime ?? now.toISOString(),
		validUntil: tirol[0].validTime?.endTime ?? now.toISOString(),
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

/** CAAML erlaubt "treeline" statt einer Zahl. */
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

/** Beispielbericht: erhebliche Lage mit Triebschneeproblem in Nordsektoren. */
export function demoBulletin(now = new Date()): AvalancheBulletin {
	const end = viennaTime(now, '17:00');

	return {
		kind: 'demo',
		regionId: REGION_ID,
		regionName: 'Tirol (Demodaten)',
		publishedAt: now.toISOString(),
		validUntil: end.toISOString(),
		rating: { above: 3, below: 2, elevationBoundary: 2200, aspects: ['N', 'NE', 'E', 'NW'] },
		problems: [
			{ type: 'wind_slab', aspects: ['N', 'NE', 'E', 'NW'], elevationAbove: 2200, elevationBelow: null },
			{ type: 'persistent_weak_layers', aspects: ['N', 'NW', 'W'], elevationAbove: 2400, elevationBelow: null }
		],
		summary:
			'Frischer Triebschnee ist die Hauptgefahr. Störanfällig sind kammnahe Bereiche der Expositionen Nordwest über Nord bis Ost oberhalb von 2200 m.',
		source: 'Demodaten im Format des Lawinenwarndienstes Tirol'
	};
}
