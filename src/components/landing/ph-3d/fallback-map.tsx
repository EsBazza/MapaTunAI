'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { type Ph3dProvince, mapHrefFor, warningLevel, warningShare } from './data';

/**
 * Flat, static version of the 3D view — used when WebGL is unavailable or the
 * visitor prefers reduced motion. Same data, same colours; circles instead of
 * columns. Each province is a real link, so it works with a keyboard.
 */
export function FallbackMap({
  provinces,
  active,
  onActiveChange,
}: {
  provinces: Ph3dProvince[];
  active: number | null;
  onActiveChange: (index: number | null) => void;
}) {
  const { viewBox, paths, maxCount } = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    const paths = provinces.map((p) =>
      p.shapes
        .map((flat) => {
          let d = '';
          for (let i = 0; i < flat.length; i += 2) {
            const x = flat[i];
            const y = -flat[i + 1]; // SVG y grows downward
            xs.push(x);
            ys.push(y);
            d += `${i === 0 ? 'M' : 'L'}${x.toFixed(3)} ${y.toFixed(3)}`;
          }
          return `${d}Z`;
        })
        .join('')
    );
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 0.6;
    return {
      viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`,
      paths,
      maxCount: Math.max(1, ...provinces.map((p) => p.count)),
    };
  }, [provinces]);

  return (
    <svg viewBox={viewBox} className="h-full w-full" role="group" aria-label="Map of provinces by number of projects">
      {provinces.map((p, i) => {
        const isActive = active === i;
        const share = warningShare(p);
        const level = warningLevel(share);
        const r = 0.08 + 0.55 * Math.sqrt(p.count / maxCount);
        return (
          <Link
            key={p.name}
            href={mapHrefFor(p)}
            aria-label={`${p.name}: ${p.count.toLocaleString('en-PH')} projects, ${(share * 100).toFixed(1)}% with warning signs. Open on the map.`}
            onMouseEnter={() => onActiveChange(i)}
            onMouseLeave={() => onActiveChange(null)}
            onFocus={() => onActiveChange(i)}
            onBlur={() => onActiveChange(null)}
            className="outline-none"
          >
            <path
              d={paths[i]}
              fill={isActive ? '#1556b5' : '#012456'}
              stroke="#ffffff"
              strokeOpacity={isActive ? 0.55 : 0.14}
              strokeWidth={0.03}
              className="transition-[fill] duration-150"
            />
            {p.count > 0 && (
              <circle
                cx={p.anchor[0]}
                cy={-p.anchor[1]}
                r={r}
                fill={level.color}
                fillOpacity={isActive ? 1 : 0.85}
                stroke="#ffffff"
                strokeOpacity={isActive ? 0.9 : 0.35}
                strokeWidth={0.03}
              />
            )}
          </Link>
        );
      })}
    </svg>
  );
}
