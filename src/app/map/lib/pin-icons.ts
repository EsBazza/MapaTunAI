import type mapboxgl from 'mapbox-gl';
import { PIN_COLORS } from './map-types';

/**
 * Close-up pins (zoom >= 13) are round badges in the status colour with a white
 * glyph showing what kind of project it is. Glyphs are lucide-style 24×24
 * stroke paths, drawn once to a canvas and registered as map images.
 */

export type CategoryKey = 'bridge' | 'road' | 'building' | 'water' | 'flood' | 'other';
export type StatusKey = 'red' | 'amber' | 'green' | 'done';

export const CATEGORY_GLYPHS: Record<CategoryKey, string[]> = {
  bridge: ['M2 9h20', 'M3 9v11', 'M21 9v11', 'M7 20v-3a5 5 0 0 1 10 0v3', 'M7 9V6', 'M17 9V6'],
  road: ['M4 22 9 2', 'M20 22 15 2', 'M12 4v2', 'M12 10v3', 'M12 17v3'],
  building: [
    'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z',
    'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2',
    'M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2',
    'M10 6h4',
    'M10 10h4',
    'M10 14h4',
    'M10 18h4',
  ],
  water: ['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z'],
  flood: [
    'M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
    'M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
    'M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
  ],
  other: [
    'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0',
    'M12 7a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
  ],
};

/** points.json category labels → glyph + plain words. */
const CATEGORY_BY_LABEL: Record<string, { key: CategoryKey; label: string }> = {
  bridges: { key: 'bridge', label: 'Bridge' },
  roads: { key: 'road', label: 'Road' },
  buildings: { key: 'building', label: 'Building' },
  water: { key: 'water', label: 'Water supply' },
  'flood control': { key: 'flood', label: 'Flood control' },
  other: { key: 'other', label: 'Other project' },
};

export function categoryInfo(raw: string | undefined | null): { key: CategoryKey; label: string } {
  return CATEGORY_BY_LABEL[(raw ?? '').toLowerCase().trim()] ?? CATEGORY_BY_LABEL.other;
}

/** Legend rows, in the order people are most likely to look for them. */
export const CATEGORY_LEGEND: Array<{ key: CategoryKey; label: string }> = [
  { key: 'road', label: 'Road' },
  { key: 'bridge', label: 'Bridge' },
  { key: 'flood', label: 'Flood control' },
  { key: 'building', label: 'Building' },
  { key: 'water', label: 'Water supply' },
  { key: 'other', label: 'Other' },
];

const STATUS_COLORS: Record<StatusKey, string> = {
  red: PIN_COLORS.red,
  amber: PIN_COLORS.amber,
  green: PIN_COLORS.green,
  done: PIN_COLORS.done,
};

export const PIN_ICON_PREFIX = 'mtn-pin-';

/** Badge size in CSS px; drawn at 2× for sharp edges on high-DPI screens. */
const BADGE = 30;
const RATIO = 2;

function drawBadge(category: CategoryKey, status: StatusKey): ImageData | null {
  if (typeof document === 'undefined') return null;
  const px = BADGE * RATIO;
  const pad = 4 * RATIO; // room for the soft shadow
  const canvas = document.createElement('canvas');
  canvas.width = px + pad * 2;
  canvas.height = px + pad * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const c = canvas.width / 2;
  const r = px / 2 - RATIO;

  ctx.save();
  ctx.shadowColor = 'rgba(2, 6, 23, 0.45)';
  ctx.shadowBlur = 3 * RATIO;
  ctx.shadowOffsetY = 1 * RATIO;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fillStyle = STATUS_COLORS[status];
  ctx.fill();
  ctx.restore();

  ctx.lineWidth = 2 * RATIO;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(c, c, r - RATIO, 0, Math.PI * 2);
  ctx.stroke();

  // 24-unit glyph scaled to ~15 CSS px, centred
  const glyph = 15 * RATIO;
  const scale = glyph / 24;
  ctx.save();
  ctx.translate(c - glyph / 2, c - glyph / 2);
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.25;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const d of CATEGORY_GLYPHS[category]) ctx.stroke(new Path2D(d));
  ctx.restore();

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function pinIconId(category: CategoryKey, status: StatusKey): string {
  return `${PIN_ICON_PREFIX}${category}-${status}`;
}

function addIcon(map: mapboxgl.Map, id: string) {
  if (map.hasImage(id)) return;
  const [category, status] = id.slice(PIN_ICON_PREFIX.length).split('-') as [CategoryKey, StatusKey];
  if (!CATEGORY_GLYPHS[category] || !STATUS_COLORS[status]) return;
  const image = drawBadge(category, status);
  if (image) map.addImage(id, image, { pixelRatio: RATIO });
}

/** Registers every badge. Call after each style load (a basemap switch drops images). */
export function registerPinIcons(map: mapboxgl.Map) {
  for (const category of Object.keys(CATEGORY_GLYPHS) as CategoryKey[]) {
    for (const status of Object.keys(STATUS_COLORS) as StatusKey[]) {
      addIcon(map, pinIconId(category, status));
    }
  }
}

/** Safety net: if the style asks for a badge we haven't drawn yet, draw it now. */
export function handleMissingPinIcon(map: mapboxgl.Map, id: string) {
  if (id.startsWith(PIN_ICON_PREFIX)) addIcon(map, id);
}

/** Map expression → glyph key from the feature's category label. */
export const CATEGORY_KEY_EXPR: mapboxgl.ExpressionSpecification = [
  'match',
  ['downcase', ['coalesce', ['get', 'c'], '']],
  'bridges', 'bridge',
  'roads', 'road',
  'buildings', 'building',
  'water', 'water',
  'flood control', 'flood',
  'other',
];

/** Map expression → status key, same rules as the circle pins. */
export const STATUS_KEY_EXPR: mapboxgl.ExpressionSpecification = [
  'case',
  ['==', ['get', 'risk'], 2], 'red',
  ['==', ['get', 'risk'], 1], 'amber',
  ['==', ['get', 'done'], 1], 'done',
  'green',
];
