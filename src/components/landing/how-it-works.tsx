'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Banknote, Eye, FileText, MapPin, Satellite, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

export interface HowItWorksStats {
  totalContracts: number;
  totalBudget: number;
  regions: number;
}

/** True once the element has scrolled into view (one-shot). */
function useInView<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/** Eases a number from 0 to `target` once `run` is true. */
function useCountUp(target: number, run: boolean, duration = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run || !target) return;
    // Reduced motion: land on the final value in the first frame.
    const span = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : duration;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / span);
      setValue(target * (1 - Math.pow(1 - t, 4)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, duration]);
  return value;
}

const compact = new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 });

function Stat({ icon: Icon, value, label, loading }: { icon: LucideIcon; value: string; label: string; loading: boolean }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <span className="flex size-10 items-center justify-center rounded-full bg-navy text-white">
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <div>
        <dd className="font-display text-3xl font-extrabold leading-none tabular text-navy sm:text-[2.5rem]">
          {loading ? <span className="inline-block h-9 w-24 animate-pulse rounded-md bg-sunken align-middle" /> : value}
        </dd>
        <dt className="mt-2 text-sm text-ink-muted">{label}</dt>
      </div>
    </div>
  );
}

const LAYERS: { code: string; icon: LucideIcon; eyebrow: string; title: string; body: string }[] = [
  {
    code: 'L1',
    icon: FileText,
    eyebrow: 'Source 1 — Government records',
    title: 'What the government reports',
    body: 'Contract amounts, how much has been paid, how much work DPWH says is done, and the deadlines — taken from DPWH’s public records.',
  },
  {
    code: 'L2',
    icon: Users,
    eyebrow: 'Source 2 — People near the site',
    title: 'What people on the ground see',
    body: 'Reports from people within 15 km of the project, each with a photo from the site. A text code to your phone can confirm the report is from a real person.',
  },
  {
    code: 'L3',
    icon: Satellite,
    eyebrow: 'Source 3 — Satellite photos',
    title: 'What satellite photos show',
    body: 'Photos of the same spot from before the project started and today, so you can see whether a road or dike was actually built. Photos can be old or cloudy, so they are a clue, not proof.',
  },
];

function LayerCard({ layer, index, visible }: { layer: (typeof LAYERS)[number]; index: number; visible: boolean }) {
  const { code, icon: Icon, eyebrow, title, body } = layer;

  // A soft spotlight that follows the pointer across the card.
  const onMove = (e: ReactPointerEvent<HTMLLIElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <li
      onPointerMove={onMove}
      className={`group relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-800 p-6 text-white shadow-[0_24px_60px_-28px_rgb(1_36_86/0.7)] transition-[transform,opacity,box-shadow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:shadow-[0_32px_70px_-28px_rgb(1_36_86/0.85)] sm:p-8 ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0'
      }`}
      style={{ transitionDelay: visible ? `${index * 140}ms` : '0ms' }}
    >
      {/* pointer spotlight */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), rgb(255 178 65 / 0.14), transparent 60%)' }}
      />
      {/* oversized watermark icon for depth */}
      <Icon
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-6 -right-4 -z-10 size-36 text-white/[0.05] transition-transform duration-700 ease-out group-hover:-rotate-6 group-hover:scale-110"
        strokeWidth={1.25}
      />

      <div className="flex items-start gap-5 sm:gap-6">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] font-display text-lg font-extrabold text-amber transition-colors duration-300 group-hover:border-amber/50 group-hover:bg-amber group-hover:text-navy-950">
          {code}
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-amber">{eyebrow}</p>
          <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">{title}</h3>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-white/75">{body}</p>
        </div>
      </div>
    </li>
  );
}

export function HowItWorks({ stats, loading }: { stats?: HowItWorksStats; loading: boolean }) {
  const { ref: statsRef, inView: statsInView } = useInView<HTMLDListElement>(0.4);
  const { ref: cardsRef, inView: cardsInView } = useInView<HTMLOListElement>(0.15);

  const contracts = useCountUp(stats?.totalContracts ?? 0, statsInView);
  const budget = useCountUp(stats?.totalBudget ?? 0, statsInView, 1600);
  const regions = useCountUp(stats?.regions ?? 0, statsInView, 1000);

  return (
    <section aria-labelledby="method-title" className="relative isolate overflow-hidden bg-canvas">
      {/* restrained backdrop: a faint dot grid and one soft glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(rgb(1_54_125/0.09)_1px,transparent_1px)] bg-[size:22px_22px] [mask-image:radial-gradient(ellipse_60%_70%_at_20%_40%,black,transparent)]"
      />
      <div aria-hidden="true" className="pointer-events-none absolute -right-48 top-1/3 -z-10 size-[36rem] rounded-full bg-navy-200/35 blur-3xl" />

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 py-24 md:px-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-32">
        {/* Left: the claim and the numbers */}
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-amber-ink">How it works</p>
          <h2 id="method-title" className="mt-4 text-4xl font-extrabold leading-[1.05] text-navy sm:text-5xl lg:text-[3.15rem]">
            How{' '}
            <span className="whitespace-nowrap uppercase tracking-[-0.03em]">
              <span className="text-signal">Mapa</span>
              <span className="text-navy">Tun</span>
              <span className="text-amber-deep">AI</span>
            </span>{' '}
            checks a project
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
            Each project is checked three ways: what the government reports, what people near the site see, and what
            satellite photos show over the years.
          </p>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex gap-2" aria-hidden="true">
              {[ShieldCheck, Satellite, Eye].map((Icon, i) => (
                <span key={i} className="flex size-10 items-center justify-center rounded-full bg-navy text-white shadow-[0_6px_16px_-6px_rgb(1_54_125/0.6)]">
                  <Icon className="size-[18px]" />
                </span>
              ))}
            </div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-navy">Three sources, side by side</p>
          </div>

          <dl ref={statsRef} className="mt-10 grid grid-cols-3 gap-6 border-t border-line pt-8">
            <Stat icon={FileText} loading={loading} value={compact.format(Math.round(contracts))} label="Public contracts tracked" />
            <Stat icon={Banknote} loading={loading} value={formatCurrency(budget)} label="Infrastructure funds tracked" />
            <Stat icon={MapPin} loading={loading} value={String(Math.round(regions))} label="Regions covered" />
          </dl>
        </div>

        {/* Right: the three layers of evidence */}
        <ol ref={cardsRef} className="space-y-5">
          {LAYERS.map((layer, i) => (
            <LayerCard key={layer.code} layer={layer} index={i} visible={cardsInView} />
          ))}
        </ol>
      </div>
    </section>
  );
}
