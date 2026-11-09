#!/usr/bin/env node
/**
 * Compacts public/geo/all_projects.json (~65 MB GeoJSON) into two files the
 * map can load quickly:
 *
 *   public/geo/points.json  – columnar arrays (id, lng, lat, budget, progress,
 *                             status, region, province, flags, category)
 *   public/geo/names.json   – project names, same order as points.json.
 *                             Loaded lazily after the pins are on screen.
 *
 * Usage: npm run generate:points
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const GEO_DIR = path.join(process.cwd(), 'public', 'geo');
const SOURCE = path.join(GEO_DIR, 'all_projects.json');

/** Collapse the messy DPWH category labels into a few plain groups. */
function cleanCategory(raw) {
  const c = String(raw ?? '').toLowerCase();
  if (c.startsWith('road')) return 'Roads';
  if (c.startsWith('bridge')) return 'Bridges';
  if (c.startsWith('flood') || c.startsWith('rain') || c.startsWith('septage') || c.startsWith('dam')) return 'Flood control';
  if (c.startsWith('building') || c.startsWith('hospital')) return 'Buildings';
  if (c.startsWith('water')) return 'Water';
  return 'Other';
}

const round5 = (n) => Math.round(Number(n) * 1e5) / 1e5;

const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const features = source.features ?? [];

const cats = [];
const catIndex = new Map();
const cols = { i: [], x: [], y: [], b: [], g: [], s: [], r: [], v: [], f: [], c: [] };
const names = [];

for (const feature of features) {
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) continue;
  const p = feature.properties ?? {};

  const cat = cleanCategory(p.c);
  if (!catIndex.has(cat)) {
    catIndex.set(cat, cats.length);
    cats.push(cat);
  }

  cols.i.push(String(p.i ?? ''));
  cols.x.push(round5(coords[0]));
  cols.y.push(round5(coords[1]));
  cols.b.push(Number(p.b) || 0); // thousands of pesos
  cols.g.push(Math.round((Number(p.g) || 0) * 10) / 10);
  cols.s.push(Number.isInteger(p.s) ? p.s : 4); // 4 = "Other"
  cols.r.push(Number.isInteger(p.r) ? p.r : -1);
  cols.v.push(Number.isInteger(p.v) ? p.v : -1);
  cols.f.push(Number(p.f) || 0);
  cols.c.push(catIndex.get(cat));
  names.push(String(p.n ?? '').trim());
}

const points = {
  version: 1,
  generatedAt: new Date().toISOString(),
  count: cols.i.length,
  budgetUnit: 1000,
  metadata: {
    regions: source.metadata?.regions ?? [],
    provinces: source.metadata?.provinces ?? [],
    provinceToRegion: source.metadata?.provinceToRegion ?? [],
    statusLabels: source.metadata?.statusLabels ?? [],
  },
  cats,
  ...cols,
};

const pointsJson = JSON.stringify(points);
const namesJson = JSON.stringify(names);
fs.writeFileSync(path.join(GEO_DIR, 'points.json'), pointsJson);
fs.writeFileSync(path.join(GEO_DIR, 'names.json'), namesJson);

const mb = (n) => (n / 1e6).toFixed(2);
const gz = (s) => zlib.gzipSync(s).length;
console.log(`points.json: ${points.count} projects, ${mb(pointsJson.length)} MB (${mb(gz(pointsJson))} MB gzipped)`);
console.log(`names.json:  ${mb(namesJson.length)} MB (${mb(gz(namesJson))} MB gzipped)`);
console.log(`categories:  ${cats.join(', ')}`);
