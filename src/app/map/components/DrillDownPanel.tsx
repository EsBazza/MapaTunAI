'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { formatCurrency } from '@/lib/format';
import { isPlaceholderCoords } from '@/lib/coords';
import { categoryInfo } from '../lib/pin-icons';
import type { NearMeStatus } from '../hooks/useNearMe';

interface CityItem {
  id: string;
  name: string;
  file?: string;
}

interface ProvinceItem {
  id: string;
  name: string;
  cities: CityItem[];
}

interface RegionItem {
  id: string;
  name: string;
  provinces: ProvinceItem[];
}

export interface BarangayItem {
  name: string;
  bounds?: [[number, number], [number, number]];
  center?: [number, number];
  zoom?: number;
}

interface SearchProjectResult {
  id: string;
  name: string;
  budgetPHP?: number;
  progress?: number;
  gpsLat?: number | null;
  gpsLng?: number | null;
  category?: string;
  province?: { name: string; region?: { name: string } };
  /** Corrected place from the API: GPS when real, else the stored record */
  location?: { province: string; region: string; source: string };
  contractorRaw?: string | null;
}

interface DrillDownPanelProps {
  totalPoints: number;
  isReady: boolean;
  sortedRegions: RegionItem[];
  region: string;
  province: string;
  municipality: string;
  barangay: string;
  setRegion: (v: string) => void;
  setProvince: (v: string) => void;
  setMunicipality: (v: string, file?: string) => void;
  setBarangay: (v: string, bounds?: [[number, number], [number, number]]) => void;
  navigateTo: (level: 'root' | 'region' | 'province' | 'municipality') => void;
  basemap: string;
  setBasemap: (v: 'satellite' | 'dark' | 'streets') => void;
  getProvinces: (regionName: string) => ProvinceItem[];
  getCities: (regionName: string, provinceName: string) => CityItem[];
  onFlyToLocation?: (coords: [number, number], zoom?: number) => void;
  onSelectProject?: (projectId: string) => void;
  /** Select a search result on the map: fly there and highlight its pin */
  onFocusProject?: (projectId: string, coords: [number, number]) => void;
  nearMe: NearMeStatus;
  onNearMe: () => void;
  onPickOnMap: () => void;
  onCancelNearMe: () => void;
  barangays?: BarangayItem[];
  loadingBarangays?: boolean;
}

const BASEMAPS: Array<{ id: 'satellite' | 'dark' | 'streets'; label: string }> = [
  { id: 'satellite', label: 'Satellite' },
  { id: 'dark', label: 'Dark' },
  { id: 'streets', label: 'Terrain' },
];

const SELECT_CLASS =
  'rounded-lg border border-white/15 bg-navy-900 px-2.5 py-1.5 text-xs font-medium text-slate-100 focus:border-amber focus:outline-none';

/** Bolds the first part of the name that matches the search. */
function Highlight({ text, query }: { text: string; query: string }) {
  const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
  const lower = text.toLowerCase();
  let at = -1;
  let len = 0;
  for (const t of tokens) {
    const i = lower.indexOf(t);
    if (i !== -1 && (at === -1 || i < at)) {
      at = i;
      len = t.length;
    }
  }
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-amber/25 px-0.5 text-amber-soft">{text.slice(at, at + len)}</mark>
      {text.slice(at + len)}
    </>
  );
}

