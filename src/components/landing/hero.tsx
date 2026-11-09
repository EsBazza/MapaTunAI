'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Construction, Hammer, MapPin } from 'lucide-react';
import { BridgeStage, type BridgePhase } from './bridge-stage';

const ENTER_DELAY = 80; // ms; ignores the pointer merely passing through
const REPAIR_MS = 2000; // segments glide in, then the lights come up (see bridge-stage.tsx)
const BREAK_MS = 900;

/**
 * Landing hero. The background opens on a broken bridge; hovering (or the
 * toggle, for touch and keyboard) rebuilds it: the fallen deck segments glide
 * back into place and the bridge lights up. Leaving lets it fall again.
 */
export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const logoRef = useRef<HTMLSpanElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const phaseRef = useRef<BridgePhase>('broken');
  const [phase, setPhaseState] = useState<BridgePhase>('broken');

  const setPhase = useCallback((next: BridgePhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const repair = useCallback(() => {
    clearTimers();
    if (phaseRef.current === 'repairing' || phaseRef.current === 'repaired') return;
    setPhase('repairing');
    timers.current.push(setTimeout(() => setPhase('repaired'), REPAIR_MS));
  }, [setPhase]);

  const breakBridge = useCallback(() => {
    clearTimers();
    if (phaseRef.current === 'broken' || phaseRef.current === 'breaking') return;
    setPhase('breaking');
    timers.current.push(setTimeout(() => setPhase('broken'), BREAK_MS));
  }, [setPhase]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      timers.current.push(setTimeout(repair, ENTER_DELAY));
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      breakBridge();
      logoRef.current?.style.setProperty('--tilt-x', '0deg');
      logoRef.current?.style.setProperty('--tilt-y', '0deg');
    };

    // Subtle 3D tilt of the logo toward the pointer.
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (reducedMotion || e.pointerType !== 'mouse') return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = section.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        logoRef.current?.style.setProperty('--tilt-x', `${(-y * 8).toFixed(2)}deg`);
        logoRef.current?.style.setProperty('--tilt-y', `${(x * 10).toFixed(2)}deg`);
      });
    };

    section.addEventListener('pointerenter', onEnter);
    section.addEventListener('pointerleave', onLeave);
    section.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      clearTimers();
      section.removeEventListener('pointerenter', onEnter);
      section.removeEventListener('pointerleave', onLeave);
      section.removeEventListener('pointermove', onMove);
    };
  }, [repair, breakBridge]);

  const built = phase === 'repairing' || phase === 'repaired';
  const toggle = () => (built ? breakBridge() : repair());

  return (
    <section
      ref={sectionRef}
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[min(calc(100svh-4rem),62rem)] items-center justify-center overflow-hidden bg-navy-950 text-white"
    >
      <BridgeStage phase={phase} />

      {/* Grade + scrims for legibility */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-gradient-to-b from-navy-950/70 via-navy-950/35 to-navy-950/40"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_42%_34%_at_50%_42%,rgb(1_20_56/0.75)_0%,rgb(1_20_56/0.3)_60%,transparent_100%)]"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-navy-950" />

      {/* Content */}
      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center px-4 pb-32 pt-14 text-center sm:px-6">
        <p className="inline-flex animate-rise items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-white/85 backdrop-blur-sm sm:text-xs">
          <span className="relative flex size-2" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-amber" />
          </span>
          <span className="hidden sm:inline">Philippine </span>civic transparency platform
        </p>

        {/* Logo */}
        <h1 id="hero-title" className="mt-10 w-full">
          <span className="sr-only">MapaTunAI</span>
          <span className="relative mx-auto block w-[min(86vw,36rem)] animate-focus-in [perspective:1200px]" aria-hidden="true">
            <span className="absolute -inset-x-[18%] -inset-y-[40%] -z-10 block bg-[radial-gradient(closest-side,rgb(63_123_224/0.35),rgb(255_178_65/0.08)_60%,transparent)] blur-2xl" />
            <span
              ref={logoRef}
              className="relative block transition-transform duration-500 ease-out [transform-style:preserve-3d] [transform:rotateX(var(--tilt-x,0deg))_rotateY(var(--tilt-y,0deg))]"
            >
              <Image
                src="/MAPATUNAI-light.png"
                alt=""
                width={1080}
                height={424}
                priority
                sizes="(max-width: 640px) 86vw, 576px"
                className="h-auto w-full drop-shadow-[0_18px_40px_rgb(0_0_0/0.6)]"
              />
              <span className="logo-sheen pointer-events-none absolute inset-0 block" />
            </span>
          </span>
        </h1>

        <div className="mt-6 flex w-[min(86vw,36rem)] animate-fade items-center gap-4 [animation-delay:500ms]" aria-hidden="true">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/30" />
          <span className="font-mono text-[11px] tracking-[0.2em] text-white/55">12.8797°N · 121.7740°E</span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/30" />
        </div>

        <p className="mt-6 max-w-xl animate-rise text-lg leading-relaxed text-white/85 [animation-delay:300ms] sm:text-xl">
          Mapping what&apos;s real. We cross-check every public works contract against satellite imagery and citizen
          reports to expose ghost projects.
        </p>

        <div className="mt-10 flex w-full animate-rise flex-col items-stretch justify-center gap-3 [animation-delay:400ms] sm:w-auto sm:flex-row sm:items-center">
          <Link
            href="/map"
            className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-amber px-7 text-base font-bold text-navy-950 shadow-[0_8px_30px_rgb(255_178_65/0.25)] transition-[background-color,transform] duration-200 hover:bg-amber-soft active:scale-[0.98]"
          >
            <MapPin className="size-5" aria-hidden="true" />
            Explore the map
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <Link
            href="/contractors"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 bg-white/[0.06] px-7 text-base font-semibold text-white backdrop-blur-sm transition-colors duration-200 hover:border-white/45 hover:bg-white/[0.12]"
          >
            Contractor registry
          </Link>
        </div>
      </div>

      {/* Status + toggle (touch and keyboard users can't hover) */}
      <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
        <button
          type="button"
          aria-pressed={built}
          onClick={toggle}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-mono text-[11px] uppercase tracking-[0.14em] backdrop-blur-md transition-colors duration-500 ${
            built
              ? 'border-amber/50 bg-amber/10 text-white'
              : 'border-white/15 bg-navy-950/50 text-white/75 hover:border-white/35 hover:text-white'
          }`}
        >
          {built ? <Hammer className="size-3.5 text-amber" aria-hidden="true" /> : <Construction className="size-3.5" aria-hidden="true" />}
          {built ? 'Built as promised' : (
            <>
              <span className="hidden sm:inline">Hover or tap </span>
              <span className="sm:hidden">Tap </span>to rebuild the bridge
            </>
          )}
        </button>
      </div>
    </section>
  );
}
