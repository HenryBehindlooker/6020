import { defineEnvVars } from '@sveltejs/kit/env';

/**
 * Umgebungsvariablen (siehe .env.example). Fehlt eine, ist sie leer - jede
 * Stelle, die sie liest, hat dafuer einen sicheren Standard: DATA_MODE leer
 * heisst Demo, AVALANCHE_BASE_URL leer die Adresse von avalanche.report,
 * TRACKS_DIR leer data/tracks, die Kachel-Variablen leer OpenStreetMap.
 */
export const variables = defineEnvVars({
	BUILD_TARGET: { schema: (input) => input ?? '' },
	DATA_MODE: { schema: (input) => input ?? '' },
	AVALANCHE_BASE_URL: { schema: (input) => input ?? '' },
	CACHE_TTL_SECONDS: { schema: (input) => input ?? '' },
	TRACKS_DIR: { schema: (input) => input ?? '' },
	PUBLIC_TILE_URL: { public: true, schema: (input) => input ?? '' },
	PUBLIC_TILE_ATTRIBUTION: { public: true, schema: (input) => input ?? '' }
});
