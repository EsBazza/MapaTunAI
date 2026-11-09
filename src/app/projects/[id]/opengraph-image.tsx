import { ImageResponse } from 'next/og';
import { formatCurrency } from '@/lib/format';
import type { WarningLevel } from '@/lib/ai-summary';
import { getShareSummary } from './share-data';

export const alt = 'Project summary: budget, money paid, work done and warning level';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Facts change slowly; re-render a project's card at most hourly.
export const revalidate = 3600;

/** Same hexes as the risk tokens in globals.css (CSS variables don't exist in OG rendering). */
const RISK: Record<WarningLevel, string> = {
  low: '#0f9d6b',
  some: '#d97706',
  high: '#ea580c',
  very_high: '#dc2626',
};

const NAVY_950 = '#011438';
const AMBER = '#ffb241';

/** The default OG font may not include the peso sign, so spell it out. */
function peso(n: number) {
  return formatCurrency(n).replace('₱', 'PHP ');
}

function clamp(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function Stat({ label, value, color = '#ffffff' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.65)' }}>{label}</div>
      <div style={{ fontSize: 40, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 150, fontSize: 22, color: 'rgba(255,255,255,0.7)' }}>{label}</div>
      <div style={{ display: 'flex', flex: 1, height: 14, borderRadius: 7, background: 'rgba(255,255,255,0.12)' }}>
        <div style={{ width: `${w}%`, height: 14, borderRadius: 7, background: color }} />
      </div>
      <div style={{ width: 80, fontSize: 24, fontWeight: 700, textAlign: 'right' }}>{`${pct}%`}</div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getShareSummary(id);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          background: NAVY_950,
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 24 }}>
          <div style={{ display: 'flex', fontWeight: 700, color: AMBER, letterSpacing: 1 }}>MAPATUNAI</div>
          <div style={{ display: 'flex', color: 'rgba(255,255,255,0.65)' }}>{s ? s.place : 'Public works project'}</div>
        </div>

        <div style={{ display: 'flex', fontSize: 50, fontWeight: 700, lineHeight: 1.15, letterSpacing: -1 }}>
          {s ? clamp(s.title, 120) : `Project ${id}`}
        </div>

        {s ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div style={{ display: 'flex', gap: 52, alignItems: 'flex-end' }}>
              <Stat label="Budget" value={peso(s.budgetPHP)} />
              <Stat label="Paid so far" value={s.paidPct === null ? 'Unknown' : `${s.paidPct}%`} color={AMBER} />
              <Stat label="Work done" value={`${s.workPct}%`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 'auto' }}>
                <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.65)' }}>Warning level</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 34, fontWeight: 700 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 9, background: RISK[s.warningLevel] }} />
                  {`${s.riskScore}/100 · ${s.warningLabel}`}
                </div>
              </div>
            </div>
            {s.paidPct !== null && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Bar label="Money paid" pct={s.paidPct} color={AMBER} />
                <Bar label="Work done" pct={s.workPct} color="#7fa9e2" />
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', fontSize: 28, color: 'rgba(255,255,255,0.7)' }}>
            See the budget, the work done, and what citizens report.
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
