"use client";

/**
 * LockedDisplay — locked phase screen for the TV display surface (D-03, DISP-04).
 *
 * STUB — replaced by Plan 06-02 with the full question + live A/B percentage bars.
 * Uses the real prop signature so DisplayPage (06-01) and 06-02 are drop-in compatible.
 */

import type { GameStateSnapshot } from "@/hooks/useGameSync";

interface LockedDisplayProps {
  state: GameStateSnapshot;
}

export function LockedDisplay({ state }: LockedDisplayProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink">
      <p className="text-[2vw] font-body text-champagne-dim">
        {state.currentQuestion?.body ?? ""}
      </p>
    </div>
  );
}
