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
