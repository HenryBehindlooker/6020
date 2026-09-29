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
	get geosphereBaseUrl(): string {
		return env.GEOSPHERE_BASE_URL || 'https://dataset.api.hub.geosphere.at/v1';
	},
	get vvtRealtimeUrl(): string {
		return env.VVT_GTFS_RT_URL || '';
	},
	get vvtApiKey(): string {
		return env.VVT_API_KEY || '';
	},
	get cacheTtlMs(): number {
		return Number(env.CACHE_TTL_SECONDS || 900) * 1000;
	}
};
