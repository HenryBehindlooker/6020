import type { PageServerLoad } from './$types';
import { buildDayPlan } from '$lib/server/plan';

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const notBefore = url.searchParams.get('ab') ?? undefined;
	const buffer = Number(url.searchParams.get('puffer') ?? '');

	const plan = await buildDayPlan({
		notBefore: /^\d{2}:\d{2}$/.test(notBefore ?? '') ? notBefore : undefined,
		bufferMinutes: Number.isFinite(buffer) && buffer > 0 ? buffer : undefined
	});

	setHeaders({ 'cache-control': 'public, max-age=300' });

	return { plan, notBefore: notBefore ?? '07:00', buffer: buffer > 0 ? buffer : 30 };
};
