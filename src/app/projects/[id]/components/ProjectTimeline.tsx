'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Flag, MessageSquare, PlayCircle } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { EASE_OUT, FadeIn } from '@/components/motion';

interface ProjectTimelineProps {
  startDate: string | null;
  completionDate: string | null;
  status: string;
  progress: number;
  reports: Array<{ id: string; createdAt: string }>;
}

const DAY = 24 * 60 * 60 * 1000;

function toTime(d: string | null): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
}

/** "2 years, 3 months" / "5 months" / "12 days" */
function humanSpan(ms: number): string {
  const days = Math.round(Math.abs(ms) / DAY);
  if (days < 45) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.round(days / 30.44);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return `${years} year${years === 1 ? '' : 's'}${rest ? `, ${rest} month${rest === 1 ? '' : 's'}` : ''}`;
}

/**
 * One bar that tells the project's story in time: when it started, when it
 * was due, where "today" is, and when citizens reported on it. Time past an
 * unmet deadline is drawn in red.
 */
export default function ProjectTimeline({ startDate, completionDate, status, progress, reports }: ProjectTimelineProps) {
  const reduce = useReducedMotion();
  const start = toTime(startDate);
  const deadline = toTime(completionDate);
  // Read the clock once per mount (keeps render pure).
  const [now] = useState(() => Date.now());
  const done = status === 'Completed' || progress >= 100;

  if (start === null) return null;

  const reportTimes = reports.map((r) => toTime(r.createdAt)).filter((t): t is number => t !== null);
  const min = Math.min(start, ...reportTimes);
  const max = Math.max(now, deadline ?? now, ...reportTimes);
  const span = Math.max(max - min, DAY);
  const pos = (t: number) => ((t - min) / span) * 100;

  const overdue = !done && deadline !== null && deadline < now;
  const notStartedYet = start > now;
  const plannedEnd = deadline ?? now;

  let headline: string;
  if (notStartedYet) headline = `Scheduled to start in ${humanSpan(start - now)}.`;
  else if (done) headline = `Marked complete. Work started ${humanSpan(now - start)} ago.`;
  else if (overdue) headline = `The deadline passed ${humanSpan(now - (deadline as number))} ago and the project is not finished.`;
  else if (deadline) headline = `${humanSpan(deadline - now)} left before the deadline.`;
  else headline = `Started ${humanSpan(now - start)} ago. No deadline was given.`;

  const grow = {
    initial: { transform: reduce ? 'scaleX(1)' : 'scaleX(0)' },
    whileInView: { transform: 'scaleX(1)' },
    viewport: { once: true },
  };

  return (
    <FadeIn as="section" className="rounded-2xl border border-line bg-surface p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-navy tracking-tight">Timeline</h3>
          <p className={`mt-0.5 text-sm font-medium ${overdue ? 'text-signal' : 'text-ink-muted'}`}>{headline}</p>
        </div>
      </div>

      {/* Bar */}
      <div className="relative mt-8 mb-10 h-3" role="img" aria-label={headline}>
        <div className="absolute inset-0 rounded-full bg-sunken" />
        {/* Planned period */}
        <motion.div
          className="absolute inset-y-0 origin-left rounded-full bg-navy"
          style={{ left: `${pos(start)}%`, width: `${Math.max(0.5, pos(Math.min(plannedEnd, max)) - pos(start))}%` }}
          {...grow}
          transition={{ duration: reduce ? 0 : 0.5, ease: EASE_OUT }}
        />
        {/* Overdue period */}
        {overdue && deadline !== null && (
          <motion.div
            className="absolute inset-y-0 origin-left rounded-r-full bg-risk-critical"
            style={{ left: `${pos(deadline)}%`, width: `${pos(now) - pos(deadline)}%` }}
            {...grow}
            transition={{ duration: reduce ? 0 : 0.3, ease: EASE_OUT, delay: reduce ? 0 : 0.45 }}
          />
        )}

        {/* Start */}
        <Marker left={pos(start)} label="Start" date={startDate} icon={<PlayCircle className="h-3.5 w-3.5" />} align="start" below />
        {/* Deadline */}
        {deadline !== null && (
          <Marker
            left={pos(deadline)}
            label="Deadline"
            date={completionDate}
            icon={<Flag className="h-3.5 w-3.5" />}
            tone={overdue ? 'red' : 'navy'}
            // Both start and deadline sit below the bar; lift the deadline above when they would collide.
            below={pos(deadline) - pos(start) >= 30 || Math.abs(pos(now) - pos(deadline)) < 18}
          />
        )}
        {/* Today */}
        <div className="absolute -top-2 bottom-[-8px] w-0.5 bg-amber" style={{ left: `${pos(now)}%` }} aria-hidden="true">
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber px-2 py-0.5 text-[11px] font-bold text-navy-950">
            Today
          </span>
        </div>
        {/* Citizen reports */}
        {reportTimes.map((t, i) => (
          <span
            key={reports[i]?.id ?? i}
            title={`Citizen report · ${formatDate(new Date(t))}`}
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-navy-400"
            style={{ left: `${pos(t)}%` }}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-ink-subtle">
        <Legend swatch="bg-navy" text="Planned work period" />
        {overdue && <Legend swatch="bg-risk-critical" text="Past the deadline" />}
        <Legend swatch="bg-amber" text="Today" />
        {reportTimes.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-navy-400" aria-hidden="true" />
            {reportTimes.length} citizen report{reportTimes.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </FadeIn>
  );
}

function Marker({
  left,
  label,
  date,
  icon,
  tone = 'navy',
  align = 'center',
  below = false,
}: {
  left: number;
  label: string;
  date: string | null;
  icon: React.ReactNode;
  tone?: 'navy' | 'red';
  align?: 'start' | 'center';
  below?: boolean;
}) {
  const color = tone === 'red' ? 'text-signal' : 'text-navy';
  // Keep edge labels inside the card.
  const shift = left < 12 || align === 'start' ? 'translate-x-0' : left > 88 ? '-translate-x-full' : '-translate-x-1/2';
  return (
    <div
      className={`absolute ${below ? 'top-5' : '-top-7'} ${shift} whitespace-nowrap text-[11px] font-bold ${color}`}
      style={{ left: `${left}%` }}
    >
      <span className="inline-flex items-center gap-1">
        {icon}
        {label}
        <span className="font-medium text-ink-subtle">· {formatDate(date)}</span>
      </span>
    </div>
  );
}

function Legend({ swatch, text }: { swatch: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-4 rounded-full ${swatch}`} aria-hidden="true" />
      {text}
    </span>
  );
}
