'use client';

import type { SummaryLang } from '@/lib/ai-summary';

const OPTIONS: Array<{ value: SummaryLang; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'fil', label: 'Filipino' },
];

/** Language switch for the written explanations on the project page. */
export default function LangToggle({ lang, onChange }: { lang: SummaryLang; onChange: (lang: SummaryLang) => void }) {
  return (
    <div role="group" aria-label="Language" className="inline-flex rounded-full bg-sunken p-1 text-sm">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={lang === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 rounded-full px-4 font-medium transition-colors duration-150 ${
            lang === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
