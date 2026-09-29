import { describe, expect, it } from 'vitest';
import { paymentInfo } from './payment';

describe('paymentInfo', () => {
	it('nur Bargeld', () => {
		expect(paymentInfo({ 'payment:cash': 'only' }).kind).toBe('nur-bar');
		expect(paymentInfo({ 'payment:cash': 'yes', 'payment:debit_cards': 'no', 'payment:credit_cards': 'no' }).kind).toBe('nur-bar');
		expect(paymentInfo({ 'payment:cards': 'no' }).kind).toBe('nur-bar');
	});
	it('Karte, sobald eine Kartenart ja sagt', () => {
		expect(paymentInfo({ 'payment:cash': 'yes', 'payment:debit_cards': 'yes', 'payment:credit_cards': 'no' }).kind).toBe('karte');
		expect(paymentInfo({ 'payment:maestro': 'yes' }).kind).toBe('karte');
	});
	it('ohne Angabe: Bargeld empfehlen', () => {
		const info = paymentInfo({ name: 'Arzler Alm' });
		expect(info.kind).toBe('unbekannt');
		expect(info.text).toMatch(/Bargeld mitnehmen/);
		expect(paymentInfo({ 'payment:cash': 'yes' }).kind).toBe('unbekannt');
	});
});
