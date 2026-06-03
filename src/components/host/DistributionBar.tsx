"use client";

/**
 * DistributionBar — animated A/B answer distribution bar (HOST-09, UI-SPEC §9/§10).
 *
 * Props: a (count), b (count), optional height (px). Renders a rounded bar split
 * proportionally — gold A-portion left, blush B-portion right — with the A width
 * animated via motion/react (0.4s easeOut). Accessible as role="meter" with
 * aria-valuenow/min/max = total answers (UI-SPEC §10). Count labels "A: X" / "B: Y".
 */

import { motion } from "motion/react";

export interface DistributionBarProps {
  a: number;
  b: number;
  height?: number;
}

export function DistributionBar({ a, b, height = 8 }: DistributionBarProps) {
  const total = a + b;
  const aPct = total > 0 ? (a / total) * 100 : 50;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="meter"
        aria-label="Distributie raspunsuri A/B"
        aria-valuenow={total}
        aria-valuemin={0}
        aria-valuemax={total}
        className="relative w-full overflow-hidden rounded-full bg-ink-muted/50"
        style={{ height }}
      >
        <motion.div
          className="absolute inset-y-0 left-0 bg-gold"
          initial={false}
          animate={{ width: `${aPct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-blush"
          style={{ width: `${100 - aPct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs">
        <span className="font-medium text-gold-bright">A: {a}</span>
        <span className="font-medium text-blush">B: {b}</span>
      </div>
    </div>
  );
}
