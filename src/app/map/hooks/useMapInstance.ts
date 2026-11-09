'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { registerPinIcons, handleMissingPinIcon } from '../lib/pin-icons';

const BASEMAP_STYLES: Record<string, string> = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
  streets: 'mapbox://styles/mapbox/outdoors-v12',
};

const PHILIPPINES_BOUNDS: [[number, number], [number, number]] = [
  [114.0, 4.0],
  [128.5, 22.0],
];

/**
 * Haze toward the horizon when the map is tilted, so distant terrain recedes
 * instead of ending in a hard edge. Colours are the navy/canvas tokens.
 */
const FOG: Record<string, mapboxgl.FogSpecification> = {
  satellite: {
    range: [1, 10],
    color: '#011a40',
    'high-color': '#012c66',
    'horizon-blend': 0.06,
    'space-color': '#011438',
    'star-intensity': 0,
  },
  dark: {
    range: [1, 10],
    color: '#011438',
    'high-color': '#011a40',
    'horizon-blend': 0.05,
    'space-color': '#011438',
    'star-intensity': 0,
  },
  streets: {
    range: [1, 10],
    color: '#f4f6fa',
    'high-color': '#d9e6f8',
    'horizon-blend': 0.05,
    'space-color': '#d9e6f8',
    'star-intensity': 0,
  },
};

const DEM_SOURCE = 'mapbox-dem';
/** 3D terrain only close up: it costs GPU and adds nothing at country scale. */
const TERRAIN_MIN_ZOOM = 12;

/**
 * Strong ease-in-out for on-screen camera movement: cubic-bezier(0.77, 0, 0.175, 1).
 * Mapbox wants an easing function, so this solves the bezier for x → y.
 */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      const d = slopeX(t);
      if (Math.abs(err) < 1e-5 || Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return sampleY(Math.min(1, Math.max(0, t)));
  };
}
const EASE_IN_OUT = cubicBezier(0.77, 0, 0.175, 1);

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useMapInstance(
  containerRef: React.RefObject<HTMLDivElement | null>,
  basemap: string,
) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [styleLoadCount, setStyleLoadCount] = useState(0);
  const [currentZoom, setCurrentZoom] = useState(5.8);
  const prevBasemapRef = useRef(basemap);
  // Read inside map event handlers without re-creating the map
  const basemapRef = useRef(basemap);
  useEffect(() => {
    basemapRef.current = basemap;
  }, [basemap]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container,
      style: BASEMAP_STYLES[basemapRef.current] || BASEMAP_STYLES.satellite,
      center: [122.0, 12.8],
      zoom: 5.8,
      minZoom: 4.8,
      maxZoom: 18,
      maxBounds: PHILIPPINES_BOUNDS,
      pitch: 20,
      bearing: 0,
    });

    // "Near me" lives in the top panel; a second locate button here would
    // behave differently and confuse people, so only zoom/rotate controls.
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    let terrainOn = false;
    const applyTerrain = () => {
      if (!map.getSource(DEM_SOURCE)) return;
      const want = map.getZoom() >= TERRAIN_MIN_ZOOM;
      if (want === terrainOn) return;
      terrainOn = want;
      map.setTerrain(want ? { source: DEM_SOURCE, exaggeration: 1.25 } : null);
    };

    const onStyleLoad = () => {
      setStyleLoadCount((c) => c + 1);
      registerPinIcons(map);
      try {
        map.setFog(FOG[basemapRef.current] ?? FOG.satellite);
      } catch {
        // Fog is decoration; never let it break the map
      }
      if (!map.getSource(DEM_SOURCE)) {
        map.addSource(DEM_SOURCE, {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
      }
      // setStyle drops terrain: re-evaluate from scratch
      terrainOn = false;
      applyTerrain();
    };

    const onMissingImage = (e: { id: string }) => handleMissingPinIcon(map, e.id);

    map.on('style.load', onStyleLoad);
    map.on('styleimagemissing', onMissingImage);
    map.on('load', () => setIsMapLoaded(true));
    map.on('moveend', () => {
      setCurrentZoom(map.getZoom());
      applyTerrain();
    });

    mapRef.current = map;

    return () => {
      map.off('style.load', onStyleLoad);
      map.off('styleimagemissing', onMissingImage);
      map.remove();
      mapRef.current = null;
      setIsMapLoaded(false);
    };
  }, [containerRef]);

  // Switch basemap without destroying the map instance
  useEffect(() => {
    if (mapRef.current && isMapLoaded && prevBasemapRef.current !== basemap) {
      prevBasemapRef.current = basemap;
      mapRef.current.setStyle(BASEMAP_STYLES[basemap] || BASEMAP_STYLES.satellite);
    }
  }, [basemap, isMapLoaded]);

  const flyTo = useCallback(
    (center: [number, number], zoom: number, padding?: mapboxgl.PaddingOptions) => {
      const map = mapRef.current;
      if (!map) return;
      const options = {
        center,
        zoom,
        pitch: zoom > 12 ? 45 : 20,
        padding: padding || { top: 90, bottom: 50, left: 50, right: 50 },
      };
      if (prefersReducedMotion()) {
        map.jumpTo(options);
        return;
      }
      map.flyTo({ ...options, duration: 1600, curve: 1.5, easing: EASE_IN_OUT, essential: true });
    },
    [],
  );

  const fitBounds = useCallback(
    (bounds: [[number, number], [number, number]], padding?: mapboxgl.PaddingOptions) => {
      const map = mapRef.current;
      if (!map) return;
      map.fitBounds(bounds, {
        duration: prefersReducedMotion() ? 0 : 1400,
        easing: EASE_IN_OUT,
        essential: true,
        padding: padding || { top: 90, bottom: 50, left: 50, right: 50 },
        maxZoom: 17,
      });
    },
    [],
  );

  return { mapRef, isMapLoaded, styleLoadCount, currentZoom, flyTo, fitBounds };
}
