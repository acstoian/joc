"use client";

/**
 * RevealScreen — in-place correct/wrong feedback + distribution + leaderboard (PLAY-05/06).
 *
 * Rendered for phase "revealed" by GameView in page.tsx.
 * Receives state and status as props — never calls useGameSync (Pitfall 3).
 *
 * All questions are always Andrei vs Cristina — A = Andrei, B = Cristina.
 *
 * Card feedback:
 *   - Correct option: gold glow + CheckCircle2 + "Corect!" text
 *   - Guest's wrong locked choice: red overlay + XCircle + "Greșit" text
 *   - Neither: dim opacity-50
 *   - No modal — in-place on the same layout (D-06)
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

// ── Types ──────────────────────────────────────────────────────────────────────

type Choice = "A" | "B";

interface RevealScreenProps {
  state: GameStateSnapshot;
  status: SyncStatus;
}

// ── Name map (A = Andrei, B = Cristina) ───────────────────────────────────────

const NAMES: Record<Choice, string> = { A: "Andrei", B: "Cristina" };

// ── Card class derivation for revealed phase ──────────────────────────────────

function getRevealClass(option: Choice, state: GameStateSnapshot): string {
  const isCorrect = state.correctOption === option;
  const isMyAnswer = state.myAnswer === option;

  const base =
    "w-full min-h-[88px] rounded-xl flex flex-row items-center gap-4 px-5 py-4";

  if (isCorrect) {
    return cn(
      base,
      "glass-gold border-2 border-gold text-champagne",
      "shadow-[0_0_20px_0_rgba(212,168,67,0.35)]"
    );
  }

  if (isMyAnswer && !isCorrect) {
    return cn(base, "border-2 border-red-500/40 text-champagne bg-red-500/10");
  }

  return cn(base, "border border-champagne/10 opacity-50");
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

  // Helper: render one reveal card (Andrei or Cristina)
  function RevealCard({ option }: { option: Choice }) {
    const name = NAMES[option];
    const isCorrect = state.correctOption === option;
    const isMyAnswer = state.myAnswer === option;
    const isWrong = isMyAnswer && !isCorrect;

    return (
      <div
        className={getRevealClass(option, state)}
        aria-label={`${name}${isCorrect ? " — Corect" : ""}${isWrong ? " — Greșit" : ""}`}
      >
        {/* Name — large, color-coded */}
        <span
          className={cn(
            "text-2xl font-bold font-heading flex-1",
            isCorrect
              ? "text-gold-bright"
              : isWrong
              ? "text-red-400"
              : "text-champagne/50"
          )}
        >
          {name}
        </span>

        {/* Result badge — right-aligned */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isCorrect && (
            <span className="flex items-center gap-1 text-xs font-semibold text-gold-bright">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
              Corect!
            </span>
          )}
          {isWrong && (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-400">
              <XCircle className="size-4 shrink-0" aria-hidden="true" />
              Greșit
            </span>
          )}
        </div>
      </div>
    );
  }

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

        {/* Andrei / Cristina reveal cards — in-place (D-06) */}
        <div className="flex flex-col gap-4 w-full max-w-md mx-auto">
          <RevealCard option="A" />
          <RevealCard option="B" />
        </div>

        {/* Distribution bars — labeled with names */}
        {state.distribution !== null && (
          <div className="flex flex-col gap-3 w-full max-w-md mx-auto">
            {(["A", "B"] as Choice[]).map((opt) => {
              const pct = opt === "A" ? pctA : pctB;
              const isCorrect = state.correctOption === opt;
              return (
                <div key={opt} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-champagne-dim font-medium">
                      {NAMES[opt]}
                    </span>
                    <span className="text-champagne tabular-nums font-semibold">
                      {pct}%
                    </span>
                  </div>
                  <div className="bg-ink-muted rounded-full overflow-hidden h-4">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-500 ease-out",
                        isCorrect ? "bg-gold-bright" : "bg-champagne-dim/25"
                      )}
                      style={{ width: `${pct}%` }}
                      role="presentation"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </motion.main>
  );
}
