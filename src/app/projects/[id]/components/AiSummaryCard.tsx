'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, CheckCircle2, RotateCw } from 'lucide-react';
import type { PlainSummary, SummaryLang } from '@/lib/ai-summary';
import LangToggle from './LangToggle';

interface SummaryResponse {
  summary: PlainSummary;
  riskScore: number;
  cached: boolean;
  source: 'ai' | 'fallback';
}

const T = {
  en: {
    title: 'What you should know',
    aiNote: 'Written by AI from DPWH records. It can make mistakes, so check the numbers on this page and the contract document.',
    fallbackNote: 'Made automatically from DPWH records (the AI is not available right now).',
    whatItIs: 'What it is',
    whereItStands: 'Where it stands',
    watch: 'Things to watch',
    nothing: 'Nothing unusual in the records.',
    todo: 'What you can do',
    loading: 'Reading the records…',
    error: 'We couldn’t load the summary.',
    retry: 'Try again',
  },
  fil: {
    title: 'Ang dapat mong malaman',
    aiNote: 'Isinulat ng AI mula sa rekord ng DPWH. Maaari itong magkamali, kaya tingnan ang mga numero sa pahinang ito at ang kontrata.',
    fallbackNote: 'Awtomatikong ginawa mula sa rekord ng DPWH (hindi available ang AI ngayon).',
    whatItIs: 'Ano ito',
    whereItStands: 'Nasaan na ito',
    watch: 'Mga dapat bantayan',
    nothing: 'Walang kakaiba sa mga rekord.',
    todo: 'Ano ang magagawa mo',
    loading: 'Binabasa ang mga rekord…',
    error: 'Hindi ma-load ang buod.',
    retry: 'Subukan ulit',
  },
} as const;

interface AiSummaryCardProps {
  projectId: string;
  lang: SummaryLang;
  onLangChange: (lang: SummaryLang) => void;
}

export default function AiSummaryCard({ projectId, lang, onLangChange }: AiSummaryCardProps) {
  const reduceMotion = useReducedMotion();
  const { data, isLoading, isError, refetch, isFetching } = useQuery<SummaryResponse>({
    queryKey: ['project-summary', projectId, lang],
    queryFn: async () => {
      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, lang }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const t = T[lang];
  const s = data?.summary;

  return (
    <section aria-labelledby="summary-title" className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="summary-title" className="font-display text-xl font-semibold text-ink">
          {t.title}
        </h2>
        <LangToggle lang={lang} onChange={onLangChange} />
      </header>

      {isLoading || (isFetching && !s) ? (
        <div className="mt-5 space-y-3" aria-busy="true" aria-live="polite">
          <span className="sr-only">{t.loading}</span>
          <div className="h-5 w-3/4 rounded bg-sunken" />
          <div className="h-4 w-full rounded bg-sunken" />
          <div className="h-4 w-5/6 rounded bg-sunken" />
        </div>
      ) : isError || !s ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-canvas p-4 text-sm text-ink-muted">
          <span>{t.error}</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-navy px-4 text-sm font-semibold text-white hover:bg-navy-700"
          >
            <RotateCw className="h-4 w-4" aria-hidden /> {t.retry}
          </button>
        </div>
      ) : (
        // Short fade when the text changes (e.g. switching language) so it doesn't jump.
        <motion.div
          key={lang}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
          className="mt-4 space-y-6"
        >
          <p className="text-lg leading-snug text-ink">{s.headline}</p>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">{t.whatItIs}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">{s.whatItIs}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">{t.whereItStands}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">{s.whereItStands}</p>
            </div>
          </div>

          <div className="grid gap-6 border-t border-line pt-5 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">{t.watch}</h3>
              {s.whatToWatch.length === 0 ? (
                <p className="mt-2 flex items-center gap-2 text-[15px] text-ink-muted">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-risk-low" aria-hidden /> {t.nothing}
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {s.whatToWatch.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-[15px] leading-relaxed text-ink-muted">
                      <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-ink" aria-hidden />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">{t.todo}</h3>
              <ol className="mt-2 space-y-2">
                {s.whatYouCanDo.map((a, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-ink-muted">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-semibold text-ink">
                      {i + 1}
                    </span>
                    <span>{a}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-ink-subtle">
            {data?.source === 'fallback' ? t.fallbackNote : t.aiNote}
          </p>
        </motion.div>
      )}
    </section>
  );
}
