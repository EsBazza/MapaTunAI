/**
 * Small, dependency-free GeoJSON helpers shared by the map (browser) and the
 * boundary API route (server).
 */

export type Position = [number, number];
export type LngLatBounds = [[number, number], [number, number]];

export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: Position[][];
}

export interface MultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: Position[][][];
}

export type AreaGeometry = PolygonGeometry | MultiPolygonGeometry;

export interface AreaFeature<P = Record<string, unknown>> {
  type: 'Feature';
  id?: string | number;
  properties: P;
  geometry: AreaGeometry;
}

/** World ring covering the entire globe, used for the inverted "spotlight" mask. */
export const WORLD_RING: Position[] = [
  [-180, -90],
  [180, -90],
  [180, 90],
  [-180, 90],
  [-180, -90],
];

/** Returns the polygons of a geometry as a uniform list (outer ring first). */
export function toPolygons(geometry: AreaGeometry | null | undefined): Position[][][] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

/** Bounding box of one or more geometries, or null when empty. */
export function getBBox(geometries: AreaGeometry | AreaGeometry[]): LngLatBounds | null {
  const list = Array.isArray(geometries) ? geometries : [geometries];
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const geometry of list) {
    for (const polygon of toPolygons(geometry)) {
      // Only the outer ring matters for the bbox
      for (const [lng, lat] of polygon[0] ?? []) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }

  if (!Number.isFinite(minLng)) return null;
  return [
    [+minLng.toFixed(5), +minLat.toFixed(5)],
    [+maxLng.toFixed(5), +maxLat.toFixed(5)],
  ];
}

/**
 * Builds a polygon covering the whole world with the given areas cut out,
 * so everything outside the selection can be dimmed.
 */
export function createInvertedMask(geometries: AreaGeometry | AreaGeometry[]): AreaFeature {
  const list = Array.isArray(geometries) ? geometries : [geometries];
  const holes: Position[][] = [];
  for (const geometry of list) {
    for (const polygon of toPolygons(geometry)) {
      if (polygon[0]?.length) holes.push(polygon[0]);
    }
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [WORLD_RING, ...holes] },
  };
}

/** Ray-casting point-in-ring test. */
function pointInRing(lng: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** True when the point lies inside any of the polygons (holes respected). */
export function pointInPolygons(lng: number, lat: number, polygons: Position[][][]): boolean {
  for (const polygon of polygons) {
    if (!polygon[0] || !pointInRing(lng, lat, polygon[0])) continue;
    let inHole = false;
    for (let h = 1; h < polygon.length; h++) {
      if (pointInRing(lng, lat, polygon[h])) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

export function isInBounds(lng: number, lat: number, bounds: LngLatBounds): boolean {
  return lng >= bounds[0][0] && lng <= bounds[1][0] && lat >= bounds[0][1] && lat <= bounds[1][1];
}
