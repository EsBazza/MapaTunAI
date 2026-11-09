'use client';

import { useState, use, useEffect, useRef } from 'react';
import Link from 'next/link';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { SiteFooter } from '@/components/site-footer';
import { MapPin, Building2, Share2, ExternalLink, FileText, ChevronRight, ShieldAlert, RotateCw, Link2, Check } from 'lucide-react';
import { useProject, type ProjectDetailData } from '@/hooks/use-projects';
import { formatDate, cleanContractorName } from '@/lib/format';
import { getDocumentUrl } from '@/lib/documents';
import { CountUp, EASE_OUT, FadeIn, Shimmer } from '@/components/motion';
import OverviewTab from './components/OverviewTab';
import CommunityTab from './components/CommunityTab';
import RiskGauge from './components/RiskGauge';
import ProjectTimeline from './components/ProjectTimeline';

interface PageProps {
  params: Promise<{ id: string }>;
}

type TabType = 'overview' | 'community';
const TABS: TabType[] = ['overview', 'community'];

function readHashTab(): TabType {
  if (typeof window === 'undefined') return 'overview';
  const hash = window.location.hash.replace('#', '') as TabType;
  return TABS.includes(hash) ? hash : 'overview';
}

/** Plain-language warning flags. The dot colour uses the risk tokens and always sits next to text. */
function getFlags(p: ProjectDetailData) {
  const flags: Array<{ label: string; dot: string }> = [];
  if (p.flagOverpaid) flags.push({ label: 'Paid but little work done', dot: 'bg-risk-critical' });
  if (p.flagStalled) flags.push({ label: 'No progress for 6+ months', dot: 'bg-risk-high' });
  if (p.flagOverdue) flags.push({ label: 'Past deadline', dot: 'bg-risk-elevated' });
  if (p.flagNeverStarted) flags.push({ label: 'Hasn’t started', dot: 'bg-white/50' });
  if (p.flagPaymentPending) flags.push({ label: 'Payment not yet released', dot: 'bg-navy-300' });
  return flags;
}

/* ------------------------------------------------------------------ */
/* Share menu: native sheet on phones, plus Facebook / Messenger / Viber */
/* ------------------------------------------------------------------ */

