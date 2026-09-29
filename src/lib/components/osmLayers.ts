import type * as Leaflet from 'leaflet';
import { openingOn, viennaDay } from '$lib/logic/openingHours';
import { paymentInfo } from '$lib/logic/payment';
import { LANDMARK_LABEL, landmarkKind } from '$lib/logic/landmarks';

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
	bike?: string;
	poi?: string;
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

export function hutPopup(props: Props, now: Date = new Date()): string {
	const name = escapeHtml(props.name ?? 'Hütte');
	const art =
		props.tourism === 'alpine_hut'
			? 'Schutzhütte'
			: props.tourism === 'wilderness_hut'
				? 'Selbstversorgerhütte'
				: 'Einkehr';
	const hoehe = props.ele ? ` · ${escapeHtml(props.ele)} m` : '';
	const betreiber = props.operator ? `<div class="sub">${escapeHtml(props.operator)}</div>` : '';
	const oh = typeof props.opening_hours === 'string' ? props.opening_hours : null;
	const heute = openingOn(oh, viennaDay(now));
	const zeiten =
		heute.status === 'offen'
			? `<div class="sub">Heute offen laut OSM: ${escapeHtml(heute.spans.join(', '))}</div>`
			: heute.status === 'zu'
				? '<div class="sub warn">Heute zu laut OSM</div>'
				: oh
					? `<div class="sub">Geöffnet: ${escapeHtml(oh)}</div>`
					: '<div class="sub">Öffnungszeiten nicht in OSM - vorher prüfen</div>';
	const zahlung = `<div class="sub${paymentInfo(props).kind === 'karte' ? '' : ' warn'}">${escapeHtml(paymentInfo(props).text)}</div>`;
	return `<strong>${name}</strong><div class="sub">${art}${hoehe}</div>${betreiber}${zeiten}${zahlung}${links(props)}`;
}

const MTB_SCALE: Record<string, string> = {
	'0': 'S0 – leicht',
	'1': 'S1 – leicht bis mittel',
	'2': 'S2 – mittel',
	'3': 'S3 – schwer',
	'4': 'S4 – sehr schwer',
	'5': 'S5 – extrem'
};

export function bikePopup(props: Props): string {
	const name = escapeHtml(props.name ?? 'Radroute');
	const ref = props.ref ? ` <span class="sub">(${escapeHtml(props.ref)})</span>` : '';
	const art = props.route === 'mtb' ? 'Mountainbike-Route' : 'Radroute';
	const scale = props['mtb:scale'] ? ` · ${escapeHtml(MTB_SCALE[String(props['mtb:scale'])] ?? props['mtb:scale'])}` : '';
	const laenge = props.length_km_in_region ? `<div class="sub">${escapeHtml(props.length_km_in_region)} km in der Region</div>` : '';
	return `<strong>${name}</strong>${ref}<div class="sub">${art} laut OSM${scale}</div>${laenge}${links(props)}`;
}

export function poiPopup(props: Props): string {
	const kind = landmarkKind(props);
	const art = kind ? LANDMARK_LABEL[kind] : 'Punkt';
	const name = props.name ? `<strong>${escapeHtml(props.name)}</strong><div class="sub">${art}</div>` : `<strong>${art}</strong>`;
	const hoehe = props.ele ? `<div class="sub">${escapeHtml(props.ele)} m</div>` : '';
	const wasser =
		kind === 'wasser' || kind === 'quelle' ? '<div class="sub warn">Im Winter oft eingeschneit oder abgedreht</div>' : '';
	return `${name}${hoehe}${wasser}${links(props)}`;
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
	huts: 'huts.geojson',
	bike: 'routes-bike.geojson',
	pois: 'pois.geojson'
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
	visible: { hiking?: boolean; skitour?: boolean; aerialways?: boolean; huts?: boolean; bike?: boolean; pois?: boolean } = {}
): Promise<Record<string, number>> {
	const [hiking, skitour, aerialways, huts, bike, pois] = await Promise.all([
		load(basePath, FILES.hiking),
		load(basePath, FILES.skitour),
		load(basePath, FILES.aerialways),
		load(basePath, FILES.huts),
		load(basePath, FILES.bike),
		load(basePath, FILES.pois)
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
	if (bike) {
		overlays['Radl & MTB'] = L.geoJSON(bike, {
			attribution,
			style: (f) => ({
				color: style.bike ?? '#8e44ad',
				weight: 3,
				opacity: 0.85,
				dashArray: f?.properties?.route === 'mtb' ? undefined : '6 4'
			}),
			onEachFeature: (f, layer) => layer.bindPopup(bikePopup(f.properties ?? {}))
		});
		counts.bike = bike.features.length;
	}
	if (pois) {
		overlays['Markante Punkte'] = L.geoJSON(pois, {
			attribution,
			pointToLayer: (_f, latlng) =>
				L.circleMarker(latlng, {
					radius: 3.5,
					color: '#ffffff',
					weight: 1,
					fillColor: style.poi ?? '#5b6b78',
					fillOpacity: 1
				}),
			onEachFeature: (f, layer) => layer.bindPopup(poiPopup(f.properties ?? {}))
		});
		counts.pois = pois.features.length;
	}
	if (huts) {
		overlays['Hütten & Einkehr'] = L.geoJSON(huts, {
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

	// Sommer-Radl und die vielen kleinen Punkte nur auf Wunsch
	const defaults = { hiking: true, skitour: true, aerialways: true, huts: true, bike: false, pois: false, ...visible };
	const keyOf: Record<string, keyof typeof defaults> = {
		'Wanderwege (Sommer)': 'hiking',
		Skitouren: 'skitour',
		Seilbahnen: 'aerialways',
		'Hütten & Einkehr': 'huts',
		'Radl & MTB': 'bike',
		'Markante Punkte': 'pois'
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
