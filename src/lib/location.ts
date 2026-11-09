// Server-side only (geo-spatial reads polygon files from disk). Client code: use '@/lib/coords'.
import { resolveProvinceAndRegion } from '@/lib/geo-spatial';
import { isPlaceholderCoords } from '@/lib/coords';

export { isPlaceholderCoords };

/**
 * The original import dumped every project whose province it could not work
 * out into Ilocos Norte (~50k rows), so that stored value is not trustworthy.
 */
const CATCH_ALL_PROVINCE = 'ilocos norte';

export const UNCONFIRMED_LOCATION = 'Location not confirmed';

export interface DisplayLocation {
  province: string;
  region: string;
  /** 'gps' = from the project's coordinates; 'record' = stored province; 'unknown' = neither is reliable */
  source: 'gps' | 'record' | 'unknown';
}

interface LocatableProject {
  gpsLat: number | null;
  gpsLng: number | null;
  province?: { name?: string | null; region?: { name?: string | null } | null } | null;
}

/**
 * Where to tell people a project is.
 * Real coordinates win (they are what the map shows); placeholder coordinates
 * fall back to the stored province unless it is the import's catch-all.
 */
export function displayLocation(project: LocatableProject): DisplayLocation {
  const storedProvince = project.province?.name?.trim() || '';
  const storedRegion = project.province?.region?.name?.trim() || '';

  if (!isPlaceholderCoords(project.gpsLat, project.gpsLng)) {
    const spatial = resolveProvinceAndRegion(project.gpsLng as number, project.gpsLat as number);
    if (spatial) return { province: spatial.province, region: spatial.region, source: 'gps' };
  }

  if (storedProvince && storedProvince.toLowerCase() !== CATCH_ALL_PROVINCE) {
    return { province: storedProvince, region: storedRegion, source: 'record' };
  }

  return { province: UNCONFIRMED_LOCATION, region: '', source: 'unknown' };
}
