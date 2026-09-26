import type { PageServerLoad } from './$types';
import { building } from '$app/environment';
import { buildDayPlan } from '$lib/server/plan';

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const notBefore = building ? undefined : (url.searchParams.get('ab') ?? undefined);
	const buffer = building ? NaN : Number(url.searchParams.get('puffer') ?? '');

	const plan = await buildDayPlan({
		notBefore: /^\d{2}:\d{2}$/.test(notBefore ?? '') ? notBefore : undefined,
		bufferMinutes: Number.isFinite(buffer) && buffer > 0 ? buffer : undefined
	});

	setHeaders({ 'cache-control': 'public, max-age=300' });

	return {
		plan,
		notBefore: notBefore ?? '07:00',
		buffer: buffer > 0 ? buffer : 30,
		// In der vorgerenderten Fassung kann das Formular nichts neu berechnen.
		staticPreview: building,
		transit: {
			real: plan.tours.some((t) => t.transit.source.startsWith('Transitous,')),
			demo: plan.tours.some((t) => t.transit.source.startsWith('Demo')),
			stand: plan.tours.find((t) => t.transit.source.startsWith('Transitous,'))?.transit.source ?? null
		}
	};
};
