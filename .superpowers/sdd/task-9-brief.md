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
