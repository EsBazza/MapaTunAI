'use client';

import { formatCurrency } from '@/lib/format';

interface ProjectFeature {
  properties: Record<string, any>;
}

interface ProjectSidebarProps {
  title: string;
  projects: ProjectFeature[];
  onSelectProject: (id: string) => void;
  onClose: () => void;
}

export default function ProjectSidebar({
  title,
  projects,
  onSelectProject,
  onClose,
}: ProjectSidebarProps) {
  if (projects.length === 0) return null;

  return (
    <div className="absolute top-24 right-4 z-20 w-84 bg-[#011438]/95 backdrop-blur-xl p-4 rounded-2xl border border-[#01367d] shadow-2xl space-y-3 max-h-[calc(100vh-140px)] overflow-y-auto text-white">
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#ffb241]" />
          <span className="font-extrabold text-white text-xs uppercase tracking-wide">
            {title} ({projects.length})
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-xs font-mono font-bold p-1 rounded-md hover:bg-white/10 transition"
        >
          [ESC]
        </button>
      </div>

      <div className="space-y-2">
        {projects.map((feat) => {
          const p = feat.properties;
          const id = p.i || p.id;
          const name = p.n || p.name || 'DPWH Project';
          // Budget can be in thousands or raw
          const budget = p.b !== undefined ? (p.b < 10000000 ? p.b * 1000 : p.b) : 0;
          const progress = Number(p.g ?? p.p ?? p.progress ?? 0);
          const category = p.c || p.cat || 'Infrastructure';
          const isRed = p.k === 2 || p.fo || p.fs;
          const isAmber = p.k === 1 || p.fd || p.fn;

          return (
            <button
              key={id}
              onClick={() => onSelectProject(id)}
              className="w-full text-left p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#ffb241]/60 transition text-xs space-y-1.5 group"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-slate-400">{id?.slice(0, 12)}</span>
                <div className="flex items-center gap-1.5 font-mono">
                  {isRed && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                      CRITICAL
                    </span>
                  )}
                  {!isRed && isAmber && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      DELAYED
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-[#ffb241]">{progress.toFixed(0)}%</span>
                </div>
              </div>
              <p className="font-bold text-slate-100 group-hover:text-[#ffb241] line-clamp-2 text-xs leading-snug transition-colors">
                {name}
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <p className="text-[11px] font-mono font-bold text-emerald-400">{formatCurrency(budget)}</p>
                <span className="text-[9px] text-slate-400 uppercase tracking-wider">{category}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
