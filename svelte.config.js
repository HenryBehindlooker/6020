import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';

// Zwei Ziele aus derselben Quelle:
// - Standard: Node-Server mit Live-Daten (DATA_MODE=live)
// - BUILD_TARGET=pages: vorgerenderte Demo-Fassung fuer GitHub Pages
const pages = process.env.BUILD_TARGET === 'pages';

/** @type {import('@sveltejs/kit').Config} */
export default {
	kit: {
		adapter: pages ? adapterStatic({ strict: true }) : adapterNode(),
		// Projektseiten liegen unter /<repo>, darum ein Basispfad.
		paths: { base: process.env.BASE_PATH || '' },
		alias: { $fixtures: 'src/fixtures' }
	}
};
