'use client';

import { useState } from 'react';
import type { ProjectDetailData } from '@/hooks/use-projects';
import type { SummaryLang } from '@/lib/ai-summary';
import AiSummaryCard from './AiSummaryCard';
import MoneyVsWork from './MoneyVsWork';
import SatelliteCompare from './SatelliteCompare';
import SatelliteTimeline from './SatelliteTimeline';

const LANG_KEY = 'mapatunai:summary-lang';

interface OverviewTabProps {
  project: ProjectDetailData;
}

export default function OverviewTab({ project }: OverviewTabProps) {
  // One language choice for every written explanation on this tab.
  // Rendered only after the project loads on the client, so reading storage here is safe.
  const [lang, setLang] = useState<SummaryLang>(() => {
    try {
      return window.localStorage.getItem(LANG_KEY) === 'fil' ? 'fil' : 'en';
    } catch {
      return 'en';
    }
  });

  const chooseLang = (next: SummaryLang) => {
    setLang(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      /* storage unavailable */
    }
  };

  const [satView, setSatView] = useState<SatView>('compare');

  const seen = (project.reviews || [])
    .map((r) => r.progressRating)
    .filter((v): v is number => typeof v === 'number');
  const citizenProgress = seen.length ? Math.round(seen.reduce((a, b) => a + b, 0) / seen.length) : null;

  return (
    <div className="space-y-6">
      <AiSummaryCard projectId={project.id} lang={lang} onLangChange={chooseLang} />
      <MoneyVsWork
        budgetPHP={project.budgetPHP}
        amountPaid={project.amountPaid}
        progress={project.progress}
        citizenProgress={citizenProgress}
      />
      <div className="space-y-3">
        <SatelliteViewToggle view={satView} onChange={setSatView} lang={lang} />
        {/* Only one satellite view at a time; the year-by-year map is created only when chosen. */}
        <div id="satellite-view" role="tabpanel" aria-labelledby={`sat-tab-${satView}`}>
          {satView === 'compare' ? (
            <SatelliteCompare
              projectId={project.id}
              lat={project.gpsLat}
              lng={project.gpsLng}
              startDate={project.startDate}
              lang={lang}
            />
          ) : (
            <SatelliteTimeline lat={project.gpsLat} lng={project.gpsLng} startDate={project.startDate} />
          )}
        </div>
      </div>
    </div>
  );
}

type SatView = 'compare' | 'years';

const SAT_VIEW_LABELS: Record<SummaryLang, Record<SatView, string>> = {
  en: { compare: 'Before & after', years: 'Every year' },
  fil: { compare: 'Bago at pagkatapos', years: 'Bawat taon' },
};

function SatelliteViewToggle({
  view,
  onChange,
  lang,
}: {
  view: SatView;
  onChange: (v: SatView) => void;
  lang: SummaryLang;
}) {
  const views: SatView[] = ['compare', 'years'];
  return (
    <div
      role="tablist"
      aria-label={lang === 'fil' ? 'Paraan ng pagtingin sa satellite' : 'Satellite view'}
      className="inline-flex rounded-full border border-line bg-surface p-1"
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const next = view === 'compare' ? 'years' : 'compare';
        onChange(next);
        document.getElementById(`sat-tab-${next}`)?.focus();
      }}
    >
      {views.map((v) => {
        const active = view === v;
        return (
          <button
            key={v}
            id={`sat-tab-${v}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls="satellite-view"
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(v)}
            className={`press rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
              active ? 'bg-navy text-white' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {SAT_VIEW_LABELS[lang][v]}
          </button>
        );
      })}
    </div>
  );
}
