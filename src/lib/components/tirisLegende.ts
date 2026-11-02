/**
 * Legenden der Kartenebenen des Landes Tirol (tiris), aus der Legende des
 * Kartendienstes uebernommen (data/probe/tiefe.json) - nicht nachgezeichnet.
 */

/** Hangneigung fuer Wintersportler: Farben der Klassen; unter 30 Grad durchsichtig. */
export const NEIGUNG_KLASSEN = [
	{ label: '30–35°', farbe: '#ffff00' },
	{ label: '35–40°', farbe: '#ffa100' },
	{ label: 'ab 40°', farbe: '#ff0000' }
] as const;

/** Symbol der Wald- und Wildschutzzonen, wie es der Dienst liefert. */
export const WILDSCHUTZ_SYMBOL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAc0lEQVQ4je2USwrAIAwFR/BiOZPn8Ew5ml2o/VhKP0l3zsqXoIQREotqQoQVVSw5HppGAuTo9hpQIEVUz52xdpd3uE5YHxwFf6HdCyJODttQ1w4NTId2pkM7PzuEzWOvP8ltyfrtw73DALkHqD/1NvczwAK+A0THj30WzgAAAABJRU5ErkJggg==';
