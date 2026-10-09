### Task 10: Full-Width 520px Satellite Timeline Scrubber in Overview Tab

**Files:**
- Modify: `src/app/projects/[id]/components/OverviewTab.tsx:1-268`

**Interfaces:**
- Consumes: Project detail record `project` (`gpsLat`, `gpsLng`, `startDate`, `completionDate`).
- Produces: Integrated 520px-height interactive satellite scrubber in `OverviewTab.tsx` with Baseline to Present timeline scrub.

- [ ] **Step 1: Remove redundant cards in `src/app/projects/[id]/components/OverviewTab.tsx`**

Remove:
- The redundant "Disbursement vs Physical Progress Alignment" card.
- The Primary Contractor card (already relocated to title header).
- The eFOI Portal Request card.

- [ ] **Step 2: Integrate large-scale (520px) satellite timeline scrubber into `OverviewTab.tsx`**

Embed the interactive ESRI Wayback satellite timeline:
- Full-width container with `h-[520px]`.
- Baseline (project start year) to Present (2026) scrubber.
- GPS coordinate overlay and Wayback catalog timestamp badge.
- Side-by-side or slider mode for comparing baseline earthworks against present ground truth.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 4: Commit changes**

```bash
git add src/app/projects/[id]/components/OverviewTab.tsx
git commit -m "feat(overview): integrate full-width 520px satellite timeline scrubber into overview tab"
```

---
