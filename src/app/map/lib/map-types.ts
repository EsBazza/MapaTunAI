import type { Position, LngLatBounds } from '@/lib/geo-bounds';

/** Properties of one project pin inside the cluster worker. */
export interface PointProps {
  /** Contract ID */
  i: string;
  /** Index into points.json / names.json */
  k: number;
  /** Budget in pesos */
  b: number;
  /** Work done (0-100) */
  g: number;
  /** Status index into metadata.statusLabels (0 = Completed) */
  s: number;
  /** Region index */
  r: number;
  /** Province index */
  v: number;
  /** Category label */
  c: string;
  /** Raw flag bitmask */
  f: number;
  /** 2 = paid but little work done, 1 = delayed, 0 = no warning */
  risk: 0 | 1 | 2;
  /** 1 when completed */
  done: 0 | 1;
  /** Project name (filled in once names.json arrives) */
  n?: string;
}

export interface ClusterProps {
  totalBudget: number;
  totalProjects: number;
  flaggedCount: number;
  /** Paid but little work done */
  redCount: number;
  /** Delayed */
  amberCount: number;
  /** No problems found, still ongoing */
  greenCount: number;
  /** Completed, no warning */
  doneCount: number;
}

export type PinFeature = GeoJSON.Feature<GeoJSON.Point, PointProps>;
export type ClusterFeature = GeoJSON.Feature<
  GeoJSON.Point,
  ClusterProps & { cluster: true; cluster_id: number; point_count: number; point_count_abbreviated: string | number }
>;
export type ClusterOrPoint = ClusterFeature | PinFeature;

export interface PointsMetadata {
  regions: string[];
  provinces: string[];
  provinceToRegion: number[];
  statusLabels: string[];
}

/** Columnar layout written by scripts/compact-map-data.mjs */
export interface PointsFile {
  version: number;
  count: number;
  budgetUnit: number;
  metadata: PointsMetadata;
  cats: string[];
  i: string[];
  x: number[];
  y: number[];
  b: number[];
  g: number[];
  s: number[];
  r: number[];
  v: number[];
  f: number[];
  c: number[];
}

export interface WorkerFilters {
  region?: string;
  province?: string;
  category?: string;
  /** Polygons of the selected city/barangay; pins must fall inside */
  polygons?: Position[][][];
  bounds?: LngLatBounds;
}

/** One row in the side list (from the worker or from /api/nearby). */
export interface SidebarPoint {
  id: string;
  name?: string;
  budget: number;
  progress: number;
  category: string;
  risk: 0 | 1 | 2;
  done: boolean;
  coordinates?: [number, number];
  distanceKm?: number;
}

export type WorkerRequest =
  | { type: 'load'; pointsUrl: string; namesUrl: string }
  | { type: 'getClusters'; id: number; bbox: [number, number, number, number]; zoom: number }
  | { type: 'filter'; id: number; filters: WorkerFilters }
  | { type: 'list'; id: number; limit: number }
  | { type: 'expansionZoom'; id: number; clusterId: number }
  | { type: 'findById'; id: number; projectId: string }
  | { type: 'near'; id: number; center: [number, number]; radiusKm: number; limit: number };

export type WorkerResponse =
  | {
      type: 'ready';
      totalPoints: number;
      /** Projects left off the map because they have no real location */
      unlocated: number;
      metadata: PointsMetadata;
      provinceCounts: number[];
    }
  | { type: 'namesReady' }
  | { type: 'error'; message: string }
  | { type: 'result'; id: number; data: unknown };

/** Plain-language labels shared by the popup, sidebar and legend. */
export const RISK_LABELS = {
  red: 'Paid but little work done',
  amber: 'Delayed',
  green: 'No problems found',
  done: 'Completed',
} as const;

/**
 * Mirrors the risk tokens in globals.css (Mapbox paint can't read CSS variables):
 * red = --color-risk-critical, amber = --color-risk-elevated, green = --color-risk-low,
 * done = --color-ink-subtle. Always shown with a text label, never colour alone.
 */
export const PIN_COLORS = {
  red: '#dc2626',
  amber: '#d97706',
  green: '#0f9d6b',
  done: '#627089',
} as const;

export function riskLabel(risk: 0 | 1 | 2, done: boolean): { text: string; color: string } {
  if (risk === 2) return { text: RISK_LABELS.red, color: PIN_COLORS.red };
  if (risk === 1) return { text: RISK_LABELS.amber, color: PIN_COLORS.amber };
  if (done) return { text: RISK_LABELS.done, color: PIN_COLORS.done };
  return { text: RISK_LABELS.green, color: PIN_COLORS.green };
}
