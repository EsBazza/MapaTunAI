'use client';

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './map.css';
import DrillDownPanel, { type BarangayItem } from './components/DrillDownPanel';
import ProjectSidebar from './components/ProjectSidebar';
import MapLegend from './components/MapLegend';
import { useMapInstance } from './hooks/useMapInstance';
import { useLocationHierarchy } from './hooks/useLocationHierarchy';
import { useSupercluster } from './hooks/useSupercluster';
import { useDrillDown } from './hooks/useDrillDown';
import { useNearMe, isInPhilippines } from './hooks/useNearMe';
import { ClusterMarkerLayer } from './lib/cluster-markers';
import {
  BoundaryIndex,
  normName,
  geometriesOf,
  type BoundaryCollection,
} from './lib/boundaries';
import { SRC, upsertSource, ensureLayers, emptyCollection, circlePolygon } from './lib/map-layers';
import { pinPopupHtml, clusterPopupHtml } from './lib/popups';
import type { ClusterOrPoint, SidebarPoint, WorkerFilters } from './lib/map-types';
import {
  getBBox,
  createInvertedMask,
  toPolygons,
  type AreaFeature,
  type LngLatBounds,
} from '@/lib/geo-bounds';

type Basemap = 'satellite' | 'dark' | 'streets';
type SelectionLevel = 'none' | 'region' | 'province' | 'city' | 'barangay';

interface Selection {
  /** Level the user asked for */
  requested: SelectionLevel;
  /** Deepest level we could draw a border for */
  level: SelectionLevel;
  features: AreaFeature[];
  key: string;
}

interface PointList {
  /** What this list answers (selection key or near-me coordinates) */
  key: string;
  items: SidebarPoint[];
  total: number;
}

const NATIONAL_VIEW: { center: [number, number]; zoom: number } = { center: [122.0, 12.8], zoom: 5.8 };
/** Try the smallest circle first; widen until something is found. */
const NEAR_ME_RADII_KM = [5, 10, 25, 50];
/** Beyond 50 km we just list the closest projects, at any distance. */
const NEAREST_FALLBACK_KM = 3000;
const ZOOM_FOR_RADIUS: Record<number, number> = { 5: 12.3, 10: 11.3, 25: 10, 50: 9 };
const PIN_LAYERS = ['pins', 'pin-icons'];
const MUNIS_MIN_ZOOM = 7;

/**
 * `map.isStyleLoaded()` is false while *any* source or tile is loading, which
 * used to make border layers silently skip. Sources and layers can be added
 * as soon as the style JSON itself is parsed.
 */
function styleReady(map: mapboxgl.Map): boolean {
  return Boolean((map as unknown as { style?: { _loaded?: boolean } }).style?._loaded);
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    return res.ok ? ((await res.json()) as T) : null;
  } catch (err) {
    console.error(`Failed to load ${url}:`, err);
    return null;
  }
}

function MapContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const [basemap, setBasemap] = useState<Basemap>('satellite');
  const { mapRef, isMapLoaded, styleLoadCount, currentZoom, flyTo, fitBounds } = useMapInstance(
    mapContainerRef,
    basemap,
  );
  const { sortedRegions, getProvinces, getCities, getCentroid } = useLocationHierarchy();
  const {
    isReady,
    namesReady,
    loadError,
    totalPoints,
    unlocated,
    metadata,
    provinceCounts,
    getClusters,
    applyFilters,
    listPoints,
    getExpansionZoom,
    findProject,
    listNear,
  } = useSupercluster();
  const drill = useDrillDown();

  // --- Boundary data -------------------------------------------------------
  const [regionsFc, setRegionsFc] = useState<BoundaryCollection | null>(null);
  const [provincesFc, setProvincesFc] = useState<BoundaryCollection | null>(null);
  const [munisFc, setMunisFc] = useState<BoundaryCollection | null>(null);
  const munisRequestedRef = useRef(false);
  const [barangayData, setBarangayData] = useState<{
    key: string;
    list: BarangayItem[];
    fc: BoundaryCollection | null;
  } | null>(null);

  const boundaryIndex = useMemo(() => {
    if (!regionsFc || !provincesFc) return null;
    const index = new BoundaryIndex(regionsFc, provincesFc);
    if (munisFc) index.setMunicities(munisFc);
    return index;
  }, [regionsFc, provincesFc, munisFc]);

  // --- Other UI state ------------------------------------------------------
  const selectedProjectId = searchParams.get('project') || searchParams.get('projectId');
  const nearMe = useNearMe();
  const nearMeCoords = nearMe.coords;
  const [areaList, setAreaList] = useState<PointList | null>(null);
  /** radiusKm: the circle that found projects; null = closest projects at any distance */
  const [nearList, setNearList] = useState<(PointList & { radiusKm: number | null }) | null>(null);
  const markersRef = useRef<ClusterMarkerLayer | null>(null);
  const pulseMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const youMarkerRef = useRef<mapboxgl.Marker | null>(null);

  /** Everything the map needs to rebuild itself after a basemap switch. */
  const mapDataRef = useRef({
    regions: null as BoundaryCollection | null,
    provinces: null as BoundaryCollection | null,
    munis: null as BoundaryCollection | null,
    barangays: null as BoundaryCollection | null,
    selection: emptyCollection(),
    mask: emptyCollection(),
    nearMe: emptyCollection(),
    provinceCounts: new Map<number, number>(),
    selectedPinId: null as string | null,
    hoverListId: null as string | null,
  });
  const renderSeqRef = useRef(0);
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFitRef = useRef('');

  // --- Draw clusters/pins for the current viewport -------------------------
  const renderClusters = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !isReady) return;
    const bounds = map.getBounds();
    if (!bounds) return;

    const seq = ++renderSeqRef.current;
    const clusters = await getClusters(
      [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
      map.getZoom(),
    );
    // A newer render started while we waited: drop this stale result
    if (seq !== renderSeqRef.current || !styleReady(map)) return;

    const source = map.getSource(SRC.projects) as mapboxgl.GeoJSONSource | undefined;
    source?.setData({ type: 'FeatureCollection', features: clusters } as GeoJSON.FeatureCollection);
    // Clusters are drawn as HTML donuts; single projects stay map layers
    markersRef.current?.update(clusters as ClusterOrPoint[]);
  }, [mapRef, isReady, getClusters]);

  // --- Make sure every source + layer exists (idempotent) ------------------
  const syncMap = useCallback(() => {
    const map = mapRef.current;
    if (!map || !styleReady(map)) return false;
    const d = mapDataRef.current;

    // Static boundary sources are only added once per style (they are large)
    if (d.regions && !map.getSource(SRC.regions)) upsertSource(map, SRC.regions, d.regions as unknown as GeoJSON.FeatureCollection, 'psgcCode');
    if (d.provinces && !map.getSource(SRC.provinces)) upsertSource(map, SRC.provinces, d.provinces as unknown as GeoJSON.FeatureCollection, 'psgcCode');
    if (d.munis && !map.getSource(SRC.munis)) upsertSource(map, SRC.munis, d.munis as unknown as GeoJSON.FeatureCollection, 'psgcCode');

    upsertSource(map, SRC.barangays, (d.barangays as unknown as GeoJSON.FeatureCollection | null) ?? emptyCollection());
    upsertSource(map, SRC.selection, d.selection);
    upsertSource(map, SRC.mask, d.mask);
    upsertSource(map, SRC.nearMe, d.nearMe);
    if (!map.getSource(SRC.projects)) upsertSource(map, SRC.projects, emptyCollection(), 'i');

    ensureLayers(map);

    if (map.getSource(SRC.provinces)) {
      d.provinceCounts.forEach((count, code) => {
        map.setFeatureState({ source: SRC.provinces, id: code }, { count });
      });
    }
    if (d.selectedPinId) {
      map.setFeatureState({ source: SRC.projects, id: d.selectedPinId }, { selected: true });
    }
    return true;
  }, [mapRef]);

  /** Run syncMap now, or as soon as the style is ready. */
  const syncMapSoon = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!syncMap()) map.once('style.load', () => syncMap());
  }, [mapRef, syncMap]);

  // --- Initial + basemap change: rebuild everything ------------------------
  useEffect(() => {
    if (!isMapLoaded) return;
    syncMapSoon();
    void renderClusters();
  }, [isMapLoaded, styleLoadCount, syncMapSoon, renderClusters]);

  // --- Read URL params ------------------------------------------------------
  useEffect(() => {
    const r = searchParams.get('region');
    const p = searchParams.get('province');
    const m = searchParams.get('city') || searchParams.get('municipality');
    if (r) drill.setRegion(r);
    if (p) drill.setProvince(p);
    if (m) drill.setMunicipality(m);
    // Only react to URL changes, not to the (stable) setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // --- Load region + province borders once ----------------------------------
  useEffect(() => {
    void fetchJson<BoundaryCollection>('/geo/regions.json').then((d) => d && setRegionsFc(d));
    void fetchJson<BoundaryCollection>('/geo/provinces.json').then((d) => d && setProvincesFc(d));
  }, []);

  // City/town borders are big: load them only when they become useful
  useEffect(() => {
    if (munisRequestedRef.current) return;
    if (currentZoom < MUNIS_MIN_ZOOM && !drill.province && !drill.municipality) return;
    munisRequestedRef.current = true;
    void fetchJson<BoundaryCollection>('/geo/municities.json').then((d) => d && setMunisFc(d));
  }, [currentZoom, drill.province, drill.municipality]);

  useEffect(() => {
    const d = mapDataRef.current;
    d.regions = regionsFc;
    d.provinces = provincesFc;
    d.munis = munisFc;
    if (isMapLoaded) syncMapSoon();
  }, [regionsFc, provincesFc, munisFc, isMapLoaded, syncMapSoon]);

  // --- Province shading = number of projects (same data as the pins) -------
  useEffect(() => {
    if (!boundaryIndex || !metadata || !provinceCounts.length) return;
    const counts = new Map<number, number>();
    metadata.provinces.forEach((name, i) => {
      const regionName = metadata.regions[metadata.provinceToRegion[i]];
      for (const code of boundaryIndex.provinceCodes(name, regionName)) {
        counts.set(code, (counts.get(code) ?? 0) + (provinceCounts[i] ?? 0));
      }
    });
    mapDataRef.current.provinceCounts = counts;
    if (isMapLoaded) syncMapSoon();
  }, [boundaryIndex, metadata, provinceCounts, isMapLoaded, syncMapSoon]);

  // --- Resolve the selected city's PSGC code (for barangays) ---------------
  const cityCodes = useMemo(() => {
    if (!boundaryIndex || !drill.municipality || !munisFc) return [];
    const provinceCodes = drill.province ? boundaryIndex.provinceCodes(drill.province, drill.region) : [];
    const hint = getCentroid({
      region: drill.region,
      province: drill.province,
      municipality: drill.municipality,
      cityFile: drill.cityFile,
    })?.center;
    return boundaryIndex.cityCodes(drill.municipality, provinceCodes, hint);
  }, [boundaryIndex, munisFc, drill.region, drill.province, drill.municipality, drill.cityFile, getCentroid]);

  // --- Barangay list + borders for the selected city -----------------------
  const barangayKey = drill.municipality
    ? `${drill.province}|${drill.municipality}|${drill.cityFile}|${cityCodes[0] ?? ''}`
    : '';
  const barangayFc = barangayKey && barangayData?.key === barangayKey ? barangayData.fc : null;
  const barangays = barangayKey && barangayData?.key === barangayKey ? barangayData.list : [];
  const loadingBarangays = Boolean(barangayKey) && barangayData?.key !== barangayKey;

  useEffect(() => {
    if (!barangayKey) return;
    let cancelled = false;
    const params = new URLSearchParams({ municipality: drill.municipality });
    if (cityCodes[0]) params.set('cityPsgc', String(cityCodes[0]));
    if (drill.cityFile) params.set('cityFile', drill.cityFile);
    if (drill.province) params.set('province', drill.province);

    void fetchJson<{ barangays?: BarangayItem[]; geojson?: BoundaryCollection }>(
      `/api/locations/barangays?${params.toString()}`,
    ).then((data) => {
      if (cancelled) return;
      setBarangayData({
        key: barangayKey,
        list: Array.isArray(data?.barangays) ? data.barangays : [],
        fc: data?.geojson?.features ? data.geojson : null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [barangayKey, drill.municipality, drill.province, drill.cityFile, cityCodes]);

  useEffect(() => {
    mapDataRef.current.barangays = barangayFc;
    if (isMapLoaded) syncMapSoon();
  }, [barangayFc, isMapLoaded, syncMapSoon]);

  // --- What area is selected, and which border do we draw? -----------------
  const selection = useMemo<Selection>(() => {
    const requested: SelectionLevel = drill.barangay
      ? 'barangay'
      : drill.municipality
        ? 'city'
        : drill.province
          ? 'province'
          : drill.region
            ? 'region'
            : 'none';
    const make = (level: SelectionLevel, features: AreaFeature[]): Selection => ({
      requested,
      level,
      features,
      key: `${level}:${features.map((f) => (f.properties as { psgcCode?: number }).psgcCode ?? '').join(',')}`,
    });

    if (!boundaryIndex || requested === 'none') return make('none', []);

    if (drill.barangay && barangayFc) {
      const target = normName(drill.barangay);
      const hit = barangayFc.features.find((f) => {
        const props = f.properties as Record<string, unknown>;
        return normName(String(props.adm4_en ?? props.name ?? props.barangay_name ?? '')) === target;
      });
      if (hit) return { ...make('barangay', [hit]), key: `barangay:${drill.municipality}:${target}` };
    }

    if (drill.municipality && cityCodes.length) {
      const features = boundaryIndex.features('city', cityCodes);
      if (features.length) return make('city', features);
    }

    if (drill.province) {
      const features = boundaryIndex.features('province', boundaryIndex.provinceCodes(drill.province, drill.region));
      if (features.length) return make('province', features);
    }

    if (drill.region) {
      const features = boundaryIndex.features('region', boundaryIndex.regionCodes(drill.region));
      if (features.length) return make('region', features);
    }

    return make('none', []);
  }, [boundaryIndex, barangayFc, cityCodes, drill.region, drill.province, drill.municipality, drill.barangay]);

  // Draw the outline + dark mask, and fit the camera to it
  useEffect(() => {
    const d = mapDataRef.current;
    const geometries = geometriesOf(selection.features);
    d.selection = { type: 'FeatureCollection', features: selection.features as unknown as GeoJSON.Feature[] };
    d.mask = geometries.length
      ? { type: 'FeatureCollection', features: [createInvertedMask(geometries) as unknown as GeoJSON.Feature] }
      : emptyCollection();
    if (isMapLoaded) syncMapSoon();

    // Fit once per user choice, and again if a deeper border arrives later
    const fitKey = `${drill.focusSeq}|${selection.key}`;
    if (!isMapLoaded || fitKey === lastFitRef.current) return;

    if (selection.requested === 'none') {
      if (drill.focusSeq > 0) {
        lastFitRef.current = fitKey;
        flyTo(NATIONAL_VIEW.center, NATIONAL_VIEW.zoom);
      }
      return;
    }

    let target: LngLatBounds | null = null;
    if (selection.level === selection.requested) {
      target = getBBox(geometries);
    } else if (selection.requested === 'barangay' && drill.barangayBounds) {
      target = drill.barangayBounds;
    } else {
      // No polygon for this exact area (e.g. a lake): use its centroid box
      target =
        getCentroid({
          region: drill.region,
          province: drill.province,
          municipality: drill.municipality,
          cityFile: drill.cityFile,
        })?.bounds ?? getBBox(geometries);
    }
    if (target) {
      lastFitRef.current = fitKey;
      fitBounds(target);
    }
  }, [selection, isMapLoaded, drill.focusSeq, drill.barangayBounds, drill.region, drill.province, drill.municipality, drill.cityFile, syncMapSoon, fitBounds, flyTo, getCentroid]);

  // --- Filter pins to the selected area -------------------------------------
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;

    const filters: WorkerFilters = {};
    const drawnArea = selection.level === 'city' || selection.level === 'barangay';
    if (drawnArea) {
      // Pins match the drawn outline exactly
      filters.polygons = selection.features.flatMap((f) => toPolygons(f.geometry));
      filters.bounds = getBBox(geometriesOf(selection.features)) ?? undefined;
    } else {
      if (drill.region) filters.region = drill.region;
      if (drill.province) filters.province = drill.province;
    }

    void applyFilters(filters).then(async () => {
      if (cancelled) return;
      void renderClusters();
      if (!drawnArea) return;
      const list = await listPoints(40);
      if (!cancelled) setAreaList({ key: `${selection.key}|${namesReady}`, items: list.items, total: list.total });
    });

    return () => {
      cancelled = true;
    };
    // namesReady: refresh the list once project names arrive
  }, [isReady, namesReady, selection, drill.region, drill.province, applyFilters, listPoints, renderClusters]);

  // --- Selected project from the URL ----------------------------------------
  useEffect(() => {
    if (!selectedProjectId || !isMapLoaded || !isReady) return;
    let cancelled = false;
    const map = mapRef.current;
    const d = mapDataRef.current;

    if (map && d.selectedPinId && styleReady(map) && map.getSource(SRC.projects)) {
      map.setFeatureState({ source: SRC.projects, id: d.selectedPinId }, { selected: false });
    }
    d.selectedPinId = selectedProjectId;

    void findProject(selectedProjectId).then(async (coords) => {
      if (cancelled) return;
      let target = coords;
      if (!target) {
        const data = await fetchJson<{ project?: { gpsLat?: number; gpsLng?: number } }>(
          `/api/projects/${encodeURIComponent(selectedProjectId)}`,
        );
        const p = data?.project;
        target = p?.gpsLat && p?.gpsLng ? [p.gpsLng, p.gpsLat] : null;
      }
      if (!cancelled && target) {
        flyTo(target, 15);
        // Two pulses, then a steady ring, so the eye finds the chosen project
        pulseMarkerRef.current?.remove();
        const el = document.createElement('div');
        el.className = 'mtn-pulse';
        if (map) pulseMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat(target).addTo(map);
      }
      syncMapSoon();
    });
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, isMapLoaded, isReady, mapRef, findProject, flyTo, syncMapSoon]);

  // --- Near me ---------------------------------------------------------------
  const nearKey = nearMeCoords ? `${nearMeCoords.join(',')}|${namesReady}` : '';
  const nearAnswer = nearKey && nearList?.key === nearKey ? nearList : null;
  const nearRadius = nearAnswer ? nearAnswer.radiusKm : null;
  const outsidePh = nearMeCoords ? !isInPhilippines(nearMeCoords) : false;

  // Find projects: 5 km first, then wider, then simply the closest ones
  useEffect(() => {
    if (!nearMeCoords || !isReady) return;
    let cancelled = false;
    void (async () => {
      for (const radiusKm of NEAR_ME_RADII_KM) {
        const list = await listNear(nearMeCoords, radiusKm, 40);
        if (cancelled) return;
        if (list.total > 0) {
          setNearList({ key: nearKey, items: list.items, total: list.total, radiusKm });
          return;
        }
      }
      const nearest = await listNear(nearMeCoords, NEAREST_FALLBACK_KM, 20);
      if (!cancelled) setNearList({ key: nearKey, items: nearest.items, total: nearest.items.length, radiusKm: null });
    })();
    return () => {
      cancelled = true;
    };
  }, [nearMeCoords, nearKey, isReady, listNear]);

  // Draw the circle that was actually used, plus a "you are here" dot
  useEffect(() => {
    const map = mapRef.current;
    mapDataRef.current.nearMe =
      nearMeCoords && nearRadius ? circlePolygon(nearMeCoords, nearRadius) : emptyCollection();
    if (isMapLoaded) syncMapSoon();

    youMarkerRef.current?.remove();
    youMarkerRef.current = null;
    if (!map || !nearMeCoords || outsidePh) return;
    const el = document.createElement('div');
    el.className = 'mtn-you';
    el.setAttribute('aria-hidden', 'true');
    youMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat(nearMeCoords).addTo(map);
  }, [nearMeCoords, nearRadius, outsidePh, isMapLoaded, syncMapSoon, mapRef]);

  // Move the camera once per answer
  const nearFlyKey = nearAnswer ? nearKey : '';
  useEffect(() => {
    if (!nearFlyKey || !nearAnswer || !nearMeCoords) return;
    if (!outsidePh) {
      flyTo(nearMeCoords, nearAnswer.radiusKm ? ZOOM_FOR_RADIUS[nearAnswer.radiusKm] ?? 11 : 9);
    } else if (nearAnswer.items[0]?.coordinates) {
      flyTo(nearAnswer.items[0].coordinates, 10);
    }
    // Only when a new answer arrives (nearFlyKey changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearFlyKey]);

  // While picking, the next tap on the map sets the location
  const picking = nearMe.status.kind === 'picking';
  const { pick } = nearMe;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || !picking) return;
    const onPick = (e: mapboxgl.MapMouseEvent) => pick([e.lngLat.lng, e.lngLat.lat]);
    map.once('click', onPick);
    return () => {
      map.off('click', onPick);
    };
  }, [picking, pick, isMapLoaded, mapRef]);

  // --- Side list: "near me" wins over the selected city/barangay -----------
  const drawnArea = selection.level === 'city' || selection.level === 'barangay';
  const areaKey = `${selection.key}|${namesReady}`;
  const pickedSpot = nearMe.status.kind === 'located' && nearMe.status.source === 'picked';
  const youLabel = pickedSpot ? 'the spot you picked' : 'you';
  const lastRadius = NEAR_ME_RADII_KM[NEAR_ME_RADII_KM.length - 1];
  let nearSubtitle: string | undefined;
  if (nearAnswer && outsidePh) {
    nearSubtitle = 'Your location looks outside the Philippines. Use Near me, then "Tap the map instead" to choose a spot.';
  } else if (nearAnswer && nearRadius && nearRadius > NEAR_ME_RADII_KM[0]) {
    nearSubtitle = `Nothing within ${NEAR_ME_RADII_KM[0]} km, so we searched wider.`;
  } else if (nearAnswer && !nearRadius) {
    nearSubtitle = `Nothing within ${lastRadius} km. These are the closest ones.`;
  }
  const sidebar = nearMeCoords
    ? {
        mode: 'near' as const,
        title: !nearAnswer
          ? `Projects near ${youLabel}`
          : nearRadius
            ? `Projects within ${nearRadius} km of ${youLabel}`
            : 'Closest projects we know of',
        subtitle: nearSubtitle,
        items: nearAnswer ? nearAnswer.items : [],
        total: nearAnswer ? nearAnswer.total : 0,
        loading: !nearAnswer,
      }
    : drawnArea
      ? {
          mode: 'area' as const,
          title: drill.barangay ? `Barangay ${drill.barangay}` : drill.municipality,
          subtitle: undefined as string | undefined,
          items: areaList?.key === areaKey ? areaList.items : [],
          total: areaList?.key === areaKey ? areaList.total : 0,
          loading: areaList?.key !== areaKey,
        }
      : null;

  // --- Mouse / touch interactions -------------------------------------------
  const openProject = useCallback(
    (id: string) => router.push(`/projects/${encodeURIComponent(id)}`),
    [router],
  );

  /** Search result chosen: select it on the map (URL drives the selection + pulse). */
  const focusProject = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('project', id);
      params.delete('projectId');
      router.replace(`/map?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    const isTouch = window.matchMedia('(hover: none)').matches;
    let hoveredId: string | number | null = null;
    let touchPopupId: string | null = null;

    // 'mtn-popup' strips Mapbox's white frame (see map.css)
    const pinPopup = new mapboxgl.Popup({
      closeButton: isTouch,
      closeOnClick: isTouch,
      offset: 14,
      maxWidth: '300px',
      className: 'mtn-popup',
    });
    const clusterPopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 22,
      maxWidth: '280px',
      className: 'mtn-popup',
    });

    const setHover = (id: string | number | null) => {
      if (hoveredId !== null && map.getSource(SRC.projects)) {
        map.setFeatureState({ source: SRC.projects, id: hoveredId }, { hover: false });
      }
      hoveredId = id;
      if (id !== null) map.setFeatureState({ source: SRC.projects, id }, { hover: true });
    };

    const showPinPopup = (feature: mapboxgl.GeoJSONFeature, withLink: boolean) => {
      const p = (feature.properties ?? {}) as Record<string, unknown>;
      const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      pinPopup
        .setLngLat(coords)
        .setHTML(
          pinPopupHtml(
            {
              id: String(p.i ?? ''),
              name: typeof p.n === 'string' ? p.n : undefined,
              category: String(p.c ?? 'Other'),
              budget: Number(p.b ?? 0),
              progress: Number(p.g ?? 0),
              risk: Number(p.risk ?? 0) as 0 | 1 | 2,
              done: Number(p.done ?? 0) === 1,
            },
            withLink,
          ),
        )
        .addTo(map);

      // Keep navigation inside the app (no full page reload)
      const link = pinPopup.getElement()?.querySelector<HTMLAnchorElement>('[data-project-link]');
      link?.addEventListener('click', (e) => {
        e.preventDefault();
        openProject(String(p.i ?? ''));
      });
    };

    // Donut clusters (HTML markers)
    const markers = new ClusterMarkerLayer(map, {
      onClick: async (clusterId, coords) => {
        const zoom = map.getZoom();
        const expansion = await getExpansionZoom(clusterId);
        map.easeTo({
          center: coords,
          zoom: Math.min(Math.max(expansion + 0.5, zoom + 2), 16),
          duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600,
        });
      },
      onEnter: (_el, mix, coords) => {
        if (isTouch) return;
        clusterPopup.setLngLat(coords).setHTML(clusterPopupHtml(mix)).addTo(map);
      },
      onLeave: () => clusterPopup.remove(),
    });
    markersRef.current = markers;

    const onMoveEnd = () => {
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
      renderTimeoutRef.current = setTimeout(() => void renderClusters(), 40);
    };

    const onPinClick = (e: mapboxgl.MapMouseEvent) => {
      // While choosing a spot for "near me", a tap sets the spot, it doesn't open a project
      if (map.getContainer().closest('.mtn-picking')) return;
      const feature = map.queryRenderedFeatures(e.point, { layers: PIN_LAYERS.filter((l) => map.getLayer(l)) })[0];
      const id = feature?.properties?.i as string | undefined;
      if (!feature || !id) return;
      // On phones the first tap shows the details, the button opens the project
      if (isTouch && touchPopupId !== id) {
        touchPopupId = id;
        showPinPopup(feature, true);
        return;
      }
      openProject(id);
    };

    const onPinMove = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const feature = e.features?.[0];
      if (!feature) return;
      map.getCanvas().style.cursor = 'pointer';
      if (feature.id !== undefined && feature.id !== hoveredId) {
        setHover(feature.id);
        if (!isTouch) showPinPopup(feature, false);
      }
    };

    const onPinLeave = () => {
      map.getCanvas().style.cursor = '';
      setHover(null);
      if (!isTouch) pinPopup.remove();
    };

    pinPopup.on('close', () => {
      touchPopupId = null;
    });

    map.on('moveend', onMoveEnd);
    map.on('click', PIN_LAYERS, onPinClick);
    map.on('mousemove', PIN_LAYERS, onPinMove);
    map.on('mouseleave', PIN_LAYERS, onPinLeave);

    // Draw the donuts for the current view now that the layer exists
    void renderClusters();

    return () => {
      map.off('moveend', onMoveEnd);
      map.off('click', PIN_LAYERS, onPinClick);
      map.off('mousemove', PIN_LAYERS, onPinMove);
      map.off('mouseleave', PIN_LAYERS, onPinLeave);
      markers.clear();
      if (markersRef.current === markers) markersRef.current = null;
      pinPopup.remove();
      clusterPopup.remove();
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
    };
  }, [isMapLoaded, mapRef, renderClusters, getExpansionZoom, openProject]);

  // Remove one-off markers when leaving the page
  useEffect(
    () => () => {
      pulseMarkerRef.current?.remove();
      youMarkerRef.current?.remove();
    },
    [],
  );

  // Highlight a pin while hovering its row in the side list
  const onHoverSidebarItem = useCallback(
    (item: SidebarPoint | null) => {
      const map = mapRef.current;
      if (!map || !styleReady(map) || !map.getSource(SRC.projects)) return;
      const d = mapDataRef.current;
      if (d.hoverListId) map.setFeatureState({ source: SRC.projects, id: d.hoverListId }, { hover: false });
      d.hoverListId = item?.id ?? null;
      if (item) map.setFeatureState({ source: SRC.projects, id: item.id }, { hover: true });
    },
    [mapRef],
  );

  const sidebarMode = sidebar?.mode;
  const { setMunicipality } = drill;
  const { reset: resetNearMe } = nearMe;
  const closeSidebar = useCallback(() => {
    if (sidebarMode === 'near') resetNearMe();
    else setMunicipality('');
  }, [sidebarMode, setMunicipality, resetNearMe]);

  const hasToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

  return (
    <div className={`relative h-[calc(100vh-64px)] w-full overflow-hidden bg-navy-950 ${picking ? 'mtn-picking' : ''}`}>
      <div ref={mapContainerRef} className="h-full w-full" />

      {!hasToken && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-6 text-center text-sm text-slate-300">
          The map can&apos;t load because NEXT_PUBLIC_MAPBOX_TOKEN is not set.
        </div>
      )}

      {(loadError || (!isReady && hasToken)) && (
        <div
          role="status"
          className="absolute left-1/2 top-44 z-30 -translate-x-1/2 rounded-lg border border-white/10 bg-navy-950/95 px-4 py-2 text-xs text-white shadow-xl sm:top-36"
        >
          {loadError ? `${loadError}. Please refresh the page.` : 'Loading projects…'}
        </div>
      )}

      <DrillDownPanel
        totalPoints={totalPoints}
        isReady={isReady}
        sortedRegions={sortedRegions}
        region={drill.region}
        province={drill.province}
        municipality={drill.municipality}
        barangay={drill.barangay}
        setRegion={drill.setRegion}
        setProvince={drill.setProvince}
        setMunicipality={drill.setMunicipality}
        setBarangay={drill.setBarangay}
        navigateTo={drill.navigateTo}
        basemap={basemap}
        setBasemap={setBasemap}
        getProvinces={getProvinces}
        getCities={getCities}
        barangays={barangays}
        loadingBarangays={loadingBarangays}
        onFlyToLocation={(coords, zoom) => flyTo(coords, zoom ?? 15)}
        onSelectProject={openProject}
        onFocusProject={focusProject}
        nearMe={nearMe.status}
        onNearMe={nearMe.locate}
        onPickOnMap={nearMe.startPicking}
        onCancelNearMe={nearMe.reset}
      />

      <MapLegend unlocated={unlocated} />

      {sidebar && (
        <ProjectSidebar
          title={sidebar.title}
          subtitle={sidebar.subtitle}
          items={sidebar.items}
          total={sidebar.total}
          loading={sidebar.loading}
          emptyText={sidebar.mode === 'near' ? 'No projects with a known location yet.' : 'No projects found in this area.'}
          onSelectProject={openProject}
          onHoverProject={onHoverSidebarItem}
          onClose={closeSidebar}
        />
      )}
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-navy-950" />}>
      <MapContent />
    </Suspense>
  );
}
