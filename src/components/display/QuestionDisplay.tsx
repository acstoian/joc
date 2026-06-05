"use client";

/**
 * QuestionDisplay — question phase screen for the TV display surface (D-02, DISP-03).
 *
 * STUB — replaced by Plan 06-02 with the full question + option layout.
 * Uses the real prop signature so DisplayPage (06-01) and 06-02 are drop-in compatible.
 *
 * Note: uses state.currentQuestion.body (not .text) per Critical Correction #2.
 */

import type { GameStateSnapshot } from "@/hooks/useGameSync";

interface QuestionDisplayProps {
  state: GameStateSnapshot;
}

export function QuestionDisplay({ state }: QuestionDisplayProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink">
      <p className="text-[2vw] font-body text-champagne-dim">
        {state.currentQuestion?.body ?? ""}
      </p>
    </div>
  );
}
