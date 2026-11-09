import type mapboxgl from 'mapbox-gl';
import { PIN_COLORS } from './map-types';
import { PIN_ICON_PREFIX, CATEGORY_KEY_EXPR, STATUS_KEY_EXPR } from './pin-icons';

/** Source ids */
export const SRC = {
  regions: 'regions-src',
  provinces: 'provinces-src',
  munis: 'munis-src',
  barangays: 'barangays-src',
  selection: 'selection-src',
  mask: 'selection-mask-src',
  nearMe: 'near-me-src',
  projects: 'projects-src',
} as const;

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

/** Bottom → top. Layers are always inserted in this order. */
// Clusters are HTML donut markers (see cluster-markers.ts), not map layers.
const LAYER_ORDER = [
  'province-fill',
  'selection-mask',
  'muni-lines',
  'barangay-lines',
  'province-lines',
  'region-lines',
  'selection-glow',
  'selection-line',
  'near-me-fill',
  'near-me-line',
  'pin-halo',
  'pins',
  'pin-icons',
] as const;

/** From this zoom, pins become category badges (see pin-icons.ts). */
export const ICON_MIN_ZOOM = 13;

export type LayerId = (typeof LAYER_ORDER)[number];

const PIN_COLOR: mapboxgl.ExpressionSpecification = [
  'case',
  ['==', ['get', 'risk'], 2], PIN_COLORS.red,
  ['==', ['get', 'risk'], 1], PIN_COLORS.amber,
  ['==', ['get', 'done'], 1], PIN_COLORS.done,
  PIN_COLORS.green,
];

const IS_ACTIVE: mapboxgl.ExpressionSpecification = [
  'any',
  ['boolean', ['feature-state', 'hover'], false],
  ['boolean', ['feature-state', 'selected'], false],
];

/** Pin size grows with budget (pesos), plus a bump when hovered/selected. */
function pinRadius(small: number[], bump: number): mapboxgl.ExpressionSpecification {
  return [
    '+',
    ['interpolate', ['linear'], ['get', 'b'], 0, small[0], 1e7, small[1], 1e8, small[2], 1e9, small[3]],
    ['case', IS_ACTIVE, bump, 0],
  ];
}

