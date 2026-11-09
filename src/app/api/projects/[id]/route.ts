import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { displayLocation } from '@/lib/location';
import { cleanProjectTitle } from '@/lib/title-cleaner';
import { computeRiskScore } from '@/lib/anomaly-flags';
import { fetchLiveContractFromScraper, syncScrapedContractToDb } from '@/lib/dpwh-scraper';
import { jsonError } from '@/lib/api';
import { PUBLIC_REVIEW_SELECT } from '@/lib/review-select';

const PROJECT_INCLUDE = {
  province: { include: { region: true } },
  comments: {
    where: { phoneVerified: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      text: true,
      severity: true,
      rationale: true,
      corroborationCount: true,
      photoUrl: true,
      createdAt: true,
    },
  },
  reviews: {
    orderBy: { createdAt: 'desc' },
    select: PUBLIC_REVIEW_SELECT,
  },
  contractDocument: { include: { engineerSignature: true } },
} satisfies Prisma.ProjectInclude;

function findProject(id: string) {
  return prisma.project.findUnique({ where: { id }, include: PROJECT_INCLUDE });
}

/** True for a document URL that points at an actual file rather than a DPWH landing page. */
function isRealDocUrl(url: string | null | undefined): url is string {
  return !!url && url.startsWith('http') && !url.includes('dpwh.gov.ph/dpwh/business');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = decodeURIComponent(rawId).trim();
    if (!id) return jsonError(400, 'Project id is required.');

    let project = await findProject(id);

    // Only reach out to the live DPWH scraper when we have no record at all.
    // (It is slow and writes to the DB, so it must not run on every page view.)
    if (!project) {
      try {
        const scraped = await fetchLiveContractFromScraper(id);
        if (scraped?.contractId) {
          const synced = await syncScrapedContractToDb(scraped);
          if (synced) project = await findProject(id);
        }
      } catch (err) {
        console.warn(`[projects/${id}] live DPWH lookup failed:`, err);
      }
    }

    if (!project) {
      return jsonError(404, 'We could not find this project in the DPWH records.');
    }

    // The DB province can be wrong for older imports; prefer the one the GPS point falls in.
    const location = displayLocation(project);
    const resolvedProvince = location.province;
    const resolvedRegion = location.region || project.province?.region?.name;

    const riskScore = computeRiskScore(project);
    const doc = project.contractDocument;
    const bestDocUrl = doc
      ? [doc.contractAgreementUrl, doc.noticeToProceedUrl, doc.noticeOfAwardUrl, doc.advertisementUrl, doc.sourcePdfUrl].find(
          isRealDocUrl
        ) ?? ''
      : '';

    const enrichedProject = {
      ...project,
      name: cleanProjectTitle(project.name),
      rawName: project.name,
      riskScore,
      location,
      province: {
        id: project.province?.id || '',
        name: resolvedProvince || '',
        region: {
          id: project.province?.region?.id || '',
          name: resolvedRegion || '',
        },
      },
      contractDocument: doc ? { ...doc, sourcePdfUrl: bestDocUrl } : null,
    };

    return Response.json(
      { project: enrichedProject, riskScore },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
    );
  } catch (error) {
    console.error('Error fetching project:', error);
    return jsonError(500, 'Something went wrong while loading this project. Please try again.');
  }
}
