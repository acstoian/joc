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

  const baseLayout =
    "w-full min-h-[120px] rounded-xl flex flex-col items-center justify-center gap-2 px-6 py-6";

  if (isCorrect) {
    return cn(
      baseLayout,
      "border-2 border-gold-bright text-gold-bright",
      "bg-gold-muted/20",
      "shadow-[0_0_16px_0_rgba(240,192,96,0.5)]"
    );
  }

  if (isMyAnswer && !isCorrect) {
    return cn(
      baseLayout,
      "border-2 border-red-500/60 text-champagne",
      "bg-red-500/20"
    );
  }

  return cn(baseLayout, "border border-champagne/20 opacity-60");
}

// ── Distribution percentage calculation ──────────────────────────────────────

function getPct(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RevealScreen({ state, status }: RevealScreenProps) {
  const q = state.currentQuestion;

  // Distribution — guard against null
  const distA = state.distribution?.A ?? 0;
  const distB = state.distribution?.B ?? 0;
  const total = distA + distB;
  const pctA = getPct(distA, total);
  const pctB = getPct(distB, total);

  return (
    <main className="relative min-h-dvh bg-ink flex flex-col gap-6 px-4 pt-12 pb-[env(safe-area-inset-bottom)]">
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

        {/* A/B buttons — in-place reveal, no modal (D-06) */}
        <div className="flex flex-col gap-4 w-full max-w-md mx-auto">
          {/* Button A */}
          <div
            className={getRevealClass("A", state)}
            aria-label={`Opțiunea A: ${q?.optionA ?? "A"}${state.correctOption === "A" ? " — Corect" : ""}${state.myAnswer === "A" && state.correctOption !== "A" ? " — Greșit" : ""}`}
          >
            {/* Option label */}
            <span className="text-xs text-champagne-dim/70 uppercase tracking-widest">A</span>
            {/* Option text */}
            <span className="text-base text-center">{q?.optionA ?? "A"}</span>
            {/* Correct indicator — icon + text (color NOT sole signal, WCAG 1.4.1) */}
            {state.correctOption === "A" && (
              <span className="flex items-center gap-1 text-sm font-semibold text-gold-bright">
                <CheckCircle2 className="size-5" aria-hidden="true" />
                Corect!
              </span>
            )}
            {/* Wrong locked indicator — icon + text */}
            {state.myAnswer === "A" && state.correctOption !== "A" && (
              <span className="flex items-center gap-1 text-sm font-semibold text-red-400">
                <XCircle className="size-5" aria-hidden="true" />
                Greșit
              </span>
            )}
          </div>

          {/* Button B */}
          <div
            className={getRevealClass("B", state)}
            aria-label={`Opțiunea B: ${q?.optionB ?? "B"}${state.correctOption === "B" ? " — Corect" : ""}${state.myAnswer === "B" && state.correctOption !== "B" ? " — Greșit" : ""}`}
          >
            <span className="text-xs text-champagne-dim/70 uppercase tracking-widest">B</span>
            <span className="text-base text-center">{q?.optionB ?? "B"}</span>
            {state.correctOption === "B" && (
              <span className="flex items-center gap-1 text-sm font-semibold text-gold-bright">
                <CheckCircle2 className="size-5" aria-hidden="true" />
                Corect!
              </span>
            )}
            {state.myAnswer === "B" && state.correctOption !== "B" && (
              <span className="flex items-center gap-1 text-sm font-semibold text-red-400">
                <XCircle className="size-5" aria-hidden="true" />
                Greșit
              </span>
            )}
          </div>
        </div>

        {/* A/B Distribution bar — guard null distribution (PLAY-06 visual) */}
        {state.distribution !== null && (
          <div className="flex flex-col gap-3 w-full max-w-md mx-auto">
            {/* A bar */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-champagne-dim">
                A: {pctA}%
              </span>
              <div className="bg-ink-muted rounded-full overflow-hidden h-2">
                <div
                  className="bg-gold h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${pctA}%` }}
                  role="presentation"
                />
              </div>
            </div>
            {/* B bar */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-champagne-dim">
                B: {pctB}%
              </span>
              <div className="bg-ink-muted rounded-full overflow-hidden h-2">
                <div
                  className="bg-gold h-full rounded-full transition-[width] duration-300"
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
    </main>
  );
}
