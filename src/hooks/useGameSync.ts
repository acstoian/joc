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

// Options bag for useGameSync — all fields optional so existing callers
// (host, guest) that pass no third argument are completely unaffected.
// Phase 6 (Display Mode) uses onEvent to intercept COUNTDOWN_STARTED before
// the state re-fetch (which does not surface this transient event).
export type UseGameSyncOptions = {
  /** Callback fired on every GAME_EVENT broadcast, BEFORE the state re-fetch. */
  onEvent?: (event: GameEvent) => void;
};

// Authoritative resync shape returned by GET /api/game/state.
// Also imported (type-only) by src/app/api/game/state/route.ts — do not rename
// fields or remove exports without updating that route.
//
// Phase 2 stub fields now populated by Phase 3 (HOST-04/SCOR-02):
//   myAnswer      — Phase 3 (JOIN-02/03) populates from player's recorded answer
//   correctOption — Phase 3 (HOST-04) populates after phase === "revealed"
//   distribution  — Phase 3 populates when phase is "locked" or "revealed"
//   leaderboard   — Phase 3 populates when phase is not "lobby"
export type GameStateSnapshot = {
  phase: "lobby" | "question" | "locked" | "revealed" | "ended";
  currentQuestionId: string | null;
  currentQuestion: {
    id: string;
    body: string;
    optionA: string;
    optionB: string;
  } | null;
  myAnswer: "A" | "B" | null;
  correctOption: "A" | "B" | null;                    // populated when phase === 'revealed'
  distribution: { A: number; B: number } | null;      // populated when locked/revealed
  leaderboard: { name: string; score: number }[];     // populated when phase !== 'lobby'
};

/**
 * useGameSync(gameId, playerId, options?)
 *
 * Returns { state, status, participantCount }.
 * Headless — no JSX, no UI elements (D-01, RT-06).
 *
 * @param gameId   UUID of the game session (matches `games.id` in DB)
 * @param playerId UUID of the current player (used for per-player answer in state fetch)
 * @param options  Optional — { onEvent? } callback fired on every broadcast before re-fetch.
 *                 All existing callers that omit this argument are unaffected.
 */
