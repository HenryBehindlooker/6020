import { readFile } from 'node:fs/promises';
import type { WeatherSnapshot } from '#lib/logic/weather.js';
import { cached } from '#lib/server/cache.js';
import { config } from '#lib/server/config.js';

/** Von scripts/fetch/weather.py geschrieben: stuendliche GeoSphere-Prognose je Gipfel. */
const SNAPSHOT_PATH = 'data/wetter/prognose.json';

/**
 * Die Wetterprognose aus dem Abzug des Runners. Ausgewertet je Planungstag
 * wird sie in $lib/logic/weather - auf dem Server wie im Browser.
 */
export async function loadWeatherSnapshot(): Promise<WeatherSnapshot | null> {
	return cached('wetter:snapshot', config.cacheTtlMs, async () => {
		try {
			const snapshot = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8')) as WeatherSnapshot;
			return snapshot.timestamps?.length && Object.keys(snapshot.points ?? {}).length ? snapshot : null;
		} catch {
			return null;
		}
	});
}
