import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchLiveContractFromScraper, syncScrapedContractToDb } from '@/lib/dpwh-scraper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contractId = id.trim();
    const searchParams = request.nextUrl.searchParams;
    const shouldRedirect = searchParams.get('redirect') === 'true';

    let contractDoc = await prisma.contractDocument.findUnique({
      where: { projectId: contractId },
      include: {
        engineerSignature: true,
        project: {
          select: {
            id: true,
            name: true,
            budgetPHP: true,
            contractorRaw: true,
          },
        },
      },
    });

    const hasRealDoc =
      contractDoc &&
      (contractDoc.contractAgreementUrl ||
        contractDoc.noticeToProceedUrl ||
        contractDoc.noticeOfAwardUrl ||
        contractDoc.advertisementUrl ||
        (contractDoc.sourcePdfUrl &&
          contractDoc.sourcePdfUrl.startsWith('http') &&
          contractDoc.sourcePdfUrl.endsWith('.pdf') &&
          !contractDoc.sourcePdfUrl.includes('transparency.dpwh.gov.ph')));

    // If missing or without real PDF URL, fetch from DPWH Transparency API: https://api.transparency.dpwh.gov.ph/projects/{contractId}
    if (!hasRealDoc) {
      try {
        const scraped = await fetchLiveContractFromScraper(contractId);
        if (scraped && scraped.contractId) {
          const syncResult = await syncScrapedContractToDb(scraped);
          contractDoc = await prisma.contractDocument.findUnique({
            where: { projectId: contractId },
            include: {
              engineerSignature: true,
              project: {
                select: {
                  id: true,
                  name: true,
                  budgetPHP: true,
                  contractorRaw: true,
                },
              },
            },
          });
        }
      } catch (err) {
        console.warn(`[Contracts PDF API] Live scrape error for ${contractId}:`, err);
      }
    }

    if (!contractDoc) {
      return Response.json(
        {
          projectId: contractId,
          extractionStatus: 'PENDING',
          message: 'Contract document not yet parsed for this project.',
        },
        { status: 404 }
      );
    }

    const realPdfUrl =
      contractDoc.contractAgreementUrl ||
      contractDoc.noticeToProceedUrl ||
      contractDoc.noticeOfAwardUrl ||
      contractDoc.advertisementUrl ||
      (contractDoc.sourcePdfUrl &&
      contractDoc.sourcePdfUrl.startsWith('http') &&
      contractDoc.sourcePdfUrl.endsWith('.pdf') &&
      !contractDoc.sourcePdfUrl.includes('transparency.dpwh.gov.ph')
        ? contractDoc.sourcePdfUrl
        : null);

    if (shouldRedirect && realPdfUrl) {
      return NextResponse.redirect(realPdfUrl, 307);
    }

    return Response.json({
      contractDocument: contractDoc,
      directPdfUrl: realPdfUrl,
    });
  } catch (error) {
    console.error('Error fetching contract PDF data:', error);
    return Response.json(
      { error: 'Failed to fetch contract document' },
      { status: 500 }
    );
  }
}
