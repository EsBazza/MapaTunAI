/**
 * Browser-safe coordinate helpers (no Node imports — usable from client components).
 *
 * ~33k imported projects share one placeholder point in Manila. Their GPS says
 * nothing about where the project really is.
 */
const PLACEHOLDER = { lat: 14.5995, lng: 120.9842 };

export function isPlaceholderCoords(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null || !lat || !lng) return true;
  return Math.abs(lat - PLACEHOLDER.lat) < 0.001 && Math.abs(lng - PLACEHOLDER.lng) < 0.001;
}
