// Server-only: imported by layout.tsx and opengraph-image.tsx (uses Prisma + fs).
import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { cleanProjectTitle } from '@/lib/title-cleaner';
import { displayLocation } from '@/lib/location';
import { computeRiskScore } from '@/lib/anomaly-flags';
import { getWarningLevel, WARNING_LABELS, type WarningLevel } from '@/lib/ai-summary';

export interface ShareSummary {
  id: string;
  title: string;
  place: string;
  budgetPHP: number;
  paidPct: number | null;
  workPct: number;
  riskScore: number;
  warningLevel: WarningLevel;
  warningLabel: string;
}

/**
 * The few public facts used by the page <head> and the share image.
 * Reads the DB only (never the live scraper or Gemini) so link previews stay fast.
 * Returns null when the project is unknown or the DB is unreachable.
 */
export const getShareSummary = cache(async (id: string): Promise<ShareSummary | null> => {
  try {
    const p = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        gpsLat: true,
        gpsLng: true,
        budgetPHP: true,
        amountPaid: true,
        progress: true,
        startDate: true,
        flagStalled: true,
        flagOverdue: true,
        flagNeverStarted: true,
        flagOverpaid: true,
        province: { select: { name: true, region: { select: { name: true } } } },
        reviews: { select: { phoneVerified: true, rating: true } },
      },
    });
    if (!p) return null;

    const loc = displayLocation(p);
    const riskScore = computeRiskScore(p);
    const level = getWarningLevel(riskScore);
    return {
      id: p.id,
      title: cleanProjectTitle(p.name),
      place: loc.source === 'unknown' ? 'Location not confirmed' : [loc.province, loc.region].filter(Boolean).join(', '),
      budgetPHP: p.budgetPHP,
      paidPct: p.budgetPHP > 0 ? Math.round((p.amountPaid / p.budgetPHP) * 100) : null,
      workPct: Math.round(p.progress || 0),
      riskScore,
      warningLevel: level,
      warningLabel: WARNING_LABELS.en[level],
    };
  } catch (err) {
    console.warn(`[share] could not load project ${id}:`, err);
    return null;
  }
});
