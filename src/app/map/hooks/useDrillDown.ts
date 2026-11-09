'use client';

import { useState, useCallback } from 'react';
import type { LngLatBounds } from '@/lib/geo-bounds';

export interface DrillDownState {
  region: string;
  province: string;
  municipality: string;
  cityFile: string;
  barangay: string;
  /** Bounds that came with the barangay list (fallback when no polygon) */
  barangayBounds: LngLatBounds | null;
  /** Bumps on every user choice so the camera re-fits even to the same place */
  focusSeq: number;
}

const EMPTY: DrillDownState = {
  region: '',
  province: '',
  municipality: '',
  cityFile: '',
  barangay: '',
  barangayBounds: null,
  focusSeq: 0,
};

/**
 * Holds the Region → Province → City → Barangay selection.
 * It does not move the camera: the map page fits the camera to the resolved
 * border of whatever is selected, so the view and the outline always match.
 */
export function useDrillDown() {
  const [state, setState] = useState<DrillDownState>(EMPTY);

  const setRegion = useCallback((region: string) => {
    setState((prev) => ({ ...EMPTY, region, focusSeq: prev.focusSeq + 1 }));
  }, []);

  const setProvince = useCallback((province: string) => {
    setState((prev) => ({ ...EMPTY, region: prev.region, province, focusSeq: prev.focusSeq + 1 }));
  }, []);

  const setMunicipality = useCallback((municipality: string, cityFile?: string) => {
    setState((prev) => ({
      ...EMPTY,
      region: prev.region,
      province: prev.province,
      municipality,
      cityFile: municipality ? cityFile || '' : '',
      focusSeq: prev.focusSeq + 1,
    }));
  }, []);

  const setBarangay = useCallback((barangay: string, bounds?: LngLatBounds) => {
    setState((prev) => ({
      ...prev,
      barangay,
      barangayBounds: barangay ? bounds ?? null : null,
      focusSeq: prev.focusSeq + 1,
    }));
  }, []);

  const resetAll = useCallback(() => setState((prev) => ({ ...EMPTY, focusSeq: prev.focusSeq + 1 })), []);

  /** Breadcrumb navigation: clicking a level clears everything below it. */
  const navigateTo = useCallback((level: 'root' | 'region' | 'province' | 'municipality') => {
    setState((prev) => {
      const focusSeq = prev.focusSeq + 1;
      switch (level) {
        case 'root':
          return { ...EMPTY, focusSeq };
        case 'region':
          return { ...EMPTY, region: prev.region, focusSeq };
        case 'province':
          return { ...EMPTY, region: prev.region, province: prev.province, focusSeq };
        case 'municipality':
          return { ...prev, barangay: '', barangayBounds: null, focusSeq };
      }
    });
  }, []);

  return {
    ...state,
    setRegion,
    setProvince,
    setMunicipality,
    setBarangay,
    resetAll,
    navigateTo,
  };
}
