import { escapeHtml } from '@/lib/html';
import { formatCurrency } from '@/lib/format';
import { riskLabel, PIN_COLORS, RISK_LABELS } from './map-types';
import type { ClusterMix } from './cluster-markers';
import { categoryInfo } from './pin-icons';

const CARD =
  'background:rgba(1,20,56,0.97);border-radius:14px;padding:12px 14px;color:#fff;' +
  'font-family:var(--font-sans),system-ui,sans-serif;min-width:230px;max-width:280px;font-size:12px;' +
  'border:1px solid rgba(255,255,255,0.12);box-shadow:0 12px 28px rgba(1,20,56,0.45);';
const ROW = 'display:flex;justify-content:space-between;gap:12px;margin-top:4px;';
const MUTED = 'color:#94a3b8;';

export interface PinPopupData {
  id: string;
  name?: string;
  category: string;
  budget: number;
  progress: number;
  risk: 0 | 1 | 2;
  done: boolean;
}

/** All dynamic text is escaped: project names come from external data. */
export function pinPopupHtml(p: PinPopupData, withLink: boolean): string {
  const status = riskLabel(p.risk, p.done);
  const category = categoryInfo(p.category).label;
  const title = p.name || `Project ${p.id}`;
  return `
    <div style="${CARD}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <span style="font-size:11px;font-weight:600;color:#ffcc80;">${escapeHtml(category)}</span>
        <span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:600;color:#fff;background:rgba(255,255,255,0.08);padding:2px 8px;border-radius:999px;">
          <span style="width:7px;height:7px;border-radius:999px;background:${status.color};"></span>${escapeHtml(status.text)}
        </span>
      </div>
      <div style="font-weight:600;margin-top:7px;line-height:1.35;font-size:13px;color:#f8fafc;">${escapeHtml(title)}</div>
      <div style="margin-top:9px;padding-top:7px;border-top:1px solid rgba(255,255,255,0.12);">
        <div style="${ROW}"><span style="${MUTED}">Budget</span><strong style="font-weight:600;color:#ffb241;">${escapeHtml(formatCurrency(p.budget))}</strong></div>
        <div style="${ROW}"><span style="${MUTED}">Work done</span><strong style="font-weight:600;color:#fff;">${escapeHtml(Math.round(p.progress))}%</strong></div>
      </div>
      ${
        withLink
          ? `<a data-project-link="${escapeHtml(p.id)}" href="/projects/${encodeURIComponent(p.id)}" style="display:block;margin-top:10px;text-align:center;font-weight:600;color:#011438;background:#ffb241;border-radius:999px;padding:7px 0;text-decoration:none;">View project →</a>`
          : `<div style="margin-top:8px;font-size:11px;font-weight:600;color:#ffb241;text-align:right;">Click to view project →</div>`
      }
    </div>`;
}

export function clusterPopupHtml(mix: ClusterMix): string {
  const rows = [
    { n: mix.red, color: PIN_COLORS.red, label: RISK_LABELS.red },
    { n: mix.amber, color: PIN_COLORS.amber, label: RISK_LABELS.amber },
    { n: mix.green, color: PIN_COLORS.green, label: RISK_LABELS.green },
    { n: mix.done, color: PIN_COLORS.done, label: RISK_LABELS.done },
  ].filter((r) => r.n > 0);
  return `
    <div style="${CARD}min-width:210px;">
      <div style="font-size:14px;font-weight:600;">${escapeHtml(mix.total.toLocaleString())} projects here</div>
      ${mix.budget > 0 ? `<div style="${ROW}"><span style="${MUTED}">Total budget</span><strong style="font-weight:600;color:#ffb241;">${escapeHtml(formatCurrency(mix.budget))}</strong></div>` : ''}
      <div style="margin-top:8px;padding-top:7px;border-top:1px solid rgba(255,255,255,0.12);">
        ${rows
          .map(
            (r) =>
              `<div style="${ROW}align-items:center;"><span style="display:inline-flex;align-items:center;gap:6px;color:#e2e8f0;"><span style="width:8px;height:8px;border-radius:999px;background:${r.color};"></span>${escapeHtml(r.label)}</span><strong style="font-weight:600;">${escapeHtml(r.n.toLocaleString())}</strong></div>`,
          )
          .join('')}
      </div>
      <div style="margin-top:8px;font-size:11px;color:#cbd5e1;">Click to zoom in</div>
    </div>`;
}
