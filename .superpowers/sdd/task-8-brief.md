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
