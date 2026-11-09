/**
 * Loading placeholder with a soft light sweep. Pure CSS (runs off the main
 * thread, so it stays smooth while data loads). Size it with className,
 * e.g. <Shimmer className="h-4 w-2/3" />. Use tone="dark" on navy surfaces.
 */
export function Shimmer({ className = '', tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  return (
    <span
      aria-hidden="true"
      className={`shimmer block rounded-lg ${tone === 'dark' ? 'shimmer-dark' : ''} ${className}`}
    />
  );
}
