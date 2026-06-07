"use client";

/**
 * WinnerDisplay — end-game screen for the TV display surface (DISP-07).
 *
 * Shows top-3 players as equal-weight glass rows — no winner declaration,
 * just a fun recap. All content fits within one viewport (h-dvh, no scroll)
 * so it reads cleanly when projected on a screen.
 *
 * Confetti fires once on mount. Skipped under prefers-reduced-motion.
 */

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import type { GameStateSnapshot } from "@/hooks/useGameSync";

const RANK_COLORS = [
  "text-gold-bright",   // #1
  "text-champagne",     // #2
  "text-champagne-dim", // #3
];

export function WinnerDisplay({ state }: { state: GameStateSnapshot }) {
  const confettiFired = useRef(false);
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    if (shouldReduce !== false) return;
    if (confettiFired.current) return;
    confettiFired.current = true;
    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { x: 0.5, y: 0.3 },
        colors: ["#f0c060", "#f5e6c8", "#d4a843", "#e8a0a0"],
      });
    });
  }, [shouldReduce]);

  const top3 = state.leaderboard.slice(0, 3);

  return (
    /* h-dvh — hard lock to one screen, no scroll */
    <div className="h-dvh flex flex-col items-center justify-center gap-[4vh] px-[8vw]">

      <h1 className="text-[5vw] font-bold font-heading text-champagne text-center">
        Mulțumim tuturor!
      </h1>

      <div className="thin-divider w-full max-w-[60vw]" />

      {/* Top-3 player rows — equal visual weight, no hierarchy */}
      {top3.length > 0 ? (
        <div className="flex flex-col gap-[2vh] w-full max-w-[60vw]">
          {top3.map((entry, i) => (
            <div
              key={`${entry.name}-${entry.score}-${i}`}
              className="glass rounded-2xl flex items-center gap-[2vw] px-[3vw] py-[2.5vh] border border-champagne/10"
            >
              <span className={cn("text-[2.5vw] font-bold font-body w-[3vw] text-right shrink-0 tabular-nums", RANK_COLORS[i])}>
                #{i + 1}
              </span>
              <span className="flex-1 text-[3.5vw] font-bold font-heading text-champagne truncate">
                {entry.name}
              </span>
              <span className="text-[2.5vw] font-bold font-body text-gold tabular-nums shrink-0">
                {entry.score} pt
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[2vw] text-champagne-dim/60">Nu există jucători înregistrați.</p>
      )}

      <div className="thin-divider w-full max-w-[60vw]" />

      <p className="text-[1.8vw] font-normal font-body text-champagne-dim/50 text-center">
        Cristina &amp; Andrei · 26.09.2026
      </p>
    </div>
  );
}
