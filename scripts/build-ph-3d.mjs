#!/usr/bin/env node
/**
 * Builds public/geo/ph-3d.json — the small asset behind the landing page's
 * 3D Philippines.
 *
 *   - Province outlines from public/geo/provinces.json (5.5 MB), simplified
 *     (Douglas–Peucker), tiny islets dropped, and projected to a flat plane
 *     with d3-geo so the browser does no geo maths.
 *   - Project counts per province, counted by point-in-polygon from
 *     public/geo/points.json (the same data the map shows). The database's
 *     province column is NOT used: ~50k rows were filed under Ilocos Norte
 *     by the original import, which would make one giant fake column.
 *     Placeholder coordinates (one point in Manila) are skipped.
 *
 * NCR's four districts are merged into "Metro Manila"; Isabela City into Basilan.
 *
 * Usage: npm run generate:points && node scripts/build-ph-3d.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { geoMercator } from 'd3-geo';

const GEO = path.join(process.cwd(), 'public', 'geo');
const OUT = path.join(GEO, 'ph-3d.json');

const SIMPLIFY_DEG = 0.012; // ~1.3 km — invisible at landing-page scale
const MIN_RING_AREA_DEG2 = 0.0015; // drop islets smaller than ~18 km²
const PLACEHOLDER = { lat: 14.5995, lng: 120.9842 };

// ---- geometry helpers ------------------------------------------------------
function perpDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function douglasPeucker(points, tol) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(points[i], points[s], points[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol && idx !== -1) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(a / 2);
}

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygonsOf(geometry) {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

// ---- load ------------------------------------------------------------------
const provinces = JSON.parse(fs.readFileSync(path.join(GEO, 'provinces.json'), 'utf8'));
const regions = JSON.parse(fs.readFileSync(path.join(GEO, 'regions.json'), 'utf8'));
const points = JSON.parse(fs.readFileSync(path.join(GEO, 'points.json'), 'utf8'));

const regionByPsgc = new Map(regions.features.map((f) => [String(f.properties.adm1_psgc), f.properties.name]));

/** Group key + display name; merges NCR districts and Isabela City. */
function groupFor(props) {
  const name = String(props.name || props.province_name || '');
  // BARMM's Special Geographic Area has no name in the source file.
  if (!name && String(props.adm2_psgc) === '1909900000') {
    return { key: 'barmm-sga', name: 'Special Geographic Area (BARMM)', mapProvince: null };
  }
  if (/^NCR/i.test(name)) return { key: 'metro-manila', name: 'Metro Manila', mapProvince: null };
  if (/City of Isabela/i.test(name)) return { key: 'basilan', name: 'Basilan', mapProvince: 'Basilan' };
  return { key: name.toLowerCase(), name, mapProvince: name };
}

// ---- build province groups -----------------------------------------------
const groups = new Map();
for (const f of provinces.features) {
  const g = groupFor(f.properties);
  const region = regionByPsgc.get(String(f.properties.adm1_psgc)) || '';
  if (!groups.has(g.key)) {
    groups.set(g.key, { ...g, region, fullPolys: [], bbox: [Infinity, Infinity, -Infinity, -Infinity], count: 0, flagged: 0, budgetK: 0 });
  }
  const grp = groups.get(g.key);
  for (const poly of polygonsOf(f.geometry)) {
    const outer = poly[0];
    grp.fullPolys.push(poly);
    for (const [x, y] of outer) {
      if (x < grp.bbox[0]) grp.bbox[0] = x;
      if (y < grp.bbox[1]) grp.bbox[1] = y;
      if (x > grp.bbox[2]) grp.bbox[2] = x;
      if (y > grp.bbox[3]) grp.bbox[3] = y;
    }
  }
}
const groupList = [...groups.values()];

