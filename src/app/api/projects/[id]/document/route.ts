import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchLiveContractFromScraper, syncScrapedContractToDb } from '@/lib/dpwh-scraper';

/**
 * GET /api/projects/[id]/document
 * Directs the user to the official contract document PDF resolved from the DPWH Transparency API:
 * Base API: https://api.transparency.dpwh.gov.ph/projects
 * Project Details: https://api.transparency.dpwh.gov.ph/projects/{contractId}
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contractId = id.trim();

    // 1. Check existing record in DB
    let doc = await prisma.contractDocument.findUnique({
      where: { projectId: contractId },
    });

    const getRealDocUrl = (d: typeof doc) => {
      if (!d) return null;
      if (d.contractAgreementUrl && d.contractAgreementUrl.startsWith('http')) return d.contractAgreementUrl;
      if (d.noticeToProceedUrl && d.noticeToProceedUrl.startsWith('http')) return d.noticeToProceedUrl;
      if (d.noticeOfAwardUrl && d.noticeOfAwardUrl.startsWith('http')) return d.noticeOfAwardUrl;
      if (d.advertisementUrl && d.advertisementUrl.startsWith('http')) return d.advertisementUrl;
      if (
        d.sourcePdfUrl &&
        d.sourcePdfUrl.startsWith('http') &&
        d.sourcePdfUrl.endsWith('.pdf') &&
        !d.sourcePdfUrl.includes('transparency.dpwh.gov.ph') &&
        !d.sourcePdfUrl.includes('dpwh.gov.ph/dpwh/business')
      ) {
        return d.sourcePdfUrl;
      }
      return null;
    };

    let targetUrl = getRealDocUrl(doc);

    // 2. If not found in DB, query the official DPWH Transparency API: https://api.transparency.dpwh.gov.ph/projects/{contractId}
    if (!targetUrl) {
      try {
        const scraped = await fetchLiveContractFromScraper(contractId);
        if (scraped && scraped.contractId) {
          const syncResult = await syncScrapedContractToDb(scraped);
          doc = syncResult.contractDoc;
          targetUrl = getRealDocUrl(doc);
        }
      } catch (scraperErr) {
        console.warn(`[Document API] Failed to fetch live contract for ${contractId}:`, scraperErr);
      }
    }

    // 3. If direct document PDF found, redirect directly to the official file
    if (targetUrl) {
      return NextResponse.redirect(targetUrl, 307);
    }

    // 4. Return formatted status if DPWH has not yet published the scanned PDF for this project
    return new NextResponse(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Contract Document Status - ${contractId} | MAPATUNAI</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #011438;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #ffffff;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 24px;
      padding: 36px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      background: #ffb241;
      color: #011438;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 5px 14px;
      border-radius: 9999px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 12px;
      color: #ffffff;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.7);
      margin: 0 0 24px;
    }
    .code {
      font-family: monospace;
      background: rgba(255, 255, 255, 0.1);
      padding: 3px 8px;
      border-radius: 6px;
      color: #ffb241;
      font-weight: bold;
    }
    .btn {
      display: inline-block;
      background: #01367d;
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      font-size: 13px;
      padding: 10px 24px;
      border-radius: 9999px;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #ffb241;
      color: #011438;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">DPWH Transparency API</div>
    <h1>Document Scan Pending Upload</h1>
    <p>Project <span class="code">${contractId}</span> is officially registered, but DPWH Document Control has not yet attached an electronic PDF scan of the signed contract agreement.</p>
    <a href="/projects/${encodeURIComponent(contractId)}" class="btn">&larr; Return to Project Dossier</a>
  </div>
</body>
</html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  } catch (error) {
    console.error('Document redirect route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
