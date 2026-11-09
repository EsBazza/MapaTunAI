'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SiteFooter } from '@/components/site-footer';
import ContractorCard from './components/ContractorCard';
import ContractorDetails from './components/ContractorDetails';
import ContractorProjectsDrawer from './components/ContractorProjectsDrawer';
import { AnimatePresence } from 'motion/react';
import type {
  Contractor,
  ContractorListResponse,
  ContractorSortField,
  RiskFilter,
} from './components/types';

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;

const FILTERS: Array<{ id: RiskFilter; label: string; activeClass: string }> = [
  { id: 'all', label: 'All', activeClass: 'bg-white text-navy' },
  { id: 'clean', label: 'No delays', activeClass: 'bg-emerald-500 text-white' },
  { id: 'delayed', label: 'Some late', activeClass: 'bg-amber text-navy' },
  { id: 'high', label: 'Many late / cancelled', activeClass: 'bg-signal text-white' },
];

const SORT_OPTIONS: Array<{ value: ContractorSortField; label: string }> = [
  { value: 'totalValuePHP', label: 'Total value (₱)' },
  { value: 'totalContracts', label: 'Number of projects' },
  { value: 'overdueCount', label: 'Late projects' },
  { value: 'avgProgress', label: 'Average work done' },
];

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function ContractorsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const debouncedSearch = useDebouncedValue(searchTerm.trim(), SEARCH_DEBOUNCE_MS);
  const [sortBy, setSortBy] = useState<ContractorSortField>('totalValuePHP');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [filterRisk, setFilterRisk] = useState<RiskFilter>('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerContractor, setDrawerContractor] = useState<string | null>(null);

  // ?q= seeds the search on arrival (e.g. from a project page link); after that,
  // keep the URL in sync with the debounced search so it can be shared.
  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (current === debouncedSearch) return;
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) params.set('q', debouncedSearch);
    else params.delete('q');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [debouncedSearch, pathname, router, searchParams]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery<ContractorListResponse>({
    queryKey: ['contractors', { q: debouncedSearch, page, sortBy, sortOrder, filterRisk }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sort: sortBy,
        order: sortOrder,
      });
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (filterRisk !== 'all') params.set('risk', filterRisk);
      const res = await fetch(`/api/contractors?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch contractors');
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const contractors = data?.contractors ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;
  const total = data?.pagination.total ?? 0;
  const selected: Contractor | null =
    contractors.find((c) => c.id === selectedId) ?? contractors[0] ?? null;

  const changeFilter = (id: RiskFilter) => {
    setFilterRisk(id);
    setPage(1);
  };

  const closeDrawer = useCallback(() => setDrawerContractor(null), []);

  return (
    <div className="w-full min-h-screen bg-canvas text-gray-900 overflow-x-hidden font-sans">
      {/* Header */}
      <div className="relative w-full bg-navy-950 text-white px-4 sm:px-12 lg:px-16 pt-10 pb-14 rounded-b-[40px] shadow-2xl border-b border-navy/40">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-screen pointer-events-none rounded-b-[40px]"
          style={{ backgroundImage: "url('/bg2.jpg')" }}
        />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay pointer-events-none rounded-b-[40px]"
          style={{ backgroundImage: "url('/bg1.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-800/95 via-navy/85 to-navy-950/95 pointer-events-none rounded-b-[40px]" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-black text-white border border-white/20 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-amber" />
              WHO BUILDS OUR PUBLIC WORKS
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white uppercase leading-none">
              <span className="text-signal">MAPA</span>
              <span className="text-canvas">TUN</span>
              <span className="text-amber">AI</span> Contractors
            </h1>
            <p className="text-sm sm:text-base text-white/85 max-w-2xl font-medium leading-relaxed">
              See which companies won government projects, how much they were given, and how many of their projects are late.
            </p>
          </div>

          <Link
            href="/map"
            className="self-start lg:self-auto inline-flex items-center gap-2 rounded-full bg-amber px-6 py-2.5 text-xs sm:text-sm font-black text-navy-950 shadow-xl hover:bg-amber-300 transition-all duration-200"
          >
            Open the map &rarr;
          </Link>
        </div>

        {/* Filters */}
        <div className="relative z-10 mt-6 flex flex-wrap items-center gap-1.5 bg-white/10 p-1.5 rounded-3xl sm:rounded-full border border-white/20 backdrop-blur-md text-xs font-bold w-fit max-w-full">
          <span className="px-3 text-white/70 text-[11px] font-black uppercase tracking-wider">Show:</span>
          {FILTERS.map((f) => {
            const isActive = filterRisk === f.id;
            const count = data?.counts ? (f.id === 'all' ? data.counts.all : data.counts[f.id]) : undefined;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => changeFilter(f.id)}
                aria-pressed={isActive}
                className={`px-3.5 py-2 rounded-full transition-all duration-200 ${
                  isActive ? `${f.activeClass} font-black shadow-md` : 'text-white/80 hover:text-white'
                }`}
              >
                {f.label}
                {count !== undefined && <span className="ml-1.5 opacity-70">{count.toLocaleString()}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main */}
      <div className="w-full px-4 sm:px-12 lg:px-16 py-10 max-w-[1800px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* List */}
          <div className="lg:col-span-8 space-y-6 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="relative flex-1">
                <svg className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search a contractor name…"
                  aria-label="Search contractors"
                  className="w-full rounded-full border border-gray-200 bg-gray-50 py-3 pl-12 pr-4 text-base sm:text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:border-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-bold text-gray-600 shrink-0">
                <label htmlFor="contractor-sort">Sort by:</label>
                <select
                  id="contractor-sort"
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as ContractorSortField);
                    setPage(1);
                  }}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs sm:text-sm font-extrabold text-navy focus:border-navy focus:ring-1 focus:ring-navy shadow-sm"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
                    setPage(1);
                  }}
                  className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs sm:text-sm font-bold text-navy hover:bg-navy hover:text-white transition shadow-sm"
                >
                  {sortOrder === 'desc' ? '↓ Highest first' : '↑ Lowest first'}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-black text-navy tracking-tight flex items-center gap-3">
                Contractors
                <span className="text-sm font-bold text-gray-500">{total.toLocaleString()} found</span>
                {isFetching && !isLoading && (
                  <span className="text-xs font-semibold text-gray-400" aria-live="polite">
                    Updating…
                  </span>
                )}
              </h2>

              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-3xl bg-white p-7 shadow-sm border border-gray-100 space-y-3">
                    <div className="h-5 bg-gray-200 rounded w-1/3" />
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                  </div>
                ))
              ) : isError ? (
                <div className="rounded-3xl bg-white p-10 text-center shadow-sm border border-gray-100 space-y-3">
                  <p className="text-gray-600 font-semibold">We couldn&rsquo;t load contractors right now.</p>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="rounded-full bg-navy px-5 py-2 text-xs font-black text-white hover:bg-amber hover:text-navy transition"
                  >
                    Try again
                  </button>
                </div>
              ) : contractors.length > 0 ? (
                contractors.map((c, idx) => (
                  <ContractorCard
                    key={c.id}
                    contractor={c}
                    rank={(page - 1) * PAGE_SIZE + idx + 1}
                    isSelected={selected?.id === c.id}
                    onSelect={() => setSelectedId(c.id)}
                    onViewProjects={() => setDrawerContractor(c.name)}
                  />
                ))
              ) : (
                <div className="rounded-3xl bg-white p-12 text-center text-gray-500 font-semibold shadow-sm border border-gray-100">
                  {debouncedSearch
                    ? <>No contractors match &ldquo;{debouncedSearch}&rdquo;.</>
                    : 'No contractors in this group.'}
                </div>
              )}

              {totalPages > 1 && (
                <nav className="flex items-center justify-between border-t border-gray-200 pt-6" aria-label="Pages">
                  <p className="text-xs sm:text-sm text-gray-600 font-semibold">
                    Page <span className="font-extrabold text-navy">{page}</span> of{' '}
                    <span className="font-extrabold text-navy">{totalPages.toLocaleString()}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(p - 1, 1))}
                      className="rounded-full border border-gray-300 bg-white px-5 py-2 text-xs sm:text-sm font-bold text-navy hover:bg-gray-50 disabled:opacity-50 transition shadow-sm"
                    >
                      &larr; Previous
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                      className="rounded-full border border-gray-300 bg-white px-5 py-2 text-xs sm:text-sm font-bold text-navy hover:bg-gray-50 disabled:opacity-50 transition shadow-sm"
                    >
                      Next &rarr;
                    </button>
                  </div>
                </nav>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
            <ContractorDetails
              contractor={selected}
              counts={data?.counts ?? null}
              isSearching={!!debouncedSearch}
              onViewProjects={(c) => setDrawerContractor(c.name)}
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {drawerContractor && (
          <ContractorProjectsDrawer key={drawerContractor} contractorName={drawerContractor} onClose={closeDrawer} />
        )}
      </AnimatePresence>
      <SiteFooter className="mt-16" />
    </div>
  );
}

export default function ContractorsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <ContractorsContent />
    </Suspense>
  );
}
