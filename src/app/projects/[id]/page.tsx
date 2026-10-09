'use client';

import { useState, use, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  MapPin,
  Building2,
  Calendar,
  Share2,
  ExternalLink,
  FileText,
  Loader2,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { useProject } from '@/hooks/use-projects';
import { formatCurrency, formatDate, cleanContractorName } from '@/lib/format';
import { getRiskScoreTier } from '@/lib/anomaly-flags';
import OverviewTab from './components/OverviewTab';
import CommunityTab from './components/CommunityTab';

interface PageProps {
  params: Promise<{ id: string }>;
}

type TabType = 'overview' | 'community';

export default function ProjectDossierPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: project, isLoading, error, refetch } = useProject(id);

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [copied, setCopied] = useState<boolean>(false);

  // Sync with URL hash if provided
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace('#', '') as TabType;
      const validTabs: TabType[] = ['overview', 'community'];
      if (validTabs.includes(hash)) {
        setTimeout(() => setActiveTab(hash), 0);
      }
    }
  }, []);

  const handleTabChange = (tab: TabType) => {
    if (tab === 'overview' || tab === 'community') {
      setActiveTab(tab);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#${tab}`);
      }
    }
  };

  const handleShare = async () => {
    if (typeof window !== 'undefined') {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#011438] text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#ffb241]" />
          <p className="text-sm font-bold tracking-wide text-white">
            Loading public infrastructure dossier...
          </p>
          <span className="text-xs text-white/60 font-mono">Contract ID: {id}</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#011438] px-4 text-center text-white">
        <ShieldAlert className="h-12 w-12 text-[#ffb241] mb-3" />
        <h2 className="text-xl font-black text-white">Project Record Not Found</h2>
        <p className="text-xs text-white/70 max-w-sm mt-1 mb-6">
          Could not retrieve contract details for ID <strong className="font-mono text-white">{id}</strong>.
          The record may not exist in the DPWH database or has not yet been ingested.
        </p>
        <Link
          href="/map"
          className="rounded-full bg-[#ffb241] px-6 py-2.5 text-xs font-black text-[#011438] hover:bg-amber-300 transition"
        >
          Return to National Map &rarr;
        </Link>
      </div>
    );
  }

  const contractorName = cleanContractorName(project.contractorRaw || 'Unknown Contractor');
  const riskTier = getRiskScoreTier(project.riskScore || 0);

  const tabs: Array<{ id: TabType; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'community', label: 'Citizen Reports', count: project.reviews?.length || 0 },
  ];

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-gray-900 selection:bg-[#ffb241]/30 pb-20">
      {/* --- HERO SECTION (Homepage Deep Navy Aesthetic) ---------- */}
      <div className="relative w-full bg-[#011438] text-white px-6 sm:px-12 lg:px-16 pt-8 pb-12 rounded-b-[40px] shadow-2xl border-b border-[#01367d]/40 overflow-hidden">
        {/* Layer 0: Subtle Dual Asset Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-screen pointer-events-none"
          style={{ backgroundImage: "url('/bg2.png')" }}
        />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: "url('/bg1.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#012456]/95 via-[#01367d]/85 to-[#011438]/95 pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-7xl space-y-6">
          {/* Breadcrumb navigation */}
          <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold text-white/70">
            <Link
              href="/"
              className="flex items-center gap-1 text-white hover:text-[#ffb241] transition"
            >
              <span>MAPATUNAI</span>
            </Link>
            <ChevronRight className="h-3 w-3 text-white/40" />
            <Link
              href={`/map?project=${encodeURIComponent(project.id)}`}
              className="flex items-center gap-1 font-bold text-[#ffb241] hover:underline transition"
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>National Map</span>
            </Link>
            <ChevronRight className="h-3 w-3 text-white/40" />
            <span>{project.province?.region?.name || 'Region'}</span>
            <ChevronRight className="h-3 w-3 text-white/40" />
            <span>{project.province?.name || 'Province'}</span>
            <ChevronRight className="h-3 w-3 text-white/40" />
            <span className="font-mono text-white/90 bg-white/10 px-2 py-0.5 rounded-md">{project.id}</span>
          </nav>

          {/* Anomaly Badges (Zero Emojis, Clean Monospace Micro-Dots) */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            {project.flagOverpaid && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-950/60 px-3 py-1 font-bold text-red-200">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                OVERPAID (GHOST RISK)
              </span>
            )}
            {project.flagStalled && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-950/60 px-3 py-1 font-bold text-amber-200">
                <span className="h-2 w-2 rounded-full bg-[#ffb241]" />
                STALLED WORKS
              </span>
            )}
            {project.flagOverdue && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-900/40 px-3 py-1 font-semibold text-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ffb241]" />
                OVERDUE MILESTONE
              </span>
            )}
            {project.flagNeverStarted && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 font-semibold text-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                NEVER STARTED
              </span>
            )}
            {project.flagPaymentPending && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-900/40 px-3 py-1 font-semibold text-blue-200">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                PAYMENT PENDING
              </span>
            )}
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-medium text-white/80 uppercase">
              {project.category}
            </span>
          </div>

          {/* Project Title and Metadata */}
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
              {project.name}
            </h1>
            <div className="flex flex-wrap items-center gap-5 text-xs text-white/80 mt-3 font-semibold">
              <Link
                href={`/contractors?q=${encodeURIComponent(contractorName)}`}
                className="inline-flex items-center gap-1.5 text-white hover:text-[#ffb241] transition group"
                title="View Contractor Profile in Registry"
              >
                <Building2 className="h-4 w-4 text-[#ffb241]" />
                <span className="text-sm font-bold group-hover:underline">{contractorName}</span>
                <ExternalLink className="h-3 w-3 text-white/50 group-hover:text-[#ffb241]" />
              </Link>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-white/60" />
                <span>
                  {formatDate(project.startDate)} &rarr;{' '}
                  {project.completionDate ? formatDate(project.completionDate) : 'Ongoing'}
                </span>
              </div>
              <span className="font-mono text-white/60 bg-white/10 px-2 py-0.5 rounded">
                CONTRACT: {project.id}
              </span>
            </div>
          </div>

          {/* 4 Stat Cards in a Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-2">
            {/* Card 1: Budget */}
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md shadow-md">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/60">
                Approved Budget
              </span>
              <p className="text-xl sm:text-2xl font-mono font-black text-white mt-1">
                {formatCurrency(project.budgetPHP)}
              </p>
              <span className="text-[10px] text-white/60">Official Allocation</span>
            </div>

            {/* Card 2: Disbursed */}
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md shadow-md">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/60">
                Amount Disbursed
              </span>
              <p className="text-xl sm:text-2xl font-mono font-black text-[#ffb241] mt-1">
                {formatCurrency(project.amountPaid)}
              </p>
              <span className="text-[10px] text-white/60 font-mono">
                {project.budgetPHP > 0
                  ? `${Math.round((project.amountPaid / project.budgetPHP) * 100)}% of total budget`
                  : '—'}
              </span>
            </div>

            {/* Card 3: Physical Progress */}
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md shadow-md">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/60">
                Physical Progress
              </span>
              <p className="text-xl sm:text-2xl font-mono font-black text-emerald-400 mt-1">
                {Math.round(project.progress)}%
              </p>
              <span className="text-[10px] text-white/60">DPWH Claimed</span>
            </div>

            {/* Card 4: Composite Risk Score */}
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/60">
                  Forensic Risk Score
                </span>
                <span className="rounded px-2 py-0.5 text-[9px] font-mono font-bold uppercase bg-white/20 text-white">
                  {riskTier.label}
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-mono font-black text-white mt-1">
                {project.riskScore}
                <span className="text-xs font-normal text-white/50">/100</span>
              </p>
              <span className="text-[10px] text-white/60">Multi-Factor Analysis</span>
            </div>
          </div>

          {/* Action Buttons Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {/* View Document Button (Opens actual contract document PDF in new tab) */}
            <a
              href={
                project.contractDocument?.contractAgreementUrl ||
                project.contractDocument?.noticeToProceedUrl ||
                project.contractDocument?.noticeOfAwardUrl ||
                (project.contractDocument?.sourcePdfUrl &&
                project.contractDocument.sourcePdfUrl.startsWith('http') &&
                !project.contractDocument.sourcePdfUrl.includes('dpwh.gov.ph')
                  ? project.contractDocument.sourcePdfUrl
                  : `/api/projects/${encodeURIComponent(project.id)}/document`)
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#ffb241] px-5 py-2.5 text-xs font-black text-[#011438] shadow hover:bg-amber-300 transition"
            >
              <FileText className="h-4 w-4" />
              <span>View Document &rarr;</span>
            </a>

            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition"
            >
              <Share2 className="h-4 w-4" />
              <span>{copied ? 'Link Copied!' : 'Share Dossier'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- TAB NAVIGATION STRIP (Homepage Aesthetic) ----------- */}
      <div className="sticky top-0 z-30 border-b border-[#01367d]/15 bg-white/95 backdrop-blur-md px-6 sm:px-12 lg:px-16 shadow-xs">
        <div className="mx-auto max-w-7xl">
          <div className="flex space-x-2 overflow-x-auto py-3 scrollbar-none">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-full px-5 py-2 text-xs font-black transition-all ${
                    isActive
                      ? 'bg-[#01367d] text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                        isActive
                          ? 'bg-[#ffb241] text-[#011438] font-bold'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* --- TAB CONTENT PANELS --------------------------------- */}
      <main className="mx-auto max-w-7xl px-6 sm:px-12 lg:px-16 py-8">
        <div className={activeTab === 'overview' ? 'block' : 'hidden'}>
          <OverviewTab project={project} onNavigateTab={(tab) => handleTabChange(tab as TabType)} />
        </div>

        <div className={activeTab === 'community' ? 'block' : 'hidden'}>
          <CommunityTab project={project} onReviewSubmitted={() => refetch()} />
        </div>
      </main>

      {/* --- FULL-WIDTH FOOTER (Homepage Aesthetic) ------------- */}
      <footer className="w-full mt-16 py-12 px-6 md:px-16 bg-[#eeeeee] text-[#01367d] border-t border-[#01367d]/15 text-center">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex items-center justify-center">
            <Image
              src="/MAPATUNAI.png"
              alt="MAPATUNAI Logo"
              width={140}
              height={40}
              className="h-8 w-auto object-contain"
            />
          </div>
          <p className="text-xs text-[#01367d]/80 font-medium">
            MapaTunAI public infrastructure forensic dossiers are compiled from official DPWH disclosures and satellite ground-truth records.
          </p>
          <div className="flex justify-center gap-4 text-xs font-bold pt-1">
            <Link href="/map" className="hover:text-[#ffb241]">Interactive Map</Link>
            <span>•</span>
            <Link href="/contractors" className="hover:text-[#ffb241]">Contractor Registry</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
