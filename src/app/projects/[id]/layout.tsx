import type { Metadata } from 'next';
import { formatCurrency } from '@/lib/format';
import { getShareSummary } from './share-data';

type Props = { params: Promise<{ id: string }> };

/**
 * Title and description for search results and link previews
 * (Facebook, Messenger, Viber). The share image comes from opengraph-image.tsx.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = await getShareSummary(id);

  if (!s) {
    return {
      title: `Project ${id} | MapaTunAI`,
      description: 'Public infrastructure project from DPWH records: budget, work done, and citizen reports.',
    };
  }

  const money = s.paidPct === null ? `Work done ${s.workPct}%` : `Paid ${s.paidPct}% · Work done ${s.workPct}%`;
  const description = `${s.place}. Budget ${formatCurrency(s.budgetPHP)}. ${money}. Warning level: ${s.warningLabel}.`;
  const title = `${s.title} | MapaTunAI`;

  return {
    title,
    description,
    openGraph: { title: s.title, description, type: 'article', siteName: 'MapaTunAI' },
    twitter: { card: 'summary_large_image', title: s.title, description },
  };
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
