# 🇵🇭 MAPATUNAI — Interactive Map Focus & UI Modernization Specification

**Document Version:** 1.0  
**Date:** 2026-10-09  
**Status:** Approved  
**Target Platform:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Mapbox GL JS 3.x, Supercluster, Google Gemini Multimodal Vision, ESRI Wayback Satellite API  

---

## 1. Executive Summary & Core Objective

**MAPATUNAI** (formerly PhilTrace) is an open-source civic technology platform auditing **246,176 public infrastructure projects** across the Philippines.

### The Objective
Within a focused **5.5-hour polishing sprint**, radically streamline the platform by:
1. **Focusing Exclusively on the Interactive Map**: Elevating `/map` as the core operational centerpiece of the platform.
2. **Eliminating Subsystem Bloat & Heavy Visualizers**:
   - Remove the Sigma.js bipartite graph visualizer and Cytoscape network graphs.
   - Remove the District Engineer signature network page (`/engineers`) and its API routes.
   - Remove the floating AI chatbot (`src/components/chatbot.tsx`, `/api/chat`).
   - Remove all Recharts charting libraries and SVG graphs.
   - Remove the slide-out inspection drawer on `/map`, routing project investigations directly to the full project dossier.
3. **Consolidating Navigation into the Map Command HUD**:
   - Embed real-time project search directly into the floating Map HUD with smooth cinematic `flyTo` camera zoom animations.
   - Embed the "Near Me" GPS geolocation radar directly into the Map HUD with smooth camera zoom to user coordinates.
   - Keep the website header minimal (Brand Logo linking to `/` and direct Map link).
4. **Elevating the Detailed Project Dossier (`/projects/[id]`)**:
   - Re-skin the entire page to match the **authoritative homepage aesthetic** (Deep Navy `#011438` / `#01367d`, Gold `#ffb241`, Off-White `#eeeeee`).
   - **Zero AI Slop**: Remove all emojis (`🚨`, `⚠️`, `⚡`, `🇵🇭`, `🔴`, `🟡`, etc.) and bubbly promotional banner badges. Replace with clean, dense monospace and micro-dot status indicators.
   - **Front-and-Center AI Satellite Ground-Truth Verification**: Combine the multi-year ESRI Wayback satellite viewer (2014–2026) with Google Gemini Multimodal Vision to deliver factual, visual satellite audit verdicts.
   - Clean tabular Bill of Quantities (BOQ) with regional unit price benchmark comparisons and verified citizen whistleblower reports.

---

## 2. Branding Standardization: MAPATUNAI

* All user-facing UI labels, page titles, top navigation logos, meta tags, and headings will strictly use **MAPATUNAI**.
* All occurrences of "PhilTrace" across UI views, banners, headers, and footer text are replaced with **MAPATUNAI**.
* Clicking the brand logo anywhere across the site navigates directly to the homepage `/`.

---

## 3. Subsystem Pruning & Codebase Trimming

### 3.1 Files & Modules to Remove
| Component / File | Purpose of Removal | Replacement |
| :--- | :--- | :--- |
| `src/app/engineers/page.tsx`<br>`src/app/api/engineers/graph/route.ts` | Eliminates unused signature graph page | Feature removed; focus shifted entirely to map |
| `src/components/chatbot.tsx`<br>`src/app/api/chat/route.ts` | Eliminates floating text chatbot widget | AI focus shifted to Multimodal Satellite Vision |
| `src/components/contractors/sigma-network.tsx` | Eliminates WebGL Sigma graph bloat | Contractors page simplified or redirected to Map |
| `src/components/project-inspection-drawer.tsx` | Eliminates cramped slide-out drawer on map | Direct click-through to full Dossier (`/projects/[id]`) |
| `src/app/nearby/page.tsx` | Redundant standalone page | Consolidated directly into the In-HUD "Near Me" button |

### 3.2 NPM Package Pruning
Remove unused heavyweight visualization packages from `package.json`:
* `@react-sigma/core`, `sigma`, `graphology`, `graphology-layout`, `graphology-layout-forceatlas2`, `react-sigma`
* `cytoscape`, `react-cytoscapejs`, `@types/cytoscape`, `@types/react-cytoscapejs`
* `recharts`

---

## 4. Interactive Map Engine & Floating Command HUD (`/map`)

### 4.1 Floating Command HUD Layout
Positioned floating at the top of the map viewport with a glassmorphic Deep Navy (`#011438` / `#01367d`) aesthetic, `#ffb241` gold accents, and sharp borders:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [MAPATUNAI]  [ 🔍 Search Contract ID, Project, Contractor... ]  [ 📍 Near Me ]  [ Region ▾ ] [ Prov ▾ ]  [ ALL | OVERDUE | STALLED | GHOST RISK ] │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### HUD Components:
1. **Brand Anchor**:
   - `MAPATUNAI` logo pill (links to `/`).
2. **In-HUD Real-Time Search Bar**:
   - Debounced search input querying contract ID (e.g. `24CD0103`), project title, contractor, or municipality.
   - Dropdown results displaying contract ID, title, contractor, budget, and status.
   - **Cinematic Zoom Animation**: When a result is selected:
     ```ts
     map.flyTo({
       center: [lng, lat],
       zoom: 16,
       pitch: 45,
       duration: 2200,
       essential: true,
     });
     ```
   - Automatically opens a clean Mapbox popup card on the pin with a prominent **`View Full Dossier →`** button navigating to `/projects/[id]`.
3. **In-HUD "Near Me" Geolocation Radar**:
   - Dedicated GPS button inside the HUD.
   - On click: triggers `navigator.geolocation.getCurrentPosition()`.
   - Smoothly executes `map.flyTo({ center: [userLng, userLat], zoom: 14, duration: 2000 })`.
   - Places a pulsating user location beacon and filters map pins to a 5km radius.
