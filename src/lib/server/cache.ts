interface Entry<T> {
	value: T;
	expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

/**
 * Haelt Antworten der externen APIs kurz im Speicher. Der Lagebericht wird
 * zweimal taeglich aktualisiert, die Fahrplaene stuendlich - dauernd neu zu
 * laden waere unhoeflich gegenueber den Datenanbietern.
 */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
	const hit = store.get(key) as Entry<T> | undefined;
	if (hit && hit.expiresAt > Date.now()) return hit.value;

	const value = await load();
	store.set(key, { value, expiresAt: Date.now() + ttlMs });
	return value;
}

export function clearCache(): void {
	store.clear();
}
