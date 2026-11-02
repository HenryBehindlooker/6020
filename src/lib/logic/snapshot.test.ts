import { describe, expect, it } from 'vitest';
import { pickSnapshotDay, toDeparture, type Snapshot, type SnapshotItinerary } from './snapshot';
import { viennaParts } from './time';

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
		expect(pickSnapshotDay(snapshot, new Date('2026-10-10T08:00:00Z'))?.label).toBe('samstag');
	});

	it('nimmt unter der Woche den Werktag', () => {
		expect(pickSnapshotDay(snapshot, new Date('2026-10-07T08:00:00Z'))?.label).toBe('werktag');
	});

	it('nimmt im Winter am Samstag den Wintersamstag', () => {
		expect(pickSnapshotDay(snapshot, new Date('2027-01-16T08:00:00Z'))?.label).toBe('winter_samstag');
	});

	it('nimmt im Winter unter der Woche den Werktag, nicht den Samstag', () => {
		// Vorher: an einem Dienstag im Jaenner wurde der Samstagsfahrplan genommen.
		expect(pickSnapshotDay(snapshot, new Date('2027-01-12T08:00:00Z'))?.label).toBe('werktag');
	});

	it('faellt nur zur vorsichtigen Seite zurueck', () => {
		// Am Werktag notfalls der Samstag - weniger Busse, also eher zu frueh umkehren
		const nurSamstag: Snapshot = { ...snapshot, days: { samstag: snapshot.days.samstag } };
		expect(pickSnapshotDay(nurSamstag, new Date('2026-10-07T08:00:00Z'))?.label).toBe('samstag');
		// Am Wochenende nie der Werktag: der kennt Busse, die dann nicht fahren
		const nurWerktag: Snapshot = { ...snapshot, days: { werktag: snapshot.days.werktag } };
		expect(pickSnapshotDay(nurWerktag, new Date('2026-10-10T08:00:00Z'))).toBeNull();
	});

	it('nimmt am Sonntag den Sonntag, sonst den Samstag', () => {
		const mitSonntag: Snapshot = {
			...snapshot,
			days: { ...snapshot.days, sonntag: { date: '2026-10-04', trailheads: {} } }
		};
		expect(pickSnapshotDay(mitSonntag, new Date('2026-10-11T08:00:00Z'))?.label).toBe('sonntag');
		expect(pickSnapshotDay(snapshot, new Date('2026-10-11T08:00:00Z'))?.label).toBe('samstag');
	});

	it('nimmt am Feiertag unter der Woche den Sonntagsfahrplan', () => {
		const mitSonntag: Snapshot = {
			...snapshot,
			days: { ...snapshot.days, sonntag: { date: '2026-10-04', trailheads: {} } }
		};
		// Di 8.12.2026, Mariae Empfaengnis - mitten in der Skisaison
		const r = pickSnapshotDay(mitSonntag, new Date('2026-12-08T08:00:00Z'));
		expect(r?.label).toBe('sonntag');
		expect(r?.feiertag).toBe('Mariä Empfängnis');
		// Mo 26.10.2026, Nationalfeiertag - ohne Sonntag im Abzug der Samstag, nie der Werktag
		expect(pickSnapshotDay(snapshot, new Date('2026-10-26T08:00:00Z'))?.label).toBe('samstag');
	});

	it('liefert null ohne Tage', () => {
		expect(pickSnapshotDay({ ...snapshot, days: {} }, new Date())).toBeNull();
	});
});

describe('toDeparture', () => {
	const heute = new Date('2026-10-10T08:00:00Z');

	it('uebertraegt die Zeiten auf das Zieldatum, in Innsbrucker Zeit', () => {
		const d = toDeparture(reise, heute, 'inbound')!;
		const p = viennaParts(new Date(d.departure));
		expect([p.day, p.hour, p.minute]).toEqual([10, 12, 5]);
		// Sommerzeit: 12:05 in Innsbruck ist 10:05 UTC
		expect(d.departure).toBe('2026-10-10T10:05:00.000Z');
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
