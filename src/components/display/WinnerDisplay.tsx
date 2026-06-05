"use client";

/**
 * WinnerDisplay — winner screen for the TV display surface (D-06, DISP-07).
 *
 * #1 player in a cinematic gold hero slot (trophy + gold name) with the full
 * ranked leaderboard below. Rendered when state.phase === "ended".
 *
 * No canvas-confetti — confetti is guest-side only (Phase 5).
 */

import { Trophy } from "lucide-react";
import type { GameStateSnapshot } from "@/hooks/useGameSync";
import { LeaderboardPanel } from "@/components/guest/LeaderboardPanel";

export function WinnerDisplay({ state }: { state: GameStateSnapshot }) {
  // Correction 2: guard against empty leaderboard
  const winner = state.leaderboard[0] ?? null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-[4vh] px-[5vw] py-[5vh]">

      {/* Heading */}
      <h1 className="text-[6vw] font-bold font-heading text-champagne text-center">
        Câștigător!
      </h1>

      <div className="thin-divider" />

      {/* #1 hero slot — only rendered when a winner exists */}
      {winner && (
        <div
          className="glass-gold rounded-3xl flex flex-col items-center gap-[2vh] px-[6vw] py-[4vh] border border-gold/30 shadow-[0_0_60px_0_rgba(212,168,67,0.3)]"
        >
          <Trophy
            className="text-gold-bright w-[5vw] h-[5vw]"
            aria-hidden="true"
          />
          {/* Correction 1: winner name + score */}
          <p className="text-[6vw] font-bold font-heading text-gold-bright text-center">
            {winner.name}
          </p>
          <p className="text-[2vw] font-normal font-body text-champagne-dim">
            {winner.score} răspunsuri corecte
          </p>
        </div>
      )}

      <div className="thin-divider" />

      <h2 className="text-[4vw] font-bold font-heading text-champagne text-center">
        Clasament final
      </h2>

      {/* Full leaderboard with Finding 5 scale wrapper */}
      <div className="w-full max-w-[55vw] mx-auto transform scale-150 origin-top">
        <LeaderboardPanel leaderboard={state.leaderboard} />
      </div>

      <p className="text-[1.5vw] font-normal font-body text-champagne-dim/60 text-center mt-[3vh]">
        Felicitări tuturor!
      </p>
    </div>
  );
}
