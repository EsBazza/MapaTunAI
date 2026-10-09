'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  BrainCircuit,
  TrendingUp,
  Building2,
  Satellite,
  ExternalLink,
  FileQuestion,
} from 'lucide-react';
import { formatCurrency, cleanContractorName } from '@/lib/format';
import { ProjectDetailData } from '@/hooks/use-projects';
import { ESRI_WAYBACK_CATALOG } from '@/lib/constants';

interface OverviewTabProps {
  project: ProjectDetailData;
  onNavigateTab: (tabId: string) => void;
}

export default function OverviewTab({ project, onNavigateTab }: OverviewTabProps) {
  const contractorName = cleanContractorName(project.contractorRaw || 'Unknown Contractor');
  const disbursementPct =
    project.budgetPHP > 0 ? Math.round((project.amountPaid / project.budgetPHP) * 100) : 0;
  const progressPct = Math.round(project.progress || 0);
  const gapPct = disbursementPct - progressPct;
  const isHighGap = gapPct >= 30;

  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainer.current || !project.gpsLat || !project.gpsLng) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
    const item = ESRI_WAYBACK_CATALOG[2024] || Object.values(ESRI_WAYBACK_CATALOG)[0];
    const tileUrl = `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/${item.m}/{z}/{y}/{x}`;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'esri-wayback': {
            type: 'raster',
            tiles: [tileUrl],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: 'wayback-layer',
            type: 'raster',
            source: 'esri-wayback',
          },
        ],
      },
      center: [project.gpsLng, project.gpsLat],
      zoom: 16,
      interactive: true,
      attributionControl: false,
    });

    new mapboxgl.Marker({ color: '#ffb241' })
      .setLngLat([project.gpsLng, project.gpsLat])
      .addTo(map);

    return () => map.remove();
  }, [project.gpsLat, project.gpsLng]);

  return (
    <div className="space-y-6">
      {/* 1. AI Forensic Briefing Card (Homepage Aesthetic) */}
      <div className="rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#01367d] text-[#ffb241] shadow-sm">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-[#01367d] tracking-tight">
              AI Forensic Ground-Truth Briefing
            </h3>
            <span className="text-xs font-mono font-bold text-gray-400">
              MULTIMODAL SATELLITE &amp; CONTRACT ANALYSIS
            </span>
          </div>
        </div>

        <div className="text-sm text-gray-700 leading-relaxed bg-[#f4f6fb] rounded-2xl p-5 border border-gray-100 font-medium">
          {project.aiSummary ? (
            <p>{project.aiSummary}</p>
          ) : (
            <p>
              This {project.category.toLowerCase()} contract involves a total public allocation of{' '}
              <strong className="text-gray-950 font-bold">{formatCurrency(project.budgetPHP)}</strong> situated in{' '}
              <strong className="text-gray-950 font-bold">{project.province?.name || 'the Philippines'}</strong>. Official
              DPWH records report <strong className="text-[#01367d] font-bold">{progressPct}%</strong> physical completion with{' '}
              <strong className="text-[#01367d] font-bold">{formatCurrency(project.amountPaid)}</strong> ({disbursementPct}%)
              disbursed.
              {isHighGap && (
                <span className="block mt-3 font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  DISCREPANCY ALERT: Financial payout outpaces reported physical completion by {gapPct}%, indicating an
                  accelerated billing anomaly that warrants citizen ground-truth inspection.
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* 2. Dual Comparison: Financial Disbursement vs Physical Progress */}
      <div className="rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="h-5 w-5 text-[#01367d]" />
            <h4 className="text-lg font-black text-[#01367d] tracking-tight">
              Disbursement vs. Physical Progress Alignment
            </h4>
          </div>
          {isHighGap && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3.5 py-1 text-xs font-mono font-bold text-red-700 border border-red-200">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              {gapPct}% DISCREPANCY GAP
            </span>
          )}
        </div>

        <div className="space-y-4">
          {/* Progress Bar 1: Financial Disbursement */}
          <div>
            <div className="flex justify-between text-xs font-bold mb-1.5">
              <span className="text-gray-500">Financial Payout (DPWH Warrants Disbursed)</span>
              <span className="font-mono text-[#01367d]">
                {formatCurrency(project.amountPaid)} ({disbursementPct}%)
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isHighGap ? 'bg-[#ffb241]' : 'bg-[#01367d]'
                }`}
                style={{ width: `${Math.min(100, disbursementPct)}%` }}
              />
            </div>
          </div>

          {/* Progress Bar 2: Physical Works Progress */}
          <div>
            <div className="flex justify-between text-xs font-bold mb-1.5">
              <span className="text-gray-500">Reported Physical Progress</span>
              <span className="font-mono text-emerald-600">{progressPct}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, progressPct)}%` }}
              />
            </div>
          </div>
        </div>

        {isHighGap && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs font-medium text-amber-900 leading-relaxed">
            <strong className="font-bold">Forensic Discrepancy Note:</strong> Funds released to the contractor substantially exceed the
            physical progress claimed on site. Inspect the satellite timeline and citizen whistleblower reviews to
            check for ghost or delayed works.
          </div>
        )}
      </div>

      {/* 3. Grid: Contractor at a Glance & Mini Satellite */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contractor at a glance */}
        <div className="rounded-3xl border border-gray-200/80 bg-white p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-[#01367d]" />
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">
                Primary Award Contractor
              </h4>
            </div>
            <p className="text-lg font-black text-[#01367d] mb-1">{contractorName}</p>
            <p className="text-xs text-gray-500 font-medium">
              Contract award for {project.category} situated in {project.province?.name}.
            </p>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={() => onNavigateTab('connections')}
              className="text-xs font-bold text-[#01367d] hover:text-[#ffb241] transition"
            >
              View Joint Ventures &amp; Ties &rarr;
            </button>
            <Link
              href={`/contractors?q=${encodeURIComponent(contractorName)}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-900 transition"
            >
              <span>Full Profile</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Mini Satellite Thumbnail */}
        <div className="rounded-3xl border border-gray-200/80 bg-white overflow-hidden shadow-sm flex flex-col justify-between">
          <div className="p-6 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Satellite className="h-4 w-4 text-[#01367d]" />
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">
                  Live Satellite Ground-Truth
                </h4>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#01367d] border border-blue-100">
                ESRI WAYBACK
              </span>
            </div>
          </div>
          
          <div className="relative h-44 w-full bg-slate-900">
            <div ref={mapContainer} className="h-full w-full" />
            <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg bg-[#011438]/90 px-2 py-1 text-[10px] font-mono text-white/80 border border-white/10 z-10">
              GPS: {project.gpsLat?.toFixed(4) || 'N/A'}, {project.gpsLng?.toFixed(4) || 'N/A'}
            </div>
          </div>

          <div className="p-4 bg-gray-50 border-t border-gray-100">
            <button
              onClick={() => onNavigateTab('satellite')}
              className="w-full py-2 rounded-full bg-[#01367d] text-xs font-black text-white hover:bg-[#ffb241] hover:text-[#011438] transition shadow-sm"
            >
              Open Full Multi-Year Satellite Comparison &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* 4. Action Banner: eFOI Portal Request */}
      <div className="rounded-3xl border border-gray-200/80 bg-white p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-50 text-[#ffb241] shrink-0 mt-0.5">
            <FileQuestion className="h-5 w-5" />
          </div>
          <div>
            <h5 className="text-sm font-black text-gray-900">Notice Irregularities or Incomplete Civil Works?</h5>
            <p className="text-xs text-gray-600 font-medium mt-0.5">
              Under Executive Order No. 2 (s. 2016), you have the right to request official DPWH inspection reports
              and notice to proceed documents via the Freedom of Information (eFOI) portal.
            </p>
          </div>
        </div>
        <a
          href="https://www.foi.gov.ph/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gray-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-gray-800 transition shrink-0 shadow-sm"
        >
          <span>File eFOI Request &rarr;</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
