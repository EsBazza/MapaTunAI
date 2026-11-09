'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { SiteFooter } from '@/components/site-footer';

interface RegionStats {
  name: string;
  totalProjects: number;
  flaggedProjects: number;
  totalBudget: number;
  anomalyDensity: number;
}

interface HomeData {
  regions: RegionStats[];
  totalContracts: number;
  totalBudget: number;
  lastSync: string;
}

// Risk is always shown as a label as well as a color.
const RISK_LEVELS = [
  { min: 0.5, label: 'Critical', color: 'var(--color-risk-critical)' },
  { min: 0.3, label: 'High', color: 'var(--color-risk-high)' },
  { min: 0.15, label: 'Elevated', color: 'var(--color-risk-elevated)' },
  { min: 0.05, label: 'Guarded', color: 'var(--color-risk-guarded)' },
  { min: 0, label: 'Low', color: 'var(--color-risk-low)' },
];

const riskFor = (density: number) => RISK_LEVELS.find((level) => density >= level.min) ?? RISK_LEVELS[4];

export default function HomePage() {
  const { data, isLoading, isError } = useQuery<HomeData>({
    queryKey: ['home-stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  const regions = [...(data?.regions ?? [])].sort((a, b) => b.anomalyDensity - a.anomalyDensity);

  return (
    <div className="w-full bg-canvas text-ink">
      <Hero />

      <HowItWorks
        loading={isLoading}
        stats={data ? { totalContracts: data.totalContracts, totalBudget: data.totalBudget, regions: data.regions.length } : undefined}
      />

      {/* Regional risk index */}
      <section aria-labelledby="regions-title" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-24 md:px-10">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-amber-ink">Regional index</p>
              <h2 id="regions-title" className="mt-4 text-4xl font-extrabold leading-[1.05] text-navy sm:text-5xl">
                Where the anomalies cluster
              </h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-muted">
                Regions ranked by the share of projects carrying at least one anomaly flag. Open a region to inspect its
                district offices and contractors.
              </p>
            </div>
            <ul aria-label="Risk legend" className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-ink-muted">
              {[...RISK_LEVELS].reverse().map((level) => (
                <li key={level.label} className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: level.color }} aria-hidden="true" />
                  {level.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-12">
            {isError ? (
              <p role="alert" className="rounded-2xl border border-signal/20 bg-signal-50 p-6 text-sm text-signal">
                Regional figures could not be loaded right now. The{' '}
                <Link href="/map" className="font-semibold underline underline-offset-4">
                  interactive map
                </Link>{' '}
                is still available.
              </p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {isLoading
                  ? Array.from({ length: 6 }, (_, i) => (
                      <li key={i} className="h-44 animate-pulse rounded-2xl border border-line bg-sunken" aria-hidden="true" />
                    ))
                  : regions.map((region) => {
                      const risk = riskFor(region.anomalyDensity);
                      const pct = region.anomalyDensity * 100;
                      return (
                        <li key={region.name}>
                          <Link
                            href={`/map?region=${encodeURIComponent(region.name)}`}
                            className="group flex h-full flex-col rounded-2xl border border-line bg-canvas p-6 transition-[border-color,background-color,box-shadow] duration-200 hover:border-navy-200 hover:bg-surface hover:shadow-[0_12px_40px_-16px_rgb(1_54_125/0.25)]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="text-lg font-bold leading-snug text-ink transition-colors group-hover:text-navy">
                                {region.name}
                              </h3>
                              <span
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink-muted ring-1 ring-line"
                              >
                                <span className="size-2 rounded-full" style={{ backgroundColor: risk.color }} aria-hidden="true" />
                                {risk.label}
                              </span>
                            </div>

                            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <dt className="text-ink-subtle">Projects</dt>
                                <dd className="font-mono font-semibold tabular text-ink">{region.totalProjects.toLocaleString('en-PH')}</dd>
                              </div>
                              <div>
                                <dt className="text-ink-subtle">Flagged</dt>
                                <dd className="font-mono font-semibold tabular text-signal">{region.flaggedProjects.toLocaleString('en-PH')}</dd>
                              </div>
                              <div className="col-span-2">
                                <dt className="text-ink-subtle">Allocated</dt>
                                <dd className="font-mono font-semibold tabular text-ink">{formatCurrency(region.totalBudget)}</dd>
                              </div>
                            </dl>

                            <div className="mt-auto pt-5">
                              <div className="flex justify-between text-xs text-ink-muted">
                                <span>Anomaly rate</span>
                                <span className="font-mono font-semibold tabular text-ink">{pct.toFixed(1)}%</span>
                              </div>
                              <div
                                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sunken"
                                role="meter"
                                aria-label={`${region.name} anomaly rate`}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Number(pct.toFixed(1))}
                              >
                                <div
                                  className="h-full origin-left rounded-full"
                                  style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: risk.color }}
                                />
                              </div>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Closing call to action */}
      <section aria-labelledby="cta-title" className="relative isolate overflow-hidden bg-navy-950 text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[url('/bg2.jpg')] bg-cover bg-center opacity-35"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950 via-navy-950/85 to-navy-950/40" />
        <div className="mx-auto max-w-6xl px-6 py-24 md:px-10">
          <h2 id="cta-title" className="max-w-2xl text-4xl font-extrabold leading-[1.05] sm:text-5xl">
            Know a project that was never built?
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">
            Find it on the map, compare the satellite record, and file a verified ground report. Every report
            strengthens the public record.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/map"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-amber px-7 font-bold text-navy-950 transition-colors duration-200 hover:bg-amber-soft"
            >
              Open the national map
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/search"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 px-7 font-semibold text-white transition-colors duration-200 hover:border-white/50 hover:bg-white/10"
            >
              Search projects
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
