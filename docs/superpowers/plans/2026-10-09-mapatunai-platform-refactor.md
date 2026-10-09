# MAPATUNAI Platform Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the MAPATUNAI platform to eliminate UI clutter and deprecated modules, resolve Mapbox basemap lifecycle, boundary rendering, and pin filtering bugs, implement an in-page contractor projects drawer, integrate an interactive 520px satellite timeline in the project overview, and deploy an automated multimodal AI Forensic Audit pipeline.

**Architecture:** 
- Centralize Mapbox GL source and layer registration onto `style.load` lifecycle events to maintain pin clusters across basemap theme switches, while scaling Supercluster radius to 45 for cleaner visual density.
- Map canonical region and locality aliases in boundary endpoints and propagate municipality filters to cluster workers to strictly restrict pins and viewports.
- Restructure project dossier into two tabs (Overview and Citizen Reports), embedding a large-scale ESRI Wayback satellite scrubber and an AI forensic cross-referencing audit endpoint (`/api/ai/forensic-audit`).
- Add an in-page slide-over drawer to `/contractors` fetching won contracts with direct navigation to project detail pages.

**Tech Stack:** Next.js 16 (App Router), React 19, Mapbox GL JS, Supercluster Web Worker, Prisma ORM (PostgreSQL), Tailwind CSS, Lucide React, Google GenAI SDK (`@google/genai`).

## Global Constraints

- Zero emojis across all badges, HUD components, cards, and reports. Use clean monospace text with micro-dots.
- Color palette: Deep Navy (`#011438`), Royal Blue (`#01367d`), Gold (`#ffb241`), Light Background (`#eeeeee` / `#f4f6fb`).
- Brand identity: `MAPATUNAI` only.
- Strict direct navigation: clicking contractor contracts must navigate directly to `/projects/[id]` without kicking back to `/map`.
- Never use multi-byte box-drawing characters (`\u2500` / `─`) in source code comments to prevent Next.js Turbopack compiler panics.

---

### Task 1: Global Header Cleanup

**Files:**
- Modify: `src/components/header.tsx:1-47`

**Interfaces:**
- Consumes: Next.js `Link`, `Image`.
- Produces: Clean global header featuring clickable MAPATUNAI logo and Contractors link, without "Home" link or "Launch Map" button.

- [ ] **Step 1: Edit `src/components/header.tsx` to remove "Home" link and "Launch Map" button**

