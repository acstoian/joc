"use client";

/**
 * ControlTab — live phase-control surface (Plan 04-02, D-05, SC4).
 *
 * Drives the Phase 3 state machine routes:
 *   POST /api/host/transition  { gameId, action: start|lock|next|end, nextQuestionId? }
 *   POST /api/host/reveal      { gameId, choice: "A"|"B" }
 *
 * In-flight safety pattern (SC4, RQ-6):
 *   - Clicking a button sets inFlight = action and disables ALL buttons immediately
 *   - Re-enable happens ONLY in useEffect([state?.phase]) — Broadcast-confirmed
 *   - 5s fallback timeout clears inFlight so the UI never permanently locks (T-04-06)
 *   - Error paths (409 / 4xx / 5xx) re-enable immediately via setInFlight(null)
 *
 * "Urmatoarea Intrebare" (next) resolution:
 *   The transition route requires nextQuestionId for the "next" action. This
 *   component fetches the ordered question list from GET /api/host/questions
 *   (created in Plan 03) and derives the next question by display_order after
 *   current_question_id. If the endpoint is not yet available (404), the button
 *   is disabled and a toast explains the dependency.
 *
 * Sections:
 *   A. Status strip — phase badge + participant count + A/B distribution bar
 *   B. Phase control buttons — 2-column grid, phase-gated (PHASE_ACTIONS map)
 *   C. Reveal A/B picker — visible only when phase === "locked" (pre-reveal)
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PhaseButton } from "@/components/host/PhaseButton";
import { EmergencyPanel } from "@/components/host/EmergencyPanel";
import { DistributionBar } from "@/components/host/DistributionBar";
import { hostFetch } from "@/lib/host/constants";
import type { GameStateSnapshot, SyncStatus } from "@/hooks/useGameSync";

// ── Shared props contract (from Plan 01 DashboardShell) ───────────────────────

export interface HostTabProps {
  state: GameStateSnapshot | null;
  status: SyncStatus;
  participantCount: number;
  password: string;
  gameId: string;
}

// ── Phase → valid actions map (RESEARCH.md Pattern 3, Open Q1) ───────────────
//
// "end" is only valid from "revealed" — the transition route has
// TRANSITIONS.end.expectedFrom = "revealed". Force-end-from-any-state is the
// Emergency panel's job in Plan 05. (Open Q1 resolution.)

const PHASE_ACTIONS: Record<string, Set<string>> = {
  lobby:    new Set(["start"]),
  question: new Set(["lock"]),
  locked:   new Set(["reveal"]),
  revealed: new Set(["next", "end"]),
  ended:    new Set(),
};

function isActionEnabled(action: string, phase: string | null | undefined): boolean {
  if (!phase) return false;
  return PHASE_ACTIONS[phase]?.has(action) ?? false;
}

// ── Phase badge labels + colors ────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  lobby:    "In asteptare",
  question: "Intrebare",
  locked:   "Blocat",
  revealed: "Dezvaluit",
  ended:    "Incheiat",
};

function PhaseBadge({ phase }: { phase: string | null | undefined }) {
  if (!phase) {
    return (
      <Badge className="bg-champagne/10 text-champagne-dim text-xs">
        —
      </Badge>
    );
  }

  const colorClass =
    phase === "lobby"    ? "bg-sage/20 text-sage"
    : phase === "question" ? "bg-gold/20 text-gold-bright"
    : phase === "locked"   ? "bg-blush/20 text-blush"
    : phase === "revealed" ? "bg-gold-bright/20 text-gold-bright"
    : phase === "ended"    ? "bg-champagne/10 text-champagne-dim"
    : "bg-champagne/10 text-champagne-dim";

  return (
    <Badge className={`text-xs font-semibold border-0 ${colorClass}`}>
      {PHASE_LABELS[phase] ?? phase}
    </Badge>
  );
}

// ── Question shape from GET /api/host/questions ───────────────────────────────

interface HostQuestion {
  id: string;
  display_order: number;
}

// ── ControlTab ────────────────────────────────────────────────────────────────

export function ControlTab({
  state,
  participantCount,
  password,
  gameId,
}: HostTabProps) {
  // Single in-flight action guard (SC4 — blocks double-tap)
  const [inFlight, setInFlight] = useState<string | null>(null);

  // Separate countdown in-flight boolean (Finding 3, Correction 3):
  // COUNTDOWN_STARTED does NOT change state.phase, so the inFlight useEffect
  // would never clear it. Self-clears after 2s via setTimeout.
  const [countdownInFlight, setCountdownInFlight] = useState(false);

  // Correct-option pick for the reveal action (the host picks A or B live)
  const [revealChoice, setRevealChoice] = useState<"A" | "B">("A");

  // Ordered question list — needed to resolve nextQuestionId for the "next" action
  const [questions, setQuestions] = useState<HostQuestion[]>([]);

  // ── Fetch question list (needed for "next" action nextQuestionId) ─────────
  // Runs once on mount (and whenever gameId/password change). Plan 03 creates
  // the endpoint; if it returns 404, questions stays [] and the next button
  // uses the graceful fallback below.
  const fetchQuestions = useCallback(async () => {
    try {
      const res = await hostFetch(
        `/api/host/questions?gameId=${gameId}`,
        password
      );
      if (res.ok) {
        const data = await res.json() as { questions: HostQuestion[] };
        setQuestions(data.questions ?? []);
      }
      // 404 = endpoint not yet deployed (Plan 03 pending) — leave questions as []
    } catch {
      // Network error — leave questions as [] silently
    }
  }, [gameId, password]);

  useEffect(() => {
    void fetchQuestions();
  }, [fetchQuestions]);

  // ── Re-enable on Broadcast-confirmed phase change (RQ-6, Pitfall 2) ──────
  // This is the ONLY place setInFlight(null) is called on SUCCESS.
  // Re-enabling here (not in the fetch .then) ensures the button state
  // matches what the room actually sees — not just what the server responded.
  useEffect(() => {
    if (inFlight !== null) {
      setInFlight(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase]);

  // ── 5-second fallback timeout (T-04-06 — Broadcast may never arrive) ─────
  // Prevents the dashboard permanently locking when Supabase Realtime drops.
  useEffect(() => {
    if (inFlight === null) return;
    const t = setTimeout(() => setInFlight(null), 5000);
    return () => clearTimeout(t);
  }, [inFlight]);

  // ── Resolve next question ID from current position in ordered list ────────
  function resolveNextQuestionId(): string | null {
    if (questions.length === 0) return null;
    const currentId = state?.currentQuestionId ?? null;
    if (currentId === null) return questions[0]?.id ?? null;
    const currentIdx = questions.findIndex((q) => q.id === currentId);
    if (currentIdx === -1) return null;
    return questions[currentIdx + 1]?.id ?? null;
  }

  // ── Action handler ────────────────────────────────────────────────────────
  async function handleAction(action: string) {
    // Double-tap guard — block if any action is already in-flight
    if (inFlight !== null) return;

    setInFlight(action);

    try {
      let res: Response;

      if (action === "reveal") {
        // POST /api/host/reveal { gameId, choice }
        res = await hostFetch("/api/host/reveal", password, {
          method: "POST",
          body: JSON.stringify({ gameId, choice: revealChoice }),
        });
      } else if (action === "next") {
        const nextQuestionId = resolveNextQuestionId();
        if (!nextQuestionId) {
          toast.error("Nu s-a putut determina urmatoarea intrebare. Reincarca pagina.");
          setInFlight(null);
          return;
        }
        // POST /api/host/transition { gameId, action: "next", nextQuestionId }
        res = await hostFetch("/api/host/transition", password, {
          method: "POST",
          body: JSON.stringify({ gameId, action, nextQuestionId }),
        });
      } else {
        // start | lock | end — POST /api/host/transition { gameId, action }
        res = await hostFetch("/api/host/transition", password, {
          method: "POST",
          body: JSON.stringify({ gameId, action }),
        });
      }

      if (!res.ok) {
        // Error paths re-enable immediately (not waiting for Broadcast)
        setInFlight(null);

        if (res.status === 409) {
          toast.error("Starea jocului s-a schimbat. Actiunea nu mai este valida.");
        } else if (res.status >= 400 && res.status < 500) {
          toast.error("Actiunea a esuat. Verifica conexiunea si incearca din nou.");
        } else {
          toast.error("Eroare de server. Incearca din nou in cateva secunde.");
        }
        return;
      }

      // Success — do NOT call setInFlight(null) here.
      // Re-enable happens in useEffect([state?.phase]) — Broadcast-confirmed.
      // If "next" succeeded, re-fetch questions (new question might have been added)
      if (action === "next") {
        void fetchQuestions();
      }
    } catch {
      // Network error
      setInFlight(null);
      toast.error("Actiunea a esuat. Verifica conexiunea si incearca din nou.");
    }
  }

  const anyInFlight = inFlight !== null;
  const phase = state?.phase ?? null;

  // ── Countdown handler (D-08, DISP-08) ───────────────────────────────────
  // Cosmetic broadcast — does NOT mutate game state or phase.
  // Uses its own inFlight boolean (Correction 3, Finding 3) because
  // COUNTDOWN_STARTED never changes state.phase so the phase-watch useEffect
  // would never re-enable the button.
  // Also blocked during any game-state action (Correction 4) to prevent
  // firing a cosmetic broadcast during a real transition.
  async function handleCountdown() {
    if (countdownInFlight || anyInFlight) return;
    setCountdownInFlight(true);
    try {
      await hostFetch("/api/host/countdown", password, {
        method: "POST",
        body: JSON.stringify({ gameId, seconds: 3 }),
      });
      // Success — self-clear after 2s regardless (see finally)
    } catch {
      // Cosmetic broadcast — silent on failure
    } finally {
      setTimeout(() => setCountdownInFlight(false), 2000);
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Section A: Status strip ─────────────────────────────────────────── */}
      <div className="glass rounded-2xl px-5 py-5 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-champagne-dim/60">Faza:</span>
            <PhaseBadge phase={phase} />
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="text-3xl font-bold text-gold-bright"
              aria-label={`${participantCount} jucatori conectati`}
            >
              {participantCount}
            </span>
            <span className="text-xs text-champagne-dim/60">
              jucatori conectati
            </span>
          </div>
        </div>

        {/* A/B distribution bar */}
        <div className="mt-4">
          {state?.distribution ? (
            <DistributionBar a={state.distribution.A} b={state.distribution.B} />
          ) : (
            <p className="text-xs text-champagne-dim/60">Niciun raspuns inca.</p>
          )}
        </div>
      </div>

      {/* ── Reveal A/B picker — visible only in locked phase ────────────────── */}
      {phase === "locked" && (
        <div className="glass rounded-2xl px-5 py-4 shadow-xl">
          <p className="mb-3 text-xs font-semibold text-champagne-dim/60">
            Alege raspunsul corect:
          </p>
          <div className="flex gap-3">
            {(["A", "B"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setRevealChoice(opt)}
                disabled={anyInFlight}
                aria-pressed={revealChoice === opt}
                className={[
                  "min-h-[44px] min-w-[44px] rounded-lg px-5 py-2",
                  "text-sm font-bold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                  revealChoice === opt
                    ? "bg-gold text-ink"
                    : "bg-gold/20 text-gold-bright hover:bg-gold/30",
                  anyInFlight ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ touchAction: "manipulation" }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Section B: Phase control buttons ────────────────────────────────── */}
      <div
        className="glass rounded-2xl px-5 py-5 shadow-xl"
        aria-label="Controale faza joc"
      >
        <p className="mb-4 text-xs font-semibold text-champagne-dim/60">
          Controleaza faza jocului
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PhaseButton
            label="Porneste Jocul"
            enabled={isActionEnabled("start", phase)}
            inFlight={inFlight === "start"}
            anyInFlight={anyInFlight}
            onClick={() => handleAction("start")}
          />
          <PhaseButton
            label="Blocheaza Raspunsurile"
            enabled={isActionEnabled("lock", phase)}
            inFlight={inFlight === "lock"}
            anyInFlight={anyInFlight}
            onClick={() => handleAction("lock")}
          />
          <PhaseButton
            label="Dezvaluie Raspunsul"
            enabled={isActionEnabled("reveal", phase)}
            inFlight={inFlight === "reveal"}
            anyInFlight={anyInFlight}
            onClick={() => handleAction("reveal")}
          />
          <PhaseButton
            label="Urmatoarea Intrebare"
            enabled={isActionEnabled("next", phase)}
            inFlight={inFlight === "next"}
            anyInFlight={anyInFlight}
            onClick={() => handleAction("next")}
          />
          <PhaseButton
            label="Incheie Jocul"
            enabled={isActionEnabled("end", phase)}
            inFlight={inFlight === "end"}
            anyInFlight={anyInFlight}
            onClick={() => handleAction("end")}
          />
        </div>
      </div>

      {/* ── Section D: Display controls (cosmetic) ──────────────────────────── */}
      <div className="glass rounded-2xl px-5 py-4 shadow-xl">
        <p className="mb-3 text-xs font-semibold text-champagne-dim/60">
          Ecran TV
        </p>
        <button
          type="button"
          onClick={handleCountdown}
          disabled={countdownInFlight || anyInFlight}
          className={[
            "min-h-[44px] w-full rounded-lg px-4 py-2",
            "text-sm font-semibold font-body",
            "bg-ink-light border border-champagne/20 text-champagne-dim",
            "hover:border-champagne/40 hover:text-champagne",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-champagne/30",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "transition-colors duration-150",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ touchAction: "manipulation" }}
          aria-label="Porneste numaratoarea inversa pe ecranul TV"
        >
          {countdownInFlight ? "Se porneste..." : "Numărătoare inversă"}
        </button>
      </div>

      {/* ── Section C: Emergency controls (collapsible, Plan 05 HOST-11) ─────── */}
      <EmergencyPanel gameId={gameId} password={password} questions={questions} />
    </div>
  );
}