function placeOf(item: SearchProjectResult): string {
  if (item.location?.source === 'unknown') return 'Location not confirmed';
  const province = item.location?.province ?? item.province?.name;
  const region = (item.location?.region ?? item.province?.region?.name ?? '').replace(/\s*\(.*\)/, '');
  if (!province) return 'Location not confirmed';
  return region && region !== province ? `${province}, ${region}` : province;
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export default function DrillDownPanel({
  totalPoints,
  isReady,
  sortedRegions,
  region,
  province,
  municipality,
  barangay,
  setRegion,
  setProvince,
  setMunicipality,
  setBarangay,
  navigateTo,
  basemap,
  setBasemap,
  getProvinces,
  getCities,
  onFlyToLocation,
  onSelectProject,
  onFocusProject,
  nearMe,
  onNearMe,
  onPickOnMap,
  onCancelNearMe,
  barangays = [],
  loadingBarangays = false,
}: DrillDownPanelProps) {
  const currentProvinces = useMemo(() => getProvinces(region), [region, getProvinces]);
  const currentCities = useMemo(() => getCities(region, province), [region, province, getCities]);

  // --- Search ---------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  // Results remember the query they answer, so a slow reply never shows for a newer query
  const [searchState, setSearchState] = useState<{ q: string; items: SearchProjectResult[] }>({ q: '', items: [] });
  const trimmedQuery = searchQuery.trim();
  const searchActive = trimmedQuery.length >= 2;
  const searchResults = searchActive && searchState.q === trimmedQuery ? searchState.items : [];
  const isSearching = searchActive && searchState.q !== trimmedQuery;
  const noResults = searchActive && !isSearching && searchResults.length === 0;
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (trimmedQuery.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/projects?q=${encodeURIComponent(trimmedQuery)}&limit=6`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled) return;
          const items = Array.isArray(data?.projects) ? (data.projects as SearchProjectResult[]) : [];
          setSearchState({ q: trimmedQuery, items });
        })
        .catch((err) => {
          console.error(err);
          if (!cancelled) setSearchState({ q: trimmedQuery, items: [] });
        });
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectResult = (p: SearchProjectResult) => {
    setShowDropdown(false);
    setSearchQuery(p.name);
    const realSpot = p.gpsLng && p.gpsLat && !isPlaceholderCoords(p.gpsLat, p.gpsLng);
    if (realSpot && onFocusProject) {
      onFocusProject(p.id, [p.gpsLng as number, p.gpsLat as number]);
    } else if (realSpot && onFlyToLocation) {
      onFlyToLocation([p.gpsLng as number, p.gpsLat as number], 16);
    } else {
      // No real map location: the project page is more useful than a wrong spot
      onSelectProject?.(p.id);
    }
  };

  // --- Near me ----------------------------------------------------------------
  const isLocating = nearMe.kind === 'locating';
  const nearActive = nearMe.kind === 'located' || nearMe.kind === 'picking';
  const showNearStatus = nearMe.kind === 'locating' || nearMe.kind === 'picking' || nearMe.kind === 'error';

  const handleNearMe = () => {
    if (nearActive || nearMe.kind === 'error' || isLocating) onCancelNearMe();
    else onNearMe();
  };

  const countLabel = isReady ? `${totalPoints.toLocaleString()} projects on the map` : 'Loading projects…';

  return (
    <div className="mtn-rise absolute left-1/2 top-4 z-30 flex w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 flex-col gap-2.5 rounded-xl border border-white/10 bg-navy-950/95 p-3 text-white shadow-xl">
      {/* Row 1: where you are · search · near me · basemap */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Area" className="flex shrink-0 items-center gap-1 text-xs text-slate-300">
          <button onClick={() => navigateTo('root')} className="rounded px-1.5 py-0.5 font-semibold transition-colors hover:text-amber">
            Philippines
          </button>
          {region && (
            <>
              <span className="text-slate-500">/</span>
              <button onClick={() => navigateTo('region')} className="max-w-[10rem] truncate rounded px-1.5 py-0.5 transition-colors hover:text-amber">
                {region.replace(/\s*\(.*\)/, '')}
              </button>
            </>
          )}
          {province && (
            <>
              <span className="text-slate-500">/</span>
              <button onClick={() => navigateTo('province')} className="rounded px-1.5 py-0.5 transition-colors hover:text-amber">
                {province}
              </button>
            </>
          )}
          {municipality && (
            <>
              <span className="text-slate-500">/</span>
              <button onClick={() => navigateTo('municipality')} className="rounded px-1.5 py-0.5 transition-colors hover:text-amber">
                {municipality}
              </button>
            </>
          )}
          {barangay && (
            <>
              <span className="text-slate-500">/</span>
              <span className="px-1.5 font-semibold text-white">{barangay}</span>
            </>
          )}
        </nav>

        {/* Search */}
        <div ref={searchContainerRef} className="relative min-w-[240px] max-w-lg flex-1">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              {isSearching ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber border-t-transparent" />
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setShowDropdown(false);
              }}
              aria-label="Search projects, contractors or places"
              placeholder="Search a project, contractor or place"
              className="w-full rounded-lg border border-white/15 bg-navy-900 py-2 pl-9 pr-8 text-sm text-white placeholder-slate-400 transition-colors focus:border-amber focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowDropdown(false);
                }}
                aria-label="Clear search"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white"
              >
                &times;
              </button>
            )}
          </div>

          {showDropdown && (searchResults.length > 0 || noResults) && (
            <div className="mtn-rise absolute left-0 right-0 z-50 mt-1.5 max-h-80 divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10 bg-navy-950 shadow-xl">
              {noResults && <p className="p-3 text-xs text-slate-400">No projects match &ldquo;{trimmedQuery}&rdquo;.</p>}
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectResult(item)}
                  className="group flex w-full flex-col gap-1 p-2.5 text-left transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-xs font-semibold leading-snug text-slate-100">
                      <Highlight text={item.name} query={trimmedQuery} />
                    </span>
                    {item.budgetPHP !== undefined && (
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-amber">{formatCurrency(item.budgetPHP)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <PinIcon className="h-3 w-3 shrink-0" />
                      <span className={`truncate ${item.location?.source === 'unknown' ? 'italic' : 'text-slate-200'}`}>
                        {placeOf(item)}
                      </span>
                      {item.category && <span className="shrink-0">· {categoryInfo(item.category).label}</span>}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-500">{item.id}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleNearMe}
            aria-pressed={nearActive}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              isLocating || nearActive
                ? 'border-amber bg-amber text-navy-950'
                : 'border-white/15 bg-white/10 text-white hover:border-amber/60 hover:bg-white/15'
            }`}
            title={nearActive ? 'Stop showing nearby projects' : 'Show projects near you'}
          >
            {isLocating ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-navy-950 border-t-transparent" aria-hidden="true" />
            ) : (
              <svg className={`h-3.5 w-3.5 ${nearActive ? '' : 'text-amber'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="8" />
                <path strokeLinecap="round" d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            )}
            <span>{isLocating ? 'Finding you' : 'Near me'}</span>
            {nearActive && (
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
              </svg>
            )}
          </button>

          <span className="hidden rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs tabular-nums text-slate-300 sm:inline">
            {countLabel}
          </span>

          <div role="group" aria-label="Map style" className="flex items-center rounded-lg border border-white/15 bg-white/5 p-0.5 text-xs">
            {BASEMAPS.map((b) => (
              <button
                key={b.id}
                onClick={() => setBasemap(b.id)}
                aria-pressed={basemap === b.id}
                className={`rounded-md px-2 py-1 transition-colors ${
                  basemap === b.id ? 'bg-amber font-semibold text-navy-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Near me: progress, problems, and the tap-the-map fallback */}
      {showNearStatus && (
        <div
          role="status"
          aria-live="polite"
          className={`mtn-rise flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
            nearMe.kind === 'error' ? 'border-amber/40 bg-amber/10 text-amber-soft' : 'border-white/15 bg-white/5 text-slate-200'
          }`}
        >
          <span className="min-w-0 flex-1">
            {nearMe.kind === 'locating' && 'Finding your location. If your browser asks, choose Allow.'}
            {nearMe.kind === 'picking' && 'Tap your spot on the map to see the projects around it.'}
            {nearMe.kind === 'error' && nearMe.message}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {nearMe.kind !== 'picking' && (
              <button type="button" onClick={onPickOnMap} className="rounded-md bg-white/15 px-2.5 py-1 font-semibold text-white transition-colors hover:bg-white/25">
                Tap the map instead
              </button>
            )}
            {nearMe.kind === 'error' && nearMe.reason !== 'unsupported' && nearMe.reason !== 'insecure' && (
              <button type="button" onClick={onNearMe} className="rounded-md bg-amber px-2.5 py-1 font-semibold text-navy-950 transition-colors hover:bg-amber-soft">
                Try again
              </button>
            )}
            <button type="button" onClick={onCancelNearMe} className="rounded-md px-2 py-1 text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
              Cancel
            </button>
          </span>
        </div>
      )}

      {/* Row 2: pick an area */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2">
        <select aria-label="Region" value={region} onChange={(e) => setRegion(e.target.value)} className={SELECT_CLASS}>
          <option value="">All regions</option>
          {sortedRegions.map((r) => (
            <option key={r.id} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>

        {region && (
          <select aria-label="Province" value={province} onChange={(e) => setProvince(e.target.value)} className={SELECT_CLASS}>
            <option value="">All provinces</option>
            {currentProvinces.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        {province && (
          <select
            aria-label="City or town"
            value={municipality}
            onChange={(e) => {
              const val = e.target.value;
              const cityItem = currentCities.find((c) => c.name === val);
              setMunicipality(val, cityItem?.file);
            }}
            className={SELECT_CLASS}
          >
            <option value="">All cities and towns</option>
            {currentCities.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {(municipality || province) && (barangays.length > 0 || loadingBarangays) && (
          <select
            aria-label="Barangay"
            value={barangay}
            onChange={(e) => {
              const val = e.target.value;
              const bObj = barangays.find((b) => b.name === val);
              setBarangay(val, bObj?.bounds);
            }}
            className={SELECT_CLASS}
          >
            <option value="">{loadingBarangays ? 'Loading barangays…' : 'All barangays'}</option>
            {barangays.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
