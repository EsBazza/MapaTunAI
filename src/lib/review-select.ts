import type { Prisma } from '@prisma/client';

/**
 * Public review fields. Deliberately excludes phoneHash, userLat and userLng:
 * those identify the reviewer and must never leave the server.
 */
export const PUBLIC_REVIEW_SELECT = {
  id: true,
  rating: true,
  progressRating: true,
  qualityRating: true,
  workersActive: true,
  comment: true,
  photoUrl: true,
  phoneVerified: true,
  distanceKm: true,
  corroborations: true,
  createdAt: true,
} satisfies Prisma.ReviewSelect;
