import Link from 'next/link';
import Image from 'next/image';

const LINKS = [
  { href: '/map', label: 'National Map' },
  { href: '/contractors', label: 'Contractor Registry' },
  { href: '/search', label: 'Search Projects' },
];

export function SiteFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`w-full border-t border-line bg-surface ${className}`}>
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr] md:px-10">
        <div className="space-y-4">
          <Image src="/MAPATUNAI.png" alt="MAPATUNAI" width={1080} height={424} className="h-10 w-auto" />
          <p className="max-w-md text-sm leading-relaxed text-ink-muted">
            MapaTunAI is an open, public-interest civic technology tool built by{' '}
            <strong className="font-semibold text-ink">UA HOW 2</strong>. It gives every Filipino taxpayer
            satellite proof and ground-truth data to hold public works accountable.
          </p>
        </div>

        <nav aria-label="Footer" className="md:justify-self-end">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Explore</h2>
          <ul className="mt-4 space-y-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-navy underline-offset-4 transition-colors hover:text-amber-ink hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-6 py-6 text-xs leading-relaxed text-ink-subtle md:px-10">
          &copy; {new Date().getFullYear()} MapaTunAI by UA HOW 2. Contract metrics are sourced from official DPWH
          disclosures and verified citizen ground reports.
        </p>
      </div>
    </footer>
  );
}