const LAYERS: Record<LayerId, mapboxgl.LayerSpecification> = {
  'province-fill': {
    id: 'province-fill',
    type: 'fill',
    source: SRC.provinces,
    maxzoom: 8,
    paint: {
      'fill-color': [
        'interpolate', ['linear'], ['coalesce', ['feature-state', 'count'], 0],
        // navy-50 → navy-200 → navy-400 → navy (design tokens)
        0, '#eef4fc',
        200, '#b3cdf0',
        1500, '#3f7be0',
        6000, '#01367d',
      ],
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.32, 7, 0.12, 8, 0],
    },
  },
  'selection-mask': {
    id: 'selection-mask',
    type: 'fill',
    source: SRC.mask,
    paint: { 'fill-color': '#011438', 'fill-opacity': 0.55 },
  },
  'muni-lines': {
    id: 'muni-lines',
    type: 'line',
    source: SRC.munis,
    minzoom: 7,
    paint: {
      'line-color': '#dce3ee',
      'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.4, 12, 1],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0, 8.5, 0.4, 11, 0.7],
    },
  },
  'barangay-lines': {
    id: 'barangay-lines',
    type: 'line',
    source: SRC.barangays,
    paint: {
      'line-color': '#b3cdf0',
      'line-width': 0.8,
      'line-opacity': 0.6,
      'line-dasharray': [2, 1.5],
    },
  },
  'province-lines': {
    id: 'province-lines',
    type: 'line',
    source: SRC.provinces,
    paint: {
      'line-color': '#ffffff',
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 10, 1.4],
      'line-opacity': 0.45,
    },
  },
  'region-lines': {
    id: 'region-lines',
    type: 'line',
    source: SRC.regions,
    paint: {
      'line-color': '#7fa9e2',
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.2, 10, 2.2],
      'line-opacity': 0.7,
    },
  },
  'selection-glow': {
    id: 'selection-glow',
    type: 'line',
    source: SRC.selection,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    // A dark casing (not a glow) so the amber outline reads on satellite and light maps alike
    paint: { 'line-color': '#011438', 'line-width': 6, 'line-opacity': 0.6 },
  },
  'selection-line': {
    id: 'selection-line',
    type: 'line',
    source: SRC.selection,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#ffb241', 'line-width': 2.5 },
  },
  'near-me-fill': {
    id: 'near-me-fill',
    type: 'fill',
    source: SRC.nearMe,
    paint: { 'fill-color': '#01367d', 'fill-opacity': 0.16 },
  },
  'near-me-line': {
    id: 'near-me-line',
    type: 'line',
    source: SRC.nearMe,
    paint: { 'line-color': '#ffb241', 'line-width': 2, 'line-dasharray': [2, 2] },
  },
  'pin-halo': {
    id: 'pin-halo',
    type: 'circle',
    source: SRC.projects,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': PIN_COLOR,
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        8, pinRadius([7, 8, 10, 13], 3),
        12.9, pinRadius([10, 12, 14, 18], 4),
        13, ['case', IS_ACTIVE, 24, 20],
        17, ['case', IS_ACTIVE, 28, 23],
      ],
      // Only hovered/selected pins get a halo: it marks the one you're looking at
      'circle-opacity': ['case', IS_ACTIVE, 0.35, 0],
    },
  },
  pins: {
    id: 'pins',
    type: 'circle',
    source: SRC.projects,
    maxzoom: ICON_MIN_ZOOM,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': PIN_COLOR,
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        8, pinRadius([3.5, 4.5, 6, 8.5], 2),
        16, pinRadius([6, 7.5, 10, 14], 3),
      ],
      'circle-stroke-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], '#ffb241',
        '#ffffff',
      ],
      'circle-stroke-width': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], 3,
        ['boolean', ['feature-state', 'hover'], false], 2.5,
        1.25,
      ],
      'circle-opacity': ['case', ['==', ['get', 'done'], 1], 0.85, 1],
    },
  },
  'pin-icons': {
    id: 'pin-icons',
    type: 'symbol',
    source: SRC.projects,
    minzoom: ICON_MIN_ZOOM,
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': ['concat', PIN_ICON_PREFIX, CATEGORY_KEY_EXPR, '-', STATUS_KEY_EXPR],
      // icon-size is a layout property, so it can't react to hover (feature-state);
      // the halo layer underneath carries the hover/selected emphasis instead.
      'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.85, 17, 1.1],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'symbol-sort-key': ['get', 'risk'],
    },
    paint: {
      'icon-opacity': ['case', ['==', ['get', 'done'], 1], 0.9, 1],
    },
  },
};

/** Which source each layer needs before it can be added. */
const LAYER_SOURCE: Record<LayerId, string> = Object.fromEntries(
  LAYER_ORDER.map((id) => [id, (LAYERS[id] as { source: string }).source]),
) as Record<LayerId, string>;

/** Add or update a GeoJSON source. */
export function upsertSource(
  map: mapboxgl.Map,
  id: string,
  data: GeoJSON.FeatureCollection | GeoJSON.Feature | null,
  promoteId?: string,
) {
  const existing = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
  const value = (data ?? EMPTY_FC) as GeoJSON.FeatureCollection;
  if (existing) {
    existing.setData(value);
    return;
  }
  map.addSource(id, { type: 'geojson', data: value, ...(promoteId ? { promoteId } : {}) });
}

/** Adds every layer whose source exists, each in its fixed slot. Safe to call repeatedly. */
export function ensureLayers(map: mapboxgl.Map) {
  for (let i = 0; i < LAYER_ORDER.length; i++) {
    const id = LAYER_ORDER[i];
    if (map.getLayer(id) || !map.getSource(LAYER_SOURCE[id])) continue;
    const beforeId = LAYER_ORDER.slice(i + 1).find((next) => map.getLayer(next));
    map.addLayer(LAYERS[id], beforeId);
  }
}

export function emptyCollection(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

/** A circle polygon around a point (for the "near me" radius). */
export function circlePolygon(center: [number, number], radiusKm = 5, points = 64): GeoJSON.FeatureCollection {
  const [lng, lat] = center;
  const dx = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const dy = radiusKm / 110.574;
  const ring: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const t = (i / points) * 2 * Math.PI;
    ring.push([lng + dx * Math.cos(t), lat + dy * Math.sin(t)]);
  }
  ring.push(ring[0]);
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }],
  };
}