```tsx
import Link from 'next/link';
import Image from 'next/image';

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#01367d]/10 bg-[#eeeeee]/95 text-[#01367d] shadow-sm backdrop-blur-md">
      <div className="w-full flex items-center justify-between gap-4 px-6 md:px-12 py-3">
        {/* Left: Brand Logo linking to Homepage */}
        <Link href="/" className="flex items-center gap-3 shrink-0 group" aria-label="MAPATUNAI Home">
          <Image
            src="/MAPATUNAI.png"
            alt="MAPATUNAI"
            width={160}
            height={45}
            className="h-9 w-auto object-contain transition-transform group-hover:scale-105"
            priority
          />
        </Link>

        {/* Right: Navigation Links */}
        <nav className="flex items-center gap-6 sm:gap-8 text-sm font-bold text-[#01367d]">
          <Link href="/contractors" className="hover:text-[#ffb241] transition-colors whitespace-nowrap">
            Contractors
          </Link>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 3: Commit changes**

```bash
git add src/components/header.tsx
git commit -m "refactor(header): remove home link and launch map button, retain logo and contractors"
```

---

### Task 2: Interactive Map HUD Cleanup

**Files:**
- Modify: `src/app/map/components/DrillDownPanel.tsx:1-537`
- Modify: `src/app/map/page.tsx:112-143`

**Interfaces:**
- Consumes: Location hierarchy hooks, map navigation callbacks.
- Produces: Streamlined Map HUD with Search, Near Me, Basemap toggle, point counter, and location dropdowns; removes MAPATUNAI logo pill and status filter chips.

- [ ] **Step 1: Remove logo pill and status filter chips from `src/app/map/components/DrillDownPanel.tsx`**

Remove:
- `RISK_FILTERS` constant and `filterAnomaly`, `setFilterAnomaly` from `DrillDownPanelProps`.
- The embedded `MAPATUNAI.png` logo pill link from the top-left HUD row.
- The `FILTER:` chips button strip from the bottom HUD row.
- Clean up unused `Image` import.

In `src/app/map/components/DrillDownPanel.tsx`:
Replace the component signature and JSX so the breadcrumb starts directly at `PH / ...` without the logo pill, and Row 2 contains only the hierarchical location dropdowns:

```tsx
interface DrillDownPanelProps {
  currentZoom: number;
  totalPoints: number;
  isReady: boolean;
  sortedRegions: RegionItem[];
  region: string;
  province: string;
  municipality: string;
  barangay: string;
  setRegion: (v: string) => void;
  setProvince: (v: string) => void;
  setMunicipality: (v: string, file?: string) => void;
  setBarangay: (v: string, bounds?: [[number, number], [number, number]]) => void;
  navigateTo: (level: 'root' | 'region' | 'province' | 'municipality') => void;
  basemap: string;
  setBasemap: (v: 'satellite' | 'dark' | 'streets') => void;
  getProvinces: (regionName: string) => ProvinceItem[];
  getCities: (regionName: string, provinceName: string) => CityItem[];
  onFlyToLocation?: (coords: [number, number], zoom?: number) => void;
  onSelectProject?: (projectId: string) => void;
  onNearMeClick?: () => void;
  isLocating?: boolean;
}
```

And in JSX:
- Replace Row 1 left container to render the breadcrumb directly.
- Row 2 renders the dropdowns with clean styling, without the filter pills.

- [ ] **Step 2: Update `src/app/map/page.tsx` to remove `filterAnomaly` passing**

In `src/app/map/page.tsx`:
- Remove `filterAnomaly` state/prop passing to `<DrillDownPanel />`.
- Clean up `filterAnomaly` references in `useEffect` for `applyFilters`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 4: Commit changes**

```bash
git add src/app/map/components/DrillDownPanel.tsx src/app/map/page.tsx
git commit -m "refactor(hud): remove logo pill and status filter chips from interactive map HUD"
```

---

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

### Task 4: Map Theme Switching State Persistence & Cluster Optimization

**Files:**
- Modify: `src/app/map/hooks/useMapInstance.ts:1-98`
- Modify: `src/app/map/workers/cluster.worker.ts:1-67`
- Modify: `src/app/map/page.tsx:220-475`

**Interfaces:**
- Consumes: Mapbox GL JS instance, basemap style switcher.
- Produces: Persistent map clusters across basemap theme changes, reduced cluster radius (45), and optimized circle layer dimensions (11-22px).

- [ ] **Step 1: Reduce clustering radius in `src/app/map/workers/cluster.worker.ts`**

In `src/app/map/workers/cluster.worker.ts`, update `Supercluster` instantiation options:
```ts
supercluster = new (Supercluster as any)({
  radius: 45, // Optimized down from 75 for cleaner spatial separation
  maxZoom: 15,
  minZoom: 0,
  minPoints: 2,
  // ... map and reduce unchanged
});
```

- [ ] **Step 2: Support `style.load` event lifecycle in `src/app/map/hooks/useMapInstance.ts`**

Expose an event notification or callback when map style loads:
Add `styleLoadCount` state or `onStyleLoad` callback so consumers know when layers must be re-mounted.
```ts
const [styleLoadCount, setStyleLoadCount] = useState(0);

