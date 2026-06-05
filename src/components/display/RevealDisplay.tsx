"use client";

/**
 * RevealDisplay — revealed phase screen for the TV display surface (D-04, D-05, DISP-05, DISP-06).
 *
 * STUB — replaced by Plan 06-02 with the full reveal effect (gold glow on correct bar,
 * opacity-40 on wrong bar) and top-5 leaderboard below.
 * Uses the real prop signature so DisplayPage (06-01) and 06-02 are drop-in compatible.
 */

import type { GameStateSnapshot } from "@/hooks/useGameSync";

interface RevealDisplayProps {
  state: GameStateSnapshot;
}

export function RevealDisplay({ state }: RevealDisplayProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink">
      <p className="text-[2vw] font-body text-champagne-dim">
        {state.currentQuestion?.body ?? ""}
      </p>
    </div>
  );
}
