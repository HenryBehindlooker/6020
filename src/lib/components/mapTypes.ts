import type { Signal } from '$lib/logic/rating';

export interface MapMarker {
	lat: number;
	lon: number;
	signal: Signal;
	label: string;
	/** Zeile unter dem Titel im Popup. */
	sub?: string;
	/** Zusaetzliche Zeilen im Popup, jeweils mit eigenem Link. */
	links?: { text: string; href: string; signal: Signal }[];
	/** Zahl im Marker - z.B. wie viele Touren ab hier starten. */
	count?: number;
}
