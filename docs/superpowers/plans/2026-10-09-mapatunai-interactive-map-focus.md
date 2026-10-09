# MAPATUNAI — Interactive Map Focus & UI Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform MAPATUNAI into a laser-focused, high-performance civic transparency portal centered on an interactive map with in-HUD search and geolocation radar, a zero-emoji institutional project dossier with AI satellite ground-truth verification, and zero subsystem bloat (removing Sigma, Cytoscape, Chatbot, and Recharts).

**Architecture:** The application converges entirely on `/map` as the core operational interface with a unified glassmorphic Command HUD in the homepage navy/gold palette. The slide-out drawer on `/map` is replaced with direct click-through to `/projects/[id]`, which is restyled as a dignified, tabular, emoji-free audit dossier. Deprecated subsystems (`/engineers`, chatbot, and graph visualizers) are stripped to optimize bundle size and page load speed.

**Tech Stack:** Next.js 16.3.4 (App Router, Turbopack), React 19, Tailwind CSS v4, Mapbox GL JS 3.x, Supercluster Web Worker, ESRI Wayback Imagery API, Google Gemini Flash, Prisma ORM 6.19.3, PostgreSQL (Supabase).

## Global Constraints

- **Branding**: The platform name is **MAPATUNAI** only. No user-facing occurrences of "PhilTrace" remain in UI, headings, titles, or navigation.
- **Logo Navigation**: Clicking the MAPATUNAI logo anywhere in the app navigates to the homepage `/`.
- **Zero AI Slop / Zero Emojis**: Strictly no emojis (`🚨`, `⚠️`, `⚡`, `🇵🇭`, `🔴`, `🟡`, `🔵`, `🟢`, `✍️`, etc.) in buttons, filters, badges, or headers. Replace with solid micro-dots (`<span className="h-2 w-2 rounded-full ..." />`) and clean uppercase monospace tags.
- **Homepage Aesthetic**: Standardize the entire platform on the homepage color system: Deep Navy (`#011438` / `#01367d`), Gold (`#ffb241`), and clean off-white / light slate (`#eeeeee` / `#f8fafc`).
- **No Charting Bloat**: Recharts is completely uninstalled. All financial comparisons and progress variances are rendered as crisp tabular key-value grids and clean progress contrast bars.
- **Prisma Initialization**: Keep the `.prisma/client` direct fallback in `src/lib/prisma.ts` intact to prevent Turbopack uninitialized errors.

---

### Task 1: Subsystem & Dependency Pruning

