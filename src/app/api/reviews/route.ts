import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { isWithinReviewRadius, MAX_REVIEW_RADIUS_KM } from '@/lib/geo';

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
    const body = await request.json();
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

    if (!projectId || rating === undefined || !comment) {
      return Response.json(
        { error: 'Missing required fields (projectId, rating, comment)' },
        { status: 400 }
      );
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
        const isDemo =
          process.env.DEMO_OTP_BYPASS === 'true' &&
          process.env.NODE_ENV !== 'production' &&
          (trimmedPhone === '+639000000000' || otp === '123456');

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
      data: {
        projectId,
        rating: numericRating,
        progressRating: progressRating !== undefined ? Number(progressRating) : null,
        qualityRating: qualityRating !== undefined ? Number(qualityRating) : null,
        workersActive: typeof workersActive === 'boolean' ? workersActive : null,
        comment,
        photoUrl: photoUrl || null,
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
