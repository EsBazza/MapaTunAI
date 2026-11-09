import mapboxgl from 'mapbox-gl';
import { PIN_COLORS, RISK_LABELS, type ClusterFeature, type ClusterOrPoint } from './map-types';

/**
 * Clusters are drawn as HTML markers holding an SVG donut, so each group shows
 * its mix of projects (red / amber / green / grey) instead of one blue blob.
 *
 * Markers are cached by a key that includes their contents: panning reuses the
 * same DOM nodes, and only genuinely new clusters are created (and animated in).
 */

export interface ClusterMix {
  total: number;
  red: number;
  amber: number;
  green: number;
  done: number;
  budget: number;
}

interface CachedMarker {
  marker: mapboxgl.Marker;
  el: HTMLDivElement;
}

const SEGMENTS: Array<{ key: keyof Omit<ClusterMix, 'total' | 'budget'>; color: string; label: string }> = [
  { key: 'red', color: PIN_COLORS.red, label: RISK_LABELS.red },
  { key: 'amber', color: PIN_COLORS.amber, label: RISK_LABELS.amber },
  { key: 'green', color: PIN_COLORS.green, label: RISK_LABELS.green },
  { key: 'done', color: PIN_COLORS.done, label: RISK_LABELS.done },
];

/** Max markers that get a staggered entrance in one update; the rest appear together. */
const STAGGER_LIMIT = 8;
const STAGGER_MS = 24;
const ENTER_MS = 200;
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

export function mixOf(props: Record<string, unknown>): ClusterMix {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
  return {
    total: n(props.totalProjects ?? props.point_count),
    red: n(props.redCount),
    amber: n(props.amberCount),
    green: n(props.greenCount),
    done: n(props.doneCount),
    budget: n(props.totalBudget),
  };
}

export function abbreviateCount(count: number): string {
  if (count >= 10000) return `${Math.round(count / 1000)}k`;
  if (count >= 1000) return `${(Math.round(count / 100) / 10).toString()}k`;
  return String(count);
}

/** Diameter in px: grows with log(count) so 50k is bigger than 50, but not 1000× bigger. */
export function clusterSize(count: number): number {
  return Math.round(Math.min(68, Math.max(30, 26 + 9 * Math.log10(Math.max(count, 2)))));
}

/** Screen-reader / tooltip text, so the meaning never depends on colour alone. */
export function describeMix(mix: ClusterMix): string {
  const parts = SEGMENTS.filter((s) => mix[s.key] > 0).map(
    (s) => `${mix[s.key].toLocaleString()} ${s.label.toLowerCase()}`,
  );
  return `${mix.total.toLocaleString()} projects${parts.length ? `: ${parts.join(', ')}` : ''}. Press to zoom in.`;
}

function donutSvg(mix: ClusterMix, size: number): string {
  const stroke = Math.max(4, Math.round(size * 0.14));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = Math.max(1, SEGMENTS.reduce((sum, s) => sum + mix[s.key], 0));
  // Tiny gap between segments reads as separate slices without an outline
  const gap = SEGMENTS.filter((s) => mix[s.key] > 0).length > 1 ? Math.min(2, c * 0.01) : 0;

  let offset = 0;
  const arcs: string[] = [];
  for (const seg of SEGMENTS) {
    const value = mix[seg.key];
    if (value <= 0) continue;
    const full = (value / total) * c;
    // Keep very small shares visible: a red sliver matters even at 0.1%
    const len = Math.max(full - gap, Math.min(3, full + 2));
    arcs.push(
      `<circle r="${r}" cx="${size / 2}" cy="${size / 2}" fill="none" stroke="${seg.color}" stroke-width="${stroke}"` +
        ` stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" />`,
    );
    offset += full;
  }

  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true" focusable="false"` +
    ` style="transform:rotate(-90deg)">` +
    `<circle r="${r}" cx="${size / 2}" cy="${size / 2}" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="${stroke}" />` +
    arcs.join('') +
    `</svg>`
  );
}

