"use client";

/**
 * useGameSync — headless game-state sync hook (D-01).
 *
 * Subscribes to the `game:{gameId}` Supabase Broadcast channel and returns
 * { state, status, participantCount } — the single sync primitive consumed by
 * guest, host, and TV surfaces in Phases 4–6.
 *
 * Core contract (must never be broken):
 *  - subscribe-then-fetch: authoritative state is re-fetched on every SUBSCRIBED
 *    event (initial connect AND every reconnect) via GET /api/game/state (RT-03)
 *  - typed-signal + re-fetch: each GAME_EVENT broadcast triggers a state re-fetch;
 *    game data is NEVER read off the event payload — the DB is always the source
 *    of truth (D-06, T-02-05)
 *  - track() exactly once per (re)connection in the SUBSCRIBED callback — never in
 *    render/broadcast paths (D-04, D-09, T-02-07 — presence flooding prevention)
 *  - visibilitychange calls fetchState() ONLY; must NOT call channel.subscribe()
 *    again (Pitfall 4 — duplicate subscription on already-subscribed channel)
 *  - no postgres_changes subscriptions anywhere (SC5, RT-02)
 *  - cleanup via supabaseRef.current.removeChannel() for React 19 StrictMode double-mount (Pitfall 2)
 *
 * Worker/heartbeat/jitter defense is inherited from createClient() in
 * src/lib/supabase/client.ts (RT-04, D-08, D-09). Do not recreate those options here.
 */

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GameEvent } from "@/lib/realtime/events";

// Connection-status enum exposed so consumers can render reconnect UI (RT-06).
// Values map 1-to-1 with REALTIME_SUBSCRIBE_STATES from @supabase/realtime-js.
export type SyncStatus = "connecting" | "connected" | "reconnecting" | "error";

// Authoritative resync shape returned by GET /api/game/state.
// Also imported (type-only) by src/app/api/game/state/route.ts — do not rename
// fields or remove exports without updating that route.
//
// Stub fields (null in Phase 2):
//   myAnswer      — Phase 3 (JOIN-02/03) populates from player's recorded answer
//   correctOption — Phase 3 (HOST-04) populates after phase === "revealed"
export type GameStateSnapshot = {
  phase: "lobby" | "question" | "locked" | "revealed" | "ended";
  currentQuestionId: string | null;
  currentQuestion: {
    id: string;
    body: string;
    optionA: string;
    optionB: string;
  } | null;
  myAnswer: "A" | "B" | null;       // null — Phase 3 populates
  correctOption: "A" | "B" | null;  // null — Phase 3 populates
};

/**
 * useGameSync(gameId, playerId)
 *
 * Returns { state, status, participantCount }.
 * Headless — no JSX, no UI elements (D-01, RT-06).
 *
 * @param gameId   UUID of the game session (matches `games.id` in DB)
 * @param playerId UUID of the current player (used for per-player answer in state fetch)
 */
