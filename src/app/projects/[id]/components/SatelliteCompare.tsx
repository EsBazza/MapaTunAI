'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronsLeftRight, RotateCw } from 'lucide-react';
import type { ChangeSeen, MatchesReport, SummaryLang } from '@/lib/ai-summary';
import { pickReleases, type SatelliteCheckResponse, type UnavailableReason } from '@/lib/satellite-releases';

const T = {
  en: {
    title: 'Before and after, from above',
    intro: (before: string, after: string) =>
      `Satellite photos of the project spot: one published ${before}, before work started, and the newest one, published ${after}. Drag the line to compare.`,
    archiveNote: 'Work may have started before our oldest photo, so the “before” photo could already show some work.',
    before: 'Before',
    after: 'Latest',
    sliderLabel: 'Compare before and after photos',
    verdictTitle: 'What changed',
    checking: 'Checking the photos…',
    change: { clear: 'Clear change', some: 'Some change', none: 'No visible change', cannot_tell: 'Hard to tell' } as Record<ChangeSeen, string>,
    match: {
      yes: 'Fits the DPWH report',
      partly: 'Partly fits the report',
      no: 'Doesn’t fit the report',
      unclear: 'Can’t confirm from photos',
    } as Record<MatchesReport, string>,
    note: 'Written by AI from DPWH records and Esri satellite photos. Photos can be old, blurry, or slightly off the site, so treat this as a hint, not proof.',
    samePhoto: (year: number) =>
      `There is no newer satellite photo of this spot since ${year}, so the two photos are the same. We will compare them when a newer one is published.`,
    reasons: {
      no_location: 'This project’s exact location is not confirmed in the records, so we can’t check satellite photos.',
      too_recent: 'Work started after the newest satellite photo we have, so there is nothing to compare yet.',
      imagery: 'We couldn’t load satellite photos for this spot right now.',
      ai_off: 'The written check isn’t available right now. You can still compare the photos yourself.',
      error: 'The written check isn’t available right now. You can still compare the photos yourself.',
      not_found: 'We couldn’t find this project.',
    } as Record<UnavailableReason, string>,
    retry: 'Try again',
  },
  fil: {
    title: 'Bago at pagkatapos, mula sa itaas',
    intro: (before: string, after: string) =>
      `Mga satellite photo ng lugar ng proyekto: isa na inilabas noong ${before}, bago nagsimula ang trabaho, at ang pinakabago, inilabas noong ${after}. I-drag ang linya para ikumpara.`,
    archiveNote: 'Maaaring nagsimula na ang trabaho bago ang pinakalumang litrato namin, kaya baka may makita nang gawa sa “bago” na litrato.',
    before: 'Bago',
    after: 'Pinakabago',
    sliderLabel: 'Ikumpara ang bago at pinakabagong litrato',
    verdictTitle: 'Ano ang nagbago',
    checking: 'Sinusuri ang mga litrato…',
    change: { clear: 'Malinaw na pagbabago', some: 'May kaunting pagbabago', none: 'Walang nakikitang pagbabago', cannot_tell: 'Mahirap matukoy' } as Record<ChangeSeen, string>,
    match: {
      yes: 'Tugma sa ulat ng DPWH',
      partly: 'Bahagyang tugma sa ulat',
      no: 'Hindi tugma sa ulat',
      unclear: 'Hindi makumpirma sa litrato',
    } as Record<MatchesReport, string>,
    note: 'Isinulat ng AI mula sa rekord ng DPWH at satellite photo ng Esri. Maaaring luma, malabo, o medyo lihis ang litrato, kaya gabay lang ito, hindi patunay.',
    samePhoto: (year: number) =>
      `Walang mas bagong satellite photo ng lugar na ito mula ${year}, kaya pareho ang dalawang litrato. Ikukumpara namin kapag may bago na.`,
    reasons: {
      no_location: 'Hindi kumpirmado sa rekord ang eksaktong lokasyon ng proyekto, kaya hindi namin masuri ang satellite photo.',
      too_recent: 'Nagsimula ang trabaho pagkatapos ng pinakabagong satellite photo namin, kaya wala pang maikukumpara.',
      imagery: 'Hindi ma-load ang satellite photo ng lugar na ito ngayon.',
      ai_off: 'Hindi available ang nakasulat na pagsusuri ngayon. Maaari mo pa ring ikumpara ang mga litrato.',
      error: 'Hindi available ang nakasulat na pagsusuri ngayon. Maaari mo pa ring ikumpara ang mga litrato.',
      not_found: 'Hindi namin mahanap ang proyektong ito.',
    } as Record<UnavailableReason, string>,
    retry: 'Subukan ulit',
  },
} as const;

