'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  ExternalLink,
  Download,
  Loader2,
  Table as TableIcon,
  Archive,
  Info,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { ProjectDetailData } from '@/hooks/use-projects';

interface FinancialsTabProps {
  project: ProjectDetailData;
}

interface BoqItem {
  id: string;
  itemCode: string;
  description: string;
  quantity: number;
  unit: string;
  unitCostPhp: number;
  totalPhp: number;
  nationalAvgPhp: number | null;
  regionalAvgPhp: number | null;
  variancePct: number | null;
  flagUnitPriceAnomaly: boolean;
}

interface BoqResponse {
  projectId: string;
  extractionStatus: string;
  totalBoqCost: number;
  mobilizationCost: number;
  flagMobilizationInflated: boolean;
  items: BoqItem[];
}

export default function FinancialsTab({ project }: FinancialsTabProps) {
  const [boqData, setBoqData] = useState<BoqResponse | null>(null);
  const [isLoadingBoq, setIsLoadingBoq] = useState<boolean>(true);

  // Official DPWH Documents
  const doc = project.contractDocument;
  const verifiedPdfUrl =
    doc?.contractAgreementUrl ||
    doc?.noticeToProceedUrl ||
    doc?.noticeOfAwardUrl ||
    doc?.advertisementUrl ||
    (doc?.sourcePdfUrl &&
    !doc.sourcePdfUrl.includes('transparency.dpwh.gov.ph') &&
    doc.sourcePdfUrl.startsWith('http')
      ? doc.sourcePdfUrl
      : '');

  const disbursementPct =
    project.budgetPHP > 0 ? Math.round((project.amountPaid / project.budgetPHP) * 100) : 0;
  const progressPct = Math.round(project.progress || 0);
  const remainingBalance = Math.max(0, project.budgetPHP - project.amountPaid);
  const deltaPct = disbursementPct - progressPct;

  useEffect(() => {
    const controller = new AbortController();

    async function loadBoq() {
      setIsLoadingBoq(true);
      try {
        const res = await fetch(`/api/contracts/${project.id}/boq`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setBoqData(data);
        }
      } catch (err: unknown) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Failed to load BOQ items:', err);
        }
      } finally {
        setIsLoadingBoq(false);
      }
    }

    loadBoq();

    return () => controller.abort();
  }, [project.id]);

  return (
    <div className="space-y-8">
      {/* SECTION 1: Tabular Financial Ledger Card */}
      <div className="rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-gray-400">
              Contract Financial Reconciliation
            </span>
            <h3 className="text-xl font-black text-[#01367d] tracking-tight">
              Four-Metric Public Ledger
            </h3>
          </div>
          {deltaPct >= 25 && (
            <div className="inline-flex items-center gap-2 rounded-full bg-red-50 border border-red-200 px-3.5 py-1 text-xs font-mono font-bold text-red-700">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              DISBURSEMENT ACCELERATION: +{deltaPct}% DELTA
            </div>
          )}
        </div>

        {/* 4-Metric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              1. Approved Budget
            </span>
            <div className="text-xl sm:text-2xl font-mono font-black text-gray-900 mt-1">
              {formatCurrency(project.budgetPHP)}
            </div>
            <span className="text-[11px] text-gray-400 font-medium">100% Total Civil Works</span>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
            <span className="text-xs font-bold text-[#01367d] uppercase tracking-wider">
              2. Disbursed to Date
            </span>
            <div className="text-xl sm:text-2xl font-mono font-black text-[#01367d] mt-1">
              {formatCurrency(project.amountPaid)}
            </div>
            <span className="text-[11px] font-mono font-bold text-blue-600">
              {disbursementPct}% of Total Allocation
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              3. Retained Balance
            </span>
            <div className="text-xl sm:text-2xl font-mono font-black text-emerald-700 mt-1">
              {formatCurrency(remainingBalance)}
            </div>
            <span className="text-[11px] font-mono font-bold text-emerald-600">
              {100 - disbursementPct}% Pending Release
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              4. Physical vs Payout Delta
            </span>
            <div className="text-xl sm:text-2xl font-mono font-black text-amber-700 mt-1">
              {deltaPct > 0 ? `+${deltaPct}%` : `${deltaPct}%`}
            </div>
            <span className="text-[11px] font-mono font-bold text-amber-600">
              Claimed: {progressPct}% | Paid: {disbursementPct}%
            </span>
          </div>
        </div>

        {/* Dual Bar Contrast */}
        <div className="space-y-3 pt-2">
          <div>
            <div className="flex justify-between text-xs font-bold mb-1">
              <span className="text-gray-500">Official Payout Released</span>
              <span className="text-[#01367d] font-mono">{disbursementPct}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#01367d] transition-all duration-500"
                style={{ width: `${Math.min(100, disbursementPct)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold mb-1">
              <span className="text-gray-500">Physical Progress Claimed on Site</span>
              <span className="text-emerald-600 font-mono">{progressPct}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, progressPct)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Itemized Bill of Quantities (BOQ) */}
      <div className="rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2.5">
            <TableIcon className="h-5 w-5 text-[#01367d]" />
            <h3 className="text-lg font-black text-[#01367d] tracking-tight">
              Itemized Bill of Quantities (BOQ)
            </h3>
          </div>
          {boqData?.flagMobilizationInflated && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1 text-xs font-mono font-bold text-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ffb241]" />
              INFLATED MOBILIZATION (&gt;5% TOTAL BUDGET)
            </span>
          )}
        </div>

        {isLoadingBoq ? (
          <div className="flex h-40 w-full items-center justify-center rounded-2xl border border-gray-100 bg-gray-50">
            <Loader2 className="h-5 w-5 animate-spin text-[#01367d] mr-2" />
            <span className="text-xs font-semibold text-gray-500">Loading itemized bill of quantities...</span>
          </div>
        ) : boqData && boqData.items && boqData.items.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full text-left text-xs text-gray-800">
              <thead className="border-b border-gray-200 bg-[#011438] text-[11px] font-mono font-bold uppercase tracking-wider text-white">
                <tr>
                  <th className="px-4 py-3">Item Code</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3 text-right">Total (₱)</th>
                  <th className="px-4 py-3 text-right">Benchmark Var.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {boqData.items.map((item) => (
                  <tr
                    key={item.id}
                    className={`transition hover:bg-gray-50 ${
                      item.flagUnitPriceAnomaly
                        ? 'bg-red-50/60 text-red-900'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-[#01367d]">
                      {item.itemCode}
                    </td>
                    <td className="px-4 py-3 max-w-xs">{item.description}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {item.quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.unit}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(item.unitCostPhp)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-gray-900">
                      {formatCurrency(item.totalPhp)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {item.variancePct !== null ? (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                            item.flagUnitPriceAnomaly
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : item.variancePct > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.variancePct > 0 ? `+${item.variancePct}%` : `${item.variancePct}%`}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center bg-gray-50">
            <Info className="mx-auto h-6 w-6 text-gray-400 mb-2" />
            <p className="text-sm font-bold text-gray-700">
              Itemized BOQ Extraction in Progress
            </p>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto font-medium">
              Line items are automatically digitized from scanned contracts via multimodal vision. Refer to the official scanned contract PDF below for all itemized specifications.
            </p>
          </div>
        )}
      </div>

      {/* SECTION 3: Official Scanned Contract PDF Viewer */}
      <div className="rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-[#01367d]" />
            <h3 className="text-lg font-black text-[#01367d] tracking-tight">
              Official Scanned Contract Document
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {doc?.contractAgreementUrl && (
              <a
                href={doc.contractAgreementUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#01367d] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#ffb241] hover:text-[#011438]"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Contract Agreement (PDF) &rarr;</span>
              </a>
            )}

            {doc?.noticeToProceedUrl && (
              <a
                href={doc.noticeToProceedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-bold text-[#01367d] hover:bg-gray-50 transition"
              >
                <span>Notice to Proceed &rarr;</span>
              </a>
            )}

            {doc?.noticeOfAwardUrl && (
              <a
                href={doc.noticeOfAwardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-bold text-[#01367d] hover:bg-gray-50 transition"
              >
                <Archive className="h-3.5 w-3.5" />
                <span>Notice of Award &rarr;</span>
              </a>
            )}

            {verifiedPdfUrl && (
              <a
                href={verifiedPdfUrl}
                download
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download PDF</span>
              </a>
            )}
          </div>
        </div>

        {/* Inline PDF Viewer Iframe */}
        {verifiedPdfUrl ? (
          <div className="relative h-[650px] w-full rounded-2xl border border-gray-200 bg-slate-900 overflow-hidden shadow-inner">
            <iframe
              src={verifiedPdfUrl}
              className="h-full w-full border-0"
              title={`Contract Document ${project.id}`}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center bg-gray-50">
            <FileText className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm font-bold text-gray-700">
              No Scanned Contract Document URL on Record
            </p>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              DPWH has not yet attached the scanned PDF document for contract ID {project.id}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