export function useGameSync(
  gameId: string,
  playerId: string
): { state: GameStateSnapshot | null; status: SyncStatus; participantCount: number } {
  // createClient() returns a module-level singleton (createBrowserClient singleton
  // behavior — Pitfall 6). Holding it in a ref keeps the reference stable across
  // renders and lets the effect read supabaseRef.current directly, satisfying
  // react-hooks/exhaustive-deps (the ref object itself is stable).
  const supabaseRef = useRef(createClient());

  // Hold the channel across renders without triggering re-renders on assignment.
  // Type is inferred from the client instance held in supabaseRef.
  const channelRef = useRef<ReturnType<typeof supabaseRef.current.channel> | null>(null);

  const [state, setState] = useState<GameStateSnapshot | null>(null);
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [participantCount, setParticipantCount] = useState(0);

  useEffect(() => {
    // fetchState is defined inside the effect so it closes over the current
    // gameId/playerId values without needing to be in the dependency list.
    // The function is safe to call multiple times (idempotent read).
    const fetchState = async () => {
      const res = await fetch(
        `/api/game/state?gameId=${gameId}&playerId=${playerId}`
      );
      if (res.ok) {
        const data: GameStateSnapshot = await res.json();
        setState(data);
      }
    };

    // ----------------------------------------------------------------
    // Channel setup — created once per [gameId, playerId] pair.
    // Do NOT move any of the .on() / .subscribe() calls outside this
    // effect — creating the channel in the render body causes a new
    // channel to be created on every render (Pitfall: channel in render body).
    //
    // Read supabaseRef.current inside the effect so the ref itself is the
    // captured value (refs are stable objects; .current is the value we want).
    // ----------------------------------------------------------------
    const sb = supabaseRef.current;
    const channel = sb
      .channel(`game:${gameId}`)

      // BROADCAST: each GAME_EVENT is a typed signal that data has changed.
      // Re-fetch from the DB for authoritative state — NEVER read game data
      // off the event payload (D-06, T-02-05 — forged/replayed broadcasts
      // cannot corrupt displayed state when the DB is always the source).
      .on("broadcast", { event: "GAME_EVENT" }, async ({ payload }) => {
        // Type assertion gives exhaustiveness checking in Phase 3+ when the
        // union is extended; the payload itself is ignored for data purposes.
        const _event = payload as GameEvent;
        void _event; // signal "intentionally unused" — event type drives future animation
        await fetchState();
      })

      // PRESENCE: derive participantCount from presenceState() on every sync.
      // Registered BEFORE .subscribe() so the handler is in place before the
      // first "sync" fires (presence sync fires immediately after SUBSCRIBED).
      .on("presence", { event: "sync" }, () => {
        const presence = channel.presenceState();
        setParticipantCount(Object.keys(presence).length);
      })

      // SUBSCRIBE callback — handles all REALTIME_SUBSCRIBE_STATES values.
      // [VERIFIED: @supabase/realtime-js@2.106.2 REALTIME_SUBSCRIBE_STATES enum]
      //   "SUBSCRIBED"    → connected (initial + every reconnect)
      //   "CHANNEL_ERROR" → transient error; SDK auto-reconnects
      //   "TIMED_OUT"     → heartbeat missed; SDK auto-reconnects
      //   "CLOSED"        → channel explicitly removed or fatal error
      .subscribe(async (subscribeStatus) => {
        if (subscribeStatus === "SUBSCRIBED") {
          setStatus("connected");

          // subscribe-then-fetch (RT-03): fetch authoritative state NOW, before
          // processing any queued events. This is the reconnect resync path —
          // it runs on initial connect AND on every SDK auto-reconnect.
          await fetchState();

          // PRESENCE TRACK — exactly once per (re)connection (D-04, D-09).
          // Must be in the SUBSCRIBED branch only, never in:
          //   - broadcast handler (floods presence at 100+ clients, T-02-07)
          //   - render loop / dependency-array trap
          //   - visibilitychange handler
          //
          // Phase 3 (JOIN-02/03) replaces this stub identity with the real
          // display_name from the player's join flow.
          const deviceToken =
            typeof window !== "undefined"
              ? (localStorage.getItem("device_token") ?? "stub-token")
              : "stub-token";
          await channel.track({ player_id: playerId, device_token: deviceToken });
        } else if (
          subscribeStatus === "CHANNEL_ERROR" ||
          subscribeStatus === "TIMED_OUT"
        ) {
          // Transient failure — SDK will auto-reconnect and re-fire SUBSCRIBED,
          // which triggers fetchState() again. No manual re-subscribe needed.
          setStatus("reconnecting");
        } else if (subscribeStatus === "CLOSED") {
          setStatus("error");
        }
      });

    channelRef.current = channel;

    // ----------------------------------------------------------------
    // VISIBILITYCHANGE — re-fetch state when tab returns to foreground.
    // (RT-04, D-08 — simulated-reconnect path; real-device 60s screen-lock
    //  proof deferred to Phase 7, RT-08)
    //
    // IMPORTANT: calls fetchState() ONLY.
    // Must NOT call channel.subscribe() — the SDK may have already reconnected
    // while the tab was backgrounded; a second subscribe() creates an orphaned
    // duplicate subscription that survives removeChannel() cleanup (Pitfall 4).
    // If the SDK dropped and reconnected, its SUBSCRIBED callback already
    // called fetchState() — both paths converge without double-subscribing.
    // ----------------------------------------------------------------
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        await fetchState();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // ----------------------------------------------------------------
    // CLEANUP — runs on unmount and on every [gameId, playerId] change.
    //
    // Order matters:
    //   1. Remove the visibilitychange listener first (prevents fetchState()
    //      firing on a partially-torn-down channel)
    //   2. sb.removeChannel() fully removes the channel from the client's
    //      internal registry — React 19 StrictMode fires this cleanup then
    //      re-runs the effect; the second mount gets a fresh channel with the
    //      same topic string rather than a conflicted duplicate (Pitfall 2).
    // ----------------------------------------------------------------
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      sb.removeChannel(channel);
    };
  }, [gameId, playerId]); // stable — only re-run when game or player changes

  return { state, status, participantCount };
}