useEffect(() => {
  const map = mapRef.current;
  if (!map) return;
  const onStyleLoad = () => {
    setStyleLoadCount((c) => c + 1);
  };
  map.on('style.load', onStyleLoad);
  return () => {
    map.off('style.load', onStyleLoad);
  };
}, [isMapLoaded]);
```
Export `styleLoadCount` from `useMapInstance`.

- [ ] **Step 3: Centralize layer registration into `mountLayers()` in `src/app/map/page.tsx`**

In `src/app/map/page.tsx`:
- Group all layer and source additions (`selected-mask-source`, `selected-boundary-source`, `supercluster-source`, `choropleth-source`, `clusters-glow`, `clusters`, `cluster-count`, `unclustered-point-glow`, `unclustered-point`) into a memoized function `mountLayers()`.
- Trigger `mountLayers()` and `renderClusters()` inside `useEffect` watching `[isMapLoaded, styleLoadCount]`.
- Scale down Mapbox circle layers:
  - Cluster outer glow: `circle-radius` changed from `24, 30, 38, 46, 56` to `14, 18, 22, 26, 30`.
  - Cluster main blob: `circle-radius` changed from `18, 23, 29, 36, 44` to `11, 14, 17, 20, 24`.
  - Unclustered point core: `circle-stroke-width` set to `1.5` with white border.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 5: Commit changes**

```bash
git add src/app/map/hooks/useMapInstance.ts src/app/map/workers/cluster.worker.ts src/app/map/page.tsx
git commit -m "fix(map): preserve clusters on theme switch and optimize cluster radius and circle sizing"
```

---

### Task 5: Regional Border Rendering Canonical Alias Fix

**Files:**
- Modify: `src/app/api/locations/boundary/route.ts:50-110`

**Interfaces:**
- Consumes: Region query parameters `name`, `type=region`.
- Produces: 100% matched GeoJSON boundary polygons for all 17 Philippine administrative regions including MIMAROPA and BARMM.

- [ ] **Step 1: Add canonical alias dictionary in `src/app/api/locations/boundary/route.ts`**

Define canonical region map:
```ts
const CANONICAL_REGION_ALIASES: Record<string, string> = {
  'region iv-b': 'MIMAROPA Region',
  'region iv-b (mimaropa)': 'MIMAROPA Region',
  'mimaropa': 'MIMAROPA Region',
  'mimaropa region': 'MIMAROPA Region',
  'barmm': 'Bangsamoro Autonomous Region In Muslim Mindanao (BARMM)',
  'armm': 'Bangsamoro Autonomous Region In Muslim Mindanao (BARMM)',
  'bangsamoro': 'Bangsamoro Autonomous Region In Muslim Mindanao (BARMM)',
  'bangsamoro autonomous region in muslim mindanao (barmm)': 'Bangsamoro Autonomous Region In Muslim Mindanao (BARMM)',
  'ncr': 'National Capital Region (NCR)',
  'national capital region': 'National Capital Region (NCR)',
  'national capital region (ncr)': 'National Capital Region (NCR)',
  'car': 'Cordillera Administrative Region (CAR)',
  'cordillera': 'Cordillera Administrative Region (CAR)',
  'cordillera administrative region (car)': 'Cordillera Administrative Region (CAR)',
  'region iv-a': 'Region IV-A (CALABARZON)',
  'calabarzon': 'Region IV-A (CALABARZON)',
  'soccsksargen': 'Region XII (SOCCSKSARGEN)',
};
```

- [ ] **Step 2: Update region feature lookup logic**

In `boundary/route.ts`, normalize query `nameLower`:
```ts
const nameClean = name.toLowerCase().trim();
const targetCanonical = CANONICAL_REGION_ALIASES[nameClean] || nameClean;

