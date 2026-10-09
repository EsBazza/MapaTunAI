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
