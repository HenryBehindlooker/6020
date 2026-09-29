/**
 * Sonnenauf- und -untergang nach dem NOAA-Verfahren (auf etwa eine Minute
 * genau). Gerechnet wird mit dem freien Horizont; in einem engen Tal oder
 * auf einem Nordhang wird es deutlich frueher dunkel - die Oberflaeche sagt
 * das dazu.
 */

const RAD = Math.PI / 180;

/** Sonnenaufgang und -untergang an einem Kalendertag (UTC-Datum des Mittags). */
export function sunTimes(day: Date, lat: number, lon: number): { sunrise: Date; sunset: Date } | null {
	// Julianischer Tag fuer 12:00 UTC des Datums
	const noonUtc = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 12);
	const jd = noonUtc / 86_400_000 + 2_440_587.5;
	const t = (jd - 2_451_545) / 36_525;

	const l0 = (280.46646 + t * (36_000.76983 + t * 0.0003032)) % 360;
	const m = 357.52911 + t * (35_999.05029 - 0.0001537 * t);
	const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
	const c =
		Math.sin(m * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
		Math.sin(2 * m * RAD) * (0.019993 - 0.000101 * t) +
		Math.sin(3 * m * RAD) * 0.000289;
	const trueLong = l0 + c;
	const omega = 125.04 - 1934.136 * t;
	const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
	const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
	const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
	const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));

	const y = Math.tan((eps / 2) * RAD) ** 2;
	const eqTime =
		4 /
		RAD *
		(y * Math.sin(2 * l0 * RAD) -
			2 * e * Math.sin(m * RAD) +
			4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD) -
			0.5 * y * y * Math.sin(4 * l0 * RAD) -
			1.25 * e * e * Math.sin(2 * m * RAD));

	const cosH =
		(Math.cos(90.833 * RAD) - Math.sin(lat * RAD) * Math.sin(decl)) / (Math.cos(lat * RAD) * Math.cos(decl));
	if (cosH < -1 || cosH > 1) return null; // Polartag/-nacht - nicht in Tirol
	const ha = Math.acos(cosH) / RAD;

	const solarNoonMin = 720 - 4 * lon - eqTime;
	const midnight = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
	return {
		sunrise: new Date(midnight + (solarNoonMin - 4 * ha) * 60_000),
		sunset: new Date(midnight + (solarNoonMin + 4 * ha) * 60_000)
	};
}
