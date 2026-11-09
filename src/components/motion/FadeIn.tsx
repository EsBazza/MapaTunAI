'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/** Strong ease-out (same curve as --ease-out-expo in globals.css). */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

interface FadeInProps {
  children: ReactNode;
  className?: string;
  /** Seconds before the reveal starts. */
  delay?: number;
  /** Distance to rise from, in px. Ignored with reduced motion. */
  y?: number;
  /** Reveal on mount instead of when scrolled into view. */
  immediate?: boolean;
  as?: 'div' | 'section' | 'li' | 'article' | 'header';
}

/**
 * Fades and lifts content in the first time it scrolls into view.
 * Uses the full transform string so it stays on the compositor under load.
 * Reduced motion: opacity only.
 */
export function FadeIn({ children, className, delay = 0, y = 8, immediate = false, as = 'div' }: FadeInProps) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  const hidden = reduce ? { opacity: 0 } : { opacity: 0, transform: `translateY(${y}px)` };
  const shown = reduce ? { opacity: 1 } : { opacity: 1, transform: 'translateY(0px)' };
  const transition = { duration: reduce ? 0.15 : 0.25, ease: EASE_OUT, delay };

  if (immediate) {
    return (
      <Tag className={className} initial={hidden} animate={shown} transition={transition}>
        {children}
      </Tag>
    );
  }

  return (
    <Tag
      className={className}
      initial={hidden}
      whileInView={shown}
      viewport={{ once: true, margin: '-60px' }}
      transition={transition}
    >
      {children}
    </Tag>
  );
}
