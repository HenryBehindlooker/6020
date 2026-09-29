import type { Signal } from '$lib/logic/rating';

/**
 * Texte der Oberflaeche - mit Innsbrucker Einschlag.
 *
 * Regel: Dialekt fuer Ueberschriften, Knoepfe und die Ampel. Warnungen,
 * Sicherheitshinweise und Begruendungen bleiben in klarem Hochdeutsch - wer am
 * Berg eine Warnung liest, soll nicht ueber die Schreibweise stolpern, und
 * Gaeste von auswaerts sollen sie genauso verstehen. Screenreader bekommen die
 * Ampel auf Hochdeutsch (aria-label).
 */

export const SIGNAL_TEXT: Record<Signal, { kurz: string; hochdeutsch: string }> = {
	gruen: { kurz: 'Geat', hochdeutsch: 'Geht' },
	gelb: { kurz: 'Heikl', hochdeutsch: 'Heikel' },
	rot: { kurz: 'Heit nit', hochdeutsch: 'Heute nicht' },
	unbekannt: { kurz: 'Unklar', hochdeutsch: 'Unklar - keine Bewertung möglich' }
};

export const TEXT = {
	titel: 'Bergampel',
	untertitel: 'Innsbruck',
	frage: 'Wos geat heit?',
	nav: { touren: 'Touren', karte: 'Karte', radl: 'Radl', taeler: 'Täler', methodik: 'Wia grechnet wird' },
	gruppeGeht: 'Des geat si aus',
	gruppeNicht: 'Heit lei nit',
	leerGeht: 'Heit geat si leider nix aus. Schau morgen wieder vorbei.',
	aufbruch: 'Wann geat\'s los?',
	puffer: 'Puffer bis zum Bus',
	rechnen: 'Nochamol rechnen',
	letzterBus: 'Letzter Bus',
	umkehr: 'Umkehrn um',
	warum: 'Warum de Ampel?',
	zeitplan: 'Zeitplan',
	bergwetter: 'Bergwetter',
	lage: 'Wo\'s is',
	einkehr: 'Einkehrn',
	hoamfahrn: 'Hoamfahrn',
	zurueck: 'Zruck zu de Touren',
	pfiati: 'Pfiat di - und kimm guat hoam.',
	obacht: 'Obacht!'
} as const;
