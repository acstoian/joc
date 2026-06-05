"use client";

/**
 * QuestionDisplay — question phase screen for the TV display surface (D-02, DISP-03).
 *
 * Full-screen centered layout with a slide-up question text + two A/B option cards.
 * NO percentage bars — suspense is maintained while voting is open.
 *
 * Critical corrections applied:
 *   - Uses state.currentQuestion?.body (not .text) per correction #1
 *   - Uses state.currentQuestion?.optionA / .optionB per correction #2
 *   - Static "Întrebarea" label — no index per correction #3
 *   - Guards null currentQuestion with fallback per correction #6
 *   - key={state.currentQuestionId} on h2 re-mounts on every question change,
 *     re-triggering the slide-up animation
 */

import { cn } from "@/lib/utils";
import type { GameStateSnapshot } from "@/hooks/useGameSync";

// ── Internal helper ────────────────────────────────────────────────────────────

interface OptionCardProps {
  option: "A" | "B";
  text: string;
}

function OptionCard({ option, text }: OptionCardProps) {
  return (
    <div
      className={cn(
        "glass rounded-2xl",
        "flex flex-col items-center justify-center gap-[1.5vh]",
        "px-[4vw] py-[3vh] min-h-[18vh]"
      )}
    >
      {/* Letter prefix label */}
      <span
        className={cn(
          "text-[1.5vw] font-normal font-body",
          "text-champagne-dim/70 uppercase tracking-[0.3em]"
        )}
      >
        {option}
      </span>

      {/* Option text */}
      <span className="text-[2vw] font-normal font-body text-champagne text-center">
        {text}
      </span>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function QuestionDisplay({ state }: { state: GameStateSnapshot }) {
  const q = state.currentQuestion;

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col items-center justify-center",
        "gap-[5vh] px-[5vw]"
      )}
    >
      {/* Question phase label — static, no index */}
      <p
        className={cn(
          "text-[1.5vw] font-normal font-body",
          "text-champagne-dim/70 text-center uppercase tracking-widest"
        )}
      >
        Întrebarea
      </p>

      {/* Question text — key triggers re-mount + re-animation on question change */}
      <h2
        key={state.currentQuestionId}
        className={cn(
          "text-[6vw] font-bold font-heading text-champagne",
          "text-center leading-snug max-w-[80vw]",
          "[animation:slide-up_400ms_ease-out_forwards]"
        )}
      >
        {q?.body ?? "Se încarcă întrebarea..."}
      </h2>

      {/* A/B option cards — side by side, no bars */}
      <div className="grid grid-cols-2 gap-[3vw] w-full max-w-[90vw]">
        <OptionCard option="A" text={q?.optionA ?? "A"} />
        <OptionCard option="B" text={q?.optionB ?? "B"} />
      </div>
    </div>
  );
}
