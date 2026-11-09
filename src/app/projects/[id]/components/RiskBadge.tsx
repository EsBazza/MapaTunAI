'use client';

import { Info } from 'lucide-react';
import { getWarningLevel, WARNING_LABELS, type SummaryLang, type WarningLevel } from '@/lib/ai-summary';

/** Risk tokens from globals.css; the dot is always paired with the text label. */
const STYLES: Record<WarningLevel, { dot: string; pill: string }> = {
  low: { dot: 'bg-risk-low', pill: 'border-white/20 text-white' },
  some: { dot: 'bg-risk-elevated', pill: 'border-white/20 text-white' },
  high: { dot: 'bg-risk-high', pill: 'border-white/20 text-white' },
  very_high: { dot: 'bg-risk-critical', pill: 'border-white/20 text-white' },
};

export const WARNING_EXPLAINER =
  'A score from 0 to 100 made from the official records: money paid vs work done, delays, missed deadlines, and verified citizen reports. A high score means "worth checking", not proof of wrongdoing.';

export function WarningInfo({ className = '' }: { className?: string }) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label="What does the warning level mean?"
        className="text-white/60 hover:text-white focus:text-white focus:outline-none"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-5 z-40 w-64 rounded-xl bg-navy-950 border border-white/15 p-3 text-xs font-medium normal-case tracking-normal leading-relaxed text-white/90 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {WARNING_EXPLAINER}
      </span>
    </span>
  );
}

export default function RiskBadge({ score, lang = 'en' }: { score: number; lang?: SummaryLang }) {
  const level = getWarningLevel(score);
  const s = STYLES[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${s.pill}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {lang === 'fil' ? 'Antas ng babala' : 'Warning level'}: {WARNING_LABELS[lang][level]}
    </span>
  );
}
