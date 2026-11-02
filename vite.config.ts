import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// Zwei Ziele aus derselben Quelle:
// - Standard: Node-Server mit Live-Daten (DATA_MODE=live)
// - BUILD_TARGET=pages: vorgerenderte Demo-Fassung fuer GitHub Pages
const pages = process.env.BUILD_TARGET === 'pages';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: pages ? adapterStatic({ strict: true }) : adapterNode(),
			// Projektseiten liegen unter /<repo>, darum ein Basispfad.
			paths: { base: (process.env.BASE_PATH || '') as '' | `/${string}` }
		})
	],
	test: { include: ['src/**/*.test.ts'] }
});
