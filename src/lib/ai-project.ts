// Server-only helpers shared by the AI routes (imports prisma).
import { prisma } from '@/lib/prisma';
import { computeRiskScore } from '@/lib/anomaly-flags';
import { displayLocation } from '@/lib/location';
import { cleanProjectTitle } from '@/lib/title-cleaner';
import { buildFacts, parseSummaryCache, type SummaryCache, type SummaryFacts } from '@/lib/ai-summary';

export async function loadProjectForAi(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      province: { include: { region: true } },
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { rating: true, progressRating: true, workersActive: true, comment: true, phoneVerified: true },
      },
    },
  });
  if (!project) return null;

  // Same location the rest of the site shows (GPS first, catch-all province ignored).
  const loc = displayLocation(project);
  const riskScore = computeRiskScore(project);
  const facts: SummaryFacts = buildFacts({
    ...project,
    name: cleanProjectTitle(project.name),
    provinceName: loc.source === 'unknown' ? null : loc.province,
    regionName: loc.source === 'unknown' ? null : loc.region,
    riskScore,
  });
  return { project, facts, riskScore };
}

/**
 * Read-modify-write of the cache column, re-reading first so the summary and
 * satellite writers don't overwrite each other's entries.
 */
export async function updateAiCache(projectId: string, mutate: (cache: SummaryCache) => void): Promise<void> {
  try {
    const row = await prisma.project.findUnique({ where: { id: projectId }, select: { aiSummary: true } });
    const cache = parseSummaryCache(row?.aiSummary);
    mutate(cache);
    await prisma.project.update({ where: { id: projectId }, data: { aiSummary: JSON.stringify(cache) } });
  } catch (err) {
    console.warn(`Failed to save AI cache for ${projectId}:`, err);
  }
}
