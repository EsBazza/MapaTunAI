'use client';

import { useQuery } from '@tanstack/react-query';

/** One province in public/geo/ph-3d.json (built by scripts/build-ph-3d.mjs). */
export interface Ph3dProvince {
  name: string;
  region: string;
  /** Name to pass to /map?province=…; null when the map has no single province for it (Metro Manila, SGA). */
  mapProvince: string | null;
  count: number;
  flagged: number;
  budgetPHP: number;
  /** Projected [x, y] (north = +y) where the column stands. */
  anchor: [number, number];
  /** Outer rings, flat [x0, y0, x1, y1, …] in the same projected plane. */
  shapes: number[][];
}

export interface Ph3dData {
  version: number;
  generatedAt: string;
  totals: { projects: number; unplaced: number; placeholder: number };
  provinces: Ph3dProvince[];
}

export function usePh3dData() {
  return useQuery<Ph3dData>({
    queryKey: ['ph-3d'],
    queryFn: async () => {
      const res = await fetch('/geo/ph-3d.json');
      if (!res.ok) throw new Error('Could not load the country overview');
      return res.json();
    },
    staleTime: Infinity,
  });
}

/** Share of projects with at least one warning sign (0–1). */
export const warningShare = (p: Pick<Ph3dProvince, 'count' | 'flagged'>) => (p.count > 0 ? p.flagged / p.count : 0);

/**
 * Warning share → colour + plain label. Shares are small nationally (max ≈ 6%),
 * so the steps are set where differences are meaningful, not at 30/50%.
 * Always shown with a label, never colour alone.
 */
// Colours are the site's risk tokens (globals.css: --color-risk-*), as literals
// because three.js materials can't read CSS variables.
export const WARNING_LEVELS = [
  { min: 0.03, label: 'More warning signs', color: '#dc2626' }, // --color-risk-critical
  { min: 0.01, label: 'Some warning signs', color: '#d97706' }, // --color-risk-elevated
  { min: 0, label: 'Few warning signs', color: '#0f9d6b' }, // --color-risk-low
] as const;

export function warningLevel(share: number) {
  return WARNING_LEVELS.find((l) => share >= l.min) ?? WARNING_LEVELS[WARNING_LEVELS.length - 1];
}

/** Where clicking a province should take you on the map. */
export function mapHrefFor(p: Ph3dProvince): string {
  const params = new URLSearchParams();
  if (p.region) params.set('region', p.region);
  if (p.mapProvince) params.set('province', p.mapProvince);
  return `/map?${params.toString()}`;
}

/** Region totals, derived from the same GPS-based counts as the 3D view. */
export interface RegionSummary {
  name: string;
  count: number;
  flagged: number;
  budgetPHP: number;
}

export function summariseRegions(data: Ph3dData): RegionSummary[] {
  const byRegion = new Map<string, RegionSummary>();
  for (const p of data.provinces) {
    const key = p.region || 'Other areas';
    const r = byRegion.get(key) ?? { name: key, count: 0, flagged: 0, budgetPHP: 0 };
    r.count += p.count;
    r.flagged += p.flagged;
    r.budgetPHP += p.budgetPHP;
    byRegion.set(key, r);
  }
  return [...byRegion.values()].filter((r) => r.count > 0);
}
