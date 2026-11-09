'use client';

import { formatCurrency } from '@/lib/format';
import { type Contractor, type ContractorCounts, RISK_LABELS, getContractorRisk } from './types';

interface ContractorDetailsProps {
  contractor: Contractor | null;
  counts: ContractorCounts | null;
  isSearching: boolean;
  onViewProjects: (c: Contractor) => void;
}

export default function ContractorDetails({ contractor, counts, isSearching, onViewProjects }: ContractorDetailsProps) {
  return (
    <div className="rounded-3xl bg-white p-6 sm:p-7 shadow-md border border-gray-100 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <span className="text-xs font-black uppercase tracking-wider text-gray-400">
          {isSearching ? 'Matching contractors' : 'All contractors'}
        </span>
        <span className="text-xs font-black text-navy">{counts ? counts.all.toLocaleString() : '—'}</span>
      </div>

      {/* Counts across every contractor (not just this page) */}
      <div className="grid grid-cols-3 gap-2.5 text-center">
        <CountTile tone="emerald" value={counts?.clean} label="No delays" />
        <CountTile tone="amber" value={counts?.delayed} label="Some late" />
        <CountTile tone="red" value={counts?.high} label="Many late / cancelled" />
      </div>

      {contractor ? (
        <div className="pt-4 border-t border-gray-100 space-y-5">
          <div className="text-center">
            <div
              className="mx-auto h-20 w-20 rounded-2xl bg-navy text-white font-black text-2xl flex items-center justify-center shadow-lg border-2 border-white"
              aria-hidden="true"
            >
              {contractor.name.substring(0, 2).toUpperCase()}
            </div>
            <h3 className="mt-4 text-base sm:text-lg font-black text-navy leading-snug break-words">
              {contractor.name}
            </h3>
            <p className="text-xs font-semibold text-gray-500 mt-1">{RISK_LABELS[getContractorRisk(contractor)]}</p>
          </div>

          <dl className="space-y-1 pt-2 text-xs sm:text-sm font-medium">
            <Row label="Total value of projects won" value={formatCurrency(contractor.totalValuePHP)} strong />
            <Row label="Projects won" value={contractor.totalContracts.toLocaleString()} />
            <Row
              label="Average work done"
              value={`${(typeof contractor.avgProgress === 'number' ? contractor.avgProgress : 0).toFixed(0)}%`}
            />
            <Row
              label="Late projects"
              value={contractor.overdueCount.toLocaleString()}
              tone={contractor.overdueCount > 0 ? 'bad' : 'good'}
            />
            <Row
              label="Cancelled contracts"
              value={contractor.terminatedCount.toLocaleString()}
              tone={contractor.terminatedCount > 0 ? 'bad' : 'good'}
            />
          </dl>

          <button
            type="button"
            onClick={() => onViewProjects(contractor)}
            className="w-full mt-2 rounded-full bg-navy py-3.5 text-center text-xs sm:text-sm font-black text-white shadow-xl hover:bg-amber hover:text-navy transition-all duration-200"
          >
            See all their projects &rarr;
          </button>
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-gray-400 font-semibold">
          Tap a contractor to see their details.
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-gray-400 border-t border-gray-100 pt-4">
        Based on DPWH records. Not a finding of wrongdoing.
      </p>
    </div>
  );
}

const TONES = {
  emerald: { box: 'bg-emerald-50 border-emerald-100', dot: 'bg-emerald-500', value: 'text-emerald-900', label: 'text-emerald-700' },
  amber: { box: 'bg-amber-50 border-amber-100', dot: 'bg-amber', value: 'text-amber-900', label: 'text-amber-700' },
  red: { box: 'bg-red-50 border-red-100', dot: 'bg-signal', value: 'text-red-900', label: 'text-red-700' },
} as const;

function CountTile({ tone, value, label }: { tone: keyof typeof TONES; value?: number; label: string }) {
  const t = TONES[tone];
  return (
    <div className={`p-3 rounded-2xl border flex flex-col items-center ${t.box}`}>
      <div className={`h-2 w-2 rounded-full mb-2 ${t.dot}`} />
      <span className={`text-base sm:text-lg font-black ${t.value}`}>
        {value !== undefined ? value.toLocaleString() : '—'}
      </span>
      <span className={`font-bold mt-0.5 text-[10px] leading-tight ${t.label}`}>{label}</span>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'good' | 'bad';
}) {
  const valueClass =
    tone === 'bad' ? 'text-red-600' : tone === 'good' ? 'text-emerald-600' : strong ? 'text-navy' : 'text-gray-900';
  return (
    <div className="flex justify-between items-center gap-3 py-2 border-b border-gray-50">
      <dt className="text-gray-500 font-bold">{label}</dt>
      <dd className={`font-black text-right ${valueClass}`}>{value}</dd>
    </div>
  );
}
