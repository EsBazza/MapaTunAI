'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import Image from 'next/image';

/**
 * Background "stage" for the landing hero: a night photograph of a
 * cable-stayed bridge with a broken span. The missing deck is three cut-out
 * pieces layered over an inpainted base, so the repair is real motion: the
 * segments glide back into place and the bridge lights come up.
 *
 * Everything is positioned in the source photo's pixel space (2500 × 1667),
 * so it stays locked to the bridge at any screen size.
 * Assets: scripts/make-hero-bridge.py. Photo: "Columbus Olentangy River bridge
 * at night", Derek Jensen (Tysto), Wikimedia Commons — public domain.
 */

export type BridgePhase = 'broken' | 'repairing' | 'repaired' | 'breaking';

const IMG_W = 2500;
const IMG_H = 1667;
const FOCUS = { x: 465, y: 1232 }; // centre of the broken span

const PIECES = [
  { src: '/hero/bridge-piece-1.png', x: 252, y: 1114, w: 159, h: 210 },
  { src: '/hero/bridge-piece-2.png', x: 384, y: 1118, w: 162, h: 220 },
  { src: '/hero/bridge-piece-3.png', x: 525, y: 1122, w: 152, h: 230 },
];

// Broken poses: two segments hang from the stubs, the middle one has fallen.
const BROKEN = [
  { transform: 'translateY(4%) rotate(34deg)', origin: '2% 8%' },
  { transform: 'translate(8%, 118%) rotate(17deg)', origin: '50% 50%' },
  { transform: 'translateY(3%) rotate(-41deg)', origin: '98% 8%' },
];

// Repair: one smooth, unhurried glide per segment — the middle first, then each side.
export const LIFT_MS = 1400;
const LIFT_DELAY = [220, 0, 340];
const LIFT_EASE = 'cubic-bezier(.65, 0, .35, 1)'; // ease-in-out, no overshoot
const FALL_DELAY = [60, 0, 110];
const FALL_EASE = 'cubic-bezier(.5, 0, .75, .4)';

// The bridge lights come up as the last segment settles.
export const LIGHTS_AT = LIFT_DELAY[2] + LIFT_MS - 250;

function useCoverLayout(frameRef: React.RefObject<HTMLDivElement | null>, stageRef: React.RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const stage = stageRef.current;
    if (!frame || !stage) return;
    const place = () => {
      const W = frame.clientWidth;
      const H = frame.clientHeight;
      if (!W || !H) return;
      const wide = W / H >= 1;
      // Cover the hero, zoomed a little, with the broken span at a chosen spot
      // (left of the copy on wide screens, under it on phones).
      const scale = Math.max(W / IMG_W, H / IMG_H) * (wide ? 1.22 : 1.15);
      const w = IMG_W * scale;
      const h = IMG_H * scale;
      const target = wide ? { x: W * 0.2, y: H * 0.76 } : { x: W * 0.5, y: H * 0.84 };
      const left = Math.min(0, Math.max(W - w, target.x - FOCUS.x * scale));
      const top = Math.min(0, Math.max(H - h, target.y - FOCUS.y * scale));
      Object.assign(stage.style, { width: `${w}px`, height: `${h}px`, left: `${left}px`, top: `${top}px` });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [frameRef, stageRef]);
}

export function BridgeStage({ phase }: { phase: BridgePhase }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  useCoverLayout(frameRef, stageRef);

  const assembled = phase === 'repairing' || phase === 'repaired';

  // Preload the cut-outs so the first hover is instant.
  useEffect(() => {
    PIECES.forEach((p) => {
      const img = new window.Image();
      img.src = p.src;
    });
  }, []);

  return (
    <div ref={frameRef} aria-hidden="true" className="absolute inset-0 -z-30 overflow-hidden">
      <div ref={stageRef} className="absolute">
        {/* Softened, silhouetted photograph; the lights come up once the span is whole */}
        <div
          className="absolute inset-0 transition-[filter] ease-out"
          style={{
            filter: assembled
              ? 'blur(1.5px) brightness(0.92) contrast(1.12) saturate(0.9)'
              : 'blur(1.5px) brightness(0.55) contrast(1.2) saturate(0.45)',
            transitionDuration: assembled ? '1400ms' : '600ms',
            transitionDelay: phase === 'repairing' ? `${LIGHTS_AT}ms` : '0ms',
          }}
        >
          <Image src="/hero/bridge-base.jpg" alt="" fill priority sizes="130vw" className="object-cover" />

          {PIECES.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- tiny pre-cut sprites, positioned in photo space
            <img
              key={p.src}
              src={p.src}
              alt=""
              draggable={false}
              className="absolute will-change-transform"
              style={{
                left: `${(p.x / IMG_W) * 100}%`,
                top: `${(p.y / IMG_H) * 100}%`,
                width: `${(p.w / IMG_W) * 100}%`,
                height: `${(p.h / IMG_H) * 100}%`,
                transformOrigin: BROKEN[i].origin,
                transform: assembled ? 'none' : BROKEN[i].transform,
                filter: assembled || i !== 1 ? 'none' : 'brightness(0.5)',
                transitionProperty: 'transform, filter',
                transitionDuration: assembled ? `${LIFT_MS}ms` : '800ms',
                transitionTimingFunction: assembled ? LIFT_EASE : FALL_EASE,
                transitionDelay: `${assembled ? LIFT_DELAY[i] : FALL_DELAY[i]}ms`,
              }}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
