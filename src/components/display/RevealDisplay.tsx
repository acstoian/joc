"use client";

/**
 * RevealDisplay — revealed phase screen for the TV display surface (D-04, D-05, DISP-05).
 *
 * Same question + identity cards + bars layout as LockedDisplay, with reveal styling:
 *   - Correct identity card: glass-gold + border-gold-bright + gold glow + scale-[1.03]
 *   - Incorrect identity wrapper: opacity-40
 *   - Correct bar fill: bg-gold-bright instead of bg-gold
 *
 * All questions are Andrei vs Cristina — names replace A/B labels everywhere.
 * No leaderboard shown here — ranking is only revealed on the final WinnerDisplay.
 */

import { cn } from "@/lib/utils";
import type { GameStateSnapshot } from "@/hooks/useGameSync";

// ── Internal helper ────────────────────────────────────────────────────────────

interface NameWithBarProps {
  option: "A" | "B";
  name: string;
  pct: number;
  correctOption: "A" | "B" | null;
}

function NameWithBar({ option, name, pct, correctOption }: NameWithBarProps) {
  const isCorrect = option === correctOption;
  const isDimmed = correctOption !== null && !isCorrect;

  return (
    <div
      className={cn(
        "flex flex-col gap-[1.5vh]",
        isDimmed && "opacity-40 transition-opacity duration-300"
      )}
    >
      {/* Identity card — gold treatment on correct, plain glass on incorrect */}
      <div
        className={cn(
          "rounded-2xl",
          "flex items-center justify-center",
          "px-[4vw] py-[3vh] min-h-[18vh]",
          isCorrect
            ? [
                "glass-gold",
                "border-2 border-gold-bright",
                "shadow-[0_0_40px_0_rgba(240,192,96,0.45)]",
                "scale-[1.03] transition-transform duration-300",
              ]
            : "glass"
        )}
      >
        <span
          className={cn(
            "text-[4vw] font-bold font-heading text-center",
            isCorrect ? "text-gradient-gold" : "text-champagne"
          )}
        >
          {name}
        </span>
      </div>

      {/* Percentage row: bar track + label */}
      <div className="flex items-center gap-[1.5vw]">
        <div className="flex-1 h-[1.5vh] rounded-full bg-ink-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-out",
              isCorrect ? "bg-gold-bright" : "bg-gold"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
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

export function RevealDisplay({ state }: { state: GameStateSnapshot }) {
  const q = state.currentQuestion;

  const dist = state.distribution ?? { A: 0, B: 0 };
  const total = dist.A + dist.B;
  const pctA = total > 0 ? Math.round((dist.A / total) * 100) : 0;
  const pctB = total > 0 ? 100 - pctA : 0;

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col items-center justify-center",
        "gap-[4vh] px-[5vw] py-[4vh]"
      )}
    >
      <p
        className={cn(
          "text-[1.5vw] font-normal font-body",
          "text-champagne-dim/70 text-center uppercase tracking-widest"
        )}
      >
        Întrebarea
      </p>

      <h2
        className={cn(
          "text-[6vw] font-bold font-heading text-champagne",
          "text-center leading-snug max-w-[80vw]"
        )}
      >
        {q?.body ?? "Se încarcă întrebarea..."}
      </h2>

      <div className="grid grid-cols-2 gap-[3vw] w-full max-w-[90vw]">
        <NameWithBar
          option="A"
          name={q?.optionA ?? "Andrei"}
          pct={pctA}
          correctOption={state.correctOption}
        />
        <NameWithBar
          option="B"
          name={q?.optionB ?? "Cristina"}
          pct={pctB}
          correctOption={state.correctOption}
        />
      </div>
    </div>
  );
}