const feat = d.features.find((f: any) => {
  const regName = (f.properties?.adm1_en || f.properties?.region_name || f.properties?.name || '').toLowerCase().trim();
  const canonicalRegName = CANONICAL_REGION_ALIASES[regName] || regName;
  
  if (canonicalRegName.toLowerCase() === targetCanonical.toLowerCase()) return true;
  if (regName === nameClean) return true;
  if (nameClean.includes('mimaropa') && regName.includes('mimaropa')) return true;
  if (nameClean.includes('barmm') && regName.includes('bangsamoro')) return true;
  if (nameClean.includes('ncr') && regName.includes('national capital')) return true;
  if (nameClean.includes('car') && !nameClean.includes('caraga') && regName.includes('cordillera')) return true;
  return regName.includes(nameClean) || nameClean.includes(regName);
});
```

- [ ] **Step 3: Test boundary lookup for MIMAROPA and BARMM via node script**

Run: `node -e "const fetch = require('node'); console.log('Checking boundary route syntax')"` or curl/test script.
Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 4: Commit changes**

```bash
git add src/app/api/locations/boundary/route.ts
git commit -m "fix(boundary): add canonical alias dictionary for 100% regional border rendering"
```

---

### Task 6: Province & City Pin Filtering & Viewport Framing

**Files:**
- Modify: `src/app/map/workers/cluster.worker.ts:77-130`
- Modify: `src/app/map/page.tsx:112-143`

**Interfaces:**
- Consumes: Drill-down state (`province`, `municipality`).
- Produces: Strictly filtered worker features restricted to target province or municipality, dynamically fitting viewport.

- [ ] **Step 1: Add municipality filtering in `src/app/map/workers/cluster.worker.ts`**

In `case 'filter'` of `cluster.worker.ts`:
```ts
if (filters.municipality) {
  const muniLower = filters.municipality.toLowerCase().trim();
  // Match by project title containing municipality name or municipality index if available
  currentFeatures = currentFeatures.filter((f: any) => {
    const p = f.properties;
    const title = (p.n || '').toLowerCase();
    return title.includes(muniLower);
  });
}
```

- [ ] **Step 2: Pass `municipality` to `applyFilters` in `src/app/map/page.tsx`**

In `src/app/map/page.tsx`:
```ts
useEffect(() => {
  if (!isReady) return;

  const filters: Record<string, any> = {};
  if (drillDown.region) filters.region = drillDown.region;
  if (drillDown.province) filters.province = drillDown.province;
  if (drillDown.municipality) filters.municipality = drillDown.municipality;

  applyFilters(filters).then(() => {
    renderClusters();
  });
}, [isReady, drillDown.region, drillDown.province, drillDown.municipality]);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 4: Commit changes**

```bash
git add src/app/map/workers/cluster.worker.ts src/app/map/page.tsx
git commit -m "feat(map): restrict pins strictly to selected province and municipality"
```

---

### Task 7: Global Multi-Region Search Bar Fix

**Files:**
- Modify: `src/app/api/projects/route.ts:1-70`

**Interfaces:**
- Consumes: Query string `q` or `search`, `contractor` parameter.
- Produces: Multi-region, tokenized project search matching across region names, province names, categories, IDs, contractor names, and project titles.

- [ ] **Step 1: Enhance search query resolution in `src/app/api/projects/route.ts`**

In `src/app/api/projects/route.ts`:
Add `contractor` filter and multi-token `q` parsing:
```ts
const contractor = searchParams.get('contractor');
if (contractor) {
  where.contractorRaw = { contains: contractor, mode: 'insensitive' };
}

if (q) {
  const tokens = q.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    const singleToken = tokens[0];
    where.OR = [
      { name: { contains: singleToken, mode: 'insensitive' } },
      { id: { contains: singleToken, mode: 'insensitive' } },
      { contractorRaw: { contains: singleToken, mode: 'insensitive' } },
      { category: { contains: singleToken, mode: 'insensitive' } },
      { province: { name: { contains: singleToken, mode: 'insensitive' } } },
      { province: { region: { name: { contains: singleToken, mode: 'insensitive' } } } },
    ];
  } else {
    // Multi-token AND search: every token must match at least one field
    where.AND = tokens.map((token) => ({
      OR: [
        { name: { contains: token, mode: 'insensitive' } },
        { id: { contains: token, mode: 'insensitive' } },
        { contractorRaw: { contains: token, mode: 'insensitive' } },
        { category: { contains: token, mode: 'insensitive' } },
        { province: { name: { contains: token, mode: 'insensitive' } } },
        { province: { region: { name: { contains: token, mode: 'insensitive' } } } },
      ],
    }));
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 3: Commit changes**

```bash
git add src/app/api/projects/route.ts
git commit -m "fix(search): enable tokenized multi-region and category project search"
```

---

### Task 8: "Near Me" GPS Radar, Visual Radius & Distance Indicator

**Files:**
- Modify: `src/app/map/page.tsx`
- Modify: `src/app/map/components/DrillDownPanel.tsx`

**Interfaces:**
- Consumes: Browser `navigator.geolocation`.
- Produces: Visual 5.0 km circular GeoJSON polygon overlay centered on the user, dynamic flight to user location, and an active radar scanning indicator badge over the map.

- [ ] **Step 1: Generate 5.0 km circle GeoJSON polygon helper**

Create circular GeoJSON polygon generator function in `src/app/map/page.tsx` (or `src/lib/geo.ts`):
```ts
function createGeoJSONCircle(center: [number, number], radiusKm = 5.0, points = 64) {
  const [lng, lat] = center;
  const coords: [number, number][] = [];
  const distanceX = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusKm / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }
  coords.push(coords[0]); // close polygon

  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coords],
    },
    properties: {},
  };
}
```

- [ ] **Step 2: Add radar circle layer & visual distance badge in `src/app/map/page.tsx`**

- Add `nearMeCoords` state `[number, number] | null`.
- Add `near-me-radius-source` and corresponding fill/line layers on Mapbox:
  - Fill: `rgba(1, 54, 125, 0.15)`
  - Line: `#01367d` (2px width, dashed)