export function useGameSync(
  gameId: string,
  playerId: string,
  options?: UseGameSyncOptions
): { state: GameStateSnapshot | null; status: SyncStatus; participantCount: number } {
  // createClient() returns a module-level singleton (createBrowserClient singleton
  // behavior — Pitfall 6). Holding it in a ref keeps the reference stable across
  // renders and lets the effect read supabaseRef.current directly, satisfying
  // react-hooks/exhaustive-deps (the ref object itself is stable).
  const supabaseRef = useRef(createClient());

  // Capture onEvent in a ref so we can call the latest version from the broadcast
  // handler without adding it to the [gameId, playerId] dependency array (which
  // would recreate the channel subscription on every render that passes a new
  // callback object — an anti-pattern on hooks that manage WebSocket subscriptions).
  // The ref is updated on every render via a separate useEffect, which runs before
  // the next paint but does not trigger a re-render of the hook itself.
  const onEventRef = useRef(options?.onEvent);
  // Update the ref on every render so callers always see the latest callback.
  // No dependency array — runs every render (fine: it is a ref write, not setState).
  useEffect(() => {
    onEventRef.current = options?.onEvent;
  });

  // Hold the channel across renders without triggering re-renders on assignment.
  // Type is inferred from the client instance held in supabaseRef.
  const channelRef = useRef<ReturnType<typeof supabaseRef.current.channel> | null>(null);

  const [state, setState] = useState<GameStateSnapshot | null>(null);
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [participantCount, setParticipantCount] = useState(0);

  useEffect(() => {
    const sb = supabaseRef.current;
    let cancelled = false;

    // fetchState is defined inside the effect so it closes over the current
    // gameId/playerId values without needing to be in the dependency list.
    // The function is safe to call multiple times (idempotent read).
    const fetchState = async () => {
      const res = await fetch(
        `/api/game/state?gameId=${gameId}&playerId=${playerId}`
      );
      // WR-03: guard after each async boundary. fetchState is invoked from the
      // visibilitychange handler and the SUBSCRIBED callback, both of which can
      // resolve after the component has unmounted (or after [gameId, playerId]
      // changed). Without these checks, setState would run on an unmounted
      // component — a React warning and a potential leak.
      if (cancelled) return;
      if (res.ok) {
        const data: GameStateSnapshot = await res.json();
        if (cancelled) return;
        setState(data);
      }
    };

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

    // ----------------------------------------------------------------
    // STRICTMODE-SAFE ASYNC SETUP (Pitfall 2)
    //
    // React 19 StrictMode fires the effect, then immediately unmounts and
    // remounts. The cleanup calls sb.removeChannel(channel), which sets the
    // channel's underlying Phoenix state to "leaving" synchronously — but the
    // channel remains in the SDK's registry (this.channels) until the server
    // acknowledges the leave (async). On the second mount, sb.channel(topic)
    // finds the leaving/joined channel in the registry and RETURNS IT instead
    // of creating a fresh one. Calling .on("presence", ...) on an
    // already-joined/joining channel throws.
    //
    // Fix: at setup start, if our own previous channel (tracked by
    // channelRef.current) is still in the registry, await its full removal
    // before creating a new one. Using `cancelled` guard ensures that if the
    // component unmounts again before setup completes, we do not proceed.
    // ----------------------------------------------------------------
    async function setup() {
      // ---- StrictMode guard -------------------------------------------------
      // If our previous channel is still registered (e.g. StrictMode re-mount
      // before the async removeChannel Promise resolved), wait for it to clear.
      // We only remove the channel we own (channelRef.current) — never touching
      // channels created by sibling hook instances using the same topic.
      const prev = channelRef.current;
      if (prev !== null && sb.getChannels().some((c) => c === prev)) {
        await sb.removeChannel(prev);
        channelRef.current = null;
      }

      // Bail out if the component was unmounted while we were awaiting above.
      if (cancelled) return;

      // ----------------------------------------------------------------
      // Channel setup — created once per [gameId, playerId] pair.
      //
      // BROADCAST is registered first (no SDK guard for broadcast type).
      //
      // PRESENCE is registered in a try/catch. The SDK throws
      // "cannot add `presence` callbacks … after `subscribe()`" when the
      // channel returned by sb.channel() is already in joined/joining state —
      // which happens when a sibling hook on the same page (same singleton
      // client) has already subscribed to this topic (SDK deduplicates by
      // topic). In that case we fall back to a one-shot read of presenceState()
      // and skip the redundant subscribe() call (Pitfall 2 + shared-channel).
      // ----------------------------------------------------------------
      const channel = sb
        .channel(`game:${gameId}`)

        // BROADCAST: each GAME_EVENT is a typed signal that data has changed.
        // Re-fetch from the DB for authoritative state — NEVER read game data
        // off the event payload (D-06, T-02-05 — forged/replayed broadcasts
        // cannot corrupt displayed state when the DB is always the source).
        //
        // onEventRef.current fires BEFORE fetchState() so transient events like
        // COUNTDOWN_STARTED (which have no DB representation) can be captured
        // by the Display Mode shell before the re-fetch overwrites hook state.
        // onEventRef is updated on every render (see useEffect above the main
        // effect) so the closure always calls the latest callback. The ref
        // pattern avoids adding onEvent to the [gameId, playerId] dep array,
        // which would recreate the channel subscription on every render.
        .on("broadcast", { event: "GAME_EVENT" }, async ({ payload }) => {
          const event = payload as GameEvent;
          onEventRef.current?.(event);
          await fetchState();
        });

      // PRESENCE: try to register sync listener and subscribe.
      // This succeeds on a fresh channel (closed state). It throws on a channel
      // already in joined/joining state (shared via SDK dedup). In the shared
      // case we read presenceState() once and skip subscribe() — the sibling
      // instance that owns the channel drives future presence updates.
      try {
        channel
          // Registered BEFORE .subscribe() so the handler is in place before
          // the first "sync" fires (presence sync fires immediately after SUBSCRIBED).
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

              // subscribe-then-fetch (RT-03): fetch authoritative state NOW,
              // before processing any queued events. This is the reconnect
              // resync path — runs on initial connect AND every SDK reconnect.
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
      } catch {
        // Channel already subscribed by a sibling hook instance (SDK topic dedup).
        // Broadcast listener is already registered above — SC1 still works.
        // We cannot register a presence "sync" listener on an already-joined
        // channel (SDK throws). Instead:
        //   - fetch authoritative state immediately (subscribe-then-fetch, RT-03)
        //   - defer the presence count read by one macrotask tick so the owning
        //     instance's track() call has time to resolve — produces an honest
        //     count that matches the primary pane rather than a stale zero.
        setStatus("connected");
        await fetchState();
        // Defer so the primary instance's track() round-trip can complete first.
        // Wrapped in a cancelled guard so we do not set state after unmount.
        setTimeout(() => {
          if (!cancelled) {
            setParticipantCount(Object.keys(channel.presenceState()).length);
          }
        }, 300);
      }

      channelRef.current = channel;
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    void setup();

    // ----------------------------------------------------------------
    // CLEANUP — runs on unmount and on every [gameId, playerId] change.
    //
    // Order matters:
    //   1. Set cancelled = true so any in-flight setup() bails out immediately
    //      (prevents attaching listeners to a channel we no longer own).
    //   2. Remove the visibilitychange listener (prevents fetchState() firing
    //      on a partially-torn-down channel).
    //   3. channel.untrack() removes this client's presence entry from the
    //      server before the channel tears down. This is critical in React 19
    //      StrictMode: without untrack(), the first mount's presence entry
    //      lingers until the server ages it out, causing ghost entries to
    //      accumulate across StrictMode double-mount cycles (D-04, D-09).
    //   4. sb.removeChannel() starts async teardown — sets the underlying
    //      Phoenix channel to "leaving" synchronously, then awaits server ack.
    //      If setup() is still awaiting a prior removeChannel(), the cancelled
    //      guard prevents it from creating a new channel after cleanup fires.
    // ----------------------------------------------------------------
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (channelRef.current !== null) {
        const ch = channelRef.current;
        channelRef.current = null;
        // untrack() before removeChannel() so the server removes this client's
        // presence entry cleanly. Fire-and-forget: cleanup is synchronous,
        // but untrack + removeChannel are both async teardown — the channel
        // leaves shortly after. Ignoring the returned promise is intentional
        // (effect cleanup cannot be async per React contract).
        void ch.untrack().finally(() => {
          void sb.removeChannel(ch);
        });
      }
    };
  }, [gameId, playerId]); // stable — only re-run when game or player changes

  return { state, status, participantCount };
}
