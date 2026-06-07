"use client";

/**
 * WinnerDisplay — winner screen for the TV display surface (D-06, DISP-07).
 *
 * #1 player in a cinematic gold hero slot (trophy + gradient name + score).
 * #2 and #3 as glass rows below — no full scrolling leaderboard on the TV.
 * TV confetti burst fires once on mount (D-09). Skipped under prefers-reduced-motion.
 */

import { useEffect, useRef } from "react";
import { Trophy, Medal } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import type { GameStateSnapshot } from "@/hooks/useGameSync";

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
  const winner = top3[0] ?? null;
  const runners = top3.slice(1); // #2 and #3

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-[4vh] px-[5vw] py-[5vh]">

      <h1 className="text-[6vw] font-bold font-heading text-champagne text-center">
        Câștigător!
      </h1>

      <div className="thin-divider" />

      {/* #1 hero slot */}
      {winner && (
        <div className="glass-gold rounded-3xl flex flex-col items-center gap-[2vh] px-[6vw] py-[4vh] border border-gold/30 shadow-[0_0_60px_0_rgba(212,168,67,0.3)]">
          <Trophy className="text-gold-bright w-[5vw] h-[5vw]" aria-hidden="true" />
          <p className="text-[6vw] font-bold font-heading text-gradient-gold text-center">
            {winner.name}
          </p>
          <p className="text-[2vw] font-normal font-body text-champagne-dim">
            {winner.score}{" "}
            {winner.score === 1 ? "răspuns corect" : "răspunsuri corecte"}
          </p>
        </div>
      )}

      {/* #2 and #3 — compact glass rows */}
      {runners.length > 0 && (
        <>
          <div className="thin-divider" />
          <div className="flex flex-col gap-[1.5vh] w-full max-w-[50vw]">
            {runners.map((entry, i) => {
              const rank = i + 2;
              return (
                <div
                  key={`${entry.name}-${entry.score}-${rank}`}
                  className={cn(
                    "glass rounded-2xl flex items-center gap-[2vw] px-[3vw] py-[2vh]",
                    rank === 2 ? "border border-champagne/25" : "border border-champagne/12"
                  )}
                >
                  <Medal
                    className={cn(
                      "w-[2.5vw] h-[2.5vw] shrink-0",
                      rank === 2 ? "text-champagne" : "text-champagne-dim/50"
                    )}
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-[3vw] font-bold font-heading text-champagne truncate">
                    {entry.name}
                  </span>
                  <span className="text-[2.5vw] font-bold font-body text-gold tabular-nums shrink-0">
                    {entry.score} pt
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="text-[1.5vw] font-normal font-body text-champagne-dim/60 text-center">
        Felicitări tuturor!
      </p>
    </div>
  );
}
