"use client";

/**
 * RevealDisplay — revealed phase screen for the TV display surface (D-04, D-05, DISP-05, DISP-06).
 *
 * Same question + options + bars layout as LockedDisplay, with reveal styling applied
 * via CONDITIONAL CLASSES IN JSX (no useEffect — Pitfall 5 avoidance):
 *   - Correct option card: glass-gold + border-gold-bright + gold glow + scale-[1.03]
 *   - Incorrect option wrapper: opacity-40
 *   - Correct bar fill: bg-gold-bright instead of bg-gold
 *
 * After the bars: .thin-divider + LeaderboardPanel with top-5 entries.
 *
 * Critical corrections applied:
 *   - Guards state.distribution against null (correction #4)
 *   - Guards state.correctOption (correction #5) — null-safe but will be set in revealed phase
 *   - Uses state.currentQuestion?.body (correction #1)
 *   - static "Întrebarea" label (correction #3)
 *   - LeaderboardPanel imported unmodified from @/components/guest/LeaderboardPanel
 *   - No new files created — OptionWithBar defined locally within this file
 */

import { cn } from "@/lib/utils";
import type { GameStateSnapshot } from "@/hooks/useGameSync";
import { LeaderboardPanel } from "@/components/guest/LeaderboardPanel";

// ── Internal helper ────────────────────────────────────────────────────────────

interface OptionWithBarProps {
  option: "A" | "B";
  text: string;
  pct: number;
  correctOption: "A" | "B" | null;
}

function OptionWithBar({ option, text, pct, correctOption }: OptionWithBarProps) {
  // Reveal state: correct = gold glow + scale; incorrect = dimmed
  // Applied via JSX conditionals at render time — no useEffect needed (Pitfall 5)
  const isCorrect = correctOption !== null && option === correctOption;

  return (
    <div
      className={cn(
        "flex flex-col gap-[1.5vh]",
        // Incorrect option wrapper dims to 40% opacity (D-04)
        !isCorrect && "opacity-40 transition-opacity duration-300"
      )}
    >
      {/* Option card — gold treatment on correct, plain glass on incorrect */}
      <div
        className={cn(
          "rounded-2xl",
          "flex flex-col items-center justify-center gap-[1.5vh]",
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
        {/* Letter prefix */}
        <span
          className="text-[1.5vw] font-normal font-body text-champagne-dim/70 uppercase tracking-[0.3em]"
        >
          {option}
        </span>

        {/* Option text — gold-bright on correct */}
        <span
          className={cn(
            "text-[2vw] font-normal font-body text-center",
            isCorrect ? "text-gold-bright" : "text-champagne"
          )}
        >
          {text}
        </span>
      </div>

      {/* Percentage row: bar track + label */}
      <div className="flex items-center gap-[1.5vw]">
        {/* Bar track */}
        <div className="flex-1 h-[1.5vh] rounded-full bg-ink-muted overflow-hidden">
          {/* Bar fill — brighter on correct (bg-gold-bright), muted on incorrect (bg-gold) */}
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-out",
              isCorrect ? "bg-gold-bright" : "bg-gold"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Percentage label */}
        <span
          className={cn(
            "text-[2vw] font-bold font-body text-champagne",
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

  // Guard distribution against null (correction #4)
  const dist = state.distribution ?? { A: 0, B: 0 };
  const total = dist.A + dist.B;
  const pctA = total > 0 ? Math.round((dist.A / total) * 100) : 0;
  const pctB = total > 0 ? Math.round((dist.B / total) * 100) : 0;

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col items-center justify-center",
        "gap-[4vh] px-[5vw] py-[4vh]"
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

      {/* Question text — no animation on reveal (the reveal effect is the story) */}
      <h2
        className={cn(
          "text-[6vw] font-bold font-heading text-champagne",
          "text-center leading-snug max-w-[80vw]"
        )}
      >
        {q?.body ?? "Se încarcă întrebarea..."}
      </h2>

      {/* A/B option cards with reveal styling + bars */}
      <div className="grid grid-cols-2 gap-[3vw] w-full max-w-[90vw]">
        <OptionWithBar
          option="A"
          text={q?.optionA ?? "A"}
          pct={pctA}
          correctOption={state.correctOption}
        />
        <OptionWithBar
          option="B"
          text={q?.optionB ?? "B"}
          pct={pctB}
          correctOption={state.correctOption}
        />
      </div>

      {/* After-reveal top-5 leaderboard (DISP-06, D-05) */}
      <div className="w-full max-w-[80vw] mx-auto">
        <div className="thin-divider" />
        {/* Scale wrapper: LeaderboardPanel uses mobile px/rem sizes; scale for TV readability
            (Finding 5 from 06-RESEARCH.md). Component is imported unmodified. */}
        <div className="transform scale-150 origin-top">
          <LeaderboardPanel leaderboard={state.leaderboard.slice(0, 5)} />
        </div>
      </div>
    </div>
  );
}
