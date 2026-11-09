'use client';

import { motion, useReducedMotion } from 'motion/react';
import { formatCurrency } from '@/lib/format';
import { CountUp, EASE_OUT, FadeIn } from '@/components/motion';

interface MoneyVsWorkProps {
  budgetPHP: number;
  amountPaid: number;
  progress: number;
  citizenProgress?: number | null;
}

function Bar({ label, value, detail, color, delay }: { label: string; value: number; detail?: string; color: string; delay: number }) {
  const reduce = useReducedMotion();
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="font-medium text-ink-muted">{label}</span>
        <span className="font-bold text-ink">
          <CountUp value={value} format="percent" />
          {detail && <span className="ml-2 text-xs font-medium text-ink-subtle">{detail}</span>}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-sunken">
        {/* Width is fixed; the reveal is a transform so it stays on the compositor. */}
        <motion.div
          className={`h-full origin-left rounded-full ${color}`}
          style={{ width: `${pct}%` }}
          initial={{ transform: reduce ? 'scaleX(1)' : 'scaleX(0)' }}
          whileInView={{ transform: 'scaleX(1)' }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: reduce ? 0 : 0.6, ease: EASE_OUT, delay: reduce ? 0 : delay }}
        />
      </div>
    </div>
  );
}

export default function MoneyVsWork({ budgetPHP, amountPaid, progress, citizenProgress }: MoneyVsWorkProps) {
  const paidPct = budgetPHP > 0 ? Math.round((amountPaid / budgetPHP) * 100) : null;
  const workPct = Math.round(progress || 0);
  const gap = paidPct === null ? null : paidPct - workPct;

  let verdict: { text: string; tone: string };
  if (paidPct === null) {
    verdict = { text: 'We don’t know the budget, so we can’t compare money and work.', tone: 'border-line text-ink-muted' };
  } else if (gap !== null && gap >= 25) {
    verdict = {
      text: `Money is ${gap} points ahead of the work. That is worth checking.`,
      tone: 'border-signal/30 bg-signal-50 text-signal',
    };
  } else if (gap !== null && gap <= -25) {
    verdict = {
      text: 'More work is reported done than has been paid. Payment is often still being processed.',
      tone: 'border-line text-ink-muted',
    };
  } else {
    verdict = { text: 'Money paid and work done are moving at about the same pace.', tone: 'border-line text-ink-muted' };
  }

  return (
    <FadeIn as="section" className="rounded-2xl border border-line bg-surface p-6 sm:p-7 space-y-5">
      <div>
        <h3 className="text-lg font-bold text-ink">Money paid vs. work done</h3>
        <p className="mt-0.5 text-sm font-medium text-ink-muted tabular">
          {paidPct === null ? `Work done ${workPct}%` : `Paid ${paidPct}% · Work done ${workPct}%`}
        </p>
      </div>
      <div className="space-y-4">
        <Bar
          label="Money paid"
          value={paidPct ?? 0}
          detail={`${formatCurrency(amountPaid)} of ${formatCurrency(budgetPHP)}`}
          color="bg-amber"
          delay={0}
        />
        <Bar label="Work done (DPWH report)" value={workPct} color="bg-navy" delay={0.08} />
        {typeof citizenProgress === 'number' && (
          <Bar label="Work done (what citizens saw)" value={citizenProgress} color="bg-navy-300" delay={0.16} />
        )}
      </div>
      <p className={`rounded-xl border p-3.5 text-sm font-medium ${verdict.tone}`}>{verdict.text}</p>
    </FadeIn>
  );
}
