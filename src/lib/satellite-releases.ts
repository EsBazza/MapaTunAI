import { ESRI_WAYBACK_CATALOG } from '@/lib/constants';
import type { SatelliteVerdict } from '@/lib/ai-summary';

/**
 * Picks which Esri Wayback releases to compare. Pure + client-safe (no sharp).
 *
 * "Before" = the last release published BEFORE work started, so the photo shows
 * the site as it was. If the project started before the oldest release we have
 * (2014), we use the oldest one and say so.
 * "After" = the newest release.
 */

export interface WaybackRelease {
  year: number;
  m: string;
  name: string;
  releaseDate: string;
}

const RELEASES: WaybackRelease[] = Object.entries(ESRI_WAYBACK_CATALOG)
  .map(([year, r]) => ({ year: Number(year), m: r.m, name: r.name, releaseDate: r.releaseDate }))
  .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));

export const OLDEST_RELEASE = RELEASES[0];
export const LATEST_RELEASE = RELEASES[RELEASES.length - 1];

export type SatelliteWhen = 'start' | 'latest';

export interface ReleasePair {
  before: WaybackRelease;
  after: WaybackRelease;
  /** Work started before our oldest photo, so "before" may already show work. */
  startsBeforeArchive: boolean;
  /** No newer photo has been published since work started. */
  noPhotoSinceStart: boolean;
}

export function pickReleases(startDate: string | Date | null | undefined): ReleasePair {
  const start = startDate ? new Date(startDate) : null;
  const startIso = start && !isNaN(start.getTime()) ? start.toISOString().slice(0, 10) : null;

  let before = OLDEST_RELEASE;
  let startsBeforeArchive = !startIso;
  if (startIso) {
    const earlier = RELEASES.filter((r) => r.releaseDate < startIso);
    if (earlier.length) before = earlier[earlier.length - 1];
    else startsBeforeArchive = true;
  }

  const after = LATEST_RELEASE;
  return {
    before,
    after,
    startsBeforeArchive,
    noPhotoSinceStart: !!startIso && after.releaseDate <= startIso,
  };
}

export function releaseFor(when: SatelliteWhen, startDate: string | Date | null | undefined): WaybackRelease {
  const pair = pickReleases(startDate);
  return when === 'start' ? pair.before : pair.after;
}

// ─── /api/ai/satellite response (shared with the UI) ─────────

export type SatelliteStatus = 'ok' | 'same_photo' | 'unavailable';
export type UnavailableReason = 'no_location' | 'too_recent' | 'imagery' | 'ai_off' | 'error' | 'not_found';

export interface PhotoInfo {
  year: number;
  releaseDate: string;
  url: string;
}

export interface SatelliteCheckResponse {
  status: SatelliteStatus;
  reason?: UnavailableReason;
  before?: PhotoInfo;
  after?: PhotoInfo;
  startsBeforeArchive?: boolean;
  verdict?: SatelliteVerdict;
  cached?: boolean;
}

