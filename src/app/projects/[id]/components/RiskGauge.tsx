'use client';

import { motion, useReducedMotion } from 'motion/react';
import { getWarningLevel, WARNING_LABELS, type SummaryLang, type WarningLevel } from '@/lib/ai-summary';
import { EASE_OUT } from '@/components/motion';
import { WarningInfo, WARNING_EXPLAINER } from './RiskBadge';

/**
 * Zones follow getRiskScoreTier's thresholds (0–30, 31–60, 61–80, 81–100)
 * and use the risk tokens from globals.css.
 */
const ZONES: Array<{ from: number; to: number; level: WarningLevel }> = [
  { from: 0, to: 30, level: 'low' },
  { from: 30, to: 60, level: 'some' },
  { from: 60, to: 80, level: 'high' },
  { from: 80, to: 100, level: 'very_high' },
];

const TOKEN: Record<WarningLevel, string> = {
  low: 'var(--color-risk-low)',
  some: 'var(--color-risk-elevated)',
  high: 'var(--color-risk-high)',
  very_high: 'var(--color-risk-critical)',
};

const R = 80;
const CX = 100;
const CY = 92;

/** Point on the semicircle for a 0–100 value (0 = left, 100 = right). */
function point(value: number, radius = R) {
  const angle = Math.PI * (1 - value / 100);
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

function arc(from: number, to: number, radius = R) {
  const a = point(from, radius);
  const b = point(to, radius);
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 0 1 ${b.x} ${b.y}`;
}

interface RiskGaugeProps {
  score: number;
  lang?: SummaryLang;
  className?: string;
}

/**
 * Semicircle warning-level gauge for the dark hero. The number and the
 * plain-language level are always written out; colour only supports them.
 */
export default function RiskGauge({ score, lang = 'en', className = '' }: RiskGaugeProps) {
  const reduce = useReducedMotion();
  const value = Math.max(0, Math.min(100, Math.round(score || 0)));
  const level = getWarningLevel(value);
  const label = WARNING_LABELS[lang][level];

  return (
    <figure
      className={`rounded-2xl border border-white/15 p-5 ${className}`}
      aria-label={`Warning level ${value} out of 100: ${label}. ${WARNING_EXPLAINER}`}
    >
      <figcaption className="flex items-center justify-between gap-2 text-sm font-medium text-white/80">
        {lang === 'fil' ? 'Antas ng babala' : 'Warning level'}
        <WarningInfo />
      </figcaption>

      <svg viewBox="0 0 200 104" className="mx-auto mt-3 w-full max-w-[220px]" aria-hidden="true">
        {ZONES.map((z) => (
          <path key={z.from} d={arc(z.from + 0.8, z.to - 0.8)} fill="none" stroke={TOKEN[z.level]} strokeOpacity={0.3} strokeWidth={10} />
        ))}
        {value > 0 && (
          <motion.path
            d={arc(0, value)}
            fill="none"
            stroke={TOKEN[level]}
            strokeWidth={10}
            strokeLinecap="round"
            initial={{ pathLength: reduce ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduce ? 0 : 0.6, ease: EASE_OUT, delay: reduce ? 0 : 0.15 }}
          />
        )}
        <text x={CX} y={CY - 12} textAnchor="middle" fill="#fff" style={{ fontSize: 32, fontWeight: 700 }}>
          {value}
        </text>
        <text x={CX} y={CY + 8} textAnchor="middle" fill="rgb(255 255 255 / 0.6)" style={{ fontSize: 11, fontWeight: 500 }}>
          out of 100
        </text>
      </svg>

      <p className="mt-2 flex items-center justify-center gap-2 text-sm font-bold text-white">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TOKEN[level] }} aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-center text-xs font-medium text-white/60">
        {lang === 'fil' ? 'Mas mataas = mas dapat suriin' : 'Higher means worth checking'}
      </p>
    </figure>
  );
}
