"use client";

/**
 * RevealScreen — in-place correct/wrong feedback + A/B distribution + leaderboard (PLAY-05/06).
 *
 * Rendered for phase "revealed" by GameView in page.tsx.
 * Receives state and status as props — never calls useGameSync (Pitfall 3).
 *
 * Button feedback (D-06):
 *   - Correct option: gold glow + CheckCircle2 + "Corect!" text (color NOT sole signal)
 *   - Guest's wrong locked choice: red overlay + XCircle + "Greșit" text
 *   - Neither: champagne/20 border, opacity-60
 *   - No modal — in-place on the same A/B layout (D-06)
 *
 * Distribution bar: horizontal fill based on state.distribution {A, B}.
 *   - Guards against null distribution and divide-by-zero (total = 0 → 0%)
 *
 * Leaderboard: <LeaderboardPanel> self-hides when empty (D-08).
 */

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";
import type { GameStateSnapshot, SyncStatus } from "@/hooks/useGameSync";
import { SyncStatusBadge } from "@/components/guest/SyncStatusBadge";
import { LeaderboardPanel } from "@/components/guest/LeaderboardPanel";

// ── Types ──────────────────────────────────────────────────────────────────────

type Choice = "A" | "B";

interface RevealScreenProps {
  state: GameStateSnapshot;
  status: SyncStatus;
}

// ── Button class derivation for revealed phase ────────────────────────────────

function getRevealClass(option: Choice, state: GameStateSnapshot): string {
  const isCorrect = state.correctOption === option;
  const isMyAnswer = state.myAnswer === option;

  // Horizontal layout: letter badge on left, text + result badge on right.
  // min-h-[80px] keeps consistent height with QuestionScreen buttons.
  const baseLayout =
    "w-full min-h-[80px] rounded-xl flex flex-row items-center gap-4 px-5 py-4";

  if (isCorrect) {
    return cn(
      baseLayout,
      "glass-gold border-2 border-gold text-champagne",
      "shadow-[0_0_20px_0_rgba(212,168,67,0.35)]"
    );
  }

  if (isMyAnswer && !isCorrect) {
    return cn(
      baseLayout,
      "border-2 border-red-500/40 text-champagne",
      "bg-red-500/10"
    );
  }

  // Neutral — not chosen, not correct
  return cn(baseLayout, "border border-champagne/10 opacity-50");
}

// ── Distribution percentage calculation ──────────────────────────────────────