// ---- count projects (full-resolution polygons, bbox prefilter) -------------
const n = points.i.length;
let placed = 0;
let skippedPlaceholder = 0;
for (let k = 0; k < n; k++) {
  const x = points.x[k];
  const y = points.y[k];
  if (Math.abs(y - PLACEHOLDER.lat) < 0.001 && Math.abs(x - PLACEHOLDER.lng) < 0.001) {
    skippedPlaceholder++;
    continue;
  }
  for (const g of groupList) {
    const b = g.bbox;
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    let hit = false;
    for (const poly of g.fullPolys) {
      if (pointInRing(x, y, poly[0])) {
        hit = true;
        break;
      }
    }
    if (!hit) continue;
    g.count++;
    // Warning flags only (bit 16 "payment pending" is informational).
    if ((points.f[k] || 0) & 15) g.flagged++;
    g.budgetK += points.b[k] || 0;
    placed++;
    break;
  }
}

// ---- project + simplify ----------------------------------------------------
// Mercator centred on the archipelago; 1 unit ≈ 1 degree of longitude.
const projection = geoMercator().center([122, 12.3]).scale(180 / Math.PI).translate([0, 0]);
const r3 = (v) => Math.round(v * 1000) / 1000;

const out = [];
for (const g of groupList) {
  const shapes = [];
  let biggest = null;
  let biggestArea = 0;
  for (const poly of g.fullPolys) {
    const outer = poly[0];
    const area = ringArea(outer);
    if (area > biggestArea) {
      biggestArea = area;
      biggest = outer;
    }
  }
  for (const poly of g.fullPolys) {
    const outer = poly[0];
    const area = ringArea(outer);
    if (area < MIN_RING_AREA_DEG2 && outer !== biggest) continue;
    const simplified = douglasPeucker(outer, SIMPLIFY_DEG);
    if (simplified.length < 4) continue;
    const flat = [];
    for (const p of simplified) {
      const [px, py] = projection(p);
      flat.push(r3(px), r3(-py)); // flip so north is +y
    }
    shapes.push(flat);
  }
  if (!shapes.length || !biggest) continue;

  // Column anchor: area-weighted centroid of the largest ring, nudged inside if needed.
  let cx = 0;
  let cy = 0;
  let a6 = 0;
  for (let i = 0, j = biggest.length - 1; i < biggest.length; j = i++) {
    const cross = biggest[j][0] * biggest[i][1] - biggest[i][0] * biggest[j][1];
    a6 += cross;
    cx += (biggest[j][0] + biggest[i][0]) * cross;
    cy += (biggest[j][1] + biggest[i][1]) * cross;
  }
  cx /= 3 * a6;
  cy /= 3 * a6;
  if (!pointInRing(cx, cy, biggest)) {
    // Fall back to the ring vertex mean pulled toward the first vertex until inside.
    const v = biggest[Math.floor(biggest.length / 2)];
    cx = (cx + v[0]) / 2;
    cy = (cy + v[1]) / 2;
  }
  const [ax, ay] = projection([cx, cy]);

  out.push({
    name: g.name,
    region: g.region,
    mapProvince: g.mapProvince,
    count: g.count,
    flagged: g.flagged,
    budgetPHP: Math.round(g.budgetK * 1000),
    anchor: [r3(ax), r3(-ay)],
    shapes,
  });
}

out.sort((a, b) => b.count - a.count);

const payload = {
  version: 1,
  generatedAt: new Date().toISOString(),
  totals: { projects: placed, unplaced: n - placed - skippedPlaceholder, placeholder: skippedPlaceholder },
  provinces: out,
};
const json = JSON.stringify(payload);
fs.writeFileSync(OUT, json);

const verts = out.reduce((s, p) => s + p.shapes.reduce((t, sh) => t + sh.length / 2, 0), 0);
console.log(`ph-3d.json: ${(json.length / 1024).toFixed(0)} KB, ${out.length} provinces, ${verts} vertices`);
console.log(`placed ${placed}/${n} projects; ${skippedPlaceholder} placeholder points skipped; ${n - placed - skippedPlaceholder} outside any outline`);
console.log('top 5:', out.slice(0, 5).map((p) => `${p.name} ${p.count}`).join(', '));
