/**
 * StackedCard — wraps any card-shaped content and renders N phantom paper
 * layers behind it to suggest a stack of papers (no rotation).
 *
 * The total stack depth is FIXED (12px / 0.75rem) so the card occupies the
 * same grid cell regardless of how many layers are drawn. As `layers` grows
 * the spacing between layers grows TIGHTER, which works as a visual
 * "frequency / volume" cue — more layers = more compact = more content.
 *
 *   layers=1 →           12px
 *   layers=2 →    6 / 12px
 *   layers=3 →    4 / 8 / 12px
 *   layers=4 →    3 / 6 / 9 / 12px
 *
 * Each layer steps DOWN and INSETS inward equally, and gets fainter the
 * deeper it sits.
 *
 * @example
 *   <StackedCard layers={2}>
 *     <div role="button" className="rounded-lg ...">…</div>
 *   </StackedCard>
 */

import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

export type StackedCardLayers = 0 | 1 | 2 | 3 | 4 | 5;

export interface StackedCardProps {
  /** Number of phantom layers behind the front card (0–4). */
  layers?: StackedCardLayers;
  /** Border-radius class to apply to phantom layers (match front card). */
  radius?: string;
  /** Additional className applied to each phantom layer. */
  layerClassName?: string;
  /** Additional className applied to the wrapper. */
  className?: string;
  /** Front card content. */
  children: ReactNode;
}

// 12px = 0.75rem — fixed total depth so the card-plus-stack box never grows.
const MAX_DEPTH_REM = 0.75;

export function StackedCard({
  layers = 0,
  radius = "rounded-lg",
  layerClassName,
  className,
  children,
}: StackedCardProps) {
  // Build deepest-first so DOM order keeps the deepest layer behind.
  const items: Array<{ offsetRem: number; opacity: number }> = [];
  for (let depth = layers; depth >= 1; depth--) {
    const ratio = depth / layers; // 1 = deepest, 1/n = nearest
    items.push({
      offsetRem: ratio * MAX_DEPTH_REM,
      // Fade by depth ratio, not absolute index, so 5-layer stacks aren't
      // washed out: nearest = ~0.95, deepest = ~0.4.
      opacity: 1 - ratio * 0.6,
    });
  }

  return (
    <div className={cn("relative", className)}>
      {items.map((it, idx) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: phantom layers are positional, not data-bound
          key={idx}
          aria-hidden
          style={{
            top: `${it.offsetRem}rem`,
            bottom: `-${it.offsetRem}rem`,
            left: `${it.offsetRem}rem`,
            right: `${it.offsetRem}rem`,
            opacity: it.opacity,
          }}
          className={cn(
            "pointer-events-none absolute border border-border bg-card",
            radius,
            layerClassName,
          )}
        />
      ))}
      {children}
    </div>
  );
}
