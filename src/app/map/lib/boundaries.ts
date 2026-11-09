import { pointInPolygons, toPolygons, type AreaFeature, type AreaGeometry } from '@/lib/geo-bounds';

/**
 * Resolves the names used in the drill-down menus (DPWH style, e.g.
 * "Bicol Region (Region V)", "Compostela Valley") to the PSGC codes used by
 * the PSA boundary files (e.g. "Region V (Bicol Region)", "Davao de Oro").
 *
 * Every border on the map goes through this one index, so the outline, the
 * dark mask, the camera fit and the pin filter always agree.
 */

export interface BoundaryProps {
  psgcCode: number;
  name: string;
  adm1_psgc?: number;
  provincePsgc?: number;
  geo_level?: string | null;
  [key: string]: unknown;
}

export type BoundaryFeature = AreaFeature<BoundaryProps>;

export interface BoundaryCollection {
  type: 'FeatureCollection';
  features: BoundaryFeature[];
}

/** Lowercase, drop "City of", "(…)", "City" suffix and punctuation. */
export function normName(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/\(not a province\)/g, '')
    .replace(/^city of\s+/, '')
    .replace(/\s+city$/, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** A stable key for a region regardless of how its name is written. */
export function regionKey(value: string | null | undefined): string {
  const n = (value ?? '').toLowerCase();
  if (n.includes('national capital') || /\bncr\b/.test(n) || n.includes('metro')) return 'NCR';
  if (n.includes('cordillera') || /\bcar\b/.test(n)) return 'CAR';
  if (n.includes('muslim') || n.includes('bangsamoro') || /\bb?armm\b/.test(n)) return 'BARMM';
  if (n.includes('mimaropa') || /\biv-b\b/.test(n)) return 'IV-B';
  if (n.includes('calabarzon') || /\biv-a\b/.test(n)) return 'IV-A';
  if (n.includes('caraga') || /\bxiii\b/.test(n)) return 'XIII';
  const roman = n.match(/region\s+([ivx]+)\b/);
  return roman ? roman[1].toUpperCase() : n.replace(/[^a-z0-9]/g, '');
}

/** DPWH province names that no longer match the PSA boundary names. */
const PROVINCE_ALIASES: Record<string, string[]> = {
  maguindanao: ['maguindanaodelnorte', 'maguindanaodelsur'],
  shariffkabunsuan: ['maguindanaodelnorte'],
  compostelavalley: ['davaodeoro'],
  northcotabato: ['cotabato'],
};

const NCR_NAMES = new Set(['metropolitanmanila', 'metromanila', 'ncr', 'nationalcapitalregion']);

export class BoundaryIndex {
  readonly regions: BoundaryFeature[];
  readonly provinces: BoundaryFeature[];
  municities: BoundaryFeature[] = [];

  private regionByKey = new Map<string, BoundaryFeature>();
  private provincesByName = new Map<string, BoundaryFeature[]>();

  constructor(regions: BoundaryCollection, provinces: BoundaryCollection) {
    this.regions = regions.features;
    this.provinces = provinces.features;

    for (const feature of this.regions) {
      this.regionByKey.set(regionKey(feature.properties.name), feature);
    }
    for (const feature of this.provinces) {
      const key = normName(feature.properties.name);
      const list = this.provincesByName.get(key) ?? [];
      // Real provinces first, "(Not a Province)" cities after
      if (feature.properties.geo_level === 'Prov') list.unshift(feature);
      else list.push(feature);
      this.provincesByName.set(key, list);
    }
  }

  setMunicities(collection: BoundaryCollection) {
    this.municities = collection.features;
  }

  regionCodes(regionName: string): number[] {
    const feature = this.regionByKey.get(regionKey(regionName));
    return feature ? [feature.properties.psgcCode] : [];
  }

  provinceCodes(provinceName: string, regionName?: string): number[] {
    const key = normName(provinceName);

    if (NCR_NAMES.has(key)) {
      return this.provinces
        .filter((p) => (p.properties.name ?? '').toLowerCase().startsWith('ncr'))
        .map((p) => p.properties.psgcCode);
    }

    const keys = PROVINCE_ALIASES[key] ?? [key];
    const regionCode = regionName ? this.regionCodes(regionName)[0] : undefined;
    const codes: number[] = [];

    for (const k of keys) {
      const candidates = this.provincesByName.get(k) ?? [];
      const inRegion = regionCode
        ? candidates.filter((c) => c.properties.adm1_psgc === regionCode)
        : candidates;
      const pick = (inRegion.length ? inRegion : candidates)[0];
      if (pick) codes.push(pick.properties.psgcCode);
    }
    return codes;
  }

  /**
   * Finds a city/municipality. Tries the name inside the selected province
   * first, then the point given as a hint (e.g. the city centroid), then the
   * name anywhere in the country.
   */
  cityCodes(cityName: string, provinceCodes: number[], hint?: [number, number]): number[] {
    if (!this.municities.length) return [];
    const key = normName(cityName);
    const inProvince = provinceCodes.length
      ? this.municities.filter((m) => provinceCodes.includes(Number(m.properties.provincePsgc)))
      : [];

    const byName = inProvince.filter((m) => normName(m.properties.name) === key);
    if (byName.length) return byName.map((m) => m.properties.psgcCode);

    if (hint) {
      const [lng, lat] = hint;
      const pool = inProvince.length ? [...inProvince, ...this.municities] : this.municities;
      const hit = pool.find((m) => pointInPolygons(lng, lat, toPolygons(m.geometry)));
      if (hit) return [hit.properties.psgcCode];
    }

    const anywhere = this.municities.filter((m) => normName(m.properties.name) === key);
    return anywhere.length === 1 ? [anywhere[0].properties.psgcCode] : [];
  }

  features(level: 'region' | 'province' | 'city', codes: number[]): BoundaryFeature[] {
    if (!codes.length) return [];
    const pool = level === 'region' ? this.regions : level === 'province' ? this.provinces : this.municities;
    const set = new Set(codes);
    return pool.filter((f) => set.has(f.properties.psgcCode));
  }
}

export function geometriesOf(features: AreaFeature[]): AreaGeometry[] {
  return features.map((f) => f.geometry).filter(Boolean);
}
