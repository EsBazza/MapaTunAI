### Task 3: Project Dossier Tab & Module Pruning

**Files:**
- Modify: `src/app/projects/[id]/page.tsx:1-430`
- Modify: `src/app/projects/[id]/components/CommunityTab.tsx:1-372`
- Modify: `src/components/review-modal.tsx:1-555`
- Modify: `src/app/api/reviews/route.ts:45-120`

**Interfaces:**
- Consumes: Project data hook `useProject`.
- Produces: Project dossier consolidated strictly into **Overview** and **Citizen Reports** tabs; relocates contractor profile link to title header; prunes external buttons and anti-fraud phone verification.

- [ ] **Step 1: Update `src/app/projects/[id]/page.tsx`**

- Reduce `TabType` to `'overview' | 'community'`.
- Remove imports of `SatelliteTab`, `NewsTab`, `FinancialsTab`, `ConnectionsTab`.
- Remove DPWH Civil Works Portal button and File FOI Request button from the hero action bar.
- Relocate contractor full profile link directly into the title header block next to contractor name:
```tsx
<Link
  href={`/contractors?q=${encodeURIComponent(contractorName)}`}
  className="inline-flex items-center gap-1.5 text-white hover:text-[#ffb241] transition group"
  title="View Contractor Profile in Registry"
>
  <Building2 className="h-4 w-4 text-[#ffb241]" />
  <span className="text-sm font-bold group-hover:underline">{contractorName}</span>
  <ExternalLink className="h-3 w-3 text-white/50 group-hover:text-[#ffb241]" />
</Link>
```
- Define `tabs` array containing only:
```tsx
const tabs: Array<{ id: TabType; label: string; count?: number }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'community', label: 'Citizen Reports', count: project.reviews?.length || 0 },
];
```
- In the tab content panels, render only `OverviewTab` and `CommunityTab`.

- [ ] **Step 2: Prune Active Workers on Site and Phone Verification UI in `src/app/projects/[id]/components/CommunityTab.tsx`**

- Remove "Active Workers on Site" indicator card from the top metrics grid.
- Expand the top grid to 2 prominent cards (Community Satisfaction & Ground Reality vs DPWH Claim) plus a full-width or side action button for "Submit Eyewitness Report".
- In the reviews feed cards, remove the `SMS Verified` badge.

- [ ] **Step 3: Remove Anti-Fraud Phone / OTP requirement in `src/components/review-modal.tsx` and `src/app/api/reviews/route.ts`**

- In `src/components/review-modal.tsx`:
  - Remove phone input and OTP verification step.
  - Users enter their ratings, progress perception, comments, GPS location check, and optional photo upload.
  - Allow direct submit without SMS OTP.
- In `src/app/api/reviews/route.ts`:
  - Make `phone` and `otp` optional in validation (`if (!projectId || rating === undefined || !comment)`).
  - Set `phoneVerified: false` if not provided.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 5: Commit changes**

```bash
git add src/app/projects/[id]/page.tsx src/app/projects/[id]/components/CommunityTab.tsx src/components/review-modal.tsx src/app/api/reviews/route.ts
git commit -m "refactor(dossier): consolidate tabs to overview and citizen reports, relocate contractor link, prune unneeded modules"
```

---
