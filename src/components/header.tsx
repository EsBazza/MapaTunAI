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

        {/* Middle: Navigation Links */}
        <nav className="flex items-center gap-6 sm:gap-8 text-sm font-bold text-[#01367d]">
          <Link href="/" className="hover:text-[#ffb241] transition-colors whitespace-nowrap">
            Home
          </Link>
          <Link href="/map" className="hover:text-[#ffb241] transition-colors whitespace-nowrap">
            Interactive Map
          </Link>
          <Link href="/contractors" className="hover:text-[#ffb241] transition-colors whitespace-nowrap">
            Contractors
          </Link>
        </nav>

        {/* Right: Map Quick Action CTA */}
        <div className="flex items-center gap-3">
          <Link
            href="/map"
            className="hidden sm:inline-flex items-center gap-2 rounded-full bg-[#01367d] px-5 py-2 text-xs font-black text-white hover:bg-[#ffb241] hover:text-[#011438] transition-all shadow-sm"
          >
            Launch Map &rarr;
          </Link>
        </div>
      </div>
    </header>
  );
}
