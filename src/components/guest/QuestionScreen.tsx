"use client";

/**
 * QuestionScreen — A/B tap with optimistic lock + refresh-proof persistence (PLAY-01..04).
 *
 * Rendered for phase "question" and "locked" by GameView in page.tsx.
 * Receives state, identity, and status as props — never calls useGameSync (Pitfall 3).
 *
 * Lock logic:
 *   - localAnswer starts null; seeded from state.myAnswer on reconnect/refresh (PLAY-03)
 *   - Any tap during "question" phase: optimistic update + POST /api/game/answer (upsert)
 *   - Tap during "locked" phase: no-op — host has locked, no changes allowed
 *   - 403 (answers_locked) are expected on race; keep optimistic state
 *
 * Button styling (D-05):
 *   - Idle (localAnswer === null, phase "question"): .glass + champagne text
 *   - Selected (choice === localAnswer, phase "question"): glass-gold + gold glow, re-tappable
 *   - Unselected (choice !== localAnswer, phase "question"): opacity-50, still tappable (change answer)
 *   - Phase "locked": selected stays gold (cursor-not-allowed), unselected opacity-40 pointer-events-none
 *   - Phase "locked" with no local answer: both buttons disabled opacity-60
 */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
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

function getButtonClass(
  choice: Choice,
  localAnswer: Choice | null,
  phase: string
): string {
  const baseLayout =
    "w-full min-h-[120px] rounded-xl flex flex-col items-center justify-center gap-2 px-6 py-6 transition-transform duration-100 [touch-action:manipulation] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50";

  // Phase "locked" and this guest never answered — both buttons disabled
  if (phase === "locked" && localAnswer === null) {
    return cn(baseLayout, "glass opacity-60 pointer-events-none cursor-not-allowed");
  }

  if (localAnswer === null) {
    // Idle — both buttons live and tappable
    return cn(baseLayout, "glass cursor-pointer");
  }

  if (choice === localAnswer) {
    // Selected — gold treatment (D-05)
    // Re-tappable during "question"; immutable once host locks
    return cn(
      baseLayout,
      "glass-gold",
      "border-2 border-gold",
      "text-gold-bright",
      "shadow-[0_0_12px_0_rgba(212,168,67,0.4)]",
      phase === "locked" ? "cursor-not-allowed" : "cursor-pointer"
    );
  }

  // Unselected — locked out after host locks; fully interactive during "question" (change answer)
  if (phase === "locked") {
    return cn(baseLayout, "glass opacity-40 pointer-events-none");
  }
  return cn(baseLayout, "glass cursor-pointer");
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
  }, [state.myAnswer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle A or B tap — optimistic update + fire-and-forget POST (upsert on server)
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
    <main className="relative min-h-dvh bg-ink flex flex-col gap-6 px-4 pt-12 pb-[env(safe-area-inset-bottom)]">
      <SyncStatusBadge status={status} />

      {/* Content column — centered vertically */}
      <div className="flex-1 flex flex-col justify-center gap-6">
        {/* Question label */}
        <p className="text-xs text-champagne-dim/70 text-center uppercase tracking-widest">
          Întrebarea
        </p>

        {/* Question body — use .body field per GameStateSnapshot shape */}
        <h2 className="font-heading text-xl font-bold text-champagne text-center leading-snug px-2">
          {q?.body ?? "Se încarcă întrebarea..."}
        </h2>

        {/* A/B buttons — full-width stacked, gap-4 between them (D-04) */}
        <div className="flex flex-col gap-4 w-full max-w-md mx-auto">
          {/* Button A */}
          <motion.button
            type="button"
            className={getButtonClass("A", localAnswer, state.phase)}
            onClick={() => handleTap("A")}
            whileTap={shouldReduce ? undefined : { scale: 0.96 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            aria-pressed={localAnswer === "A"}
            aria-disabled={isLocked && localAnswer !== "A"}
            aria-label={`Opțiunea A: ${q?.optionA ?? "A"}`}
          >
            <span className="text-xs text-champagne-dim/70 uppercase tracking-widest">
              A
            </span>
            <span
              className={cn(
                "text-base text-center",
                localAnswer === "A" ? "text-gold-bright" : "text-champagne"
              )}
            >
              {q?.optionA ?? "A"}
            </span>
          </motion.button>

          {/* Button B */}
          <motion.button
            type="button"
            className={getButtonClass("B", localAnswer, state.phase)}
            onClick={() => handleTap("B")}
            whileTap={shouldReduce ? undefined : { scale: 0.96 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            aria-pressed={localAnswer === "B"}
            aria-disabled={isLocked && localAnswer !== "B"}
            aria-label={`Opțiunea B: ${q?.optionB ?? "B"}`}
          >
            <span className="text-xs text-champagne-dim/70 uppercase tracking-widest">
              B
            </span>
            <span
              className={cn(
                "text-base text-center",
                localAnswer === "B" ? "text-gold-bright" : "text-champagne"
              )}
            >
              {q?.optionB ?? "B"}
            </span>
          </motion.button>
        </div>

        {/* Waiting state — shown after lock (PLAY-04) */}
        {isLocked && (
          <div className="text-center mt-4">
            <div className="thin-divider" />
            <p className="text-sm text-champagne-dim/70 mt-3">
              Aștepți dezvăluirea...
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
