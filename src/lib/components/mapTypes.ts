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
	/** Ausgangspunkt (Kreis) oder Gipfel (Dreieck). */
	shape?: 'punkt' | 'gipfel';
}

export interface MapTrack {
	/** Punkte als [lat, lon]. */
	points: [number, number][];
	signal: Signal;
	label: string;
	/** Schematischer Verlauf: wird gestrichelt gezeichnet und als solcher benannt. */
	schematic: boolean;
	href?: string;
}
