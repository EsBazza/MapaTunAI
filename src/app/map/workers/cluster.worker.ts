/// <reference lib="webworker" />
import Supercluster from 'supercluster';
import { pointInPolygons, isInBounds, type Position, type LngLatBounds } from '@/lib/geo-bounds';
import { regionKey, normName } from '../lib/boundaries';
import type {
  PinFeature,
  PointProps,
  ClusterProps,
  PointsFile,
  PointsMetadata,
  WorkerFilters,
  WorkerRequest,
  WorkerResponse,
  SidebarPoint,
} from '../lib/map-types';

declare const self: DedicatedWorkerGlobalScope;

// f bitmask from the data generator
const FLAG_OVERPAID = 1;
const FLAG_STALLED = 2;
const FLAG_NEVER_STARTED = 4;
const FLAG_OVERDUE = 8;
// 16 = payment pending: informational only, never colours a pin

type PointFeature = PinFeature;

/**
 * Projects without a real location were geocoded to this point in Manila.
 * Showing them there would create a fake giant cluster, so they are left off.
 */
const PLACEHOLDER_LNG = 120.9842;
const PLACEHOLDER_LAT = 14.5995;
let unlocatedCount = 0;

let master: PointFeature[] = [];
let current: PointFeature[] = [];
let metadata: PointsMetadata | null = null;
let index: Supercluster<PointProps, ClusterProps> | null = null;

function riskFromFlags(f: number): 0 | 1 | 2 {
  if (f & FLAG_OVERPAID) return 2;
  if (f & (FLAG_STALLED | FLAG_NEVER_STARTED | FLAG_OVERDUE)) return 1;
  return 0;
}

function buildIndex(features: PointFeature[]) {
  index = new Supercluster<PointProps, ClusterProps>({
    radius: 48,
    maxZoom: 15,
    minZoom: 0,
    minPoints: 2,
    map: (p) => ({
      totalBudget: p.b,
      totalProjects: 1,
      flaggedCount: p.risk > 0 ? 1 : 0,
      redCount: p.risk === 2 ? 1 : 0,
      amberCount: p.risk === 1 ? 1 : 0,
      greenCount: p.risk === 0 && p.done === 0 ? 1 : 0,
      doneCount: p.risk === 0 && p.done === 1 ? 1 : 0,
    }),
    reduce: (acc, p) => {
      acc.totalBudget += p.totalBudget;
      acc.totalProjects += p.totalProjects;
      acc.flaggedCount += p.flaggedCount;
      acc.redCount += p.redCount;
      acc.amberCount += p.amberCount;
      acc.greenCount += p.greenCount;
      acc.doneCount += p.doneCount;
    },
  });
  index.load(features);
}

function decode(file: PointsFile): PointFeature[] {
  const out: PointFeature[] = [];
  const unit = file.budgetUnit || 1000;
  unlocatedCount = 0;
  for (let k = 0; k < file.count; k++) {
    if (file.x[k] === PLACEHOLDER_LNG && file.y[k] === PLACEHOLDER_LAT) {
      unlocatedCount++;
      continue;
    }
    const f = file.f[k] || 0;
    const s = file.s[k];
    out.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [file.x[k], file.y[k]] },
      properties: {
        i: file.i[k],
        k,
        b: (file.b[k] || 0) * unit,
        g: file.g[k] || 0,
        s,
        r: file.r[k],
        v: file.v[k],
        c: file.cats[file.c[k]] ?? 'Other',
        f,
        risk: riskFromFlags(f),
        done: s === 0 ? 1 : 0,
      },
    });
  }
  return out;
}

function provinceCounts(features: PointFeature[]): number[] {
  const counts = new Array(metadata?.provinces.length ?? 0).fill(0);
  for (const feat of features) {
    const v = feat.properties.v;
    if (v >= 0 && v < counts.length) counts[v]++;
  }
  return counts;
}

/** Exact name first, then the same normalizer the map borders use. */
function nameIndex(list: string[] | undefined, name: string | undefined, normalize: (s: string) => string): number {
  if (!list || !name) return -1;
  const target = name.toLowerCase().trim();
  const exact = list.findIndex((item) => item.toLowerCase().trim() === target);
  if (exact !== -1) return exact;
  const key = normalize(name);
  return key ? list.findIndex((item) => normalize(item) === key) : -1;
}

