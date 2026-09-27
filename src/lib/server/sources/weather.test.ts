import { describe, expect, it } from 'vitest';
import { componentsToAspect, parseGeosphere } from './weather';

function antwort(params: Record<string, { unit?: string; data: number[] }>) {
	return { features: [{ properties: { parameters: params } }] };
}

const basis = {
	u10m: { unit: 'm s-1', data: [5, 5] },
	v10m: { unit: 'm s-1', data: [0, 0] },
	ugust: { unit: 'm s-1', data: [9, 9] },
	vgust: { unit: 'm s-1', data: [0, 0] },
	t2m: { unit: '°C', data: [-5.2, -6] },
	tcc: { unit: '%', data: [40, 50] }
};

describe('parseGeosphere', () => {
	it('liest Grad Celsius als Grad Celsius', () => {
		// Vorher wurde immer 273,15 abgezogen: -5,2 °C wurden zu -278,4 °C.
		expect(parseGeosphere(antwort(basis), 2000).temperatureC).toBe(-5.2);
	});

	it('rechnet Kelvin nur um, wenn die Antwort Kelvin sagt', () => {
		const k = antwort({ ...basis, t2m: { unit: 'K', data: [268.15] } });
		expect(parseGeosphere(k, 2000).temperatureC).toBe(-5);
	});

	it('nimmt den Neuschnee als 24-h-Zuwachs der aufsummierten Menge', () => {
		// snow_acc summiert seit Modellstart: 0 ... 32 mm nach 24 h
		const data = Array.from({ length: 30 }, (_, h) => (h <= 24 ? h * (32 / 24) : 32));
		const r = parseGeosphere(antwort({ ...basis, snow_acc: { unit: 'kg m-2', data } }), 2000);
		expect(r.newSnow24hCm).toBe(32);
	});

	it('meldet 0 cm, wenn nicht geschneit wird', () => {
		const r = parseGeosphere(antwort({ ...basis, snow_acc: { data: [0, 0, 0] } }), 2000);
		expect(r.newSnow24hCm).toBe(0);
	});

	it('rechnet Wind in km/h und nennt die Herkunftsrichtung', () => {
		const r = parseGeosphere(antwort(basis), 2000);
		expect(r.windSpeedKmh).toBe(18);
		expect(r.windGustsKmh).toBe(32);
		// u = +5 heisst: Luft stroemt nach Osten, kommt also aus Westen
		expect(r.windDirection).toBe('W');
	});

	it('bricht ohne Winddaten ab, statt Windstille zu melden', () => {
		expect(() => parseGeosphere(antwort({ t2m: { data: [1] } }), 2000)).toThrow();
	});
});

describe('componentsToAspect', () => {
	it('kennt die Hauptrichtungen', () => {
		expect(componentsToAspect(0, -5)).toBe('N');
		expect(componentsToAspect(-5, 0)).toBe('E');
		expect(componentsToAspect(0, 5)).toBe('S');
	});
});
