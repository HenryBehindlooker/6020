import { describe, expect, it } from 'vitest';
import { pickSnapshotDay, toDeparture, type Snapshot, type SnapshotItinerary } from './snapshot';

const reise: SnapshotItinerary = {
	departure: '12:05',
	arrival: '12:46',
	walk_to_stop_min: 6,
	walk_from_stop_min: 3,
	transfers: 1,
	legs: [
		{ line: '462', from: 'Oberperfuss Gemeindeamt', to: 'Völs Bahnhof', departure: '12:11', arrival: '12:25' },
		{ line: 'REX 3337', from: 'Völs Bahnhof', to: 'Innsbruck Hauptbahnhof', departure: '12:28', arrival: '12:36' }
	]
};

const snapshot: Snapshot = {
	fetched_at: '2026-09-26T10:00:00Z',
	source: 'Transitous',
	destination: 'Innsbruck Hauptbahnhof',
	days: {
		samstag: { date: '2026-10-03', trailheads: {} },
		werktag: { date: '2026-09-30', trailheads: {} },
		winter_samstag: { date: '2026-12-05', trailheads: {} }
	}
};

describe('pickSnapshotDay', () => {
	it('nimmt am Samstag den Samstag', () => {
		expect(pickSnapshotDay(snapshot, new Date('2026-10-10T08:00:00'))?.label).toBe('samstag');
	});

	it('nimmt unter der Woche den Werktag', () => {
		expect(pickSnapshotDay(snapshot, new Date('2026-10-07T08:00:00'))?.label).toBe('werktag');
	});

	it('nimmt im Winter den Wintertag', () => {
		expect(pickSnapshotDay(snapshot, new Date('2027-01-16T08:00:00'))?.label).toBe('winter_samstag');
	});

	it('faellt auf den anderen Tag zurueck, wenn einer fehlt', () => {
		const nurWerktag: Snapshot = { ...snapshot, days: { werktag: snapshot.days.werktag } };
		expect(pickSnapshotDay(nurWerktag, new Date('2026-10-10T08:00:00'))?.label).toBe('werktag');
	});

	it('liefert null ohne Tage', () => {
		expect(pickSnapshotDay({ ...snapshot, days: {} }, new Date())).toBeNull();
	});
});

describe('toDeparture', () => {
	const heute = new Date('2026-10-10T00:00:00');

	it('uebertraegt die Zeiten auf das Zieldatum', () => {
		const d = toDeparture(reise, heute, 'inbound')!;
		expect(new Date(d.departure).getHours()).toBe(12);
		expect(new Date(d.departure).getMinutes()).toBe(5);
		expect(new Date(d.departure).getDate()).toBe(10);
	});

	it('fasst die Linien zusammen und zaehlt Umstiege', () => {
		const d = toDeparture(reise, heute, 'inbound')!;
		expect(d.line).toBe('462 + REX 3337');
		expect(d.transfers).toBe(1);
		expect(d.headsign).toBe('Innsbruck Hauptbahnhof');
	});

	it('nimmt beim Rueckweg den Fussweg zur Haltestelle', () => {
		expect(toDeparture(reise, heute, 'inbound')!.walkMinutes).toBe(6);
		expect(toDeparture(reise, heute, 'outbound')!.walkMinutes).toBe(3);
	});

	it('rechnet ueber Mitternacht richtig', () => {
		const spaet = { ...reise, departure: '23:40', arrival: '00:25' };
		const d = toDeparture(spaet, heute, 'inbound')!;
		expect(new Date(d.arrival).getTime()).toBeGreaterThan(new Date(d.departure).getTime());
	});

	it('verwirft Reisen ohne Zeiten', () => {
		expect(toDeparture({ ...reise, departure: null }, heute, 'inbound')).toBeNull();
		expect(toDeparture({ ...reise, legs: [] }, heute, 'inbound')).toBeNull();
	});
});