function ShareMenu({ title }: { title: string }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  // Only rendered client-side (after the project query resolves), so reading matchMedia here is safe.
  const [isTouch] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const url = typeof window === 'undefined' ? '' : window.location.href.split('#')[0];
  const text = `${title}: budget, work done, and what citizens report.`;

  const onMainClick = async () => {
    // Phones: the system share sheet already lists Messenger, Viber, etc.
    if (isTouch && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    setOpen((o) => !o);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied('copied');
    } catch {
      setCopied('failed');
    }
    setTimeout(() => setCopied('idle'), 2200);
  };

  const enc = encodeURIComponent;
  const items = [
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    ...(isTouch
      ? [
          { label: 'Messenger', href: `fb-messenger://share/?link=${enc(url)}` },
          { label: 'Viber', href: `viber://forward?text=${enc(`${text} ${url}`)}` },
        ]
      : []),
  ];

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={onMainClick}
        aria-haspopup="menu"
        aria-expanded={open}
        className="press inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10"
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        Share
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className="absolute left-0 top-full z-40 mt-2 w-60 origin-top-left rounded-xl border border-white/15 bg-navy-950 p-1.5 text-sm text-white"
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'scale(0.97)' }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, transform: 'scale(1)' }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.15, ease: EASE_OUT }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={copy}
              className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left font-medium hover:bg-white/10"
            >
              {copied === 'copied' ? <Check className="h-4 w-4 text-risk-low" aria-hidden="true" /> : <Link2 className="h-4 w-4 text-amber" aria-hidden="true" />}
              <span aria-live="polite">
                {copied === 'copied' ? 'Link copied' : copied === 'failed' ? 'Couldn’t copy. Use the address bar.' : 'Copy link'}
              </span>
            </button>
            {items.map((it) => (
              <a
                key={it.label}
                role="menuitem"
                href={it.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 font-medium hover:bg-white/10"
              >
                <ExternalLink className="h-4 w-4 text-white/50" aria-hidden="true" />
                Share on {it.label}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Latest satellite photo of the site, shown as a captioned figure.    */
/* Hidden entirely when there is no photo (e.g. unconfirmed location). */
/* ------------------------------------------------------------------ */

function SitePhoto({ projectId }: { projectId: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  if (state === 'failed') return null;
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/15">
      <div className="relative aspect-[4/3] bg-white/5">
        {state === 'loading' && <Shimmer tone="dark" className="absolute inset-0 rounded-none" />}
        {/* eslint-disable-next-line @next/next/no-img-element -- same-origin API image, sized server-side */}
        <img
          src={`/api/projects/${encodeURIComponent(projectId)}/satellite?when=latest`}
          alt="Latest satellite photo of the project site. The marker shows the recorded location."
          decoding="async"
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
          className={`h-full w-full object-cover transition-opacity duration-200 ${state === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
      <figcaption className="px-3 py-2 text-xs font-medium text-white/60">Latest satellite photo · Esri Wayback</figcaption>
    </figure>
  );
}

function LoadingState({ id }: { id: string }) {
  return (
    <div className="min-h-screen bg-canvas" aria-busy="true">
      <span className="sr-only" aria-live="polite">Loading project {id}</span>
      <div className="bg-navy-950 px-4 pt-8 pb-12 sm:px-12 lg:px-16">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            <Shimmer tone="dark" className="h-3 w-48" />
            <Shimmer tone="dark" className="h-9 w-3/4" />
            <Shimmer tone="dark" className="h-9 w-1/2" />
            <Shimmer tone="dark" className="h-20 w-full" />
          </div>
          <Shimmer tone="dark" className="hidden h-64 rounded-2xl lg:block" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-12 lg:px-16">
        <Shimmer className="h-40 rounded-2xl" />
        <Shimmer className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

export default function ProjectPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: project, isLoading, error, refetch, isRefetching } = useProject(id);
  const reduce = useReducedMotion();
  const [activeTab, setActiveTab] = useState<TabType>(readHashTab);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    window.history.replaceState(null, '', `#${tab}`);
  };

  if (isLoading) return <LoadingState id={id} />;

  if (error || !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-navy-950 px-4 text-center text-white">
        <ShieldAlert className="mb-3 h-10 w-10 text-amber" aria-hidden="true" />
        <h2 className="text-xl font-bold">We couldn&rsquo;t load this project</h2>
        <p className="mt-2 mb-6 max-w-sm text-sm font-medium text-white/70">
          Project <strong className="text-white">{id}</strong> may not be in our records yet, or the connection failed.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="press inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 text-sm font-bold transition-colors hover:bg-white/10 disabled:opacity-60"
          >
            <RotateCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} aria-hidden="true" /> Try again
          </button>
          <Link href="/map" className="press inline-flex min-h-11 items-center rounded-full bg-amber px-6 py-2.5 text-sm font-bold text-navy-950 transition-colors hover:bg-amber-soft">
            Back to the map
          </Link>
        </div>
      </div>
    );
  }

  const contractorName = cleanContractorName(project.contractorRaw || 'Unknown contractor');
  const paidPct = project.budgetPHP > 0 ? Math.round((project.amountPaid / project.budgetPHP) * 100) : null;
  const flags = getFlags(project);
  const documentUrl = getDocumentUrl(project.id, project.contractDocument);
  const locationUnknown = project.location?.source === 'unknown';
  const provinceName = project.location?.province || project.province?.name || '';
  const regionName = locationUnknown ? '' : project.location?.region || project.province?.region?.name || '';

  const tabs: Array<{ id: TabType; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'community', label: 'Citizen reports', count: project.reviews?.length || 0 },
  ];

  return (
    <div className="min-h-screen bg-canvas pb-20 text-ink selection:bg-amber/30">
      <header className="w-full border-b border-navy-900 bg-navy-950 px-4 pt-8 pb-12 text-white sm:px-12 lg:px-16">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <FadeIn immediate className="min-w-0 space-y-6">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm font-medium text-white/70">
              <Link href="/" className="hover:text-white">Home</Link>
              <ChevronRight className="h-3.5 w-3.5 text-white/40" aria-hidden="true" />
              {regionName && (
                <>
                  <span>{regionName}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-white/40" aria-hidden="true" />
                </>
              )}
              <span className={locationUnknown ? 'italic' : ''}>{provinceName}</span>
              <Link
                href={`/map?project=${encodeURIComponent(project.id)}`}
                className="ml-1 inline-flex items-center gap-1 font-bold text-amber hover:underline"
              >
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Show on map
              </Link>
            </nav>

            <div className="space-y-3">
              <p className="text-sm font-medium text-white/70">
                {project.category} · {project.status}
              </p>
              <h1 className="text-2xl font-bold leading-tight tracking-tight break-words sm:text-3xl lg:text-4xl">{project.name}</h1>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-white/80">
                <Link
                  href={`/contractors?q=${encodeURIComponent(contractorName)}`}
                  className="inline-flex items-center gap-1.5 hover:text-amber"
                  title="See this contractor's other projects"
                >
                  <Building2 className="h-4 w-4 text-amber" aria-hidden="true" />
                  <span className="font-bold text-white underline-offset-2 hover:underline">{contractorName}</span>
                </Link>
                <span>
                  {formatDate(project.startDate)} to {project.completionDate ? formatDate(project.completionDate) : 'no deadline given'}
                </span>
                <span className="tabular text-white/60">Contract {project.id}</span>
              </div>
            </div>

            {flags.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Warning signs from the records">
                {flags.map((f) => (
                  <li key={f.label} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-sm font-medium">
                    <span className={`h-2 w-2 rounded-full ${f.dot}`} aria-hidden="true" />
                    {f.label}
                  </li>
                ))}
              </ul>
            )}

            <dl className="grid grid-cols-1 divide-y divide-white/15 border-y border-white/15 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="py-4 sm:pr-6">
                <dt className="text-sm font-medium text-white/70">Budget</dt>
                <dd className="mt-1 text-2xl font-bold"><CountUp value={project.budgetPHP} format="currency" /></dd>
              </div>
              <div className="py-4 sm:px-6">
                <dt className="text-sm font-medium text-white/70">Paid so far</dt>
                <dd className="mt-1 text-2xl font-bold text-amber"><CountUp value={project.amountPaid} format="currency" /></dd>
                <dd className="text-xs font-medium text-white/60">{paidPct === null ? 'Budget unknown' : `${paidPct}% of the budget`}</dd>
              </div>
              <div className="py-4 sm:pl-6">
                <dt className="text-sm font-medium text-white/70">Work done</dt>
                <dd className="mt-1 text-2xl font-bold"><CountUp value={Math.round(project.progress)} format="percent" /></dd>
                <dd className="text-xs font-medium text-white/60">As reported by DPWH</dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href={documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="press inline-flex min-h-11 items-center gap-2 rounded-full bg-amber px-5 py-2.5 text-sm font-bold text-navy-950 transition-colors hover:bg-amber-soft"
              >
                <FileText className="h-4 w-4" aria-hidden="true" /> View contract document
              </a>
              <ShareMenu title={project.name} />
            </div>
          </FadeIn>

          <FadeIn immediate delay={0.05} className="space-y-4">
            <RiskGauge score={project.riskScore || 0} />
            <SitePhoto projectId={project.id} />
          </FadeIn>
        </div>
      </header>

      <div className="sticky top-0 z-30 border-b border-line bg-surface px-4 sm:px-12 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <LayoutGroup id="project-tabs">
            <div role="tablist" aria-label="Project sections" className="flex space-x-2 overflow-x-auto py-3 scrollbar-none">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-controls={`panel-${tab.id}`}
                    aria-selected={isActive}
                    onClick={() => handleTabChange(tab.id)}
                    className={`press relative flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full px-5 py-2 text-sm font-bold transition-colors ${
                      isActive ? 'text-white' : 'text-ink-muted hover:bg-sunken hover:text-ink'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="tab-pill"
                        className="absolute inset-0 rounded-full bg-navy"
                        transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
                      />
                    )}
                    <span className="relative">{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className={`relative tabular text-xs font-medium ${isActive ? 'text-amber' : 'text-ink-subtle'}`}>{tab.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </LayoutGroup>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-12 lg:px-16">
        <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" hidden={activeTab !== 'overview'} className="space-y-8">
          <ProjectTimeline
            startDate={project.startDate}
            completionDate={project.completionDate}
            status={project.status}
            progress={project.progress}
            reports={(project.reviews || []).map((r) => ({ id: r.id, createdAt: r.createdAt }))}
          />
          <OverviewTab project={project} />
        </div>
        <div role="tabpanel" id="panel-community" aria-labelledby="tab-community" hidden={activeTab !== 'community'}>
          <CommunityTab project={project} onReviewSubmitted={() => refetch()} />
        </div>
      </main>
      <SiteFooter className="mt-16" />
    </div>
  );
}