function keyOf(feature: ClusterFeature, mix: ClusterMix): string {
  return `${feature.properties.cluster_id}:${mix.red}:${mix.amber}:${mix.green}:${mix.done}`;
}

export interface ClusterMarkerHandlers {
  onClick: (clusterId: number, coords: [number, number]) => void;
  onEnter?: (el: HTMLElement, mix: ClusterMix, coords: [number, number]) => void;
  onLeave?: () => void;
}

export class ClusterMarkerLayer {
  private cache = new Map<string, CachedMarker>();
  private reduceMotion: boolean;

  constructor(
    private map: mapboxgl.Map,
    private handlers: ClusterMarkerHandlers,
  ) {
    this.reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  update(features: ClusterOrPoint[]) {
    const next = new Set<string>();
    let entering = 0;

    for (const feature of features) {
      if (!('cluster' in feature.properties) || !feature.properties.cluster) continue;
      const cluster = feature as ClusterFeature;
      const mix = mixOf(cluster.properties as unknown as Record<string, unknown>);
      const key = keyOf(cluster, mix);
      const coords = cluster.geometry.coordinates as [number, number];
      next.add(key);

      const cached = this.cache.get(key);
      if (cached) {
        cached.marker.setLngLat(coords);
        continue;
      }

      const el = this.createElement(cluster, mix, coords);
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat(coords).addTo(this.map);
      this.cache.set(key, { marker, el });
      this.animateIn(el, entering++);
    }

    for (const [key, cached] of this.cache) {
      if (!next.has(key)) {
        cached.marker.remove();
        this.cache.delete(key);
      }
    }
  }

  clear() {
    for (const cached of this.cache.values()) cached.marker.remove();
    this.cache.clear();
  }

  private createElement(cluster: ClusterFeature, mix: ClusterMix, coords: [number, number]): HTMLDivElement {
    const size = clusterSize(mix.total);
    const root = document.createElement('div');
    root.className = 'mtn-cluster';
    root.setAttribute('role', 'button');
    root.setAttribute('tabindex', '0');
    root.setAttribute('aria-label', describeMix(mix));

    // Mapbox owns the root's transform (positioning), so all motion lives on the body
    const body = document.createElement('div');
    body.className = 'mtn-cluster__body';
    body.style.width = `${size}px`;
    body.style.height = `${size}px`;
    body.innerHTML =
      donutSvg(mix, size) +
      `<span class="mtn-cluster__count" style="font-size:${size >= 52 ? 13 : size >= 40 ? 12 : 11}px">${abbreviateCount(mix.total)}</span>`;
    root.appendChild(body);

    const id = cluster.properties.cluster_id;
    const activate = (e: Event) => {
      e.stopPropagation();
      this.handlers.onLeave?.();
      this.handlers.onClick(id, coords);
    };
    root.addEventListener('click', activate);
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate(e);
      }
    });
    root.addEventListener('mouseenter', () => this.handlers.onEnter?.(root, mix, coords));
    root.addEventListener('mouseleave', () => this.handlers.onLeave?.());
    root.addEventListener('focus', () => this.handlers.onEnter?.(root, mix, coords));
    root.addEventListener('blur', () => this.handlers.onLeave?.());
    return root;
  }

  /** WAAPI: transform + opacity only, runs off the main thread where supported. */
  private animateIn(root: HTMLDivElement, index: number) {
    const body = root.firstElementChild as HTMLElement | null;
    if (!body || typeof body.animate !== 'function') return;
    const delay = index < STAGGER_LIMIT ? index * STAGGER_MS : STAGGER_LIMIT * STAGGER_MS;
    const keyframes = this.reduceMotion
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { opacity: 0, transform: 'scale(0.9)' },
          { opacity: 1, transform: 'scale(1)' },
        ];
    body.animate(keyframes, { duration: ENTER_MS, delay, easing: EASE_OUT, fill: 'backwards' });
  }
}
