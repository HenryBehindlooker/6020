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
 * Laedt den Lawinenlagebericht.
 *
 * Demo-Modus: mitgelieferter Beispielbericht. Live-Modus: der echte Bericht -
 * und wenn der nicht zu bekommen ist, null. Niemals still auf Demodaten
 * ausweichen: ein erfundener Bericht, der wie ein echter aussieht, ist
 * gefaehrlicher als gar keiner. Ohne Bericht zeigt die Ampel "unklar".
 */
export async function getBulletin(now = new Date()): Promise<AvalancheBulletin | null> {
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
			console.error('[avalanche] Lagebericht nicht verfuegbar:', err);
			return null;
		}
	});
}

interface RegionRating {
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

	const above = ratings.find((r) => r?.elevation?.lowerBound !== undefined) ?? ratings[0];
	const below = ratings.find((r) => r?.elevation?.upperBound !== undefined) ?? above;

	return {
		above: level(above?.mainValue),
		below: level(below?.mainValue),
		boundary: parseElevation(above?.elevation?.lowerBound ?? below?.elevation?.upperBound),
		aspects: (above?.aspects ?? []) as Aspect[],
		problems: (bulletin.avalancheProblems ?? []).map(
			(p: any): AvalancheProblem => ({
				type: p?.problemType ?? 'unknown',
				aspects: (p?.aspects ?? []) as Aspect[],
				elevationAbove: parseElevation(p?.elevation?.lowerBound),
				elevationBelow: parseElevation(p?.elevation?.upperBound)
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
		summary:
			parts.find((p) => p.highlights)?.highlights ??
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
			'Frischer Triebschnee ist die Hauptgefahr. Störanfällig sind kammnahe Bereiche der Expositionen Nordwest über Nord bis Ost oberhalb von 2200 m.',
		source: 'Demodaten im Format des Lawinenwarndienstes Tirol'
	};
}
