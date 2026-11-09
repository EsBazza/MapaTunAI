'use client';

import { useState } from 'react';
import { PIN_COLORS, RISK_LABELS } from '../lib/map-types';
import { CATEGORY_GLYPHS, CATEGORY_LEGEND } from '../lib/pin-icons';

const STATUS_ROWS = [
  { color: PIN_COLORS.red, label: RISK_LABELS.red },
  { color: PIN_COLORS.amber, label: RISK_LABELS.amber },
  { color: PIN_COLORS.green, label: RISK_LABELS.green },
  { color: PIN_COLORS.done, label: RISK_LABELS.done },
];

/** A real donut drawn the same way as the map's clusters (example mix). */
function DonutExample() {
  const size = 34;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const mix = [
    { color: PIN_COLORS.red, share: 0.08 },
    { color: PIN_COLORS.amber, share: 0.17 },
    { color: PIN_COLORS.green, share: 0.45 },
    { color: PIN_COLORS.done, share: 0.3 },
  ];
  const arcs: Array<{ color: string; len: number; offset: number }> = [];
  let offset = 0;
  for (const m of mix) {
    arcs.push({ color: m.color, len: m.share * c, offset });
    offset += m.share * c;
  }
  return (
    <span className="relative inline-grid h-[34px] w-[34px] shrink-0 place-items-center" aria-hidden="true">
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        {arcs.map((a) => (
          <circle
            key={a.color}
            r={r}
            cx={size / 2}
            cy={size / 2}
            fill="none"
            stroke={a.color}
            strokeWidth={stroke}
            strokeDasharray={`${Math.max(0, a.len - 1.5)} ${c - a.len + 1.5}`}
            strokeDashoffset={-a.offset}
          />
        ))}
      </svg>
      <span className="relative grid h-[22px] w-[22px] place-items-center rounded-full bg-navy-950 text-[9px] font-semibold text-white">
        48
      </span>
    </span>
  );
}

function CategoryGlyph({ paths }: { paths: string[] }) {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
}

/** Small, collapsible plain-language key for the map. */
export default function MapLegend({ unlocated = 0 }: { unlocated?: number }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mtn-rise absolute bottom-6 left-4 z-20 w-64 max-w-[calc(100%-2rem)] rounded-xl border border-white/10 bg-navy-950/95 text-white shadow-xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold"
      >
        <span>How to read the map</span>
        <svg
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="max-h-[50vh] space-y-3 overflow-y-auto border-t border-white/10 px-4 pb-3.5 pt-3 text-xs text-slate-200">
          <section>
            <h3 className="mb-1.5 text-[11px] font-semibold text-slate-400">Project status</h3>
            <ul className="space-y-1.5">
              {STATUS_ROWS.map((row) => (
                <li key={row.label} className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full border-2 border-white" style={{ backgroundColor: row.color }} />
                  <span>{row.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-slate-400">Bigger dot = bigger budget.</p>
          </section>

          <section className="flex items-center gap-2.5 border-t border-white/10 pt-2.5">
            <DonutExample />
            <span>
              A group of nearby projects. The ring shows their mix of statuses. Click it to zoom in.
            </span>
          </section>

          <section className="border-t border-white/10 pt-2.5">
            <h3 className="mb-1.5 text-[11px] font-semibold text-slate-400">Project type (when zoomed in)</h3>
            <ul className="grid grid-cols-2 gap-x-2 gap-y-1.5">
              {CATEGORY_LEGEND.map((c) => (
                <li key={c.key} className="flex items-center gap-1.5">
                  <CategoryGlyph paths={CATEGORY_GLYPHS[c.key]} />
                  <span>{c.label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex items-center gap-2 border-t border-white/10 pt-2.5">
            <span className="h-3 w-6 shrink-0 rounded-sm bg-gradient-to-r from-navy-50 via-navy-400 to-navy" aria-hidden="true" />
            <span>Shaded provinces: darker means more projects.</span>
          </section>

          {unlocated > 0 && (
            <p className="border-t border-white/10 pt-2.5 text-slate-400">
              {unlocated.toLocaleString()} projects have no exact location in DPWH records, so they are not on the map.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