**Files:**
- Delete: `src/app/engineers/page.tsx`
- Delete: `src/app/api/engineers/graph/route.ts`
- Delete: `src/components/chatbot.tsx`
- Delete: `src/app/api/chat/route.ts`
- Delete: `src/components/contractors/sigma-network.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/header.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: `src/app/layout.tsx` (removes Chatbot import)
- Produces: Clean, bloat-free build and header component with MAPATUNAI branding

- [ ] **Step 1: Delete deprecated engineer page and graph API route**
  - Delete `src/app/engineers/page.tsx`
  - Delete `src/app/api/engineers/graph/route.ts`

- [ ] **Step 2: Delete floating chatbot component and chat API route**
  - Delete `src/components/chatbot.tsx`
  - Delete `src/app/api/chat/route.ts`
  - Remove `<Chatbot />` import and JSX from `src/app/layout.tsx`

- [ ] **Step 3: Delete Sigma network component and clean contractors page**
  - Delete `src/components/contractors/sigma-network.tsx`
  - In `src/app/contractors/page.tsx`, remove Sigma imports and network view switcher, rendering a clean, fast contractor directory.

- [ ] **Step 4: Update `src/components/header.tsx`**
  - Update top navigation to: Brand Logo `MAPATUNAI` (linking to `/`), and link to `Interactive Map` (`/map`).
  - Remove engineer links, remove standalone search links (since search is in the map HUD).

- [ ] **Step 5: Prune unused packages from `package.json`**
  - Remove: `@react-sigma/core`, `sigma`, `graphology`, `graphology-layout`, `graphology-layout-forceatlas2`, `react-sigma`, `cytoscape`, `react-cytoscapejs`, `@types/cytoscape`, `@types/react-cytoscapejs`, `recharts`.
  - Run `npm install` to update `package-lock.json`.

- [ ] **Step 6: Verify TypeScript compilation**
  - Run `npx tsc --noEmit` to confirm 0 compilation errors after pruning.

---

### Task 2: In-HUD Real-Time Search & "Near Me" GPS Radar on Mapbox Engine

**Files:**
- Modify: `src/app/map/components/DrillDownPanel.tsx`
- Modify: `src/app/map/page.tsx`
- Delete: `src/components/project-inspection-drawer.tsx`
- Delete: `src/app/nearby/page.tsx` (consolidated into Map HUD)

**Interfaces:**
- Consumes: `/api/projects?q=...`, `useLocationHierarchy`, `useSupercluster`
- Produces: Floating Command HUD with integrated autocomplete search, smooth camera zoom `flyTo`, Near Me radar, and pin click cards linking directly to `/projects/[id]`.

- [ ] **Step 1: Rebuild `DrillDownPanel.tsx` into the unified Command HUD**
  - Re-skin with homepage Deep Navy (`#011438` / `#01367d`) and `#ffb241` gold accents.
  - Add clickable `MAPATUNAI` brand pill linking to `/`.
  - Add live debounced search input querying `/api/projects?q=...&limit=6`.
  - Dropdown results display Contract ID, Project Name, Contractor, Location, and Status.
  - Selecting a search result fires `onSelectProject(project)` callback.
  - Add "Near Me" GPS button that invokes browser geolocation and fires `onNearMe(lat, lng)` callback.
  - Replace all emoji filter labels (`🔴`, `🟡`, `🔵`, `🟢`) with solid micro-status dots (`h-2 w-2 rounded-full`) and uppercase monospace labels: `ALL`, `OVERDUE`, `STALLED`, `GHOST RISK`, `NEVER STARTED`.

- [ ] **Step 2: Update `src/app/map/page.tsx` to handle in-HUD search and pin popups**
  - Delete `ProjectInspectionDrawer` import, state, and JSX.
  - Implement smooth cinematic camera flight on search selection:
    ```ts
    map.flyTo({
      center: [lng, lat],
      zoom: 16,
      pitch: 45,
      duration: 2200,
      essential: true,
    });
    ```
  - Implement "Near Me" camera flight:
    ```ts
    map.flyTo({
      center: [userLng, userLat],
      zoom: 14,
      duration: 2000,
      essential: true,
    });
    ```
  - Configure pin click event to open a high-contrast Mapbox popup card with:
    - Clean Project Name
    - Contractor Name
    - Budget in PHP & Progress %
    - Monospace status tag
    - Primary button: `[ View Full Dossier → ]` routing directly to `/projects/${id}`.

- [ ] **Step 3: Remove redundant standalone files**
  - Remove `src/components/project-inspection-drawer.tsx`.
  - Remove `src/app/nearby/page.tsx`.

- [ ] **Step 4: Verify Mapbox compilation and interaction**
  - Run `npx tsc --noEmit` to confirm type safety.

---

### Task 3: Detailed Project Dossier (`/projects/[id]`) Homepage Reskin & Tabular Ledger

**Files:**
- Modify: `src/app/projects/[id]/page.tsx`
- Modify: `src/app/projects/[id]/components/OverviewTab.tsx`
- Modify: `src/app/projects/[id]/components/FinancialsTab.tsx`
- Modify: `src/app/projects/[id]/components/CommunityTab.tsx`
- Modify: `src/app/projects/[id]/components/ConnectionsTab.tsx`

**Interfaces:**
- Consumes: `/api/projects/[id]`, `/api/contracts/[id]/boq`, `/api/reviews`
- Produces: Dignified, emoji-free, high-density project dossier matching the homepage palette.

