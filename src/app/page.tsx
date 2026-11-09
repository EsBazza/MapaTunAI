'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Philippines3DSection, summariseRegions, usePh3dData, warningLevel, WARNING_LEVELS } from '@/components/landing/ph-3d';
import { SiteFooter } from '@/components/site-footer';

interface HomeData {
  totalContracts: number;
  totalBudget: number;
  regions: unknown[];
  lastSync: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export default function HomePage() {
  const reducedMotion = useReducedMotion() ?? false;

  const { data, isLoading } = useQuery<HomeData>({
    queryKey: ['home-stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  // Region cards use the same location-based counts as the map and the 3D view.
  // (The database's province column filed ~50k projects under Ilocos Norte.)
  const { data: geo, isLoading: geoLoading, isError: geoError } = usePh3dData();
  const regions = geo
    ? summariseRegions(geo).sort((a, b) => b.flagged / b.count - a.flagged / a.count)
    : [];

  const card = reducedMotion
    ? { hidden: { opacity: 0 }, shown: { opacity: 1 } }
    : {
        hidden: { opacity: 0, transform: 'translateY(12px)' },
        shown: { opacity: 1, transform: 'translateY(0px)' },
      };

  return (
    <div className="w-full bg-canvas text-ink">
      <Hero />

      <HowItWorks
        loading={isLoading || geoLoading}
        stats={
          data
            ? {
                totalContracts: data.totalContracts,
                totalBudget: data.totalBudget,
                regions: regions.length || data.regions.length,
              }
            : undefined
        }
      />

      <Philippines3DSection />

      {/* Regional overview */}
      <section aria-labelledby="regions-title" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-24 md:px-10">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-amber-ink">By region</p>
              <h2 id="regions-title" className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] text-navy sm:text-5xl">
                Where the warning signs are
              </h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-muted">
                Regions sorted by the share of projects with at least one warning sign, like being past the deadline or
                paid with little work done. Open a region to see its projects on the map.
              </p>
            </div>
            <ul aria-label="Colour legend" className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-ink-muted">
              {[...WARNING_LEVELS].reverse().map((level) => (
                <li key={level.label} className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: level.color }} aria-hidden="true" />
                  {level.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-12">
            {geoError ? (
              <p role="alert" className="rounded-2xl border border-signal/20 bg-signal-50 p-6 text-sm text-signal">
                Regional figures could not be loaded right now. The{' '}
                <Link href="/map" className="font-semibold underline underline-offset-4">
                  interactive map
                </Link>{' '}
                still works.
              </p>
            ) : geoLoading ? (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <li key={i} className="h-44 animate-pulse rounded-2xl border border-line bg-sunken" />
                ))}
              </ul>
            ) : (
              <motion.ul
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                initial="hidden"
                whileInView="shown"
                viewport={{ once: true, amount: 0.1 }}
                transition={{ staggerChildren: reducedMotion ? 0 : 0.04 }}
              >
                {regions.map((region) => {
                  const share = region.count > 0 ? region.flagged / region.count : 0;
                  const level = warningLevel(share);
                  const pct = share * 100;
                  // Bars are scaled to the highest region so small shares are still readable.
                  const maxShare = Math.max(...regions.map((r) => r.flagged / r.count), 0.0001);
                  return (
                    <motion.li key={region.name} variants={card} transition={{ duration: 0.35, ease: EASE_OUT }}>
                      <Link
                        href={`/map?region=${encodeURIComponent(region.name)}`}
                        className="group flex h-full flex-col rounded-2xl border border-line bg-canvas p-6 transition-[border-color,background-color,box-shadow] duration-200 hover:border-navy-200 hover:bg-surface hover:shadow-[0_12px_40px_-16px_rgb(1_54_125/0.25)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-lg font-bold leading-snug text-ink transition-colors group-hover:text-navy">
                            {region.name}
                          </h3>
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink-muted ring-1 ring-line">
                            <span className="size-2 rounded-full" style={{ backgroundColor: level.color }} aria-hidden="true" />
                            {level.label.replace(' warning signs', '')}
                          </span>
                        </div>

                        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <dt className="text-ink-subtle">Projects</dt>
                            <dd className="font-mono font-semibold tabular text-ink">{region.count.toLocaleString('en-PH')}</dd>
                          </div>
                          <div>
                            <dt className="text-ink-subtle">With warnings</dt>
                            <dd className="font-mono font-semibold tabular text-signal">{region.flagged.toLocaleString('en-PH')}</dd>
                          </div>
                          <div className="col-span-2">
                            <dt className="text-ink-subtle">Total budget</dt>
                            <dd className="font-mono font-semibold tabular text-ink">{formatCurrency(region.budgetPHP)}</dd>
                          </div>
                        </dl>

                        <div className="mt-auto pt-5">
                          <div className="flex justify-between text-xs text-ink-muted">
                            <span>Share with warning signs</span>
                            <span className="font-mono font-semibold tabular text-ink">{pct.toFixed(1)}%</span>
                          </div>
                          <div
                            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sunken"
                            role="meter"
                            aria-label={`${region.name}: share of projects with warning signs`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Number(pct.toFixed(1))}
                          >
                            <div
                              className="h-full origin-left rounded-full"
                              style={{ width: `${Math.min((share / maxShare) * 100, 100)}%`, backgroundColor: level.color }}
                            />
                          </div>
                        </div>
                      </Link>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </div>
        </div>
      </section>

      {/* Closing call to action */}
      <section aria-labelledby="cta-title" className="relative isolate overflow-hidden bg-navy-950 text-white">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[url('/bg2.jpg')] bg-cover bg-center opacity-35" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950 via-navy-950/85 to-navy-950/40" />
        <motion.div
          className="mx-auto max-w-6xl px-6 py-24 md:px-10"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateY(16px)' }}
          whileInView={reducedMotion ? { opacity: 1 } : { opacity: 1, transform: 'translateY(0px)' }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          <h2 id="cta-title" className="max-w-2xl text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-5xl">
            Know a project that was never built?
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">
            Find it on the map, compare the satellite photos, and send a report with a photo from the site. Every report
            helps keep the record honest.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/map"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-amber px-7 font-bold text-navy-950 transition-[background-color,transform] duration-150 hover:bg-amber-soft active:scale-[0.97]"
            >
              Open the map
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/search"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 px-7 font-semibold text-white transition-[border-color,background-color,transform] duration-150 hover:border-white/50 hover:bg-white/10 active:scale-[0.97]"
            >
              Search projects
            </Link>
          </div>
        </motion.div>
      </section>

      <SiteFooter />
    </div>
  );
}
