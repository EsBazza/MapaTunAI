import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { displayLocation } from '@/lib/location';
import type { Prisma } from '@prisma/client';
import { parseContractors, cleanContractorName } from '@/lib/format';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const region = searchParams.get('region');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const flag = searchParams.get('flag');
    const province = searchParams.get('province');
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 500);
    const sort = searchParams.get('sort') ?? 'budgetPHP';
    const order = searchParams.get('order') ?? 'desc';
    const q = searchParams.get('q') ?? searchParams.get('search');

    const contractor = searchParams.get('contractor');
    const contractorExact = searchParams.get('contractorExact')?.trim();

    // Exact contractor match (used by the contractor projects drawer).
    // `contractorRaw` can hold joint ventures and ID suffixes, e.g.
    // "ABC BUILDERS (123) / XYZ CORP (456)", so a plain `contains` would also
    // match "ABC BUILDERS 2". Narrow with `contains`, then keep only rows where
    // one of the parsed contractor names is exactly the requested name.
    if (contractorExact) {
      // Contractor names in the list keep their ID suffix ("NAME (17267)"), but the
      // parsed project names don't, so strip it from the search term too.
      const cleanName = cleanContractorName(contractorExact);
      const target = cleanName.toUpperCase();
      const candidates = await prisma.project.findMany({
        where: { contractorRaw: { contains: cleanName, mode: 'insensitive' } },
        include: { province: { include: { region: true } } },
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        take: 2000,
      });
      const matches = candidates.filter((p: { contractorRaw: string }) =>
        parseContractors(p.contractorRaw).some((n) => n.toUpperCase() === target)
      );
      const start = (Math.max(page, 1) - 1) * limit;
      return Response.json(
        {
          projects: matches.slice(start, start + limit),
          pagination: {
            page,
            limit,
            total: matches.length,
            totalPages: Math.max(1, Math.ceil(matches.length / limit)),
          },
        },
        { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
      );
    }

    const where: Prisma.ProjectWhereInput = {};

    if (contractor) {
      where.contractorRaw = { contains: contractor, mode: 'insensitive' };
    }

    if (q) {
      const tokens = q.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 1) {
        const token = tokens[0];
        where.OR = [
          { name: { contains: token, mode: 'insensitive' } },
          { id: { contains: token, mode: 'insensitive' } },
          { contractorRaw: { contains: token, mode: 'insensitive' } },
          { category: { contains: token, mode: 'insensitive' } },
          { province: { name: { contains: token, mode: 'insensitive' } } },
          { province: { region: { name: { contains: token, mode: 'insensitive' } } } },
        ];
      } else if (tokens.length > 1) {
        where.AND = tokens.map((token) => ({
          OR: [
            { name: { contains: token, mode: 'insensitive' } },
            { id: { contains: token, mode: 'insensitive' } },
            { contractorRaw: { contains: token, mode: 'insensitive' } },
            { category: { contains: token, mode: 'insensitive' } },
            { province: { name: { contains: token, mode: 'insensitive' } } },
            { province: { region: { name: { contains: token, mode: 'insensitive' } } } },
          ],
        }));
      }
    }

    if (province || region) {
      const provinceFilter: Prisma.ProvinceWhereInput = {};
      if (province) {
        provinceFilter.name = { contains: province, mode: 'insensitive' };
      }
      if (region) {
        provinceFilter.region = {
          OR: [
            { name: { equals: region, mode: 'insensitive' } },
            { name: { contains: region, mode: 'insensitive' } },
          ],
        };
      }

      const matchingProvinces = await prisma.province.findMany({
        where: provinceFilter,
        select: { id: true },
      });

      if (matchingProvinces.length > 0) {
        where.provinceId = { in: matchingProvinces.map((p: { id: string }) => p.id) };
      } else {
        return Response.json({
          projects: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        });
      }
    }

    if (status) {
      where.status = status;
    }

    if (category && category !== 'All') {
      where.category = { contains: category, mode: 'insensitive' };
    }

    if (flag) {
      switch (flag) {
        case 'stalled':
          where.flagStalled = true;
          break;
        case 'neverStarted':
          where.flagNeverStarted = true;
          break;
        case 'overdue':
          where.flagOverdue = true;
          break;
        case 'overpaid':
          where.flagOverpaid = true;
          break;
        case 'paymentPending':
          where.flagPaymentPending = true;
          break;
      }
    }

    const validSortFields = ['budgetPHP', 'progress', 'startDate', 'updatedAt'];
    const sortField = validSortFields.includes(sort) ? sort : 'budgetPHP';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    // Execute queries in parallel
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          province: {
            include: { region: true },
          },
        },
        orderBy: { [sortField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      limit >= 500 ? Promise.resolve(0) : prisma.project.count({ where }),
    ]);

    const resolvedTotal = limit >= 500 ? projects.length : total;

    // Stored provinces are unreliable for older imports (e.g. ~50k rows defaulted to
    // Ilocos Norte). Show the place the GPS point is actually in.
    type ProjectWithProvince = Prisma.ProjectGetPayload<{ include: { province: { include: { region: true } } } }>;
    const withLocation = (projects as ProjectWithProvince[]).map((p) => {
      const location = displayLocation(p);
      return {
        ...p,
        location,
        province: {
          ...p.province,
          name: location.province,
          region: { ...p.province.region, name: location.region || p.province.region.name },
        },
      };
    });

    return Response.json(
      {
        projects: withLocation,
        pagination: {
          page,
          limit,
          total: resolvedTotal,
          totalPages: Math.ceil(resolvedTotal / limit),
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching projects:', error);
    return Response.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
