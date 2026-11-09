'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import type {
  ClusterOrPoint,
  PointsMetadata,
  WorkerFilters,
  WorkerRequest,
  WorkerResponse,
  SidebarPoint,
} from '../lib/map-types';

export type { ClusterOrPoint };

type PendingRequest = Exclude<WorkerRequest, { type: 'load' }>;
// Distributes Omit over the union so each variant keeps its own fields
type RequestBody<T = PendingRequest> = T extends PendingRequest ? Omit<T, 'id'> : never;

/**
 * Runs Supercluster in a Web Worker. Every request carries an id so that
 * overlapping calls (pan + sidebar + filter) never steal each other's replies.
 */
export function useSupercluster() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(new Map<number, (data: unknown) => void>());
  const nextIdRef = useRef(1);

  const [isReady, setIsReady] = useState(false);
  const [namesReady, setNamesReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [nationalTotal, setNationalTotal] = useState(0);
  const [unlocated, setUnlocated] = useState(0);
  const [metadata, setMetadata] = useState<PointsMetadata | null>(null);
  const [provinceCounts, setProvinceCounts] = useState<number[]>([]);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/cluster.worker.ts', import.meta.url), {
      type: 'module',
    });
    const pending = pendingRef.current;

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      switch (msg.type) {
        case 'ready':
          setMetadata(msg.metadata);
          setProvinceCounts(msg.provinceCounts);
          setTotalPoints(msg.totalPoints);
          setNationalTotal(msg.totalPoints);
          setUnlocated(msg.unlocated);
          setIsReady(true);
          break;
        case 'namesReady':
          setNamesReady(true);
          break;
        case 'error':
          setLoadError(msg.message);
          break;
        case 'result': {
          const resolve = pending.get(msg.id);
          if (resolve) {
            pending.delete(msg.id);
            resolve(msg.data);
          }
          break;
        }
      }
    };

    const origin = window.location.origin;
    worker.postMessage({
      type: 'load',
      pointsUrl: `${origin}/geo/points.json`,
      namesUrl: `${origin}/geo/names.json`,
    } satisfies WorkerRequest);
    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
      pending.clear();
      setIsReady(false);
    };
  }, []);

  const request = useCallback(<T,>(body: RequestBody, fallback: T): Promise<T> => {
    const worker = workerRef.current;
    if (!worker) return Promise.resolve(fallback);
    const id = nextIdRef.current++;
    return new Promise<T>((resolve) => {
      pendingRef.current.set(id, (data) => resolve(data as T));
      worker.postMessage({ ...body, id } as WorkerRequest);
    });
  }, []);

  const getClusters = useCallback(
    (bbox: [number, number, number, number], zoom: number) =>
      isReady ? request<ClusterOrPoint[]>({ type: 'getClusters', bbox, zoom }, []) : Promise.resolve([]),
    [isReady, request],
  );

  const applyFilters = useCallback(
    async (filters: WorkerFilters) => {
      const total = await request<number>({ type: 'filter', filters }, 0);
      setTotalPoints(total);
      return total;
    },
    [request],
  );

  const listPoints = useCallback(
    (limit = 30) =>
      request<{ total: number; items: SidebarPoint[] }>({ type: 'list', limit }, { total: 0, items: [] }),
    [request],
  );

  const getExpansionZoom = useCallback(
    (clusterId: number) => request<number>({ type: 'expansionZoom', clusterId }, 16),
    [request],
  );

  const findProject = useCallback(
    (projectId: string) => request<[number, number] | null>({ type: 'findById', projectId }, null),
    [request],
  );

  const listNear = useCallback(
    (center: [number, number], radiusKm = 5, limit = 40) =>
      request<{ total: number; items: SidebarPoint[] }>(
        { type: 'near', center, radiusKm, limit },
        { total: 0, items: [] },
      ),
    [request],
  );

  return {
    isReady,
    namesReady,
    loadError,
    totalPoints,
    nationalTotal,
    unlocated,
    metadata,
    provinceCounts,
    getClusters,
    applyFilters,
    listPoints,
    getExpansionZoom,
    findProject,
    listNear,
  };
}