4. **Territory Drill-Down Selectors**:
   - Compact dropdown cascade: `Philippines` > `Region` > `Province` > `Municipality`.
   - Updates the inverted polygon boundary mask spotlighting the selected administrative unit.
5. **Clean Anomaly Filter Pills (Zero Emojis)**:
   - High-contrast pill filters styled in navy with solid micro-status dots:
     - `ALL`
     - `OVERDUE` (solid amber dot `#f59e0b`)
     - `STALLED` (solid yellow dot `#eab308`)
     - `GHOST RISK` (solid crimson dot `#ef4444`)
     - `NEVER STARTED` (solid slate dot `#64748b`)

### 4.2 Map Pin Interaction (No Slide Drawer)
* Clicking any individual map marker displays a concise Mapbox popup card:
  - **Project Name** (cleaned of bureaucratic prefixes)
  - **Contractor Name**
  - **Budget (PHP)** & **Physical Progress %**
  - **Status Indicator** (e.g., `[STATUS: DELAYED]`, `[STATUS: ON-GOING]`)
  - **Action Button**: Primary pill button **`View Full Dossier →`** that routes directly to `/projects/[id]`.
* Complete removal of `ProjectInspectionDrawer`, keeping the entire viewport dedicated to the map.

---

## 5. Detailed Project Dossier (`/projects/[id]`) Redesign

### 5.1 Aesthetic & Visual Hierarchy (Homepage Theme)
* **Hero Banner**:
  - Deep Navy background (`#011438` / `#01367d`) with subtle overlay grid lines.
  - `#ffb241` gold accents for brand badges and milestone highlights.
  - Breadcrumb navigation: `MAPATUNAI > Region > Province > Contract ID`.
  - Project Title in bold, high-contrast white text (`font-black tracking-tight`).
* **Zero AI Slop / Zero Emojis**:
  - All emojis (`🚨`, `⚠️`, `⚡`, `🇵🇭`, etc.) removed.
  - Status indicators rendered as clean, high-contrast monospace tags:
    - `<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-700 text-rose-300 text-xs font-mono font-bold"><span className="h-2 w-2 rounded-full bg-rose-500" />GHOST RISK / OVERPAID</span>`
    - `<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-700 text-amber-300 text-xs font-mono font-bold"><span className="h-2 w-2 rounded-full bg-amber-500" />OVERDUE (142 DAYS)</span>`
    - `<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-600 text-slate-300 text-xs font-mono font-bold">CATEGORY: FLOOD CONTROL</span>`

### 5.2 Key Information Sections

#### 1. Contract & Financial Ledger (Tabular, No Recharts)
* Replaces Recharts SVG graphs with a crisp 4-metric summary card:
  - **Allocated Budget**: e.g., `₱48,250,000.00`
  - **Amount Disbursed**: e.g., `₱41,012,500.00 (85.0%)`
  - **Physical Progress**: e.g., `22.5% Claimed`
  - **Financial Variance**: `+62.5% Payout Gap` (highlighted in crimson when payout significantly outpaces physical completion)
* Clear dual-progress bar showing Disbursed % vs Physical Progress % side-by-side.

#### 2. AI Satellite Ground-Truth Verification Engine
* **ESRI Wayback Satellite Time Machine (2014–2026)**:
  - Scrub multi-year high-resolution satellite imagery directly at the project GPS coordinates.
  - "Start Date vs. Latest Pass" quick toggle button for instantaneous ground-truth comparison.
* **AI Satellite Multimodal Vision Audit**:
  - Powered by Gemini Vision analyzing the coordinate imagery against the contract title and declared completion.
  - Outputs an objective, non-slop audit card:
    - **Ground-Truth Match Confidence**: `High Confidence` | `Discrepancy Detected` | `Under Review`
    - **Factual Telemetry Observation**: Clear, factual statement detailing visible ground structures (or lack thereof) across capture years.

#### 3. Bill of Quantities (BOQ) Regional Price Benchmark Audit
* Clean, sortable table displaying civil works line items (Excavation, Concrete, Rebar, Mobilization).
* Highlights items billed at $\ge 30\%$ above regional PSA/DPWH price benchmarks.
* Mobilization costs $>5\%$ of total budget highlighted with `[INFLATED MOBILIZATION]`.

#### 4. Verified Eyewitness Community Reports
* Chronological feed of citizen reports verified by 15km GPS geofencing and SMS OTP.
* Displays eyewitness photos, timestamp, structural quality rating, and local corroboration counts.

---

## 6. Implementation Milestones (5.5-Hour Allocation)

| Phase | Duration | Scope of Work |
| :--- | :--- | :--- |
| **Phase 1: Subsystem Pruning & Dependencies** | 45 mins | Delete `/engineers` routes, delete Chatbot component & API, remove Sigma and Recharts from `package.json`, update top navigation header. |
| **Phase 2: In-HUD Search & Near Me on Mapbox** | 90 mins | Rebuild floating Map HUD with homepage navy aesthetic, integrated live search with `flyTo` camera zoom animation, "Near Me" GPS radar, and remove drawer. |
| **Phase 3: Detailed Project Dossier Redesign** | 90 mins | Redesign `/projects/[id]` to homepage aesthetic (`#011438` / `#01367d` / `#ffb241`), purge all emojis, replace charts with tabular ledger, integrate AI satellite vision card. |
| **Phase 4: Global Brand Standardization & Polish** | 45 mins | Replace all "PhilTrace" references with "MAPATUNAI", audit all pages for emojis and banner badges. |
| **Phase 5: Verification & Production Build** | 30 mins | Run `npx tsc --noEmit` and `npm run build`, verifying 0 errors and zero regressions. |

---
