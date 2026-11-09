'use client';

import { Component, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { ArrowRight, Box, Hand, MousePointer2 } from 'lucide-react';
import { FallbackMap } from './fallback-map';
import { WARNING_LEVELS, mapHrefFor, usePh3dData, warningLevel, warningShare } from './data';

// three.js is ~600 KB — only fetched once the section is close to the viewport.
const PhilippinesScene = dynamic(() => import('./scene'), {
  ssr: false,
  loading: () => <StageSkeleton />,
});

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function StageSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center text-sm text-white/50">Loading the map…</div>
  );
}

let webglSupport: boolean | undefined;
function hasWebGL(): boolean {
  if (webglSupport === undefined) {
    try {
      const canvas = document.createElement('canvas');
      webglSupport = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

/** If the WebGL scene throws (lost context, old driver), fall back to the flat map. */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('3D view failed, showing the flat map instead:', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const noopSubscribe = () => () => undefined;

/** null on the server / first render, then whether the browser can draw WebGL. */
function useWebGL(): boolean | null {
  return useSyncExternalStore(noopSubscribe, hasWebGL, () => null);
}

function subscribeVisibility(cb: () => void) {
  document.addEventListener('visibilitychange', cb);
  return () => document.removeEventListener('visibilitychange', cb);
}
function usePageVisible() {
  return useSyncExternalStore(subscribeVisibility, () => document.visibilityState === 'visible', () => true);
}

const COARSE = '(pointer: coarse)';
function subscribeCoarse(cb: () => void) {
  const mq = window.matchMedia(COARSE);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
function useCoarsePointer() {
  return useSyncExternalStore(subscribeCoarse, () => window.matchMedia(COARSE).matches, () => false);
}

export function Philippines3DSection() {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion() ?? false;
  const coarsePointer = useCoarsePointer();
  const pageVisible = usePageVisible();

  // Mount the scene a little before it scrolls in; run the loop only while on screen.
  const nearViewport = useInView(stageRef, { once: true, margin: '300px 0px' });
  const onScreen = useInView(stageRef, { amount: 0.15 });

  const webgl = useWebGL();
  const [wants3d, setWants3d] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  const { data, isError } = usePh3dData();
  const provinces = data?.provinces ?? [];
  const top = provinces.slice(0, 6);

  const show3d = webgl === true && (!reducedMotion || wants3d);
  const flat = (
    <FallbackMap provinces={provinces} active={active} onActiveChange={setActive} />
  );

  const reveal = reducedMotion
    ? { initial: { opacity: 0 }, whileInView: { opacity: 1 } }
    : { initial: { opacity: 0, transform: 'translateY(8px)' }, whileInView: { opacity: 1, transform: 'translateY(0px)' } };

  return (
    <section aria-labelledby="ph3d-title" className="bg-navy-950 text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-24 md:px-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
        <motion.div
          {...reveal}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
        >
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-amber">The whole country at a glance</p>
          <h2 id="ph3d-title" className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-5xl">
            Where the projects are
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-white/75">
            Each column is a province. Taller means more public works projects. The colour shows how many of them have
            warning signs.
          </p>

          <ul aria-label="Colour legend" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/80">
            {[...WARNING_LEVELS].reverse().map((l) => (
              <li key={l.label} className="inline-flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: l.color }} aria-hidden="true" />
                {l.label}
              </li>
            ))}
          </ul>

          <h3 className="mt-9 text-sm font-semibold text-white/70">Provinces with the most projects</h3>
          <ol className="mt-3 divide-y divide-white/10 border-y border-white/10">
            {(top.length ? top : Array.from({ length: 6 }, () => null)).map((p, i) =>
              p ? (
                <li key={p.name}>
                  <Link
                    href={mapHrefFor(p)}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    className={`group flex min-h-11 items-center gap-3 py-2.5 text-sm transition-colors duration-150 ${
                      active === i ? 'text-white' : 'text-white/80'
                    }`}
                  >
                    <span className="w-5 font-mono text-xs text-white/40 tabular-nums">{i + 1}</span>
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: warningLevel(warningShare(p)).color }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                    <span className="font-mono text-xs tabular-nums text-white/70">{p.count.toLocaleString('en-PH')}</span>
                    <ArrowRight
                      className="size-3.5 shrink-0 text-amber opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ) : (
                <li key={i} className="h-11" aria-hidden="true" />
              )
            )}
          </ol>

          {data && (
            <p className="mt-4 text-xs leading-relaxed text-white/50">
              Counted from each project&apos;s map location.{' '}
              {data.totals.placeholder.toLocaleString('en-PH')} projects have no exact location yet and are not shown.
            </p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="relative"
        >
          <div
            ref={stageRef}
            className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-white/10 bg-navy-900 sm:aspect-square lg:aspect-[6/7]"
          >
            {isError ? (
              <p role="alert" className="flex h-full items-center justify-center p-8 text-center text-sm text-white/70">
                The country overview could not be loaded. The{' '}
                <Link href="/map" className="mx-1 font-semibold text-amber underline underline-offset-4">
                  interactive map
                </Link>{' '}
                still works.
              </p>
            ) : !data || webgl === null ? (
              <StageSkeleton />
            ) : show3d ? (
              nearViewport ? (
                <SceneBoundary fallback={flat}>
                  <PhilippinesScene
                    provinces={provinces}
                    active={active}
                    onActiveChange={setActive}
                    onOpen={(i) => router.push(mapHrefFor(provinces[i]))}
                    running={onScreen && pageVisible}
                    reducedMotion={reducedMotion}
                    coarsePointer={coarsePointer}
                  />
                </SceneBoundary>
              ) : (
                <StageSkeleton />
              )
            ) : (
              <div className="h-full w-full p-4">{flat}</div>
            )}

            {/* hint chip */}
            {data && (
              <div className="pointer-events-none absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-navy-950 px-3 py-1.5 text-xs text-white/75">
                {show3d ? (
                  coarsePointer ? (
                    <>
                      <Hand className="size-3.5" aria-hidden="true" /> Tap a province, tap again to open it
                    </>
                  ) : (
                    <>
                      <MousePointer2 className="size-3.5" aria-hidden="true" /> Drag to turn · click a province to open it
                    </>
                  )
                ) : (
                  <>
                    <MousePointer2 className="size-3.5" aria-hidden="true" /> Choose a province to open it on the map
                  </>
                )}
              </div>
            )}

            {/* reduced-motion visitors can still opt in to the (non-rotating) 3D view */}
            {data && webgl && reducedMotion && !wants3d && (
              <button
                type="button"
                onClick={() => setWants3d(true)}
                className="absolute right-4 top-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-navy-950 px-4 text-xs font-semibold text-white transition-colors duration-150 hover:bg-navy-800"
              >
                <Box className="size-4" aria-hidden="true" /> Show in 3D
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
