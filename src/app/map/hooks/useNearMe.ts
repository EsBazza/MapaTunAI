'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * "Near me" that never spins forever.
 *
 * Why the old version hung: `getCurrentPosition` with high accuracy waits for
 * GPS, and its own timeout doesn't run while the permission prompt is open.
 * Now: check permission first, ask for a quick (low-accuracy, cached) fix,
 * and run our own watchdog. If anything fails, people can tap the map instead.
 */

export type NearMeStatus =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'picking' }
  | { kind: 'located'; coords: [number, number]; source: 'gps' | 'picked' }
  | { kind: 'error'; reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure'; message: string };

const WATCHDOG_MS = 12_000;

/** Rough box around the Philippines; outside it the map can't show the spot. */
const PH_BOX = { minLng: 116.5, maxLng: 127.0, minLat: 4.3, maxLat: 21.5 };

export function isInPhilippines([lng, lat]: [number, number]): boolean {
  return lng >= PH_BOX.minLng && lng <= PH_BOX.maxLng && lat >= PH_BOX.minLat && lat <= PH_BOX.maxLat;
}

const MESSAGES = {
  denied:
    'Location is blocked for this site. To turn it on, click the lock icon next to the web address, allow Location, then try again. Or tap your spot on the map.',
  unavailable: "Your device couldn't find your location right now. You can tap your spot on the map instead.",
  timeout: 'Finding your location is taking too long. You can tap your spot on the map instead.',
  unsupported: "This browser can't share your location. You can tap your spot on the map instead.",
  insecure: 'Location only works on a secure (https) page. You can tap your spot on the map instead.',
} as const;

export function useNearMe() {
  const [status, setStatus] = useState<NearMeStatus>({ kind: 'idle' });
  // Each attempt gets an id so a late GPS answer from an old attempt is ignored
  const attemptRef = useRef(0);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWatchdog = () => {
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = null;
  };

  useEffect(() => clearWatchdog, []);

  const fail = useCallback((reason: Extract<NearMeStatus, { kind: 'error' }>['reason']) => {
    clearWatchdog();
    setStatus({ kind: 'error', reason, message: MESSAGES[reason] });
  }, []);

  const locate = useCallback(async () => {
    const attempt = ++attemptRef.current;
    clearWatchdog();

    if (typeof window === 'undefined' || !('geolocation' in navigator)) return fail('unsupported');
    if (!window.isSecureContext) return fail('insecure');

    setStatus({ kind: 'locating' });

    // Permission API is missing in some browsers (older Safari): just try.
    try {
      const perm = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
      if (attempt !== attemptRef.current) return;
      if (perm?.state === 'denied') return fail('denied');
    } catch {
      // ignore: fall through to asking for the position
    }

    watchdogRef.current = setTimeout(() => {
      if (attempt === attemptRef.current) {
        attemptRef.current++; // ignore a late answer
        fail('timeout');
      }
    }, WATCHDOG_MS);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (attempt !== attemptRef.current) return;
        clearWatchdog();
        setStatus({ kind: 'located', coords: [pos.coords.longitude, pos.coords.latitude], source: 'gps' });
      },
      (err) => {
        if (attempt !== attemptRef.current) return;
        if (err.code === err.PERMISSION_DENIED) fail('denied');
        else if (err.code === err.TIMEOUT) fail('timeout');
        else fail('unavailable');
      },
      // Low accuracy answers in ~1 s from Wi-Fi/IP; a 5-minute-old fix is fine for "near me"
      { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: WATCHDOG_MS - 1000 },
    );
  }, [fail]);

  const startPicking = useCallback(() => {
    attemptRef.current++;
    clearWatchdog();
    setStatus({ kind: 'picking' });
  }, []);

  const pick = useCallback((coords: [number, number]) => {
    attemptRef.current++;
    clearWatchdog();
    setStatus({ kind: 'located', coords, source: 'picked' });
  }, []);

  const reset = useCallback(() => {
    attemptRef.current++;
    clearWatchdog();
    setStatus({ kind: 'idle' });
  }, []);

  const coords = status.kind === 'located' ? status.coords : null;

  return { status, coords, locate, startPicking, pick, reset };
}
