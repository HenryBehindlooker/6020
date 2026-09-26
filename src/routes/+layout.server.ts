import { env } from '$env/dynamic/private';

/**
 * Nur die statische Demo-Fassung fuer GitHub Pages wird vorgerendert. Der
 * Node-Server rechnet weiterhin pro Anfrage - sonst haette er die Lawinenlage
 * und die Fahrzeiten vom Build-Zeitpunkt eingefroren.
 */
export const prerender = env.BUILD_TARGET === 'pages';
