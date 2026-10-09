'use client';

import { useState } from 'react';
import {
  Star,
  MapPin,
  ThumbsUp,
  MessageSquare,
  Users,
  Camera,
  AlertCircle,
} from 'lucide-react';
import { formatDate, formatDistance } from '@/lib/format';
import { ProjectDetailData } from '@/hooks/use-projects';
import ReviewModal from '@/components/review-modal';

interface CommunityTabProps {
  project: ProjectDetailData;
  onReviewSubmitted?: () => void;
}

export default function CommunityTab({ project, onReviewSubmitted }: CommunityTabProps) {
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [corroborations, setCorroborations] = useState<Record<string, number>>({});
  const [corroboratedSet, setCorroboratedSet] = useState<Set<string>>(new Set());

  const reviews = project.reviews || [];
  const totalReviews = reviews.length;
  const avgRating = project.avgRating || 0;

  // Star distributions
  const starCounts = [5, 4, 3, 2, 1].map((s) => {
    const count = reviews.filter((r) => Math.round(r.rating) === s).length;
    const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
    return { stars: s, count, pct };
  });

  // Calculate physical progress perception average
  const progressRatings = reviews
    .map((r) => r.progressRating)
    .filter((p): p is number => p !== null && p !== undefined);
  const avgPerceivedProgress =
    progressRatings.length > 0
      ? Math.round(progressRatings.reduce((a, b) => a + b, 0) / progressRatings.length)
      : null;

  const handleCorroborate = async (reviewId: string) => {
    if (corroboratedSet.has(reviewId)) return;

    // Optimistic update
    setCorroboratedSet((prev) => new Set(prev).add(reviewId));
    setCorroborations((prev) => ({
      ...prev,
      [reviewId]: (prev[reviewId] || 0) + 1,
    }));

    try {
      await fetch('/api/reviews/corroborate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId }),
      });
    } catch (err) {
      console.error('Failed to corroborate review:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Eyewitness Report Action Banner (Matches OverviewTab Aesthetic) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-7 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#01367d] text-[#ffb241] shrink-0 shadow-sm">
            <Camera className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-base font-black text-[#01367d] tracking-tight">Have you inspected this project site?</h4>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Submit an eyewitness report with ground photos to verify actual construction progress.
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsReviewModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#01367d] px-6 py-2.5 text-xs font-black text-white hover:bg-[#ffb241] hover:text-[#011438] transition shadow-md shrink-0"
        >
          <Camera className="h-4 w-4" />
          <span>Submit Eyewitness Report</span>
        </button>
      </div>

      {/* 2. Quick Metrics Grid (2 Prominent Cards matching OverviewTab) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Star Rating Breakdown */}
        <div className="rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-7 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Star className="h-5 w-5 text-[#ffb241] fill-[#ffb241]" />
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">
              Community Satisfaction
            </h4>
          </div>

          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-3xl font-black text-[#01367d]">
              {avgRating.toFixed(1)}
            </span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-4 w-4 ${
                    s <= Math.round(avgRating)
                      ? 'text-[#ffb241] fill-[#ffb241]'
                      : 'text-gray-200'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-mono text-gray-400">({totalReviews} reviews)</span>
          </div>

          <div className="space-y-2">
            {starCounts.map((sc) => (
              <div key={sc.stars} className="flex items-center gap-2.5 text-xs">
                <span className="w-5 font-mono text-gray-500 font-bold">{sc.stars}★</span>
                <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#ffb241] transition-all"
                    style={{ width: `${sc.pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-[11px] font-mono text-gray-400">
                  {sc.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Physical Progress Perception Contrast */}
        <div className="rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-7 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
              <Users className="h-5 w-5 text-[#01367d]" />
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">
                Ground Reality vs DPWH Claim
              </h4>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-gray-500">Official Claimed Progress</span>
                  <span className="font-mono text-[#01367d] font-black">{Math.round(project.progress)}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#01367d] transition-all duration-500"
                    style={{ width: `${Math.min(100, project.progress)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-gray-500">Citizen Perceived Completion</span>
                  <span className="font-mono text-emerald-600 font-black">
                    {avgPerceivedProgress !== null ? `${avgPerceivedProgress}%` : 'No data'}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${avgPerceivedProgress || 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {avgPerceivedProgress !== null &&
            project.progress - avgPerceivedProgress >= 25 && (
              <div className="flex items-center gap-2 rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs font-medium text-amber-900">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Significant divergence detected between official claim and eyewitness ground observers.</span>
              </div>
            )}
        </div>
      </div>

      {/* 3. Verified Eyewitness Reports Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">
            Verified Eyewitness Reports ({totalReviews})
          </h4>
        </div>

        {reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((r) => {
              const extraCorroborations = corroborations[r.id] || 0;
              const totalCorroborations = (r.corroborations || 0) + extraCorroborations;
              const hasCorroborated = corroboratedSet.has(r.id);

              return (
                <div
                  key={r.id}
                  className="rounded-3xl border border-gray-200/80 bg-white p-6 shadow-sm hover:shadow-md transition space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-4 w-4 ${
                              s <= Math.round(r.rating)
                                ? 'text-[#ffb241] fill-[#ffb241]'
                                : 'text-gray-200'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Distance Badge */}
                      {r.distanceKm !== null && r.distanceKm !== undefined && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-mono font-bold text-slate-700 border border-slate-200">
                          <MapPin className="h-3 w-3 text-[#01367d]" />
                          <span>{formatDistance(r.distanceKm)}</span>
                        </span>
                      )}

                      {/* Active Workers Tag */}
                      {r.workersActive !== null && r.workersActive !== undefined && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold border ${
                            r.workersActive
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {r.workersActive ? 'Active Workers' : 'Site Abandoned'}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] font-mono text-gray-400">
                      {formatDate(r.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-gray-800 leading-relaxed font-medium">
                    {r.comment}
                  </p>

                  {/* Photo attachment if available */}
                  {r.photoUrl && (
                    <div className="pt-1">
                      <a
                        href={r.photoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block rounded-2xl overflow-hidden border border-gray-200 hover:border-[#01367d] transition shadow-xs"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.photoUrl}
                          alt="Field inspection photo"
                          className="h-36 w-56 object-cover"
                        />
                      </a>
                    </div>
                  )}

                  {/* Corroboration Action Button */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs">
                    <button
                      onClick={() => handleCorroborate(r.id)}
                      disabled={hasCorroborated}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition border ${
                        hasCorroborated
                          ? 'text-[#01367d] bg-blue-50 border-blue-200 cursor-default'
                          : 'text-gray-600 bg-gray-50 border-gray-200 hover:border-[#ffb241] hover:text-[#011438] hover:bg-amber-50/50'
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      <span>
                        {hasCorroborated ? 'Corroborated' : 'Corroborate report'} (
                        {totalCorroborations})
                      </span>
                    </button>
                    <span className="text-[10px] font-mono text-gray-400">
                      Protected by SHA-256 Anti-Spam
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-gray-300 p-12 text-center bg-white shadow-sm space-y-2">
            <MessageSquare className="mx-auto h-10 w-10 text-gray-300 mb-2" />
            <p className="text-base font-black text-[#01367d]">
              No Citizen Eyewitness Reports Yet
            </p>
            <p className="text-xs text-gray-500 font-medium max-w-sm mx-auto mb-4">
              Are you located near this project site in {project.province?.name || 'the area'}?
              Help your community by submitting a photo and rating the construction ground reality.
            </p>
            <button
              onClick={() => setIsReviewModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[#01367d] px-6 py-2.5 text-xs font-black text-white shadow-md hover:bg-[#ffb241] hover:text-[#011438] transition"
            >
              <Camera className="h-4 w-4" />
              <span>Submit First Eyewitness Report</span>
            </button>
          </div>
        )}
      </div>

      {/* Review Modal Trigger */}
      {isReviewModalOpen && (
        <ReviewModal
          isOpen={isReviewModalOpen}
          projectId={project.id}
          projectName={project.name}
          onClose={() => setIsReviewModalOpen(false)}
          onSuccess={() => {
            setIsReviewModalOpen(false);
            if (onReviewSubmitted) onReviewSubmitted();
          }}
        />
      )}
    </div>
  );
}
