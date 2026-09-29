/**
 * KML fuer Google Earth: Ausgangspunkt, Gipfel, Huetten und - falls es eine
 * echte Aufzeichnung gibt - den Verlauf. Eine gerade Linie vom Parkplatz zum
 * Gipfel wird bewusst NICHT gezeichnet: in 3D saehe sie wie eine Route aus.
 */

export interface KmlPoint {
	name: string;
	lat: number;
	lon: number;
	description?: string;
	style: 'start' | 'gipfel' | 'huette' | 'punkt';
}

function esc(value: string): string {
	return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

const ICONS: Record<KmlPoint['style'], { href: string; color: string }> = {
	start: { href: 'https://maps.google.com/mapfiles/kml/shapes/bus.png', color: 'ff884a1d' },
	gipfel: { href: 'https://maps.google.com/mapfiles/kml/shapes/triangle.png', color: 'ff2b7fb8' },
	huette: { href: 'https://maps.google.com/mapfiles/kml/shapes/homegardenbusiness.png', color: 'ff0b86b8' },
	punkt: { href: 'https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png', color: 'ff416b2f' }
};

export function buildKml(opts: {
	name: string;
	description: string;
	points: KmlPoint[];
	/** [lat, lon] einer echten Aufzeichnung */
	track?: [number, number][] | null;
}): string {
	const styles = Object.entries(ICONS)
		.map(
			([id, icon]) =>
				`<Style id="${id}"><IconStyle><color>${icon.color}</color><scale>1.1</scale><Icon><href>${icon.href}</href></Icon></IconStyle></Style>`
		)
		.join('');
	const placemarks = opts.points
		.map(
			(p) =>
				`<Placemark><name>${esc(p.name)}</name>${p.description ? `<description>${esc(p.description)}</description>` : ''}<styleUrl>#${p.style}</styleUrl><Point><coordinates>${p.lon},${p.lat},0</coordinates></Point></Placemark>`
		)
		.join('\n');
	const track =
		opts.track && opts.track.length > 1
			? `<Placemark><name>Verlauf</name><Style><LineStyle><color>ff2b7fb8</color><width>4</width></LineStyle></Style><LineString><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode><coordinates>${opts.track.map(([lat, lon]) => `${lon},${lat},0`).join(' ')}</coordinates></LineString></Placemark>`
			: '';
	return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<name>${esc(opts.name)}</name>
<description>${esc(opts.description)}</description>
${styles}
${placemarks}
${track}
</Document>
</kml>
`;
}

/** Google Earth im Browser, Blick schraeg auf den Punkt. Kein Schluessel noetig. */
export function googleEarthUrl(lat: number, lon: number, eleM = 1500, distanceM = 4500): string {
	return `https://earth.google.com/web/@${lat},${lon},${eleM}a,${distanceM}d,35y,0h,60t,0r`;
}
