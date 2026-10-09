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
