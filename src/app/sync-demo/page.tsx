"use client";

/**
 * THROWAWAY PROOF HARNESS — Phase 2 only.
 * Removed / replaced by real game surfaces (host dashboard, guest app, TV display)
 * in Phases 4–6.
 *
 * Proves Phase 2 success criteria:
 *   SC1: two independent subscriber panes both update within ~1s of a fired GAME_EVENT
 *        (DevTools: fire any button, watch both panes update — no manual refresh)
 *   SC2: 60s offline → reconnect + resync
 *        (DevTools → Network → Offline, wait ~60s, set Online — panes recover)
 *   SC3: subscribe-then-fetch populates state immediately on connect
 *        (panes show "connected" + authoritative state snapshot on load)
 *   SC4: visibilitychange triggers re-fetch when tab returns to foreground
 *        (switch to another tab ~30s, return — DevTools Network shows GET /api/game/state)
 *
 * Security: this page is "use client" and imports ONLY the demoBroadcast server
 * action — it never imports @/lib/supabase/admin or any service-role surface (T-02-08).
 */

import { useEffect, useState } from "react";
import { useGameSync } from "@/hooks/useGameSync";
import { demoBroadcast } from "@/app/actions/demo-broadcast";
import type { GameEvent } from "@/lib/realtime/events";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Phase 1 seed game id — matches prisma/seed.ts and Supabase seed data. */
const SEED_GAME_ID = "a0000000-0000-4000-8000-000000000001";

/** Phase 1 seed question id — used for events that require questionId. */
const SEED_QUESTION_ID = "b0000000-0000-4000-8000-000000000001";

// ── SubscriberPane ─────────────────────────────────────────────────────────────

interface SubscriberPaneProps {
  label: string;
  gameId: string;
  playerId: string;
}

