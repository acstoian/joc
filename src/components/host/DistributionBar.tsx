"use client";

/**
 * DistributionBar — animated Andrei/Cristina answer distribution bar (HOST-09).
 *
 * Renders a rounded bar split proportionally — gold Andrei-portion left,
 * blush Cristina-portion right — with the Andrei width animated via motion/react.
 * Labels show "Andrei: X" / "Cristina: Y" to match the player-facing buttons.
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
        aria-label="Distributie raspunsuri Andrei/Cristina"
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
        <span className="font-medium text-gold-bright">Andrei: {a}</span>
        <span className="font-medium text-blush">Cristina: {b}</span>
      </div>
    </div>
  );
}
