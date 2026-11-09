'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

interface CityItem {
  id: string;
  name: string;
  file?: string;
}

interface ProvinceItem {
  id: string;
  name: string;
  cities: CityItem[];
}

interface RegionItem {
  id: string;
  name: string;
  provinces: ProvinceItem[];
}

interface LocationHierarchy {
  regions: RegionItem[];
  totalRegions: number;
  totalProvinces: number;
  totalCities: number;
}

// Philippine standard region ordering: NCR, CAR, Regions I–XIII, then BARMM
function getRegionSortOrder(name: string): number {
  const n = name.toLowerCase();
  if (n.includes('ncr') || n.includes('national capital')) return 0;
  if (n.includes('car') && !n.includes('caraga')) return 1;
  if (/region\s+i\b|\(region\s+i\)/.test(n)) return 2;
  if (/region\s+ii\b|\(region\s+ii\)/.test(n)) return 3;
  if (/region\s+iii\b|\(region\s+iii\)/.test(n)) return 4;
  if (/region\s+iv-a|\(region\s+iv-a\)/.test(n)) return 5;
  if (/region\s+iv-b|\(region\s+iv-b\)/.test(n)) return 6;
  if (/region\s+v\b|\(region\s+v\)/.test(n)) return 7;
  if (/region\s+vi\b|\(region\s+vi\)/.test(n)) return 8;
  if (/region\s+vii\b|\(region\s+vii\)/.test(n)) return 9;
  if (/region\s+viii\b|\(region\s+viii\)/.test(n)) return 10;
  if (/region\s+ix\b|\(region\s+ix\)/.test(n)) return 11;
  if (/region\s+x\b|\(region\s+x\)/.test(n)) return 12;
  if (/region\s+xi\b|\(region\s+xi\)/.test(n)) return 13;
  if (/region\s+xii\b|\(region\s+xii\)/.test(n)) return 14;
  if (/region\s+xiii\b|\(region\s+xiii\)/.test(n)) return 15;
  if (n.includes('caraga')) return 16;
  if (n.includes('armm') || n.includes('barmm') || n.includes('muslim')) return 17;
  return 99;
}

export interface Centroids {
  regions: Record<string, { center: [number, number]; bounds: [[number, number], [number, number]]; zoom: number }>;
  provinces: Record<string, { center: [number, number]; bounds: [[number, number], [number, number]]; zoom: number }>;
  cities: Record<string, { center: [number, number]; bounds: [[number, number], [number, number]]; zoom: number }>;
}

export function useLocationHierarchy() {
  const [hierarchy, setHierarchy] = useState<LocationHierarchy | null>(null);
  const [centroids, setCentroids] = useState<Centroids | null>(null);

  useEffect(() => {
    fetch('/api/locations/hierarchy')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d) setHierarchy(d);
      })
      .catch(console.error);

    fetch('/geo/region_centroids.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d) setCentroids(d);
      })
      .catch(console.error);
  }, []);

  // Sort regions by Philippine standard order
  const sortedRegions = useMemo(() => {
    if (!hierarchy?.regions) return [];
    return [...hierarchy.regions].sort(
      (a, b) => getRegionSortOrder(a.name) - getRegionSortOrder(b.name),
    );
  }, [hierarchy]);

  const getProvinces = useCallback(
    (regionName: string): ProvinceItem[] => {
      if (!regionName || !hierarchy?.regions) return [];
      const reg = hierarchy.regions.find(
        (r) => r.name.toLowerCase() === regionName.toLowerCase(),
      );
      return reg?.provinces || [];
    },
    [hierarchy],
  );

  const getCities = useCallback(
    (regionName: string, provinceName: string): CityItem[] => {
      const provinces = getProvinces(regionName);
      const prov = provinces.find(
        (p) => p.name.toLowerCase() === provinceName.toLowerCase(),
      );
      return prov?.cities || [];
    },
    [getProvinces],
  );

  /**
   * Fallback camera target from region_centroids.json, used only when an
   * area has no polygon in the boundary files (e.g. some lakes and cities).
   */
  const getCentroid = useCallback(
    (sel: { region: string; province: string; municipality: string; cityFile?: string }) => {
      if (!centroids) return null;
      const lower = (s: string) => s.toLowerCase().trim();
      let entry: Centroids['regions'][string] | undefined;
      if (sel.municipality) {
        entry =
          (sel.cityFile ? centroids.cities[sel.cityFile] : undefined) ||
          centroids.cities[`${sel.province}::${sel.municipality}`] ||
          centroids.cities[sel.municipality] ||
          centroids.cities[lower(sel.municipality)];
      } else if (sel.province) {
        entry =
          centroids.provinces[`${sel.region}::${sel.province}`] ||
          centroids.provinces[sel.province] ||
          centroids.provinces[lower(sel.province)];
      } else if (sel.region) {
        entry = centroids.regions[sel.region] || centroids.regions[lower(sel.region)];
      }
      if (!entry) return null;
      // Ignore placeholder entries that sit outside the Philippines
      const [lng, lat] = entry.center;
      if (lng < 114 || lng > 129 || lat < 4 || lat > 22) return null;
      return entry;
    },
    [centroids],
  );

  return {
    hierarchy,
    sortedRegions,
    centroids,
    getProvinces,
    getCities,
    getCentroid,
  };
}
