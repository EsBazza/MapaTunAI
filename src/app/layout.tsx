import type { Metadata, Viewport } from 'next';
import { Archivo, JetBrains_Mono, Public_Sans } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/lib/query-client';
import { Header } from '@/components/header';
import { MainLayoutWrapper } from '@/components/main-layout-wrapper';

const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-public-sans',
  display: 'swap',
});

// Only body text is needed on every page, so only Public Sans is preloaded.
// Archivo (headings) and JetBrains Mono (labels) load when a page uses them.
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: "MAPATUNAI: Mapping What's Real — Exposing Ghost Projects Across the Philippines",
  description: "MAPATUNAI: Mapping What's Real — Exposing Ghost Projects Across the Philippines. Track, investigate, and verify public infrastructure contracts with citizen truth and satellite proof.",
};

export const viewport: Viewport = {
  themeColor: '#011438',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${publicSans.variable} ${archivo.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-canvas text-ink antialiased overflow-x-hidden">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-amber focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-navy-950"
        >
          Skip to content
        </a>
        <QueryProvider>
          <Header />
          <MainLayoutWrapper>
            {children}
          </MainLayoutWrapper>
        </QueryProvider>
      </body>
    </html>
  );
}
