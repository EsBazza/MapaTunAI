import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { isWithinReviewRadius, MAX_REVIEW_RADIUS_KM } from '@/lib/geo';
import { jsonError, readJson } from '@/lib/api';
import { PUBLIC_REVIEW_SELECT } from '@/lib/review-select';
import { DEMO_PHONE_NUMBER } from '@/lib/constants';

const MAX_COMMENT_LENGTH = 2000;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return Response.json({ error: 'projectId is required' }, { status: 400 });
    }

    const reviews = await prisma.review.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: PUBLIC_REVIEW_SELECT,
    });

    const total = reviews.length;
    const avgRating =
      total > 0
        ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / total
        : 0;

    return Response.json({
      reviews,
      stats: {
        total,
        avgRating,
        fiveStars: reviews.filter((r: { rating: number }) => r.rating >= 4.5).length,
        fourStars: reviews.filter((r: { rating: number }) => r.rating >= 3.5 && r.rating < 4.5).length,
        threeStars: reviews.filter((r: { rating: number }) => r.rating >= 2.5 && r.rating < 3.5).length,
        twoStars: reviews.filter((r: { rating: number }) => r.rating >= 1.5 && r.rating < 2.5).length,
        oneStar: reviews.filter((r: { rating: number }) => r.rating < 1.5).length,
      },
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return Response.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await readJson<Record<string, unknown>>(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const {
      projectId,
      rating,
      progressRating,
      qualityRating,
      workersActive,
      comment,
      photoUrl,
      phone,
      otp,
      userLat,
      userLng,
    } = body;

    if (typeof projectId !== 'string' || !projectId || rating === undefined || typeof comment !== 'string' || !comment.trim()) {
      return jsonError(400, 'Please give a rating and write a short comment.');
    }
    if (comment.length > MAX_COMMENT_LENGTH) {
      return jsonError(400, `Your comment is too long (max ${MAX_COMMENT_LENGTH} characters).`);
    }

    // Every citizen report must carry ground-photo evidence.
    if (typeof photoUrl !== 'string' || !photoUrl.trim()) {
      return Response.json(
        { error: 'A ground photo is required to submit a citizen report.' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(Number(rating))) {
      return jsonError(400, 'Rating must be a number from 1 to 5.');
    }
    const numericRating = Math.max(1, Math.min(5, Number(rating)));

    // 1. Fetch Project Details for Location Verification
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, gpsLat: true, gpsLng: true },
    });

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Validate User GPS Geofence (15km)
    if (userLat === undefined || userLng === undefined || userLat === null || userLng === null) {
      return Response.json(
        {
          error:
            'Your GPS location is required to rate this project. Please allow location access to verify you are within 15 km.',
        },
        { status: 400 }
      );
    }

    const parsedUserLat = Number(userLat);
    const parsedUserLng = Number(userLng);

    if (isNaN(parsedUserLat) || isNaN(parsedUserLng)) {
      return Response.json(
        { error: 'Invalid GPS coordinates provided.' },
        { status: 400 }
      );
    }

    const { isWithin, distanceKm } = isWithinReviewRadius(
      parsedUserLat,
      parsedUserLng,
      project.gpsLat,
      project.gpsLng,
      MAX_REVIEW_RADIUS_KM
    );

    if (!isWithin) {
      return Response.json(
        {
          error: `Location verification failed: You are ${distanceKm} km away. Citizen ratings are strictly restricted to residents & observers within ${MAX_REVIEW_RADIUS_KM} km of the project site.`,
        },
        { status: 403 }
      );
    }

    // 3. Handle Phone & OTP (Optional)
    let phoneHash: string;
    let phoneVerified = false;

    if (phone && typeof phone === 'string' && phone.trim()) {
      const trimmedPhone = phone.trim();
      phoneHash = crypto.createHash('sha256').update(trimmedPhone).digest('hex');

      const existingReview = await prisma.review.findFirst({
        where: {
          projectId,
          phoneHash,
        },
      });

      if (existingReview) {
        return Response.json(
          {
            error:
              'This phone number has already submitted a review for this project. Only 1 rating per project is allowed.',
          },
          { status: 400 }
        );
      }

      if (otp && typeof otp === 'string' && otp.trim()) {
        // Demo bypass: only for the dedicated demo number, never in production.
        const isDemo =
          process.env.DEMO_OTP_BYPASS === 'true' &&
          process.env.NODE_ENV !== 'production' &&
          trimmedPhone === DEMO_PHONE_NUMBER;

        if (isDemo) {
          phoneVerified = true;
        } else {
          const validOtp = await prisma.otpCode.findFirst({
            where: {
              phone: trimmedPhone,
              code: otp.trim(),
              used: false,
              expiresAt: { gt: new Date() },
              OR: [{ projectId: null }, { projectId: projectId }],
            },
            orderBy: { createdAt: 'desc' },
          });

          if (validOtp) {
            await prisma.otpCode.update({
              where: { id: validOtp.id },
              data: { used: true },
            });
            phoneVerified = true;
          } else {
            return jsonError(400, 'That verification code is wrong or has expired. Please request a new one.');
          }
        }
      }
    } else {
      // Anonymous submission without phone
      phoneHash = crypto
        .createHash('sha256')
        .update(`anon-${Date.now()}-${Math.random()}-${projectId}`)
        .digest('hex');
      phoneVerified = false;
    }

    // 5. Create Review Record
    const review = await prisma.review.create({
      select: PUBLIC_REVIEW_SELECT,
      data: {
        projectId,
        rating: numericRating,
        progressRating: Number.isFinite(Number(progressRating)) && progressRating !== null && progressRating !== undefined ? Math.max(0, Math.min(100, Number(progressRating))) : null,
        qualityRating: Number.isFinite(Number(qualityRating)) && qualityRating !== null && qualityRating !== undefined ? Math.max(1, Math.min(5, Number(qualityRating))) : null,
        workersActive: typeof workersActive === 'boolean' ? workersActive : null,
        comment: comment.trim(),
        photoUrl: photoUrl.trim(),
        phoneHash,
        phoneVerified,
        userLat: parsedUserLat,
        userLng: parsedUserLng,
        distanceKm: distanceKm,
      },
    });

    // 6. Recompute Project Average Rating
    const allReviews = await prisma.review.findMany({
      where: { projectId },
      select: { rating: true },
    });

    const newAvg =
      allReviews.length > 0
        ? allReviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) /
          allReviews.length
        : numericRating;

    await prisma.project.update({
      where: { id: projectId },
      data: {
        avgRating: newAvg,
        reviewCount: allReviews.length,
        reportCount: { increment: 1 },
      },
    });

    return Response.json({ success: true, review, distanceKm });
  } catch (error) {
    console.error('Error submitting review:', error);
    return Response.json({ error: 'Failed to submit review' }, { status: 500 });
  }
}
