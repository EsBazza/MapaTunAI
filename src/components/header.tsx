'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Map, Building2, Search } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/map', label: 'Map', icon: Map },
  { href: '/contractors', label: 'Contractors', icon: Building2 },
  { href: '/search', label: 'Search', icon: Search },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-line bg-surface/90 backdrop-blur-md supports-[backdrop-filter]:bg-surface/75">
      <div className="mx-auto flex h-full w-full items-center justify-between gap-4 px-4 sm:px-6 md:px-10">
        <Link href="/" className="flex shrink-0 items-center rounded-md" aria-label="MAPATUNAI home">
          <Image
            src="/MAPATUNAI.png"
            alt="MAPATUNAI"
            width={1080}
            height={424}
            className="h-9 w-auto"
            priority
          />
        </Link>

        <nav aria-label="Primary">
          <ul className="flex items-center gap-1 sm:gap-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 sm:px-4 text-sm font-semibold transition-colors duration-200 ${
                      active
                        ? 'bg-navy text-white'
                        : 'text-ink-muted hover:bg-sunken hover:text-navy'
                    }`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
