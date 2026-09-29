/**
 * Bargeld-Hinweis fuer Huetten aus den OSM-Tags payment:*.
 *
 * Viele Huetten nehmen nur Bargeld, und am Berg gibt es keinen Bankomaten.
 * Fehlt die Angabe, raet die App darum zu Bargeld, statt "Karte" zu vermuten.
 */

export type PaymentKind = 'nur-bar' | 'karte' | 'unbekannt';

export interface PaymentInfo {
	kind: PaymentKind;
	text: string;
}

const CARD_KEYS = [
	'payment:cards',
	'payment:debit_cards',
	'payment:credit_cards',
	'payment:maestro',
	'payment:girocard',
	'payment:v_pay',
	'payment:visa',
	'payment:mastercard',
	'payment:contactless',
	'payment:apple_pay',
	'payment:google_pay'
];

export function paymentInfo(tags: Record<string, unknown>): PaymentInfo {
	const val = (k: string) => (typeof tags[k] === 'string' ? (tags[k] as string).trim().toLowerCase() : null);
	const cash = val('payment:cash') ?? val('payment:coins');
	const cards = CARD_KEYS.map(val).filter((v): v is string => v !== null);

	if (cash === 'only' || (cash === 'yes' && cards.length > 0 && cards.every((v) => v === 'no'))) {
		return { kind: 'nur-bar', text: 'Nur Bargeld' };
	}
	if (cards.some((v) => v === 'yes')) {
		return { kind: 'karte', text: 'Kartenzahlung möglich' };
	}
	if (cards.length > 0 && cards.every((v) => v === 'no')) {
		return { kind: 'nur-bar', text: 'Keine Kartenzahlung' };
	}
	return { kind: 'unbekannt', text: 'Zahlungsart unbekannt – Bargeld mitnehmen' };
}
