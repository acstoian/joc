"use client";

/**
 * QuestionScreen — Andrei/Cristina tap with optimistic lock + refresh-proof persistence (PLAY-01..04).
 *
 * Rendered for phase "question" and "locked" by GameView in page.tsx.
 * Receives state, identity, and status as props — never calls useGameSync (Pitfall 3).
 *
 * All questions are always "Andrei vs Cristina" — option A = Andrei, option B = Cristina.
 * The buttons are identity cards (large centered name) rather than generic A/B labels.
 *
 * Lock logic:
 *   - localAnswer starts null; seeded from state.myAnswer on reconnect/refresh (PLAY-03)
 *   - Any tap during "question" phase: optimistic update + POST /api/game/answer (upsert)
 *   - Tap during "locked" phase: no-op — host has locked, no changes allowed
 *   - 403 (answers_locked) are expected on race; keep optimistic state
 *
 * Button styling:
 *   - Idle (localAnswer === null, phase "question"): .glass + champagne name
 *   - Selected (this choice, phase "question"): glass-gold + ring-pulse + gold name
 *   - Unselected (other choice, phase "question"): opacity-60, still tappable
 *   - Phase "locked": selected stays gold (cursor-not-allowed + lock icon), unselected opacity-35
 *   - Phase "locked" with no answer: both buttons disabled opacity-50
 */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { GAME_ID } from "@/lib/host/constants";
import type { GameStateSnapshot, SyncStatus } from "@/hooks/useGameSync";
import { SyncStatusBadge } from "@/components/guest/SyncStatusBadge";

// ── Types ──────────────────────────────────────────────────────────────────────

type Choice = "A" | "B";

interface QuestionScreenProps {
  state: GameStateSnapshot;
  identity: { deviceToken: string; playerId: string };
  status: SyncStatus;
}

// ── Button class derivation ────────────────────────────────────────────────────

/**
 * Full-width identity card button — centered large name.
 * min-h-[108px] gives a generous touch target and a game-show presence on mobile.
 */
function getButtonClass(
  choice: Choice,
  localAnswer: Choice | null,
  phase: string
): string {
  const base =
    "relative w-full min-h-[108px] rounded-xl flex items-center justify-center transition-all duration-150 [touch-action:manipulation] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50";

  // Phase "locked" and this guest never answered — both buttons disabled
  if (phase === "locked" && localAnswer === null) {
    return cn(base, "glass opacity-50 pointer-events-none cursor-not-allowed");
  }

  if (localAnswer === null) {
    // Idle — both buttons live and tappable
    return cn(base, "glass cursor-pointer");
  }

  if (choice === localAnswer) {
    // Selected — gold treatment + ring-pulse during "question", immutable once locked
    return cn(
      base,
      "glass-gold border-2 border-gold",
      phase === "locked" ? "cursor-not-allowed" : "cursor-pointer ring-pulse"
    );
  }

  // Unselected after a selection was made
  if (phase === "locked") {
    return cn(base, "glass opacity-35 pointer-events-none");
  }
  // Still tappable during "question" — dimmed to show it's not chosen
  return cn(base, "glass opacity-60 cursor-pointer");
}

// ── Component ─────────────────────────────────────────────────────────────────

