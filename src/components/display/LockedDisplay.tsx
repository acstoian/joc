"use client";

/**
 * LockedDisplay — locked phase screen for the TV display surface (D-03, DISP-04).
 *
 * Same question + identity cards layout as QuestionDisplay, but with live A/B percentage
 * bars that fill smoothly as votes arrive from useGameSync re-fetches.
 * All questions are Andrei vs Cristina — the names replace A/B labels everywhere.
 *
 * Critical corrections applied:
 *   - Guards state.distribution against null: const dist = state.distribution ?? { A: 0, B: 0 }
 *   - Uses state.currentQuestion?.body (not .text, correction #1)
 *   - No slide-up animation on the question h2 in the locked phase (phase change, not new question)
 *   - static "Întrebarea" label (correction #3)
 */

import { cn } from "@/lib/utils";
import type { GameStateSnapshot } from "@/hooks/useGameSync";

// ── Internal helpers ───────────────────────────────────────────────────────────

interface NameWithBarProps {
  name: string;
  pct: number;
}

function NameWithBar({ name, pct }: NameWithBarProps) {
  return (
    <div className="flex flex-col gap-[1.5vh]">
      {/* Identity card — glass, no gold treatment yet */}
      <div
        className={cn(
          "glass rounded-2xl",
          "flex items-center justify-center",
          "px-[4vw] py-[3vh] min-h-[18vh]"
        )}
      >
        <span className="text-[4vw] font-bold font-heading text-champagne text-center">
          {name}
        </span>
      </div>

      {/* Percentage row: bar track + percentage label */}
      <div className="flex items-center gap-[1.5vw]">
        {/* Bar track */}
        <div className="flex-1 h-[1.5vh] rounded-full bg-ink-muted overflow-hidden">
          {/* Bar fill — transition-[width] animates as pct changes on each re-fetch */}
          <div
            className="h-full rounded-full bg-gold transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Percentage label */}
        <span
          className={cn(
            "text-[2vw] font-bold font-body text-champagne tabular-nums",
            "w-[5vw] text-right shrink-0"
          )}
        >
          {pct}%
        </span>
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function LockedDisplay({ state }: { state: GameStateSnapshot }) {
  const q = state.currentQuestion;

  // Guard distribution against null (correction #4)
  const dist = state.distribution ?? { A: 0, B: 0 };
  const total = dist.A + dist.B;
  const pctA = total > 0 ? Math.round((dist.A / total) * 100) : 0;
  const pctB = total > 0 ? 100 - pctA : 0;

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col items-center justify-center",
        "gap-[4vh] px-[5vw]"
      )}
    >
      {/* Question phase label — static */}
      <p
        className={cn(
          "text-[1.5vw] font-normal font-body",
          "text-champagne-dim/70 text-center uppercase tracking-widest"
        )}
      >
        Întrebarea
      </p>

      {/* Question text — no slide-up animation (this is a phase change, not new question) */}
      <h2
        className={cn(
          "text-[6vw] font-bold font-heading text-champagne",
          "text-center leading-snug max-w-[80vw]"
        )}
      >
        {q?.body ?? "Se încarcă întrebarea..."}
      </h2>

      {/* Locked notice */}
      <p
        className={cn(
          "text-[1.5vw] font-normal font-body",
          "text-champagne-dim/60 text-center"
        )}
      >
        Răspunsurile au fost blocate
      </p>

      {/* Andrei / Cristina cards with live-filling percentage bars */}
      <div className="grid grid-cols-2 gap-[3vw] w-full max-w-[90vw]">
        <NameWithBar name={q?.optionA ?? "Andrei"} pct={pctA} />
        <NameWithBar name={q?.optionB ?? "Cristina"} pct={pctB} />
      </div>
    </div>
  );
}