- Render floating distance badge:
```tsx
{nearMeCoords && (
  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 bg-[#011438]/90 border border-[#01367d] text-white px-4 py-2 rounded-full font-mono text-xs flex items-center gap-2 shadow-xl backdrop-blur-md">
    <span className="h-2 w-2 rounded-full bg-[#ffb241] animate-ping" />
    <span>SEARCH RADIUS: 5.0 KM (SCANNING NEARBY INFRASTRUCTURE)</span>
    <button
      onClick={() => setNearMeCoords(null)}
      className="ml-2 text-slate-400 hover:text-white"
    >
      &times;
    </button>
  </div>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 4: Commit changes**

```bash
git add src/app/map/page.tsx src/app/map/components/DrillDownPanel.tsx
git commit -m "feat(map): implement 5km Near Me geolocation radar polygon and distance badge"
```

---

### Task 9: Contractor Won Projects Slide-Over Drawer

**Files:**
- Modify: `src/app/contractors/page.tsx:1-508`

**Interfaces:**
- Consumes: `useContractors`, `/api/projects?q=...` or `/api/projects?contractor=...`.
- Produces: Right slide-over drawer modal listing won projects for selected contractor with direct routing to `/projects/[id]`.

- [ ] **Step 1: Add slide-over drawer state and query in `src/app/contractors/page.tsx`**

In `src/app/contractors/page.tsx`:
- Add state: `activeDrawerContractor: { name: string; id: string } | null`.
- Add `drawerProjects` state and `isDrawerLoading` state.
- In `useEffect`: fetch `/api/projects?contractor=${encodeURIComponent(activeDrawerContractor.name)}&limit=50` (or `q=${encodeURIComponent(activeDrawerContractor.name)}`).

- [ ] **Step 2: Update "View Projects →" CTA button on contractor cards**

Update `onClick`:
```tsx
<button
  onClick={(e) => {
    e.stopPropagation();
    setActiveDrawerContractor({ name: c.name, id: c.id });
  }}
  className="rounded-full bg-[#01367d] px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-md hover:bg-[#ffb241] hover:text-[#01367d] hover:scale-105 transition-all duration-200 whitespace-nowrap"
>
  View Projects &rarr;
</button>
```

- [ ] **Step 3: Render in-page Slide-Over Drawer with direct project routing**

Render slide-over panel on the right side of the screen when `activeDrawerContractor` is present:
- Header: Contractor name, total awards badge, close button.
- Body: List of won projects showing title, contract ID, allocated budget, physical progress, and location.
- **Direct Redirect**: Clicking any project calls `router.push(/projects/${encodeURIComponent(project.id)})`.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 5: Commit changes**

```bash
git add src/app/contractors/page.tsx
git commit -m "feat(contractors): implement in-page won projects drawer with direct dossier redirect"
```

---

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

### Task 13: Full Build Verification & Sanity Testing

**Files:**
- Review all touched files across the codebase.

**Interfaces:**
- All 28 Next.js routes.

- [ ] **Step 1: Run TypeScript compiler check**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 2: Run production Next.js build**

Run: `npx next build`  
Expected: Build successfully completes with exit code 0.

- [ ] **Step 3: Final verification commit**

```bash
git add .
git commit -m "chore: complete MAPATUNAI platform refactor verification"
```