function applyFilters(filters: WorkerFilters): number {
  const polygons: Position[][][] | undefined = filters.polygons?.length ? filters.polygons : undefined;
  const bounds: LngLatBounds | undefined = filters.bounds;
  const regionIdx = nameIndex(metadata?.regions, filters.region, regionKey);
  const provinceIdx = nameIndex(metadata?.provinces, filters.province, normName);

  current = master.filter((feat) => {
    const p = feat.properties;
    const [lng, lat] = feat.geometry.coordinates;

    // A drawn area (city / barangay) wins: pins match the outline exactly.
    if (polygons) {
      if (bounds && !isInBounds(lng, lat, bounds)) return false;
      return pointInPolygons(lng, lat, polygons);
    }

    if (regionIdx !== -1 && p.r !== regionIdx) return false;
    if (provinceIdx !== -1 && p.v !== provinceIdx) return false;
    if (filters.category && p.c !== filters.category) return false;
    return true;
  });

  buildIndex(current);
  return current.length;
}

function toSidebarPoint(feat: PointFeature, distanceKm?: number): SidebarPoint {
  return {
    id: feat.properties.i,
    name: feat.properties.n,
    budget: feat.properties.b,
    progress: feat.properties.g,
    category: feat.properties.c,
    risk: feat.properties.risk,
    done: feat.properties.done === 1,
    coordinates: feat.geometry.coordinates as [number, number],
    distanceKm,
  };
}

function listPoints(limit: number): { total: number; items: SidebarPoint[] } {
  const sorted = [...current].sort((a, b) => {
    // Problems first, then biggest budget
    if (b.properties.risk !== a.properties.risk) return b.properties.risk - a.properties.risk;
    return b.properties.b - a.properties.b;
  });
  return { total: current.length, items: sorted.slice(0, limit).map((f) => toSidebarPoint(f)) };
}

function haversineKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function nearPoints(center: [number, number], radiusKm: number, limit: number) {
  const [lng, lat] = center;
  const dLat = radiusKm / 110.574;
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const hits: { feat: PointFeature; d: number }[] = [];
  for (const feat of master) {
    const [x, y] = feat.geometry.coordinates;
    if (Math.abs(y - lat) > dLat || Math.abs(x - lng) > dLng) continue;
    const d = haversineKm(lng, lat, x, y);
    if (d <= radiusKm) hits.push({ feat, d });
  }
  hits.sort((a, b) => a.d - b.d);
  return { total: hits.length, items: hits.slice(0, limit).map((h) => toSidebarPoint(h.feat, h.d)) };
}

async function loadNames(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const names = (await res.json()) as string[];
    for (const feat of master) {
      const name = names[feat.properties.k];
      if (name) feat.properties.n = name;
    }
    post({ type: 'namesReady' });
  } catch (err) {
    console.warn('Project names could not be loaded:', err);
  }
}

function post(message: WorkerResponse) {
  self.postMessage(message);
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'load': {
      try {
        const res = await fetch(msg.pointsUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const file = (await res.json()) as PointsFile;
        metadata = file.metadata;
        master = decode(file);
        current = master;
        buildIndex(current);
        post({
          type: 'ready',
          totalPoints: master.length,
          unlocated: unlocatedCount,
          metadata,
          provinceCounts: provinceCounts(master),
        });
        void loadNames(msg.namesUrl);
      } catch (err) {
        post({ type: 'error', message: `Could not load project pins (${(err as Error).message})` });
      }
      return;
    }

    case 'getClusters': {
      const data = index ? index.getClusters(msg.bbox, Math.floor(msg.zoom)) : [];
      post({ type: 'result', id: msg.id, data });
      return;
    }

    case 'filter': {
      const total = master.length ? applyFilters(msg.filters) : 0;
      post({ type: 'result', id: msg.id, data: total });
      return;
    }

    case 'list': {
      post({ type: 'result', id: msg.id, data: listPoints(msg.limit) });
      return;
    }

    case 'expansionZoom': {
      let zoom = 16;
      try {
        if (index) zoom = index.getClusterExpansionZoom(msg.clusterId);
      } catch {
        // cluster id from a previous index; fall back to a default zoom
      }
      post({ type: 'result', id: msg.id, data: zoom });
      return;
    }

    case 'near': {
      post({ type: 'result', id: msg.id, data: nearPoints(msg.center, msg.radiusKm, msg.limit) });
      return;
    }

    case 'findById': {
      const feat = master.find((f) => f.properties.i === msg.projectId);
      post({
        type: 'result',
        id: msg.id,
        data: feat ? (feat.geometry.coordinates as [number, number]) : null,
      });
      return;
    }
  }
};
