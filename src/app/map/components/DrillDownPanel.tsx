'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { formatCurrency } from '@/lib/format';

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

interface BarangayItem {
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
  province?: { name: string; region?: { name: string } };
  contractorRaw?: string | null;
}

interface DrillDownPanelProps {
  currentZoom: number;
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
  onNearMeClick?: () => void;
  isLocating?: boolean;
}

export default function DrillDownPanel({
  currentZoom,
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
  onNearMeClick,
  isLocating: externalIsLocating,
}: DrillDownPanelProps) {
  const currentProvinces = useMemo(() => getProvinces(region), [region, getProvinces]);
  const currentCities = useMemo(() => getCities(region, province), [region, province, getCities]);

  const [barangays, setBarangays] = useState<BarangayItem[]>([]);
  const [loadingBarangays, setLoadingBarangays] = useState(false);

  // In-HUD Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchProjectResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Near Me state
  const [internalIsLocating, setInternalIsLocating] = useState(false);
  const isLocating = externalIsLocating ?? internalIsLocating;
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    if (!municipality) {
      setBarangays([]);
      return;
    }

    const city = currentCities.find((c) => c.name.toLowerCase() === municipality.toLowerCase());
    setLoadingBarangays(true);

    const params = new URLSearchParams({
      municipality,
    });
    if (province) params.set('province', province);
    if (city?.file) params.set('cityFile', city.file);

    fetch(`/api/locations/barangays?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.barangays && Array.isArray(data.barangays)) {
          setBarangays(data.barangays);
        } else {
          setBarangays([]);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingBarangays(false));
  }, [municipality, province, currentCities]);

  // Debounced Search Effect
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/projects?q=${encodeURIComponent(q)}&limit=6`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.projects && Array.isArray(data.projects)) {
            setSearchResults(data.projects);
            setShowDropdown(true);
          } else {
            setSearchResults([]);
          }
        })
        .catch(console.error)
        .finally(() => setIsSearching(false));
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown on outside click
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
    if (p.gpsLng && p.gpsLat && onFlyToLocation) {
      onFlyToLocation([p.gpsLng, p.gpsLat], 16);
    } else if (onSelectProject) {
      onSelectProject(p.id);
    }
  };

  const handleNearMe = () => {
    if (onNearMeClick) {
      onNearMeClick();
      return;
    }

    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by browser');
      return;
    }

    setInternalIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setInternalIsLocating(false);
        const { longitude, latitude } = pos.coords;
        if (onFlyToLocation) {
          onFlyToLocation([longitude, latitude], 14);
        }
      },
      (err) => {
        setInternalIsLocating(false);
        console.warn('Geolocation error:', err.message);
        setGeoError('Location permission denied or unavailable');
        setTimeout(() => setGeoError(null), 3500);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const formatCount = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[96%] max-w-6xl bg-[#011438]/95 backdrop-blur-xl rounded-2xl border border-[#01367d]/70 shadow-2xl flex flex-col gap-2.5 p-3 text-white">
      {/* -- ROW 1: Breadcrumbs + In-HUD Search + Near Me + Counters -- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Breadcrumb Hierarchy Navigation */}
        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-300 shrink-0">
          <button
            onClick={() => navigateTo('root')}
            className="hover:text-[#ffb241] px-1.5 py-0.5 rounded transition font-bold"
          >
            PH
          </button>
          {region && (
            <>
              <span className="text-slate-500">/</span>
              <button
                onClick={() => navigateTo('region')}
                className="hover:text-[#ffb241] px-1.5 py-0.5 rounded transition"
              >
                {region.replace(/\s*\(.*\)/, '').slice(0, 16)}
              </button>
            </>
          )}
          {province && (
            <>
              <span className="text-slate-500">/</span>
              <button
                onClick={() => navigateTo('province')}
                className="hover:text-[#ffb241] px-1.5 py-0.5 rounded transition text-[#ffb241]"
              >
                {province}
              </button>
            </>
          )}
          {municipality && (
            <>
              <span className="text-slate-500">/</span>
              <button
                onClick={() => navigateTo('municipality')}
                className="hover:text-[#ffb241] px-1.5 py-0.5 rounded transition text-emerald-400"
              >
                {municipality}
              </button>
            </>
          )}
          {barangay && (
            <>
              <span className="text-slate-500">/</span>
              <span className="text-cyan-300 font-bold">{barangay}</span>
            </>
          )}
        </div>

        {/* Center: Real-Time In-HUD Search Input */}
        <div ref={searchContainerRef} className="relative flex-1 min-w-[240px] max-w-lg">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              {isSearching ? (
                <div className="w-3.5 h-3.5 border-2 border-[#ffb241] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
              placeholder="Search 246k+ projects, contractors, locations..."
              className="w-full bg-[#012456]/80 text-white placeholder-slate-400 text-xs font-semibold pl-9 pr-8 py-2 rounded-xl border border-[#01367d] focus:border-[#ffb241] focus:ring-1 focus:ring-[#ffb241] focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowDropdown(false);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
              >
                &times;
              </button>
            )}
          </div>

          {/* Search Autocomplete Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 mt-1.5 bg-[#011438] border border-[#01367d] rounded-xl shadow-2xl overflow-hidden z-50 divide-y divide-white/5 max-h-72 overflow-y-auto">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectResult(item)}
                  className="w-full text-left p-2.5 hover:bg-white/10 transition flex flex-col gap-0.5 group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-100 group-hover:text-[#ffb241] truncate">
                      {item.name}
                    </span>
                    {item.budgetPHP !== undefined && (
                      <span className="text-[11px] font-mono font-bold text-[#ffb241] shrink-0">
                        {formatCurrency(item.budgetPHP)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="truncate">
                      {item.province?.name || 'Philippines'} {item.contractorRaw ? `• ${item.contractorRaw}` : ''}
                    </span>
                    <span className="text-slate-500 font-mono text-[9px] shrink-0">
                      ID: {item.id}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: In-HUD "Near Me" GPS Radar Button + Counter */}
        <div className="flex items-center gap-2">
          {/* Near Me GPS Button */}
          <button
            onClick={handleNearMe}
            disabled={isLocating}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${
              isLocating
                ? 'bg-[#ffb241] text-[#011438] border-[#ffb241] animate-pulse'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/15 hover:border-[#ffb241]/60'
            }`}
            title="Center map on your current GPS coordinates"
          >
            <svg
              className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : 'text-[#ffb241]'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="8" strokeWidth={2} />
              <line x1="12" y1="2" x2="12" y2="6" strokeWidth={2} />
              <line x1="12" y1="18" x2="12" y2="22" strokeWidth={2} />
              <line x1="2" y1="12" x2="6" y2="12" strokeWidth={2} />
              <line x1="18" y1="12" x2="22" y2="12" strokeWidth={2} />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
            <span>{isLocating ? 'Locating...' : 'Near Me'}</span>
          </button>

          {/* Project Count Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 font-mono text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-slate-200">
              {isReady ? `${formatCount(totalPoints)} PTS` : 'LOADING...'}
            </span>
          </div>

          {/* Basemap Toggle Pills */}
          <div className="flex items-center bg-white/10 p-0.5 rounded-xl border border-white/15 text-[11px] font-mono">
            <button
              onClick={() => setBasemap('satellite')}
              className={`px-2 py-1 rounded-lg transition-all ${
                basemap === 'satellite'
                  ? 'bg-[#ffb241] text-[#011438] font-bold shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              SAT
            </button>
            <button
              onClick={() => setBasemap('dark')}
              className={`px-2 py-1 rounded-lg transition-all ${
                basemap === 'dark'
                  ? 'bg-[#ffb241] text-[#011438] font-bold shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              DARK
            </button>
            <button
              onClick={() => setBasemap('streets')}
              className={`px-2 py-1 rounded-lg transition-all ${
                basemap === 'streets'
                  ? 'bg-[#ffb241] text-[#011438] font-bold shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              TERR
            </button>
          </div>
        </div>
      </div>

      {/* Geolocation feedback error toast */}
      {geoError && (
        <div className="bg-red-500/20 border border-red-500/40 text-red-200 text-[11px] px-3 py-1 rounded-lg text-center font-mono">
          {geoError}
        </div>
      )}

      {/* -- ROW 2: Hierarchical Dropdowns -- */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/10 text-xs">
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="rounded-lg border border-[#01367d] bg-[#012456] px-2.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#ffb241]"
        >
          <option value="">All Regions</option>
          {sortedRegions.map((r) => (
            <option key={r.id} value={r.name}>{r.name}</option>
          ))}
        </select>

        {region && (
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="rounded-lg border border-[#01367d] bg-[#012456] px-2.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#ffb241]"
          >
            <option value="">All Provinces</option>
            {currentProvinces.map((p) => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        )}

        {province && (
          <select
            value={municipality}
            onChange={(e) => {
              const val = e.target.value;
              const cityItem = currentCities.find((c) => c.name === val);
              setMunicipality(val, cityItem?.file);
            }}
            className="rounded-lg border border-[#01367d] bg-[#012456] px-2.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#ffb241]"
          >
            <option value="">All Cities / Muni</option>
            {currentCities.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        )}

        {(municipality || province) && barangays.length > 0 && (
          <select
            value={barangay}
            onChange={(e) => {
              const val = e.target.value;
              const bObj = barangays.find((b) => b.name === val);
              setBarangay(val, bObj?.bounds);
            }}
            className="rounded-lg border border-[#01367d] bg-[#012456] px-2.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#ffb241]"
          >
            <option value="">All Barangays</option>
            {barangays.map((b) => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
