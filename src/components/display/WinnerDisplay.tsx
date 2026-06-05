"use client";

/**
 * WinnerDisplay — ended phase screen for the TV display surface (D-06, DISP-07).
 *
 * STUB — replaced by Plan 06-03 with the full winner hero slot (#1 in gold,
 * trophy icon) and ranked full leaderboard.
 * Uses the real prop signature so DisplayPage (06-01) and 06-03 are drop-in compatible.
 */

import type { GameStateSnapshot } from "@/hooks/useGameSync";

interface WinnerDisplayProps {
  state: GameStateSnapshot;
}

export function WinnerDisplay({ state }: WinnerDisplayProps) {
  const winner = state.leaderboard[0];
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink">
      <p className="text-[2vw] font-body text-champagne-dim">
        {winner ? `${winner.name} — ${winner.score} pt` : ""}
      </p>
    </div>
  );
}
