'use client';

import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/format';

export type CountFormat = 'number' | 'currency' | 'percent' | 'compact';

const PRESETS: Record<CountFormat, (n: number) => string> = {
  number: (n) => Math.round(n).toLocaleString('en-PH'),
  currency: (n) => formatCurrency(n),
  percent: (n) => `${Math.round(n)}%`,
  compact: (n) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : `${Math.round(n)}`,
};

interface CountUpProps {
  value: number;
  /** Preset formatter (serialisable). Ignored when `formatter` is given. */
  format?: CountFormat;
  formatter?: (n: number) => string;
  /** Seconds (keep ≤ 0.8). Runs once, on first view. */
  duration?: number;
  className?: string;
}

/**
 * Counts from 0 to `value` the first time it scrolls into view.
 * Screen readers get the final value only; the rolling digits are aria-hidden.
 * Reduced motion: shows the final value immediately.
 */
export function CountUp({ value, format = 'number', formatter, duration = 0.7, className }: CountUpProps) {
  const fmt = formatter ?? PRESETS[format];
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(() => fmt(0));
  const safe = Number.isFinite(value) ? value : 0;

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, safe, {
      duration: Math.min(duration, 0.8),
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(fmt(v)),
    });
    return () => controls.stop();
    // fmt is derived from props; re-running on identity change would restart the count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce, safe, duration]);

  return (
    <span ref={ref} className={`tabular ${className ?? ''}`}>
      <span aria-hidden="true">{reduce ? fmt(safe) : display}</span>
      <span className="sr-only">{fmt(safe)}</span>
    </span>
  );
}