/** Colour + text together; never colour alone. Uses the shared risk tokens. */
const MATCH_STYLE: Record<MatchesReport, string> = {
  yes: 'bg-risk-low/10 text-risk-low',
  partly: 'bg-risk-elevated/10 text-amber-ink',
  no: 'bg-risk-high/10 text-risk-high',
  unclear: 'bg-sunken text-ink-muted',
};

function monthYear(iso: string, lang: SummaryLang) {
  return new Date(iso).toLocaleDateString(lang === 'fil' ? 'fil-PH' : 'en-PH', { month: 'short', year: 'numeric' });
}

interface SatelliteCompareProps {
  projectId: string;
  lat: number | null | undefined;
  lng: number | null | undefined;
  startDate: string | null | undefined;
  lang: SummaryLang;
}

export default function SatelliteCompare({ projectId, lat, lng, startDate, lang }: SatelliteCompareProps) {
  const t = T[lang];
  const reduceMotion = useReducedMotion();
  const pair = pickReleases(startDate);
  const hasCoords = typeof lat === 'number' && typeof lng === 'number' && !!lat && !!lng;

  const { data, isLoading, refetch, isFetching } = useQuery<SatelliteCheckResponse>({
    queryKey: ['satellite-check', projectId, lang],
    queryFn: async () => {
      const res = await fetch('/api/ai/satellite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, lang }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
    retry: 1,
    enabled: hasCoords,
  });

  // Photos load in parallel with the written check (the URLs are predictable).
  const base = `/api/projects/${encodeURIComponent(projectId)}/satellite`;
  const [loaded, setLoaded] = useState({ before: false, after: false });
  const [imageFailed, setImageFailed] = useState(false);

  const status = data?.status;
  const reason = data?.reason;
  const noPhotos =
    !hasCoords || imageFailed || reason === 'no_location' || reason === 'too_recent' || reason === 'imagery' || reason === 'not_found';
  const samePhoto = status === 'same_photo';

  const beforeLabel = `${t.before} · ${monthYear(pair.before.releaseDate, lang)}`;
  const afterLabel = `${t.after} · ${monthYear(pair.after.releaseDate, lang)}`;

  return (
    <section aria-labelledby="satellite-title" className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
      <h2 id="satellite-title" className="font-display text-xl font-semibold text-ink">
        {t.title}
      </h2>
      {!noPhotos && !samePhoto && (
        <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
          {t.intro(monthYear(pair.before.releaseDate, lang), monthYear(pair.after.releaseDate, lang))}
        </p>
      )}

      {noPhotos ? (
        <p className="mt-4 rounded-xl bg-canvas p-4 text-[15px] leading-relaxed text-ink-muted">
          {!hasCoords ? t.reasons.no_location : t.reasons[reason ?? 'imagery']}
        </p>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            {samePhoto ? (
              <figure className="relative aspect-square overflow-hidden rounded-xl bg-sunken">
                {/* eslint-disable-next-line @next/next/no-img-element -- generated per project by our API */}
                <img src={`${base}?when=latest`} alt={afterLabel} className="h-full w-full object-cover" />
                <PhotoLabel side="right">{afterLabel}</PhotoLabel>
              </figure>
            ) : (
              <CompareSlider
                beforeSrc={`${base}?when=start`}
                afterSrc={`${base}?when=latest`}
                beforeLabel={beforeLabel}
                afterLabel={afterLabel}
                sliderLabel={t.sliderLabel}
                ready={loaded.before && loaded.after}
                onLoad={(which) => setLoaded((l) => ({ ...l, [which]: true }))}
                onError={() => setImageFailed(true)}
              />
            )}
            {pair.startsBeforeArchive && !samePhoto && (
              <p className="mt-2 text-xs leading-relaxed text-ink-subtle">{t.archiveNote}</p>
            )}
          </div>

          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-ink">{t.verdictTitle}</h3>

            {samePhoto ? (
              <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{t.samePhoto(pair.before.year)}</p>
            ) : isLoading || (isFetching && !data) ? (
              <div className="mt-3 space-y-2.5" aria-busy="true" aria-live="polite">
                <span className="text-sm text-ink-subtle">{t.checking}</span>
                <div className="h-4 w-full rounded bg-sunken" />
                <div className="h-4 w-5/6 rounded bg-sunken" />
                <div className="h-4 w-2/3 rounded bg-sunken" />
              </div>
            ) : status === 'ok' && data?.verdict ? (
              <motion.div
                key={lang}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                className="mt-2 space-y-4"
              >
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-sunken px-3 py-1 text-sm font-medium text-ink">
                    {t.change[data.verdict.changeSeen]}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${MATCH_STYLE[data.verdict.matchesReport]}`}>
                    {t.match[data.verdict.matchesReport]}
                  </span>
                </div>
                <p className="text-[15px] leading-relaxed text-ink">{data.verdict.whatChanged}</p>
                <p className="text-[15px] leading-relaxed text-ink-muted">{data.verdict.explanation}</p>
                {data.verdict.caveats.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-subtle">
                    {data.verdict.caveats.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
                <p className="border-t border-line pt-3 text-xs leading-relaxed text-ink-subtle">{t.note}</p>
              </motion.div>
            ) : (
              <div className="mt-2 space-y-3">
                <p className="text-[15px] leading-relaxed text-ink-muted">{t.reasons[reason ?? 'error']}</p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium text-ink hover:bg-canvas"
                >
                  <RotateCw className="h-4 w-4" aria-hidden /> {t.retry}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function PhotoLabel({ side, children }: { side: 'left' | 'right'; children: ReactNode }) {
  return (
    <span
      className={`pointer-events-none absolute bottom-3 ${side === 'left' ? 'left-3' : 'right-3'} rounded-md bg-navy-950/75 px-2 py-1 text-xs font-medium text-white`}
    >
      {children}
    </span>
  );
}

interface CompareSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel: string;
  afterLabel: string;
  sliderLabel: string;
  ready: boolean;
  onLoad: (which: 'before' | 'after') => void;
  onError: () => void;
}

/**
 * Before/after slider. Dragging writes styles straight to the DOM (no React
 * re-render per pointer move); clip-path + transform only.
 */
function CompareSlider({ beforeSrc, afterSrc, beforeLabel, afterLabel, sliderLabel, ready, onLoad, onError }: CompareSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(50);
  const draggingRef = useRef(false);
  const [ariaPos, setAriaPos] = useState(50);

  const apply = useCallback((p: number) => {
    const clamped = Math.min(100, Math.max(0, p));
    posRef.current = clamped;
    if (afterRef.current) afterRef.current.style.clipPath = `inset(0 0 0 ${clamped}%)`;
    if (handleRef.current) handleRef.current.style.transform = `translateX(${clamped}%)`;
    return clamped;
  }, []);

  useEffect(() => {
    apply(posRef.current);
  }, [apply]);

  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    apply(((e.clientX - rect.left) / rect.width) * 100);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    let next: number | null = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = posRef.current - step;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = posRef.current + step;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 100;
    if (next === null) return;
    e.preventDefault();
    setAriaPos(Math.round(apply(next)));
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-square cursor-ew-resize touch-pan-y select-none overflow-hidden rounded-xl bg-sunken"
      onPointerDown={(e) => {
        draggingRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        fromPointer(e);
      }}
      onPointerMove={(e) => {
        if (draggingRef.current) fromPointer(e);
      }}
      onPointerUp={() => {
        draggingRef.current = false;
        setAriaPos(Math.round(posRef.current));
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- generated per project by our API */}
      <img
        src={beforeSrc}
        alt={beforeLabel}
        draggable={false}
        onLoad={() => onLoad('before')}
        onError={onError}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${ready ? 'opacity-100' : 'opacity-0'}`}
      />
      <div ref={afterRef} className="absolute inset-0" style={{ clipPath: 'inset(0 0 0 50%)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- generated per project by our API */}
        <img
          src={afterSrc}
          alt={afterLabel}
          draggable={false}
          onLoad={() => onLoad('after')}
          onError={onError}
          className={`h-full w-full object-cover transition-opacity duration-200 ${ready ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>

      {ready && (
        <>
          <PhotoLabel side="left">{beforeLabel}</PhotoLabel>
          <PhotoLabel side="right">{afterLabel}</PhotoLabel>

          {/* Full-width layer so translateX(%) maps to the container width. */}
          <div ref={handleRef} className="pointer-events-none absolute inset-0" style={{ transform: `translateX(${ariaPos}%)` }}>
            <div className="absolute inset-y-0 left-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(1,20,56,0.25)]" />
            <div
              role="slider"
              tabIndex={0}
              aria-label={sliderLabel}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={ariaPos}
              aria-valuetext={`${ariaPos}%`}
              onKeyDown={onKeyDown}
              className="pointer-events-auto absolute left-0 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-navy shadow-md outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2"
            >
              <ChevronsLeftRight className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </>
      )}

      {!ready && <div className="absolute inset-0 bg-sunken" aria-hidden />}
    </div>
  );
}
