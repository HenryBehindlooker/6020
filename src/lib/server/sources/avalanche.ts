import type { Aspect, AvalancheBulletin, AvalancheProblem, DangerLevel } from '$lib/types';
import { cached } from '$lib/server/cache';
import { config } from '$lib/server/config';
import { viennaTime } from '$lib/logic/time';

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

/**
 * Laedt den Lawinenlagebericht. Im Demo-Modus - und wenn die Quelle nicht
 * erreichbar ist - wird ein mitgelieferter Beispielbericht zurueckgegeben.
 */
export async function getBulletin(now = new Date()): Promise<AvalancheBulletin> {
	if (config.mode === 'demo') return demoBulletin(now);

	return cached('bulletin', config.cacheTtlMs, async () => {
		try {
			const res = await fetch(config.avalancheUrl, {
				headers: { accept: 'application/json' },
				signal: AbortSignal.timeout(10_000)
			});
			if (!res.ok) throw new Error(`Lagebericht antwortete mit ${res.status}`);
			return parseCaaml(await res.json(), now);
		} catch (err) {
			console.error('[avalanche] Live-Abruf fehlgeschlagen, nutze Demodaten:', err);
			return demoBulletin(now);
		}
	});
}

/**
 * Uebersetzt ein CAAMLv6-Bulletin (EAWS) in das interne Modell. Die Quelle
 * liefert eine Liste von Bulletins - eines pro Regionsgruppe; wir nehmen das
 * erste, das die Region Tirol enthaelt.
 */
export function parseCaaml(raw: unknown, now = new Date()): AvalancheBulletin {
	const doc = raw as Record<string, any>;
	const list: any[] = Array.isArray(doc?.bulletins) ? doc.bulletins : Array.isArray(doc) ? doc : [];
	const bulletin =
		list.find((b) =>
			(b?.regions ?? []).some((r: any) => String(r?.regionID ?? '').startsWith(REGION_ID))
		) ?? list[0];

	if (!bulletin) throw new Error('Kein Bulletin im CAAML-Dokument gefunden');

	const ratings: any[] = bulletin.dangerRatings ?? [];
	const above = ratings.find((r) => r?.elevation?.lowerBound !== undefined) ?? ratings[0];
	const below = ratings.find((r) => r?.elevation?.upperBound !== undefined);
	const boundary = parseElevation(above?.elevation?.lowerBound ?? below?.elevation?.upperBound);

	return {
		regionId: REGION_ID,
		regionName: bulletin.regions?.[0]?.name ?? 'Tirol',
		publishedAt: bulletin.publicationTime ?? now.toISOString(),
		validUntil: bulletin.validTime?.endTime ?? now.toISOString(),
		rating: {
			above: LEVEL_BY_NAME[above?.mainValue] ?? 0,
			below: LEVEL_BY_NAME[below?.mainValue ?? above?.mainValue] ?? 0,
			elevationBoundary: boundary,
			aspects: (above?.aspects ?? []) as Aspect[]
		},
		problems: (bulletin.avalancheProblems ?? []).map(
			(p: any): AvalancheProblem => ({
				type: p?.problemType ?? 'unknown',
				aspects: (p?.aspects ?? []) as Aspect[],
				elevationAbove: parseElevation(p?.elevation?.lowerBound),
				elevationBelow: parseElevation(p?.elevation?.upperBound)
			})
		),
		summary:
			bulletin.highlights ??
			bulletin.avalancheActivity?.highlights ??
			'Details siehe Originalbericht des Lawinenwarndienstes Tirol.',
		source: 'Lawinenwarndienst Tirol / EAWS (CAAMLv6)'
	};
}

/** CAAML erlaubt "treeline" statt einer Zahl. */
function parseElevation(value: unknown): number | null {
	if (value === undefined || value === null) return null;
	if (typeof value === 'number') return value;
	const text = String(value).toLowerCase();
	if (text === 'treeline') return 2000;
	const parsed = Number.parseInt(text, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

/** Beispielbericht: erhebliche Lage mit Triebschneeproblem in Nordsektoren. */
export function demoBulletin(now = new Date()): AvalancheBulletin {
	const end = viennaTime(now, '17:00');

	return {
		regionId: REGION_ID,
		regionName: 'Tirol (Demodaten)',
		publishedAt: now.toISOString(),
		validUntil: end.toISOString(),
		rating: { above: 3, below: 2, elevationBoundary: 2200, aspects: ['N', 'NE', 'E', 'NW'] },
		problems: [
			{ type: 'wind_slab', aspects: ['N', 'NE', 'E', 'NW'], elevationAbove: 2200, elevationBelow: null },
			{ type: 'persistent_weak_layer', aspects: ['N', 'NW', 'W'], elevationAbove: 2400, elevationBelow: null }
		],
		summary:
			'Frischer Triebschnee ist die Hauptgefahr. Stoeranfaellig sind kammnahe Bereiche der Expositionen Nordwest ueber Nord bis Ost oberhalb von 2200 m.',
		source: 'Demodaten im Format des Lawinenwarndienstes Tirol'
	};
}