function SubscriberPane({ label, gameId, playerId }: SubscriberPaneProps) {
  const { state, status, participantCount } = useGameSync(gameId, playerId);

  const statusColor =
    status === "connected"
      ? "text-emerald-400"
      : status === "reconnecting"
        ? "text-gold"
        : status === "error"
          ? "text-red-400"
          : "text-champagne-dim";

  return (
    <div className="glass flex-1 rounded-2xl px-5 py-5 shadow-xl">
      <h2 className="font-heading text-base font-bold tracking-tight text-champagne">
        {label}
      </h2>
      <div className="thin-divider" aria-hidden="true" />

      {/* Connection status */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-champagne-dim/60">Status:</span>
        <span className={`text-xs font-semibold uppercase tracking-widest ${statusColor}`}>
          {status}
        </span>
      </div>

      {/* Participant count */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-champagne-dim/60">Participants:</span>
        <span className="text-xs font-semibold text-gold-bright">{participantCount}</span>
      </div>

      {/* Authoritative state snapshot */}
      <div
        className="glass-gold rounded-xl px-4 py-3"
        role="status"
        aria-live="polite"
        aria-label={`${label} game state`}
      >
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gold">
          State snapshot
        </p>
        <pre className="overflow-auto text-xs text-champagne-dim/80">
          {state !== null ? JSON.stringify(state, null, 2) : "(loading…)"}
        </pre>
      </div>
    </div>
  );
}

// ── HostControls ──────────────────────────────────────────────────────────────

interface HostControlsProps {
  gameId: string;
}

function HostControls({ gameId }: HostControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [lastFired, setLastFired] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [correctOption, setCorrectOption] = useState<"A" | "B">("A");

  async function fire(event: GameEvent) {
    setLoading(event.type);
    setError(null);
    try {
      await demoBroadcast(gameId, event);
      setLastFired(event.type);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Broadcast failed");
    } finally {
      setLoading(null);
    }
  }

  const btnClass =
    "cursor-pointer rounded-xl bg-gold/20 px-4 py-3 text-xs font-semibold text-gold-bright transition-colors hover:bg-gold/30 disabled:cursor-not-allowed disabled:opacity-50 text-left min-h-[44px]";

  return (
    <div className="glass w-full rounded-2xl px-5 py-5 shadow-xl">
      <h2 className="font-heading text-base font-bold tracking-tight text-champagne">
        Host Controls
      </h2>
      <div className="thin-divider" aria-hidden="true" />
      <p className="mb-4 text-xs text-champagne-dim/60">
        Fire any GAME_EVENT — both panes should update within ~1s (SC1).
      </p>

      {/* ANSWER_REVEALED needs a correctOption pick */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs text-champagne-dim/60">ANSWER_REVEALED correct option:</span>
        <button
          type="button"
          onClick={() => setCorrectOption("A")}
          className={`min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
            correctOption === "A"
              ? "bg-gold text-ink"
              : "bg-gold/20 text-gold-bright hover:bg-gold/30"
          }`}
          aria-pressed={correctOption === "A"}
        >
          A
        </button>
        <button
          type="button"
          onClick={() => setCorrectOption("B")}
          className={`min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
            correctOption === "B"
              ? "bg-gold text-ink"
              : "bg-gold/20 text-gold-bright hover:bg-gold/30"
          }`}
          aria-pressed={correctOption === "B"}
        >
          B
        </button>
      </div>

      {/* All 8 GAME_EVENT buttons */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => fire({ type: "GAME_STARTED", gameId })}
          disabled={loading !== null}
          aria-busy={loading === "GAME_STARTED"}
          className={btnClass}
        >
          {loading === "GAME_STARTED" ? "Firing…" : "GAME_STARTED"}
        </button>

        <button
          type="button"
          onClick={() =>
            fire({ type: "QUESTION_STARTED", gameId, questionId: SEED_QUESTION_ID })
          }
          disabled={loading !== null}
          aria-busy={loading === "QUESTION_STARTED"}
          className={btnClass}
        >
          {loading === "QUESTION_STARTED" ? "Firing…" : "QUESTION_STARTED"}
        </button>

        <button
          type="button"
          onClick={() =>
            fire({ type: "ANSWERS_LOCKED", gameId, questionId: SEED_QUESTION_ID })
          }
          disabled={loading !== null}
          aria-busy={loading === "ANSWERS_LOCKED"}
          className={btnClass}
        >
          {loading === "ANSWERS_LOCKED" ? "Firing…" : "ANSWERS_LOCKED"}
        </button>

        <button
          type="button"
          onClick={() =>
            fire({
              type: "ANSWER_REVEALED",
              gameId,
              questionId: SEED_QUESTION_ID,
              correctOption,
            })
          }
          disabled={loading !== null}
          aria-busy={loading === "ANSWER_REVEALED"}
          className={btnClass}
        >
          {loading === "ANSWER_REVEALED"
            ? "Firing…"
            : `ANSWER_REVEALED (${correctOption})`}
        </button>

        <button
          type="button"
          onClick={() => fire({ type: "SCORES_UPDATED", gameId })}
          disabled={loading !== null}
          aria-busy={loading === "SCORES_UPDATED"}
          className={btnClass}
        >
          {loading === "SCORES_UPDATED" ? "Firing…" : "SCORES_UPDATED"}
        </button>

        <button
          type="button"
          onClick={() =>
            fire({ type: "ROUND_RESET", gameId, questionId: SEED_QUESTION_ID })
          }
          disabled={loading !== null}
          aria-busy={loading === "ROUND_RESET"}
          className={btnClass}
        >
          {loading === "ROUND_RESET" ? "Firing…" : "ROUND_RESET"}
        </button>

        <button
          type="button"
          onClick={() => fire({ type: "GAME_ENDED", gameId })}
          disabled={loading !== null}
          aria-busy={loading === "GAME_ENDED"}
          className={btnClass}
        >
          {loading === "GAME_ENDED" ? "Firing…" : "GAME_ENDED"}
        </button>

        <button
          type="button"
          onClick={() =>
            fire({ type: "COUNTDOWN_STARTED", gameId, seconds: 3 })
          }
          disabled={loading !== null}
          aria-busy={loading === "COUNTDOWN_STARTED"}
          className={btnClass}
        >
          {loading === "COUNTDOWN_STARTED" ? "Firing…" : "COUNTDOWN_STARTED (3s)"}
        </button>
      </div>

      {/* Last fired / error feedback */}
      {(lastFired !== null || error !== null) && (
        <div
          className="glass-gold mt-4 rounded-xl px-4 py-3"
          role="status"
          aria-live="polite"
        >
          {lastFired !== null && error === null && (
            <p className="text-xs font-semibold text-gold-bright">
              Fired: {lastFired}
            </p>
          )}
          {error !== null && (
            <p className="text-xs font-semibold text-red-400">
              Error: {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SyncDemoPage() {
  // Read ?gameId= from the URL client-side to avoid SSR/hydration mismatch.
  // Initialise to SEED_GAME_ID on both server and client; update after mount.
  const [gameId, setGameId] = useState(SEED_GAME_ID);
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("gameId");
    if (param) setGameId(param);
  }, []);

  return (
    <main className="min-h-dvh bg-ink p-4 pb-8">
      {/* Header */}
      <div className="mx-auto mb-6 max-w-5xl text-center">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-champagne">
          Sync Demo
        </h1>
        <div className="thin-divider mx-auto w-32" aria-hidden="true" />
        <p className="text-xs text-champagne-dim/60">
          Phase 2 proof harness — throwaway
        </p>
        <p className="mt-1 text-xs text-champagne-dim/40">
          Game: {gameId}
        </p>
      </div>

      {/* Subscriber panes — side by side */}
      <div className="mx-auto mb-6 flex max-w-5xl flex-col gap-4 sm:flex-row">
        <SubscriberPane
          label="Pane A"
          gameId={gameId}
          playerId="stub-player-a"
        />
        <SubscriberPane
          label="Pane B"
          gameId={gameId}
          playerId="stub-player-b"
        />
      </div>

      {/* Host controls */}
      <div className="mx-auto max-w-5xl">
        <HostControls gameId={gameId} />
      </div>

      {/* Manual checklist */}
      <div className="mx-auto mt-6 max-w-5xl">
        <div className="glass rounded-2xl px-5 py-5 shadow-xl">
          <h2 className="font-heading text-sm font-bold tracking-tight text-champagne">
            Manual Verification Checklist
          </h2>
          <div className="thin-divider" aria-hidden="true" />
          <ul className="space-y-1 text-xs text-champagne-dim/70">
            <li>SC1 · Fire any button — both panes update within ~1s, no refresh</li>
            <li>SC2 · DevTools → Network → Offline (~60s) → Online — panes reconnect + resync</li>
            <li>SC3 · On load: panes show &quot;connected&quot; + populated state snapshot</li>
            <li>SC4 · Switch tab ~30s → return — DevTools Network shows GET /api/game/state</li>
            <li>Presence · participantCount reflects connected tabs; does not climb continuously</li>
            <li>SC5 · <code className="text-gold">grep -rn &quot;postgres_changes&quot; src/</code> → 0 matches</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
