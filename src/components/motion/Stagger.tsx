'use client';

import { motion, useReducedMotion, type Variants } from 'motion/react';
import type { ReactNode } from 'react';
import { EASE_OUT } from './FadeIn';

interface StaggerProps {
  children: ReactNode;
  className?: string;
  /** Seconds between children (keep 0.03–0.08). */
  gap?: number;
  /** Animate on mount instead of when scrolled into view. */
  immediate?: boolean;
  as?: 'div' | 'ul' | 'ol' | 'section';
}

/**
 * Parent for a cascading reveal. Wrap each child in <StaggerItem>.
 * Purely decorative: it never blocks clicks while playing.
 */
export function Stagger({ children, className, gap = 0.05, immediate = false, as = 'div' }: StaggerProps) {
  const Tag = motion[as];
  const variants: Variants = {
    hidden: {},
    shown: { transition: { staggerChildren: gap } },
  };
  return (
    <Tag
      className={className}
      variants={variants}
      initial="hidden"
      {...(immediate ? { animate: 'shown' } : { whileInView: 'shown', viewport: { once: true, margin: '-40px' } })}
    >
      {children}
    </Tag>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li' | 'article';
}

export function StaggerItem({ children, className, as = 'div' }: StaggerItemProps) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  const variants: Variants = reduce
    ? { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: 0.15 } } }
    : {
        hidden: { opacity: 0, transform: 'translateY(6px)' },
        shown: { opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.25, ease: EASE_OUT } },
      };
  return (
    <Tag className={className} variants={variants}>
      {children}
    </Tag>
  );
}
