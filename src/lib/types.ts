/** Himmelsrichtungen wie im Lawinenlagebericht (EAWS). */
export type Aspect = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export const ALL_ASPECTS: Aspect[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Gefahrenstufe 1-5 der Europaeischen Lawinengefahrenskala. 0 = kein Bericht. */
export type DangerLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface DangerRating {
	/** Gefahrenstufe unterhalb der Hoehengrenze. */
	below: DangerLevel;
	/** Gefahrenstufe oberhalb der Hoehengrenze. */
	above: DangerLevel;
	/** Hoehengrenze in Metern; null = einheitliche Stufe. */
	elevationBoundary: number | null;
	aspects: Aspect[];
}

export interface AvalancheProblem {
	/** EAWS-Problemtyp, z.B. "wind_slab", "persistent_weak_layer". */
	type: string;
	aspects: Aspect[];
	elevationAbove: number | null;
	elevationBelow: number | null;
}

export interface AvalancheBulletin {
	regionId: string;
	regionName: string;
	/** ISO-Zeitpunkt der Veroeffentlichung. */
	publishedAt: string;
	validUntil: string;
	rating: DangerRating;
	problems: AvalancheProblem[];
	/** Kurzfassung des Berichts (Originaltext des Lawinenwarndienstes). */
	summary: string;
	source: string;
}

export interface WeatherForecast {
	/** Bezugshoehe der Werte in Metern. */
	referenceAltitude: number;
	/** Mittlere Windgeschwindigkeit auf Kammhoehe in km/h. */
	windSpeedKmh: number;
	windGustsKmh: number;
	windDirection: Aspect;
	/** Neuschnee der letzten 24 h in cm. */
	newSnow24hCm: number;
	/** Temperatur auf Bezugshoehe in Grad Celsius. */
	temperatureC: number;
	/** Bewoelkung in Prozent. */
	cloudCoverPct: number;
	/** Niederschlagswahrscheinlichkeit in Prozent. */
	precipProbabilityPct: number;
	source: string;
}

export interface Departure {
	/** Liniennummer bzw. -kuerzel, z.B. "4166" oder "J". */
	line: string;
	/** Fahrtziel laut Aushang. */
	headsign: string;
	/** Abfahrt als ISO-Zeitpunkt. */
	departure: string;
	/** Ankunft am Zielhalt als ISO-Zeitpunkt. */
	arrival: string;
	/** Verspaetung in Minuten aus GTFS-RT; null wenn keine Echtzeitdaten. */
	delayMinutes: number | null;
}

export interface TransitConnection {
	/** Halt in Innsbruck, von dem die Hinfahrt startet. */
	originStop: string;
	/** Halt am Ausgangspunkt der Tour. */
	destinationStop: string;
	outbound: Departure[];
	inbound: Departure[];
	source: string;
}

export interface Tour {
	id: string;
	name: string;
	/** Talort / Ausgangspunkt. */
	trailhead: string;
	trailheadStop: string;
	lat: number;
	lon: number;
	summitAltitude: number;
	trailheadAltitude: number;
	ascentMeters: number;
	/** Reine Aufstiegszeit in Minuten. */
	ascentMinutes: number;
	/** Reine Abstiegszeit in Minuten. */
	descentMinutes: number;
	/** Exponierte Hangrichtungen der Schluesselstellen. */
	aspects: Aspect[];
	/** Steilheit der steilsten Passage in Grad. */
	steepnessMax: number;
	type: 'skitour' | 'winterwanderung' | 'schneeschuh';
	description: string;
	/** Gipfel bzw. Ziel laut OpenStreetMap (scripts/verify_tours.py). */
	summit?: {
		name: string;
		lat: number;
		lon: number;
		ele: number | null;
		osm: string | null;
	};
	/** OSM-Referenz der Haltestelle am Ausgangspunkt. */
	trailheadOsm?: string | null;
	/** Was belegt ist und was Richtwert bleibt. */
	verification?: {
		osm: string;
		estimate: string;
	};
}
