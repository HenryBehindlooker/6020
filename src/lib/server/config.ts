import { env } from '$env/dynamic/private';

export type DataMode = 'demo' | 'live';

export const config = {
	get mode(): DataMode {
		return env.DATA_MODE === 'live' ? 'live' : 'demo';
	},
	/** Verzeichnis der Tagesordner; die Datei heisst <Tag>/<Tag>-AT-07.json. */
	get avalancheBaseUrl(): string {
		return (env.AVALANCHE_BASE_URL || 'https://static.avalanche.report/eaws_bulletins').replace(/\/$/, '');
	},
	get cacheTtlMs(): number {
		return Number(env.CACHE_TTL_SECONDS || 900) * 1000;
	}
};
