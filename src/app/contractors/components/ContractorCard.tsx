'use client';

import { formatCurrency } from '@/lib/format';
import { type Contractor, getContractorRisk } from './types';

interface ContractorCardProps {
  contractor: Contractor;
  rank: number;
  isSelected: boolean;
  onSelect: () => void;
  onViewProjects: () => void;
}

function progressColor(pct: number) {
  if (pct >= 90) return '#10b981';
  if (pct >= 50) return '#3b82f6';
  return '#f59e0b';
}

export default function ContractorCard({
  contractor: c,
  rank,
  isSelected,
  onSelect,
  onViewProjects,
}: ContractorCardProps) {
  const risk = getContractorRisk(c);
  const progressPct = Math.min(Math.max(c.avgProgress || 0, 0), 100);
  const accentBg = risk === 'high' ? 'bg-signal' : risk === 'delayed' ? 'bg-amber' : 'bg-blue-600';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={isSelected}
      className={`group relative overflow-hidden rounded-3xl bg-white p-5 sm:p-6 shadow-sm hover:shadow-xl transition-all duration-300 border cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-navy ${
        isSelected ? 'border-navy ring-2 ring-navy/20 bg-blue-50/20 shadow-md' : 'border-gray-200/80 hover:border-navy/40'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        {/* Rank + total value */}
        <div className="flex items-center gap-4 shrink-0">
          <div className={`w-2 h-16 rounded-full shrink-0 ${accentBg} shadow-sm`} aria-hidden="true" />
          <div className="bg-slate-50/90 border border-slate-100 rounded-2xl p-4 sm:w-48 text-left shadow-xs">
            <span
              className={`inline-flex items-center justify-center rounded-full font-black text-xs px-3 py-0.5 mb-1 ${
                rank <= 3 ? 'bg-gradient-to-r from-amber to-amber-400 text-navy shadow-xs' : 'bg-navy/10 text-navy'
              }`}
            >
              #{rank}
            </span>
            <div className="text-xl sm:text-2xl font-black text-navy tracking-tight">
              {formatCurrency(c.totalValuePHP)}
            </div>
            <div className="text-xs font-bold text-gray-500 mt-0.5">
              {c.totalContracts.toLocaleString()} project{c.totalContracts === 1 ? '' : 's'} won
            </div>
          </div>
        </div>

        {/* Name + average work done */}
        <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
          <div
            className="h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-navy to-navy-950 text-white font-black flex items-center justify-center text-lg shadow-md border-2 border-white"
            aria-hidden="true"
          >
            {c.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <h3 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 group-hover:text-navy transition line-clamp-2 leading-snug break-words">
              {c.name}
            </h3>
            <div className="space-y-1 max-w-sm pt-0.5">
              <div className="flex items-center justify-between text-xs font-extrabold">
                <span className="text-gray-500">Average work done</span>
                <span className="text-blue-600 font-black">{progressPct.toFixed(0)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, backgroundColor: progressColor(progressPct) }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Status + action */}
        <div className="shrink-0 flex flex-wrap items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0">
          {risk === 'clean' ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-3.5 py-1.5 text-xs font-black">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              No delays on record
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {c.overdueCount > 0 && (
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-black ${
                    risk === 'high'
                      ? 'bg-red-50 text-signal border border-red-200/80'
                      : 'bg-amber-50 text-[#b45309] border border-amber/60'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${risk === 'high' ? 'bg-signal' : 'bg-amber'}`} />
                  {c.overdueCount} late
                </span>
              )}
              {c.terminatedCount > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-black bg-red-50 text-signal border border-red-200/80">
                  <span className="h-2 w-2 rounded-full bg-signal" />
                  {c.terminatedCount} cancelled
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewProjects();
            }}
            className="rounded-full bg-navy px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md hover:bg-amber hover:text-navy transition-all duration-200 whitespace-nowrap"
          >
            See projects &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