function getPct(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RevealScreen({ state, status }: RevealScreenProps) {
  const confettiFired = useRef(false);
  const shouldReduce = useReducedMotion();

  // Correct-answer mini confetti burst — fires once on mount (D-08).
  // CRITICAL: GameStateSnapshot has NO playerAnsweredCorrectly field.
  // Derive correctness from myAnswer + correctOption (verified RESEARCH.md §CRITICAL FINDING).
  useEffect(() => {
    const answeredCorrectly =
      state.myAnswer !== null && state.myAnswer === state.correctOption;
    if (!answeredCorrectly) return;
    if (shouldReduce !== false) return;
    if (confettiFired.current) return;
    confettiFired.current = true;
    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({
        particleCount: 60,
        spread: 50,
        origin: { y: 0.6 },
        colors: ["#f0c060", "#f5e6c8", "#d4a843"],
      });
    });
  }, [state.myAnswer, state.correctOption, shouldReduce]);

  const q = state.currentQuestion;

  // Distribution — guard against null
  const distA = state.distribution?.A ?? 0;
  const distB = state.distribution?.B ?? 0;
  const total = distA + distB;
  const pctA = getPct(distA, total);
  const pctB = getPct(distB, total);

  return (
    <motion.main
      className="relative min-h-dvh bg-ink flex flex-col gap-6 px-4 pt-12 pb-[env(safe-area-inset-bottom)]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <SyncStatusBadge status={status} />

      {/* Content column */}
      <div className="flex-1 flex flex-col justify-center gap-6">
        {/* Question label */}
        <p className="text-xs text-champagne-dim/70 text-center uppercase tracking-widest">
          Rezultat
        </p>

        {/* Question body */}
        <h2 className="font-heading text-xl font-bold text-champagne text-center leading-snug px-2">
          {q?.body ?? "—"}
        </h2>

        {/* A/B reveal cards — in-place, no modal (D-06) */}
        <div className="flex flex-col gap-4 w-full max-w-md mx-auto">

          {/* Option A */}
          <div
            className={getRevealClass("A", state)}
            aria-label={`Opțiunea A: ${q?.optionA ?? "A"}${state.correctOption === "A" ? " — Corect" : ""}${state.myAnswer === "A" && state.correctOption !== "A" ? " — Greșit" : ""}`}
          >
            {/* Left: letter badge */}
            <span
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold font-heading shrink-0",
                state.correctOption === "A"
                  ? "bg-gold text-ink"
                  : state.myAnswer === "A"
                  ? "border-2 border-red-500/60 text-red-400"
                  : "border-2 border-champagne/20 text-champagne/50"
              )}
            >
              A
            </span>
            {/* Right: option text + result badge */}
            <div className="flex flex-col flex-1 gap-1 min-w-0">
              <span className="text-base text-left leading-snug">{q?.optionA ?? "A"}</span>
              {state.correctOption === "A" && (
                <span className="flex items-center gap-1 text-xs font-semibold text-gold-bright">
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                  Corect!
                </span>
              )}
              {state.myAnswer === "A" && state.correctOption !== "A" && (
                <span className="flex items-center gap-1 text-xs font-semibold text-red-400">
                  <XCircle className="size-4 shrink-0" aria-hidden="true" />
                  Greșit
                </span>
              )}
            </div>
          </div>

          {/* Option B */}
          <div
            className={getRevealClass("B", state)}
            aria-label={`Opțiunea B: ${q?.optionB ?? "B"}${state.correctOption === "B" ? " — Corect" : ""}${state.myAnswer === "B" && state.correctOption !== "B" ? " — Greșit" : ""}`}
          >
            <span
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold font-heading shrink-0",
                state.correctOption === "B"
                  ? "bg-gold text-ink"
                  : state.myAnswer === "B"
                  ? "border-2 border-red-500/60 text-red-400"
                  : "border-2 border-champagne/20 text-champagne/50"
              )}
            >
              B
            </span>
            <div className="flex flex-col flex-1 gap-1 min-w-0">
              <span className="text-base text-left leading-snug">{q?.optionB ?? "B"}</span>
              {state.correctOption === "B" && (
                <span className="flex items-center gap-1 text-xs font-semibold text-gold-bright">
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                  Corect!
                </span>
              )}
              {state.myAnswer === "B" && state.correctOption !== "B" && (
                <span className="flex items-center gap-1 text-xs font-semibold text-red-400">
                  <XCircle className="size-4 shrink-0" aria-hidden="true" />
                  Greșit
                </span>
              )}
            </div>
          </div>
        </div>

        {/* A/B Distribution bars — taller + color-coded (PLAY-06 visual) */}
        {state.distribution !== null && (
          <div className="flex flex-col gap-3 w-full max-w-md mx-auto">
            {/* A bar */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-champagne-dim font-medium">A</span>
                <span className="text-champagne tabular-nums font-semibold">{pctA}%</span>
              </div>
              <div className="bg-ink-muted rounded-full overflow-hidden h-4">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500 ease-out",
                    state.correctOption === "A" ? "bg-gold-bright" : "bg-champagne-dim/25"
                  )}
                  style={{ width: `${pctA}%` }}
                  role="presentation"
                />
              </div>
            </div>
            {/* B bar */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-champagne-dim font-medium">B</span>
                <span className="text-champagne tabular-nums font-semibold">{pctB}%</span>
              </div>
              <div className="bg-ink-muted rounded-full overflow-hidden h-4">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500 ease-out",
                    state.correctOption === "B" ? "bg-gold-bright" : "bg-champagne-dim/25"
                  )}
                  style={{ width: `${pctB}%` }}
                  role="presentation"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard — self-hides when empty (D-08) */}
      <LeaderboardPanel leaderboard={state.leaderboard} />
    </motion.main>
  );
}
