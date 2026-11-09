'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { formatCurrency } from '@/lib/format';
import type { ContractorProject } from './types';

const PAGE_SIZE = 20;

interface ProjectsPage {
  projects: ContractorProject[];
  pagination: { page: number; total: number; totalPages: number };
}

interface ContractorProjectsDrawerProps {
  contractorName: string;
  onClose: () => void;
}

/** iOS-like drawer curve; enter and exit along the same path (from the right). */
const DRAWER_EASE = [0.32, 0.72, 0, 1] as const;

export default function ContractorProjectsDrawer({ contractorName, onClose }: ContractorProjectsDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion() ?? false;
  const panelHidden = reducedMotion ? { opacity: 0 } : { transform: 'translateX(100%)' };
  const panelShown = reducedMotion ? { opacity: 1 } : { transform: 'translateX(0%)' };

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['contractor-projects', contractorName],
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<ProjectsPage> => {
      const params = new URLSearchParams({
        contractorExact: contractorName,
        page: String(pageParam),
        limit: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/projects?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load projects');
      return res.json();
    },
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
  });

  const projects = data?.pages.flatMap((p) => p.projects) ?? [];
  const total = data?.pages[0]?.pagination.total ?? 0;

  // Lock page scroll, close on Escape, focus the close button.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="drawer-title" role="dialog" aria-modal="true">
      <motion.div
        className="fixed inset-0 bg-navy-950/60"
        onClick={onClose}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10 z-50">
        <motion.div
          className="w-screen max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-gray-200"
          initial={panelHidden}
          animate={panelShown}
          exit={panelHidden}
          transition={{ duration: 0.3, ease: DRAWER_EASE }}
        >
          {/* Header */}
          <div className="bg-navy-950 text-white p-5 sm:p-6 border-b border-navy/40 flex items-start justify-between gap-4 shrink-0">
            <div className="space-y-1.5 flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber">Projects won</p>
              <h2 id="drawer-title" className="text-xl sm:text-2xl font-black tracking-tight text-white line-clamp-2 leading-snug break-words">
                {contractorName}
              </h2>
              <p className="text-xs font-semibold text-white/80">
                {isLoading ? 'Loading projects…' : `${total.toLocaleString()} project${total === 1 ? '' : 's'}`}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="rounded-full p-2 bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-amber"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#f8fafd]">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl bg-white p-5 border border-gray-200/80 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              ))
            ) : isError ? (
              <div className="rounded-2xl bg-white p-8 text-center border border-gray-200 space-y-3">
                <p className="text-sm font-semibold text-gray-600">We couldn&rsquo;t load these projects.</p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="rounded-full bg-navy px-5 py-2 text-xs font-black text-white hover:bg-amber hover:text-navy transition"
                >
                  Try again
                </button>
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-2xl bg-white p-8 text-center text-gray-500 font-semibold border border-gray-200">
                No projects found for this contractor.
              </div>
            ) : (
              <>
                {projects.map((project) => (
                  <ProjectRow key={project.id} project={project} />
                ))}
                {hasNextPage && (
                  <button
                    type="button"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="w-full rounded-full border border-navy/30 bg-white py-3 text-xs sm:text-sm font-black text-navy hover:bg-navy hover:text-white disabled:opacity-60 transition"
                  >
                    {isFetchingNextPage ? 'Loading…' : `Load more (${(total - projects.length).toLocaleString()} left)`}
                  </button>
                )}
              </>
            )}
          </div>

          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-full border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 transition"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function ProjectRow({ project }: { project: ContractorProject }) {
  const progressPct = Math.min(Math.max(project.progress || 0, 0), 100);
  const location =
    [project.province?.name, project.province?.region?.name].filter(Boolean).join(', ') || 'Location not listed';
  const barColor = progressPct >= 90 ? '#10b981' : progressPct >= 50 ? '#01367d' : '#ffb241';

  return (
    <Link
      href={`/projects/${encodeURIComponent(project.id)}`}
      className="group block rounded-2xl bg-white p-5 border border-gray-200/90 hover:border-navy hover:shadow-lg transition-all duration-200 space-y-3"
    >
      <div className="space-y-1">
        <h3 className="font-bold text-sm text-navy group-hover:text-blue-700 transition leading-snug break-words">
          {project.name}
        </h3>
        <div className="font-mono text-xs text-gray-500">ID: {project.id}</div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="truncate">{location}</span>
      </div>

      <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
        <span className="text-gray-500 font-semibold">Budget</span>
        <span className="font-black text-navy-950 text-sm">{formatCurrency(project.budgetPHP ?? 0)}</span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-gray-500">Work done</span>
          <span className="text-navy font-black">{progressPct.toFixed(0)}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div className="h-2 rounded-full" style={{ width: `${progressPct}%`, backgroundColor: barColor }} />
        </div>
      </div>

      <div className="flex items-center justify-end text-xs font-bold text-navy group-hover:text-amber-ink transition-colors">
        View project &rarr;
      </div>
    </Link>
  );
}
