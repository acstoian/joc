"use client";

/**
 * RevealDisplay — revealed phase screen for the TV display surface (D-04, D-05, DISP-05, DISP-06).
 *
 * Same question + identity cards + bars layout as LockedDisplay, with reveal styling applied:
 *   - Correct identity card: glass-gold + border-gold-bright + gold glow + scale-[1.03]
 *   - Incorrect identity wrapper: opacity-40
 *   - Correct bar fill: bg-gold-bright instead of bg-gold
 *
 * All questions are Andrei vs Cristina — names replace A/B labels everywhere.
 * After the bars: .thin-divider + staggered top-5 leaderboard (inline motion.ol/li, D-03).
 * Reduced-motion: plain <ol>/<li> list with no stagger.
 *
 * Critical corrections applied:
 *   - Guards state.distribution against null (correction #4)
 *   - Guards state.correctOption (correction #5) — null-safe but will be set in revealed phase
 *   - Uses state.currentQuestion?.body (correction #1)
 *   - static "Întrebarea" label (correction #3)
 *   - LeaderboardPanel replaced by inline stagger (Plan 07-02)
 *   - No new files created — NameWithBar defined locally within this file
 */

import { motion, useReducedMotion } from "motion/react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { GameStateSnapshot } from "@/hooks/useGameSync";

// ── Local rank helpers ─────────────────────────────────────────────────────────

function getRankClasses(rank: number): string {
  if (rank === 1) return "text-gold-bright font-bold";
  if (rank <= 3) return "text-champagne";
  return "text-champagne-dim";
}

function getScoreClasses(rank: number): string {
  if (rank === 1) return "text-gold-bright font-bold";
  return "text-gold";
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

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
        {/* Bar track */}
        <div className="flex-1 h-[1.5vh] rounded-full bg-ink-muted overflow-hidden">
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
  const shouldReduce = useReducedMotion();
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

      {/* Question text */}
      <h2
        className={cn(
          "text-[6vw] font-bold font-heading text-champagne",
          "text-center leading-snug max-w-[80vw]"
        )}
      >
        {q?.body ?? "Se încarcă întrebarea..."}
      </h2>

      {/* Andrei / Cristina identity cards with reveal styling + bars */}
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

      {/* After-reveal top-5 leaderboard (DISP-06, D-05, D-03) — staggered */}
      <div className="w-full max-w-[55vw] mx-auto">
        <div className="thin-divider" />
        <div className="transform scale-150 origin-top">
          {state.leaderboard.length > 0 && (
            <div className="flex flex-col gap-0 w-full max-w-md mx-auto mt-6">
              <h3 className="text-base font-bold font-heading text-champagne text-center mb-4">
                Clasament
              </h3>
              {shouldReduce ? (
                <ol role="list" className="flex flex-col">
                  {state.leaderboard.slice(0, 5).map((entry, index) => {
                    const rank = index + 1;
                    const isLast = index === Math.min(5, state.leaderboard.length) - 1;
                    return (
                      <li key={`${entry.name}-${entry.score}-${index}`}>
                        <div className="flex items-center gap-3 py-3 px-2">
                          <span className="text-sm text-champagne-dim w-6 text-right shrink-0">#{rank}</span>
                          <span className={`flex-1 text-base truncate ${getRankClasses(rank)}`}>{entry.name}</span>
                          <span className={`text-sm tabular-nums ${getScoreClasses(rank)} shrink-0`}>{entry.score} pt</span>
                        </div>
                        {!isLast && <Separator className="bg-champagne/10" />}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <motion.ol
                  role="list"
                  className="flex flex-col"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {state.leaderboard.slice(0, 5).map((entry, index) => {
                    const rank = index + 1;
                    const isLast = index === Math.min(5, state.leaderboard.length) - 1;
                    return (
                      <motion.li key={`${entry.name}-${entry.score}-${index}`} variants={rowVariants}>
                        <div className="flex items-center gap-3 py-3 px-2">
                          <span className="text-sm text-champagne-dim w-6 text-right shrink-0">#{rank}</span>
                          <span className={`flex-1 text-base truncate ${getRankClasses(rank)}`}>{entry.name}</span>
                          <span className={`text-sm tabular-nums ${getScoreClasses(rank)} shrink-0`}>{entry.score} pt</span>
                        </div>
                        {!isLast && <Separator className="bg-champagne/10" />}
                      </motion.li>
                    );
                  })}
                </motion.ol>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
