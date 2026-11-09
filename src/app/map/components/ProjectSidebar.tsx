'use client';

import { useEffect } from 'react';
import { formatCurrency } from '@/lib/format';
import { riskLabel, type SidebarPoint } from '../lib/map-types';
import { categoryInfo } from '../lib/pin-icons';

interface ProjectSidebarProps {
  title: string;
  subtitle?: string;
  items: SidebarPoint[];
  total?: number;
  loading?: boolean;
  emptyText?: string;
  onSelectProject: (id: string) => void;
  onHoverProject?: (item: SidebarPoint | null) => void;
  onClose: () => void;
}

export default function ProjectSidebar({
  title,
  subtitle,
  items,
  total,
  loading,
  emptyText = 'No projects found here.',
  onSelectProject,
  onHoverProject,
  onClose,
}: ProjectSidebarProps) {
  // Escape closes the list
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const count = total ?? items.length;

  return (
    <aside className="mtn-rise absolute bottom-4 right-4 top-40 z-20 flex w-[min(22rem,calc(100%-2rem))] flex-col rounded-xl border border-white/10 bg-navy-950/95 text-white shadow-xl sm:top-32">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {loading
              ? 'Loading projects…'
              : `${count.toLocaleString()} project${count === 1 ? '' : 's'}${count > items.length ? ` · showing ${items.length}` : ''}`}
          </p>
          {subtitle && !loading && <p className="mt-1 text-xs text-amber-soft">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close list"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-white/5" />
          ))}

        {!loading && items.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-slate-400">{emptyText}</p>
        )}

        {!loading &&
          items.map((item) => {
            const status = riskLabel(item.risk, item.done);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectProject(item.id)}
                onMouseEnter={() => onHoverProject?.(item)}
                onMouseLeave={() => onHoverProject?.(null)}
                className="group w-full space-y-1.5 rounded-lg border border-white/10 bg-white/5 p-3 text-left text-xs transition-colors hover:border-amber/60 hover:bg-white/10 focus-visible:border-amber focus-visible:outline-none"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-300">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
                    {status.text}
                  </span>
                  <span className="text-[11px] tabular-nums text-slate-300">
                    Work done {Math.round(item.progress)}%
                  </span>
                </div>
                <p className="line-clamp-2 font-semibold leading-snug text-slate-100">
                  {item.name || `Project ${item.id}`}
                </p>
                <div className="flex items-center justify-between border-t border-white/5 pt-1">
                  <span className="font-semibold tabular-nums text-amber">{formatCurrency(item.budget)}</span>
                  <span className="text-[11px] text-slate-400">
                    {item.distanceKm !== undefined
                      ? `${item.distanceKm < 1 ? `${Math.round(item.distanceKm * 1000)} m` : `${item.distanceKm.toFixed(1)} km`} away`
                      : categoryInfo(item.category).label}
                  </span>
                </div>
              </button>
            );
          })}
      </div>
    </aside>
  );
}
