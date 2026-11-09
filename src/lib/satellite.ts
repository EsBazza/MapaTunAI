// Server-only: imports sharp (native). Never import this from a client component.
import sharp from 'sharp';
import type { WaybackRelease } from '@/lib/satellite-releases';

/**
 * Builds one square satellite photo of a project site from Esri World Imagery
 * Wayback tiles, centred on the project's GPS point, with a small marker.
 *
 * z17 ≈ 1.1 m per pixel in the Philippines, so the 768 px image covers ~850 m.
 */

const ZOOM = 17;
const TILE = 256;
export const SATELLITE_IMAGE_SIZE = 768;
const TILE_TIMEOUT_MS = 8000;
const TILE_BASE = 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile';

export interface SiteImage {
  jpeg: Buffer;
  /**
   * The release Esri actually served for the centre tile. Wayback redirects a
   * tile to the release where it last changed, so two releases that resolve to
   * the same id are the SAME photo.
   */
  photoId: string;
  release: WaybackRelease;
}

export class SatelliteUnavailableError extends Error {}

function globalPixel(lat: number, lng: number): { x: number; y: number } {
  const n = 2 ** ZOOM * TILE;
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  };
}

async function fetchTile(m: string, x: number, y: number): Promise<{ buf: Buffer; servedId: string } | null> {
  try {
    const res = await fetch(`${TILE_BASE}/${m}/${ZOOM}/${y}/${x}`, {
      signal: AbortSignal.timeout(TILE_TIMEOUT_MS),
      headers: { 'User-Agent': 'MapaTunAI/1.0 (public infrastructure transparency)' },
    });
    if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) return null;
    const servedId = /\/tile\/(\d+)\//i.exec(res.url)?.[1] ?? m;
    return { buf: Buffer.from(await res.arrayBuffer()), servedId };
  } catch {
    return null;
  }
}

const MARKER_SVG = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SATELLITE_IMAGE_SIZE}" height="${SATELLITE_IMAGE_SIZE}">
    <circle cx="${SATELLITE_IMAGE_SIZE / 2}" cy="${SATELLITE_IMAGE_SIZE / 2}" r="22" fill="none" stroke="#011438" stroke-opacity="0.55" stroke-width="5"/>
    <circle cx="${SATELLITE_IMAGE_SIZE / 2}" cy="${SATELLITE_IMAGE_SIZE / 2}" r="22" fill="none" stroke="#ffb241" stroke-width="2.5"/>
    <circle cx="${SATELLITE_IMAGE_SIZE / 2}" cy="${SATELLITE_IMAGE_SIZE / 2}" r="3.5" fill="#ffb241"/>
  </svg>`
);

async function buildSiteImage(lat: number, lng: number, release: WaybackRelease): Promise<SiteImage> {
  const half = SATELLITE_IMAGE_SIZE / 2;
  const { x: px, y: py } = globalPixel(lat, lng);
  const left = Math.round(px - half);
  const top = Math.round(py - half);
  const tx0 = Math.floor(left / TILE);
  const ty0 = Math.floor(top / TILE);
  const tx1 = Math.floor((left + SATELLITE_IMAGE_SIZE - 1) / TILE);
  const ty1 = Math.floor((top + SATELLITE_IMAGE_SIZE - 1) / TILE);

  const jobs: Array<Promise<{ tx: number; ty: number; tile: Awaited<ReturnType<typeof fetchTile>> }>> = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      jobs.push(fetchTile(release.m, tx, ty).then((tile) => ({ tx, ty, tile })));
    }
  }
  const tiles = await Promise.all(jobs);
  const ok = tiles.filter((t) => t.tile);
  // Tolerate a missing edge tile, but not a mostly-empty photo.
  if (ok.length < Math.ceil(tiles.length * 0.75)) {
    throw new SatelliteUnavailableError(`Only ${ok.length}/${tiles.length} imagery tiles loaded`);
  }

  const centre = tiles.find((t) => t.tx === Math.floor(px / TILE) && t.ty === Math.floor(py / TILE));
  if (!centre?.tile) throw new SatelliteUnavailableError('The tile at the project point did not load');

  const canvasW = (tx1 - tx0 + 1) * TILE;
  const canvasH = (ty1 - ty0 + 1) * TILE;
  const mosaic = await sharp({
    create: { width: canvasW, height: canvasH, channels: 3, background: '#1e293b' },
  })
    .composite(ok.map((t) => ({ input: t.tile!.buf, left: (t.tx - tx0) * TILE, top: (t.ty - ty0) * TILE })))
    .png()
    .toBuffer();

  const jpeg = await sharp(mosaic)
    .extract({ left: left - tx0 * TILE, top: top - ty0 * TILE, width: SATELLITE_IMAGE_SIZE, height: SATELLITE_IMAGE_SIZE })
    .composite([{ input: MARKER_SVG }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  return { jpeg, photoId: centre.tile.servedId, release };
}

// ─── Small in-memory cache (per server instance) ────────────────────────────

const MAX_CACHED = 80;
const cache = new Map<string, Promise<SiteImage>>();

export function getSiteImage(lat: number, lng: number, release: WaybackRelease): Promise<SiteImage> {
  const key = `${release.m}:${lat.toFixed(5)}:${lng.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key); // refresh LRU position
    cache.set(key, hit);
    return hit;
  }
  const pending = buildSiteImage(lat, lng, release);
  cache.set(key, pending);
  pending.catch(() => cache.delete(key)); // never cache failures
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value as string);
  return pending;
}
