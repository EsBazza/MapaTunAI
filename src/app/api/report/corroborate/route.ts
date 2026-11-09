import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp, jsonError, rateLimit, readJson } from '@/lib/api';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const parsed = await readJson<{ commentId?: unknown }>(request);
    if (!parsed.ok) return parsed.response;
    const { commentId } = parsed.data;

    if (typeof commentId !== 'string' || !commentId.trim()) {
      return jsonError(400, 'commentId is required');
    }

    const ip = getClientIp(request);
    if (!rateLimit(`corroborate-comment:${ip}:${commentId}`, 1, DAY_MS)) {
      return jsonError(429, 'You already confirmed this report.');
    }
    if (!rateLimit(`corroborate-comment:${ip}`, 30, 60 * 60 * 1000)) {
      return jsonError(429, 'Too many confirmations. Please try again later.');
    }

    const exists = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true } });
    if (!exists) return jsonError(404, 'This report no longer exists.');

    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: { corroborationCount: { increment: 1 } },
      select: { corroborationCount: true },
    });

    return Response.json({ corroborationCount: comment.corroborationCount });
  } catch (error) {
    console.error('Error corroborating:', error);
    return jsonError(500, 'Could not save your confirmation. Please try again.');
  }
}
