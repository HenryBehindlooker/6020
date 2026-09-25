import { describe, expect, it } from 'vitest';
import type { TourPlan } from '$lib/server/plan';
import type { Signal } from '$lib/logic/rating';
import { boundsOf, groupByTrailhead } from './trailheads';

function plan(
	id: string,
	stop: string,
	signal: Signal,
	feasible: boolean,
	lat = 47.1,
	lon = 11.1
): TourPlan {
	return {
		tour: {
			id,
			name: id,
			trailhead: stop,
			trailheadStop: stop,
			lat,
			lon,
			summitAltitude: 2500,
			trailheadAltitude: 1500,
			ascentMeters: 1000,
			ascentMinutes: 180,
			descentMinutes: 70,
			aspects: ['N'],
			steepnessMax: 30,
			type: 'skitour',
			description: ''
		},
		rating: { signal, effectiveDangerLevel: 2, reasons: [] },
		weather: null,
		transit: { originStop: 'Innsbruck', destinationStop: stop, outbound: [], inbound: [], source: 't' },
		turnaround: {
			outbound: null,
			lastInbound: null,
			turnaroundAt: null,
			summitAt: null,
			slackMinutes: null,
			feasible,
			note: ''
		}
	};
}

describe('groupByTrailhead', () => {
	it('fasst Touren mit demselben Ausgangspunkt zusammen', () => {
		const groups = groupByTrailhead([
			plan('a', 'Praxmar', 'rot', true),
			plan('b', 'Praxmar', 'gelb', true),
			plan('c', 'Kuehtai', 'gruen', true)
		]);
		expect(groups).toHaveLength(2);
		expect(groups.find((g) => g.stop === 'Praxmar')?.tours).toHaveLength(2);
	});

	it('faerbt den Punkt nach der besten Tour', () => {
		const groups = groupByTrailhead([
			plan('a', 'Praxmar', 'rot', true),
			plan('b', 'Praxmar', 'gelb', true)
		]);
		expect(groups[0].bestSignal).toBe('gelb');
	});

	it('zaehlt nur die zeitlich machbaren Touren', () => {
		const groups = groupByTrailhead([
			plan('a', 'Praxmar', 'gruen', true),
			plan('b', 'Praxmar', 'gruen', false)
		]);
		expect(groups[0].feasibleCount).toBe(1);
	});

	it('mittelt die Koordinaten der Touren eines Ausgangspunkts', () => {
		const groups = groupByTrailhead([
			plan('a', 'Praxmar', 'gruen', true, 47.0, 11.0),
			plan('b', 'Praxmar', 'gruen', true, 47.2, 11.2)
		]);
		expect(groups[0].lat).toBeCloseTo(47.1, 5);
		expect(groups[0].lon).toBeCloseTo(11.1, 5);
	});

	it('sortiert die besten Ausgangspunkte nach vorne', () => {
		const groups = groupByTrailhead([
			plan('a', 'Praxmar', 'rot', true),
			plan('b', 'Kuehtai', 'gruen', true),
			plan('c', 'Igls', 'gelb', true)
		]);
		expect(groups.map((g) => g.stop)).toEqual(['Kuehtai', 'Igls', 'Praxmar']);
	});

	it('sortiert innerhalb eines Ausgangspunkts die beste Tour nach vorne', () => {
		const groups = groupByTrailhead([
			plan('rot', 'Praxmar', 'rot', true),
			plan('gruen', 'Praxmar', 'gruen', true)
		]);
		expect(groups[0].tours[0].tour.id).toBe('gruen');
	});
});

describe('boundsOf', () => {
	it('umfasst alle Punkte', () => {
		const groups = groupByTrailhead([
			plan('a', 'Praxmar', 'gruen', true, 47.0, 11.0),
			plan('b', 'Kuehtai', 'gruen', true, 47.3, 11.5)
		]);
		expect(boundsOf(groups)).toEqual([
			[47.0, 11.0],
			[47.3, 11.5]
		]);
	});

	it('liefert null ohne Punkte', () => {
		expect(boundsOf([])).toBeNull();
	});
});