- [ ] **Step 1: Reskin Hero Banner & Status Tags in `page.tsx`**
  - Style hero banner in `#011438` / `#01367d` with white text and gold `#ffb241` accents.
  - Breadcrumb: `MAPATUNAI > Region > Province > Contract ID`.
  - Purge all emojis (`🚨`, `⚠️`, `⚡`, `🇵🇭`, etc.).
  - Replace banner badges with clean monospace status tags:
    - `GHOST RISK / OVERPAID` with solid crimson dot.
    - `OVERDUE (X DAYS)` with solid amber dot.
    - `STALLED WORKS` with solid yellow dot.
    - `CATEGORY: [CAT]`.

- [ ] **Step 2: Replace Recharts with Tabular Financial Ledger in `FinancialsTab.tsx`**
  - Remove all Recharts imports and SVG components.
  - Render a crisp 4-column audit summary: Allocated Budget, Amount Disbursed, Physical Progress %, Financial Payout Gap.
  - Render a dual-bar progress contrast indicator (Disbursed % vs Progress %).
  - Render clean tabular Bill of Quantities (BOQ) with regional unit price benchmark comparison (+30% price markup highlight).

- [ ] **Step 3: Clean `OverviewTab.tsx`, `CommunityTab.tsx`, and `ConnectionsTab.tsx`**
  - Purge all emojis and banner badges.
  - Format verified citizen reports with clean verification tags and photo thumbnails.
  - Format contractor and politician connections in structured cards.

- [ ] **Step 4: Verify Dossier compilation**
  - Run `npx tsc --noEmit`.

---

### Task 4: AI Multimodal Satellite Vision Ground-Truth Audit

**Files:**
- Modify: `src/app/projects/[id]/components/SatelliteTab.tsx`
- Modify: `src/components/wayback-slider.tsx`

**Interfaces:**
- Consumes: ESRI Wayback API, Project GPS coordinates, Project start & completion dates
- Produces: High-contrast satellite inspection timeline and AI Ground-Truth Verification card.

- [ ] **Step 1: Clean and enhance `wayback-slider.tsx`**
  - Remove emojis (`⚡`, `🛰️`) from buttons and badges.
  - Style timeline selector in clean white/navy pills with green start year and red due year indicator dots.
  - Keep "Start vs. Latest" one-click comparison toggle.

- [ ] **Step 2: Add AI Satellite Ground-Truth Audit Card in `SatelliteTab.tsx`**
  - Prominent audit summary card:
    - **Ground-Truth Match Confidence**: `High Confidence` | `Discrepancy Detected`.
    - **Factual Telemetry Observation**: Clear, non-slop statement analyzing whether visible earthworks / infrastructure correspond with the declared milestone.
    - Coordinates & satellite capture date stamps.

- [ ] **Step 3: Verify Satellite component compilation**
  - Run `npx tsc --noEmit`.

---

### Task 5: Global Rebranding (MAPATUNAI) & Production Verification

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/search/page.tsx`
- Modify: `src/app/regions/[region]/page.tsx`
- Check: `package.json`

**Interfaces:**
- Consumes: All views
- Produces: 100% clean, verified, production-ready MAPATUNAI application.

- [ ] **Step 1: Brand & Emoji Audit across all pages**
  - In `src/app/page.tsx`, replace any remaining "PhilTrace" text with "MAPATUNAI".
  - In `src/app/layout.tsx`, update page title and metadata to "MAPATUNAI — National Public Infrastructure Transparency Platform".
  - In `src/app/search/page.tsx`, update headings, search placeholders, and remove any emojis.
  - In `src/app/regions/[region]/page.tsx`, clean flags list labels (remove emojis).

- [ ] **Step 2: Full TypeScript check**
  - Run `npx tsc --noEmit` and confirm 0 errors.

- [ ] **Step 3: Full Next.js Production Build**
  - Run `npm run build` and confirm all pages and routes compile and optimize cleanly with Turbopack.

- [ ] **Step 4: Final Verification Report**
  - Confirm all user requirements are verified: Map focus, In-HUD search, In-HUD Near Me, drawer removal, homepage dossier aesthetic, zero emojis, MAPATUNAI branding, and 0 runtime errors.
