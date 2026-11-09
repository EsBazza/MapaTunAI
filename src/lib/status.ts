/**
 * Canonical project status values. DPWH sources spell these inconsistently
 * ("Ongoing", "On-Going", "on going", "COMPLETED"...), so every write path
 * should pass raw values through `normalizeStatus` first.
 */
export const PROJECT_STATUSES = [
  'Completed',
  'On-Going',
  'Not Yet Started',
  'Suspended',
  'Terminated',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number] | string;

export function normalizeStatus(raw: string | null | undefined): ProjectStatus {
  const s = (raw ?? '').trim();
  if (!s) return 'Not Yet Started';
  const key = s.toLowerCase().replace(/[\s_-]+/g, '');
  if (key === 'ongoing' || key === 'inprogress') return 'On-Going';
  if (key === 'completed' || key === 'complete' || key === 'done') return 'Completed';
  if (key === 'notyetstarted' || key === 'notstarted' || key === 'pending') return 'Not Yet Started';
  if (key === 'suspended' || key === 'onhold') return 'Suspended';
  if (key === 'terminated' || key === 'cancelled' || key === 'canceled') return 'Terminated';
  return s;
}

export function isOngoing(status: string | null | undefined): boolean {
  return normalizeStatus(status) === 'On-Going';
}

export function isCompleted(status: string | null | undefined): boolean {
  return normalizeStatus(status) === 'Completed';
}