export function QuestionScreen({ state, identity, status }: QuestionScreenProps) {
  // Optimistic lock state — null until guest taps (or state.myAnswer arrives)
  const [localAnswer, setLocalAnswer] = useState<Choice | null>(null);
  const shouldReduce = useReducedMotion();

  // PLAY-03: seed from authoritative state on reconnect/refresh (Pitfall 6).
  // Runs only when state.myAnswer changes. Uses a ref snapshot of localAnswer
  // instead of adding it to deps — adding localAnswer would re-run this effect
  // on every tap, creating a window where stale server state overwrites the
  // optimistic selection before the upsert confirms.
  const localAnswerRef = useRef(localAnswer);
  localAnswerRef.current = localAnswer;
  useEffect(() => {
    if (state.myAnswer && localAnswerRef.current === null) {
      setLocalAnswer(state.myAnswer);
    }
  }, [state.myAnswer]);

  // Handle Andrei or Cristina tap — optimistic update + fire-and-forget POST (upsert on server)
  async function handleTap(choice: Choice) {
    // Only block after host locks — guests can change their answer during "question" phase
    if (state.phase === "locked") return;

    // Optimistic lock — immediate UI update
    setLocalAnswer(choice);

    // Submit to server — 403 and 409 are acceptable (lock stays)
    try {
      await fetch("/api/game/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: GAME_ID,
          deviceToken: identity.deviceToken,
          choice,
        }),
      });
      // 403 answers_locked → host locked mid-race; next broadcast re-fetch corrects
    } catch {
      // Network error — keep optimistic lock; next reconnect re-fetches real state
    }
  }

  const q = state.currentQuestion;
  const isLocked = state.phase === "locked";

  return (
    <motion.main
      className="relative min-h-dvh bg-ink flex flex-col gap-6 px-4 pt-12 pb-[env(safe-area-inset-bottom)]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <SyncStatusBadge status={status} />

      {/* Content column — centered vertically */}
      <div className="flex-1 flex flex-col justify-center gap-6">
        {/* Question label */}
        <p className="text-xs text-champagne-dim/70 text-center uppercase tracking-widest">
          Întrebarea
        </p>

        {/* Question body */}
        <h2 className="font-heading text-xl font-bold text-champagne text-center leading-snug px-2">
          {q?.body ?? "Se încarcă întrebarea..."}
        </h2>

        {/* Andrei / Cristina identity-card buttons — full-width stacked */}
        <div className="flex flex-col gap-4 w-full max-w-md mx-auto">

          {/* Andrei (option A) */}
          <motion.button
            type="button"
            className={getButtonClass("A", localAnswer, state.phase)}
            onClick={() => handleTap("A")}
            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            aria-pressed={localAnswer === "A"}
            aria-disabled={isLocked && localAnswer !== "A"}
            aria-label={`Andrei${localAnswer === "A" ? " — selectat" : ""}`}
          >
            <span
              className={cn(
                "text-3xl font-bold font-heading transition-colors duration-150",
                localAnswer === "A" ? "text-gold-bright" : "text-champagne"
              )}
            >
              Andrei
            </span>
            {/* Lock icon — indicates selected answer is now immutable */}
            {isLocked && localAnswer === "A" && (
              <Lock
                className="absolute bottom-3 right-4 size-4 text-gold/40"
                aria-hidden="true"
              />
            )}
          </motion.button>

          {/* Cristina (option B) */}
          <motion.button
            type="button"
            className={getButtonClass("B", localAnswer, state.phase)}
            onClick={() => handleTap("B")}
            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            aria-pressed={localAnswer === "B"}
            aria-disabled={isLocked && localAnswer !== "B"}
            aria-label={`Cristina${localAnswer === "B" ? " — selectată" : ""}`}
          >
            <span
              className={cn(
                "text-3xl font-bold font-heading transition-colors duration-150",
                localAnswer === "B" ? "text-gold-bright" : "text-champagne"
              )}
            >
              Cristina
            </span>
            {isLocked && localAnswer === "B" && (
              <Lock
                className="absolute bottom-3 right-4 size-4 text-gold/40"
                aria-hidden="true"
              />
            )}
          </motion.button>
        </div>

        {/* Locked waiting state — animated dots + label (PLAY-04) */}
        {isLocked && (
          <div className="flex flex-col items-center gap-3 mt-2">
            <div
              className="flex items-center gap-2"
              aria-hidden="true"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-gold/50 dot-1" />
              <span className="w-1.5 h-1.5 rounded-full bg-gold/50 dot-2" />
              <span className="w-1.5 h-1.5 rounded-full bg-gold/50 dot-3" />
            </div>
            <p className="text-sm text-champagne-dim/60">
              Aștepți dezvăluirea...
            </p>
          </div>
        )}
      </div>
    </motion.main>
  );
}
