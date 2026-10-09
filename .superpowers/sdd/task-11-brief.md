### Task 11: AI Forensic Analysis Pipeline Endpoint

**Files:**
- Create: `src/app/api/ai/forensic-audit/route.ts`

**Interfaces:**
- Consumes: `POST { projectId: string }`.
- Produces: Structured `ForensicAuditReport` response with temporal discrepancy analysis and risk tiering.

- [ ] **Step 1: Create `src/app/api/ai/forensic-audit/route.ts`**

Implement endpoint:
1. Fetch project with reviews and province/region data from Prisma.
2. Ingest contract allocation, disbursement, progress, and review observations.
3. Compute financial payout vs physical completion discrepancy gap.
4. Construct prompt for Gemini (`DEFAULT_GEMINI_MODEL`) requesting structured JSON conforming to `ForensicAuditReport`.
5. Provide resilient heuristic fallback if Gemini API key is unset or rate limited.
6. Return structured report.

```ts
import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { DEFAULT_GEMINI_MODEL } from '@/lib/constants';
import { formatCurrency } from '@/lib/format';

export interface ForensicAuditReport {
  executiveSummary: string;
  temporalComparison: {
    baselineYear: number;
    presentYear: number;
    observedChanges: string;
    satelliteConfidencePct: number;
  };
  discrepancyAudit: {
    financialPayoutPct: number;
    claimedPhysicalPct: number;
    deltaGapPct: number;
    accelerationWarning: boolean;
  };
  riskTier: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  complianceStatus: 'VERIFIED' | 'UNDER_REVIEW' | 'FLAGGED_ANOMALY';
  actionableRecommendations: string[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 3: Commit changes**

```bash
git add src/app/api/ai/forensic-audit/route.ts
git commit -m "feat(api): implement AI forensic cross-referencing audit endpoint"
```

---
