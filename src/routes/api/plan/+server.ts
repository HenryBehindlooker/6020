import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildDayPlan } from '$lib/server/plan';

/** JSON-Sicht auf denselben Tagesplan - fuer Widgets, Bots oder eine native App. */
export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const notBefore = url.searchParams.get('ab') ?? undefined;
	const buffer = Number(url.searchParams.get('puffer') ?? '');

	const plan = await buildDayPlan({
		notBefore: /^\d{2}:\d{2}$/.test(notBefore ?? '') ? notBefore : undefined,
		bufferMinutes: Number.isFinite(buffer) && buffer > 0 ? buffer : undefined
	});

	setHeaders({ 'cache-control': 'public, max-age=300' });
	return json(plan);
};
