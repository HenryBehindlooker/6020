import { describe, expect, it } from 'vitest';
import { parsePlanParams, planQuery } from './planParams';

const p = (q: string) => parsePlanParams(new URLSearchParams(q));

describe('parsePlanParams', () => {
	it('nimmt gueltige Werte', () => {
		expect(p('ab=10:15&puffer=60')).toEqual({ notBefore: '10:15', bufferMinutes: 60, custom: true });
	});

	it('faellt ohne Angaben auf den Standard zurueck', () => {
		expect(p('')).toEqual({ notBefore: '07:00', bufferMinutes: 30, custom: false });
		expect(parsePlanParams(null).notBefore).toBe('07:00');
	});

	it('verwirft unsinnige Uhrzeiten', () => {
		expect(p('ab=25:00').notBefore).toBe('07:00');
		expect(p('ab=7:00').notBefore).toBe('07:00');
		expect(p('ab=<script>').notBefore).toBe('07:00');
	});

	it('verwirft Puffer, die den Server abstuerzen liessen', () => {
		expect(p('puffer=1e12').bufferMinutes).toBe(30);
		expect(p('puffer=-5').bufferMinutes).toBe(30);
		expect(p('puffer=999').bufferMinutes).toBe(30);
		expect(p('puffer=abc').bufferMinutes).toBe(30);
	});

	it('erlaubt 0 Minuten Puffer', () => {
		expect(p('puffer=0').bufferMinutes).toBe(0);
	});
});

describe('planQuery', () => {
	it('gibt nur Abweichungen vom Standard weiter', () => {
		expect(planQuery({ notBefore: '07:00', bufferMinutes: 30 })).toBe('');
		expect(planQuery({ notBefore: '09:30', bufferMinutes: 30 })).toBe('?ab=09%3A30');
		expect(planQuery({ notBefore: '07:00', bufferMinutes: 45 })).toBe('?puffer=45');
	});
});
