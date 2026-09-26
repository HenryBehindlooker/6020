import type * as Leaflet from 'leaflet';

/**
 * Zusatzebenen aus OpenStreetMap: Wege, Skitouren, Seilbahnen, Huetten.
 *
 * Die GeoJSON-Dateien liegen unter static/osm/ und werden erst geladen, wenn
 * eine Karte sie braucht. Fehlt eine Datei (noch nie abgeholt), bleibt die
 * Ebene einfach weg.
 *
 * OSM kann jede und jeder bearbeiten. Alles, was aus den Tags ins Popup geht,
 * wird darum escaped, und Links werden nur als http(s) uebernommen.
 */

type Props = Record<string, string | number | undefined>;

export interface OsmLayerStyle {
	route: string;
	skitour: string;
	aerialway: string;
	hut: string;
}

export function escapeHtml(value: unknown): string {
	return String(value ?? '').replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
	);
}

/** Nur echte Web-Adressen - kein javascript:, data: oder Aehnliches. */
export function safeUrl(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const url = value.trim().startsWith('www.') ? `https://${value.trim()}` : value.trim();
	try {
		const parsed = new URL(url);
		return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
	} catch {
		return null;
	}
}

function osmLink(props: Props): string {
	const ref = typeof props.osm === 'string' && /^(node|way|relation)\/\d+$/.test(props.osm) ? props.osm : null;
	return ref
		? `<a href="https://www.openstreetmap.org/${ref}" target="_blank" rel="noopener noreferrer">in OSM ansehen</a>`
		: '';
}

