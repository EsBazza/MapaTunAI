import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

/** A contractor with more than this many late projects counts as "many delays". */
const HIGH_DELAY_THRESHOLD = 3;

export type ContractorRisk = 'clean' | 'delayed' | 'high';

const RISK_WHERE: Record<ContractorRisk, Prisma.ContractorWhereInput> = {
  // No late or cancelled projects on record
  clean: { overdueCount: 0, terminatedCount: 0 },
  // A few late projects, none cancelled
  delayed: {
    overdueCount: { gt: 0, lte: HIGH_DELAY_THRESHOLD },
    terminatedCount: 0,
  },
  // Many late projects, or at least one cancelled contract
  high: {
    OR: [
      { overdueCount: { gt: HIGH_DELAY_THRESHOLD } },
      { terminatedCount: { gt: 0 } },
    ],
  },
};

const VALID_SORT_FIELDS = ['totalValuePHP', 'totalContracts', 'avgProgress', 'overdueCount', 'name'] as const;

function toPositiveInt(value: string | null, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = (searchParams.get('q') ?? searchParams.get('search') ?? '').trim();
    const page = toPositiveInt(searchParams.get('page'), 1);
    const limit = Math.min(toPositiveInt(searchParams.get('limit'), 20), 100);
    const sort = searchParams.get('sort') ?? 'totalValuePHP';
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const riskParam = searchParams.get('risk');
    const risk = riskParam && riskParam in RISK_WHERE ? (riskParam as ContractorRisk) : null;

    // Search applies to both the list and the summary counts.
    const searchWhere: Prisma.ContractorWhereInput = q
      ? { name: { contains: q, mode: 'insensitive' } }
      : {};

    // The risk filter applies to the list (and its pagination) only.
    const listWhere: Prisma.ContractorWhereInput = risk
      ? { AND: [searchWhere, RISK_WHERE[risk]] }
      : searchWhere;

    const sortField = (VALID_SORT_FIELDS as readonly string[]).includes(sort) ? sort : 'totalValuePHP';

    const [contractors, total, all, clean, delayed, high] = await Promise.all([
      prisma.contractor.findMany({
        where: listWhere,
        orderBy: [{ [sortField]: order }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contractor.count({ where: listWhere }),
      prisma.contractor.count({ where: searchWhere }),
      prisma.contractor.count({ where: { AND: [searchWhere, RISK_WHERE.clean] } }),
      prisma.contractor.count({ where: { AND: [searchWhere, RISK_WHERE.delayed] } }),
      prisma.contractor.count({ where: { AND: [searchWhere, RISK_WHERE.high] } }),
    ]);

    return Response.json(
      {
        contractors,
        counts: { all, clean, delayed, high },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching contractors:', error);
    return Response.json({ error: 'Could not load contractors. Please try again.' }, { status: 500 });
  }
}
