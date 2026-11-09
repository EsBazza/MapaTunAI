import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp, jsonError, rateLimit, readJson } from '@/lib/api';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const parsed = await readJson<{ reviewId?: unknown }>(request);
    if (!parsed.ok) return parsed.response;
    const { reviewId } = parsed.data;

    if (typeof reviewId !== 'string' || !reviewId.trim()) {
      return jsonError(400, 'reviewId is required');
    }

    const ip = getClientIp(request);
    // One "I saw this too" per person per report, plus an overall cap per IP.
    if (!rateLimit(`corroborate:${ip}:${reviewId}`, 1, DAY_MS)) {
      return jsonError(429, 'You already confirmed this report.');
    }
    if (!rateLimit(`corroborate:${ip}`, 30, 60 * 60 * 1000)) {
      return jsonError(429, 'Too many confirmations. Please try again later.');
    }

    const exists = await prisma.review.findUnique({ where: { id: reviewId }, select: { id: true } });
    if (!exists) return jsonError(404, 'This report no longer exists.');

    const review = await prisma.review.update({
      where: { id: reviewId },
      data: { corroborations: { increment: 1 } },
      select: { corroborations: true },
    });

    return Response.json({ success: true, corroborations: review.corroborations });
  } catch (error) {
    console.error('Error corroborating review:', error);
    return jsonError(500, 'Could not save your confirmation. Please try again.');
  }
}