function websiteLink(props: Props): string {
	const url = safeUrl(props.website ?? props['contact:website']);
	return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Website</a>` : '';
}

function links(props: Props): string {
	const parts = [websiteLink(props), osmLink(props)].filter(Boolean);
	return parts.length ? `<div class="links">${parts.join(' · ')}</div>` : '';
}

export function routePopup(props: Props, kind: 'Wanderweg' | 'Skitour'): string {
	const name = escapeHtml(props.name ?? 'ohne Namen');
	const ref = props.ref ? ` <span class="sub">(${escapeHtml(props.ref)})</span>` : '';
	const hinweis =
		kind === 'Wanderweg'
			? '<div class="sub warn">Sommerweg laut OSM - im Winter keine Aufstiegsroute</div>'
			: '<div class="sub">Skitour laut OSM</div>';
	const laenge = props.length_km_in_region ? `<div class="sub">${escapeHtml(props.length_km_in_region)} km in der Region</div>` : '';
	return `<strong>${name}</strong>${ref}${hinweis}${laenge}${links(props)}`;
}

export function hutPopup(props: Props): string {
	const name = escapeHtml(props.name ?? 'Huette');
	const art =
		props.tourism === 'alpine_hut'
			? 'Schutzhuette'
			: props.tourism === 'wilderness_hut'
				? 'Selbstversorgerhuette'
				: 'Einkehr';
	const hoehe = props.ele ? ` · ${escapeHtml(props.ele)} m` : '';
	const betreiber = props.operator ? `<div class="sub">${escapeHtml(props.operator)}</div>` : '';
	const zeiten = props.opening_hours
		? `<div class="sub">Geoeffnet: ${escapeHtml(props.opening_hours)}</div>`
		: '<div class="sub">Oeffnungszeiten nicht in OSM - vorher pruefen</div>';
	return `<strong>${name}</strong><div class="sub">${art}${hoehe}</div>${betreiber}${zeiten}${links(props)}`;
}

export function aerialwayPopup(props: Props): string {
	const name = escapeHtml(props.name ?? 'Seilbahn');
	const typ: Record<string, string> = {
		cable_car: 'Pendelbahn',
		gondola: 'Gondelbahn',
		chair_lift: 'Sessellift',
		mixed_lift: 'Kombibahn',
		funicular: 'Standseilbahn'
	};
	const art = typ[String(props.aerialway ?? props.railway ?? '')] ?? 'Bahn';
	return `<strong>${name}</strong><div class="sub">${art}</div>${links(props)}`;
}

const FILES = {
	hiking: 'routes-hiking.geojson',
	skitour: 'routes-skitour.geojson',
	aerialways: 'aerialways.geojson',
	huts: 'huts.geojson'
} as const;

async function load(basePath: string, file: string): Promise<GeoJSON.FeatureCollection | null> {
	try {
		const res = await fetch(`${basePath}/osm/${file}`);
		if (!res.ok) return null;
		const data = (await res.json()) as GeoJSON.FeatureCollection;
		return data.features?.length ? data : null;
	} catch {
		return null;
	}
}

/**
 * Laedt die vorhandenen Ebenen und haengt sie mit einem Umschalter an die Karte.
 * Liefert die Anzahl geladener Objekte je Ebene, fuer Tests und die Legende.
 */
export async function addOsmLayers(
	L: typeof Leaflet,
	map: Leaflet.Map,
	basePath: string,
	style: OsmLayerStyle,
	visible: { hiking?: boolean; skitour?: boolean; aerialways?: boolean; huts?: boolean } = {}
): Promise<Record<string, number>> {
	const [hiking, skitour, aerialways, huts] = await Promise.all([
		load(basePath, FILES.hiking),
		load(basePath, FILES.skitour),
		load(basePath, FILES.aerialways),
		load(basePath, FILES.huts)
	]);

	const attribution = '&copy; OpenStreetMap-Mitwirkende (ODbL)';
	const overlays: Record<string, Leaflet.Layer> = {};
	const counts: Record<string, number> = {};

	if (hiking) {
		overlays['Wanderwege (Sommer)'] = L.geoJSON(hiking, {
			attribution,
			style: { color: style.route, weight: 2, opacity: 0.7 },
			onEachFeature: (f, layer) => layer.bindPopup(routePopup(f.properties ?? {}, 'Wanderweg'))
		});
		counts.hiking = hiking.features.length;
	}
	if (skitour) {
		overlays['Skitouren'] = L.geoJSON(skitour, {
			attribution,
			style: { color: style.skitour, weight: 3, opacity: 0.9 },
			onEachFeature: (f, layer) => layer.bindPopup(routePopup(f.properties ?? {}, 'Skitour'))
		});
		counts.skitour = skitour.features.length;
	}
	if (aerialways) {
		overlays['Seilbahnen'] = L.geoJSON(aerialways, {
			attribution,
			style: { color: style.aerialway, weight: 3, opacity: 0.9, dashArray: '1 6', lineCap: 'round' },
			onEachFeature: (f, layer) => layer.bindPopup(aerialwayPopup(f.properties ?? {}))
		});
		counts.aerialways = aerialways.features.length;
	}
	if (huts) {
		overlays['Huetten & Einkehr'] = L.geoJSON(huts, {
			attribution,
			pointToLayer: (_f, latlng) =>
				L.circleMarker(latlng, {
					radius: 5,
					color: '#ffffff',
					weight: 1.5,
					fillColor: style.hut,
					fillOpacity: 1,
					className: 'bergampel-huette'
				}),
			onEachFeature: (f, layer) => layer.bindPopup(hutPopup(f.properties ?? {}))
		});
		counts.huts = huts.features.length;
	}

	const defaults = { hiking: true, skitour: true, aerialways: true, huts: true, ...visible };
	const keyOf: Record<string, keyof typeof defaults> = {
		'Wanderwege (Sommer)': 'hiking',
		Skitouren: 'skitour',
		Seilbahnen: 'aerialways',
		'Huetten & Einkehr': 'huts'
	};

	for (const [label, layer] of Object.entries(overlays)) {
		if (defaults[keyOf[label]]) layer.addTo(map);
		// Wege unter die Marker der Ausgangspunkte legen
		if ('bringToBack' in layer && typeof layer.bringToBack === 'function') layer.bringToBack();
	}

	if (Object.keys(overlays).length > 0) {
		L.control.layers(undefined, overlays, { collapsed: true, position: 'topright' }).addTo(map);
	}

	return counts;
}
