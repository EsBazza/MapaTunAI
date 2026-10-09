# Task 3 Report: Project Dossier Tab & Module Pruning

## Summary
Successfully refactored the Project Dossier experience across `src/app/projects/[id]/page.tsx`, `src/app/projects/[id]/components/CommunityTab.tsx`, `src/components/review-modal.tsx`, and `src/app/api/reviews/route.ts`:
- Consolidated dossier tabs strictly to **Overview** and **Citizen Reports** (`CommunityTab`), reducing `TabType` to `'overview' | 'community'`.
- Removed imports and panels for `SatelliteTab`, `NewsTab`, `FinancialsTab`, and `ConnectionsTab`.
- Relocated contractor registry profile link directly into the title header block next to the contractor name.
- Pruned external DPWH Civil Works Portal and FOI Request buttons from hero action bar; retained Contract Agreement PDF link (if present) and Share Dossier button.
- Pruned "Active Workers on Site" summary card from `CommunityTab.tsx`, expanding the metrics grid to 2 cards (Community Satisfaction & Ground Reality vs DPWH Claim) with a dedicated "Submit Eyewitness Report" call-to-action banner.
- Removed the "SMS Verified" badge from eyewitness review cards and replaced emoji warning with Lucide `AlertCircle`.
- Removed phone number and OTP verification inputs from `ReviewModal.tsx`, allowing direct citizen report submissions while preserving GPS proximity checks and ground photo uploads.
- Made `phone` and `otp` optional in `src/app/api/reviews/route.ts`, setting `phoneVerified: false` when omitted and preventing database unique constraint collisions.
- Maintained zero emojis across all modified cards, badges, and chips, aligned with MAPATUNAI Deep Navy, Royal Blue, and Gold branding.

## Changes Made
1. **`src/app/projects/[id]/page.tsx`**:
   - Updated `TabType` type to `'overview' | 'community'`.
   - Removed imports for `SatelliteTab`, `NewsTab`, `FinancialsTab`, `ConnectionsTab`, `FileQuestion`, and unused `useRouter`.
   - Replaced contractor name container in title header with clickable `<Link href={`/contractors?q=${encodeURIComponent(contractorName)}`} ...>` including `Building2` icon and `ExternalLink` icon.
   - Simplified `tabs` list to Overview and Citizen Reports with count badge.
   - Pruned DPWH Civil Works Portal and File FOI Request buttons from the hero action bar.
   - Simplified main tab panels to render only `OverviewTab` and `CommunityTab`.

2. **`src/app/projects/[id]/components/CommunityTab.tsx`**:
   - Pruned "Active Workers on Site" indicator card and associated workforce state variables (`activeWorkerVotes`, `abandonedVotes`, `totalWorkerVotes`, `activePct`).
   - Removed unused imports (`ShieldCheck`, `HardHat`, `CheckCircle2`).
   - Expanded metrics grid into 2 cards: Community Satisfaction and Ground Reality vs DPWH Claim.
   - Added a prominent full-width action banner for "Submit Eyewitness Report".
   - Removed the `SMS Verified` badge from individual reviews in the feed.
   - Replaced `⚠️` emoji with `<AlertCircle />` icon in divergence warning banner.
   - Aligned button and indicator styles with brand colors (`#01367d`, `#ffb241`, `#011438`).

3. **`src/components/review-modal.tsx`**:
   - Removed `phone`, `otp`, `otpSent` states and `handleSendOtp` handler.
   - Removed Anti-Fraud Phone Verification card from the modal form.
   - Simplified form submission to submit immediately upon client validation of observations and 15km GPS geofence.
   - Updated submit button text to "Submit Eyewitness Report" and styled with brand colors.

4. **`src/app/api/reviews/route.ts`**:
   - Updated required field validation in `POST` handler to `if (!projectId || rating === undefined || !comment)`.
   - Made `phone` and `otp` optional. If phone is omitted, generates a unique anonymous SHA-256 hash to prevent database collisions on `@@unique([projectId, phoneHash])`, and sets `phoneVerified: false`.
   - If phone and OTP are supplied, verifies OTP and marks `phoneVerified: true` if valid.

## Verification
- Ran `npx tsc --noEmit`: 0 errors (clean compilation).
- Ran `npx eslint src/app/projects/[id]/page.tsx src/app/projects/[id]/components/CommunityTab.tsx src/components/review-modal.tsx src/app/api/reviews/route.ts`: 0 errors, 0 warnings.
- Ran emoji detection script: 0 emoji pictograms found across all 4 files.
- Verified git diff and commit status.

## Commits Created
- `84ae03f`: `refactor(dossier): consolidate tabs to overview and citizen reports, relocate contractor link, prune unneeded modules`
