import type { PageServerLoad } from './$types';
import { getBikeRoutes, getOsmSource } from '$lib/server/sources/osm';

export const load: PageServerLoad = async () => {
	const [routes, source] = await Promise.all([getBikeRoutes(), getOsmSource()]);
	return { routes, osmStand: source?.fetched_at ?? null };
};
