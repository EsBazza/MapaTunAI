'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Play, Pause } from 'lucide-react';
import { ESRI_WAYBACK_CATALOG } from '@/lib/constants';

const CATALOG_YEARS = Object.keys(ESRI_WAYBACK_CATALOG).map(Number).sort((a, b) => a - b);
const LATEST_YEAR = CATALOG_YEARS[CATALOG_YEARS.length - 1];

function tileUrlFor(year: number) {
  const item = ESRI_WAYBACK_CATALOG[year] || ESRI_WAYBACK_CATALOG[LATEST_YEAR];
  return `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/${item.m}/{z}/{y}/{x}`;
}

interface SatelliteTimelineProps {
  lat: number | null | undefined;
  lng: number | null | undefined;
  startDate: string | null | undefined;
}

export default function SatelliteTimeline({ lat, lng, startDate }: SatelliteTimelineProps) {
  const startYear = startDate ? new Date(startDate).getFullYear() : NaN;
  // Show one year before work started (when available) so people can compare before/after.
  const beforeYear = Math.max(CATALOG_YEARS[0], Math.min(isNaN(startYear) ? CATALOG_YEARS[0] : startYear - 1, LATEST_YEAR - 1));

  const years = useMemo(() => CATALOG_YEARS.filter((y) => y >= beforeYear), [beforeYear]);
  const [year, setYear] = useState<number>(LATEST_YEAR);
  const [isPlaying, setIsPlaying] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const yearRef = useRef(year);
  useEffect(() => {
    yearRef.current = year;
  }, [year]);

  const hasCoords = typeof lat === 'number' && typeof lng === 'number' && !!lat && !!lng;

  useEffect(() => {
    if (!containerRef.current || !hasCoords) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          'esri-wayback': { type: 'raster', tiles: [tileUrlFor(yearRef.current)], tileSize: 256, attribution: 'Esri World Imagery Wayback' },
        },
        layers: [{ id: 'wayback-layer', type: 'raster', source: 'esri-wayback' }],
      },
      center: [lng as number, lat as number],
      zoom: 16,
      attributionControl: false,
      cooperativeGestures: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    new mapboxgl.Marker({ color: '#ffb241' }).setLngLat([lng as number, lat as number]).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, hasCoords]);

  // Swap imagery year in place (setTiles keeps the map, no layer re-creation).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('esri-wayback') as mapboxgl.RasterTileSource | undefined;
      src?.setTiles([tileUrlFor(year)]);
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [year]);

  // Timelapse: one stable interval while playing.
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setYear((prev) => {
        const i = years.indexOf(prev);
        return years[(i + 1) % years.length];
      });
    }, 1600);
    return () => clearInterval(id);
  }, [isPlaying, years]);

  const item = ESRI_WAYBACK_CATALOG[year] || ESRI_WAYBACK_CATALOG[LATEST_YEAR];

  const published = new Date(item.releaseDate).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });

  return (
    <section aria-labelledby="timeline-title" className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-end justify-between gap-3 p-5 sm:px-7">
        <div>
          <h2 id="timeline-title" className="font-display text-xl font-semibold text-ink">
            Explore every year
          </h2>
          <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">
            Move through the satellite photos of this spot, one year at a time.
          </p>
        </div>
        {hasCoords && (
          <p className="text-sm text-ink-muted" aria-live="polite">
            Showing <span className="font-semibold text-ink">{year}</span> · published {published}, the photo may be older
          </p>
        )}
      </div>

      <div className="relative h-[380px] w-full bg-navy-950 sm:h-[460px]">
        {hasCoords ? (
          <div ref={containerRef} className="h-full w-full" />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-6 text-center text-[15px] text-white/75">
            This project has no map location in the records, so we can&rsquo;t show satellite photos.
          </div>
        )}
      </div>

      {hasCoords && (
        <div className="space-y-3 border-t border-line p-4 sm:px-7">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              aria-label={isPlaying ? 'Pause the year-by-year playback' : 'Play the years in order'}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-navy px-4 text-sm font-medium text-white hover:bg-navy-700"
            >
              {isPlaying ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <input
              type="range"
              aria-label="Photo year"
              aria-valuetext={String(year)}
              min={years[0]}
              max={LATEST_YEAR}
              step={1}
              value={year}
              onChange={(e) => {
                setIsPlaying(false);
                setYear(Number(e.target.value));
              }}
              className="h-2 w-full cursor-pointer accent-navy"
            />
          </div>
          <div className="flex items-center justify-between gap-1 overflow-x-auto">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                aria-pressed={y === year}
                onClick={() => {
                  setIsPlaying(false);
                  setYear(y);
                }}
                className={`min-h-9 shrink-0 rounded-md px-2 text-sm transition-colors duration-150 ${
                  y === year ? 'bg-navy font-medium text-white' : 'text-ink-muted hover:bg-sunken hover:text-ink'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
