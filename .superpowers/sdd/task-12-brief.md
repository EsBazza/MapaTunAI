### Task 12: AI Forensic Executive Briefing Card Integration

**Files:**
- Modify: `src/app/projects/[id]/components/OverviewTab.tsx`

**Interfaces:**
- Consumes: `/api/ai/forensic-audit` endpoint, `project` data.
- Produces: Executive forensic audit card styled with Deep Navy, Royal Blue, Gold, and zero emojis.

- [ ] **Step 1: Add forensic audit query & UI in `src/app/projects/[id]/components/OverviewTab.tsx`**

- Fetch forensic audit data on load from `/api/ai/forensic-audit`.
- Render executive briefing card:
  - Header with Risk Tier (`CRITICAL`, `HIGH`, `MODERATE`, `LOW`) and Compliance Status badges (`VERIFIED`, `UNDER REVIEW`, `FLAGGED ANOMALY`).
  - Executive summary text.
  - Discrepancy audit metrics (Financial payout % vs Claimed physical % vs Delta gap %).
  - Temporal cross-referencing findings.
  - Actionable recommendations checklist.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 3: Commit changes**

```bash
git add src/app/projects/[id]/components/OverviewTab.tsx
git commit -m "feat(overview): render AI Forensic Executive Briefing card with temporal audit findings"
```

---
