# Phase 2: Realtime Core - Research

**Researched:** 2026-06-02
**Domain:** Supabase Realtime Broadcast + Presence, `useGameSync` hook, subscribe-then-fetch pattern, `GET /api/game/state` endpoint, `/sync-demo` throwaway harness
**Confidence:** HIGH (all critical API surface verified against installed node_modules source; library versions pinned and verified)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `useGameSync` is headless — exposes `{ state, status, participantCount }`. Ships no production UI in Phase 2.
- **D-02:** Phase 2's shippable proof is a throwaway `/sync-demo` harness: host-side buttons fire each GAME_EVENT via a server action calling the existing `broadcast()` helper; two subscriber panes display connection status, `participantCount`, last received event type, and the re-fetched authoritative state. Modeled on Phase 1's `/skeleton/ping` throwaway pattern.
- **D-03:** `GET /api/game/state` returns the games row (`phase`, `current_question_id`) plus the current question and the player's existing answer — with Phase 3 fields stubbed/null. Sets the Phase 2/3 boundary.
- **D-04:** Presence wired into the hook now. Hook calls `channel.track()` with a device-token stub identity (localStorage device token + placeholder name). Exposes `participantCount` from `presenceState()`. Do not flood `track()` — track once per (re)connection.
- **D-05:** Full 8-member GAME_EVENT discriminated union defined now: `GAME_STARTED`, `QUESTION_STARTED`, `ANSWERS_LOCKED`, `ANSWER_REVEALED`, `SCORES_UPDATED`, `ROUND_RESET`, `GAME_ENDED`, `COUNTDOWN_STARTED`.
- **D-06:** Event semantics = typed signal + always re-fetch. Events carry `{ type, gameId, ...minimal ids }` only. Clients always re-fetch `GET /api/game/state` for authoritative data.
- **D-07:** `ANSWER_REVEALED` carries the chosen correct option (A/B). Host selects correct answer live at reveal time, not at authoring time. Phase 2 demo exercises this; real write deferred to Phase 3/4.
- **D-08:** Phase 2 acceptance proves 60s screen-lock reconnect via simulation (DevTools offline toggle + tab backgrounding). Real-device proof deferred to Phase 7 (RT-08). `visibilitychange`/`worker` handling is cross-platform.
- **D-09:** Primitive must hold at 100+ concurrent clients: jittered reconnect + single-`track()`-per-connection.
- **Carried forward:** Supabase Broadcast only; no client-side `postgres_changes` for game state. Client configured with `worker: true`, jittered `reconnectAfterMs`, 15s heartbeat. Subscribe-then-fetch on connect; re-fetch on every reconnect. Reuse existing `broadcast()` helper in `src/lib/supabase/admin.ts`.

### Claude's Discretion

- Exact hook return-type shape and file location (e.g. `src/hooks/useGameSync.ts`).
- Location/structure of the event-union TypeScript types (e.g. `src/lib/realtime/events.ts`).
- How realtime client options (`worker`, `heartbeatIntervalMs`, `reconnectAfterMs`) are injected — extend `src/lib/supabase/client.ts` vs a dedicated realtime-client factory.
- `/sync-demo` route path naming and (throwaway) styling.
- Connection-status enum naming and the precise `state` object surface.

### Deferred Ideas (OUT OF SCOPE)

- Reusable "Reconnecting..." UI component (Phase 5/6).
- Real player identity in presence (`display_name`) — Phase 3 (JOIN-02/03).
- Real host-picks-correct write + UI — Phase 3 (HOST-04) / Phase 4 (QSTN-04).
- Per-event self-contained payloads.
- Real-device 60s screen-lock proof (iOS Safari + Android Chrome) — Phase 7 (RT-08).
- True 100+ concurrent load test — Phase 7 (RT-05/RT-08).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RT-01 | Current question, reveal, scores, and round transitions sync live across all clients (guest, host, TV) | Subscribe-then-fetch + GAME_EVENT union covers all transitions; two-tab demo proves delivery |
| RT-03 | Clients recover authoritative state via subscribe-then-fetch on (re)connect | `SUBSCRIBED` callback triggers fetch; `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` callbacks re-fetch; verified against installed realtime-js types |
| RT-04 | Reconnect handles unstable mobile connections (jittered backoff, `worker:true`, visibilitychange) | All three options verified in `RealtimeClientOptions` type; `worker` delegates heartbeat to Web Worker; `visibilitychange` fires immediate reconnect+fetch; default heartbeat is 25s — must be overridden to 15s |
| RT-06 | UI is mobile-first and responsive, with smooth animations on low-end phones | Phase 2 is headless (no UI animations); Zustand store pattern defers re-renders; hook returns `status` for downstream use |
</phase_requirements>

---

## Summary

Phase 2 builds the single sync primitive that all three game surfaces will share: a headless `useGameSync(gameId, playerId)` hook backed by a Supabase Broadcast channel and a `GET /api/game/state` reconnect-resync endpoint. The hook subscribes to `game:{gameId}`, fetches authoritative state on every `SUBSCRIBED` event (initial connect and every reconnect), tracks presence for `participantCount`, and exposes a typed `status` enum so consumers can render connection state. A throwaway `/sync-demo` harness proves all five success criteria before any production game UI exists.

The critical implementation path is narrow and well-understood. All three required Realtime client options (`worker`, `heartbeatIntervalMs`, `reconnectAfterMs`) are directly supported by `RealtimeClientOptions` (verified in installed `@supabase/realtime-js@2.106.2`), passed through `SupabaseClientOptions.realtime` to `createBrowserClient`. The subscribe-then-fetch ordering is governed by the `REALTIME_SUBSCRIBE_STATES` enum whose values are `SUBSCRIBED`, `TIMED_OUT`, `CLOSED`, and `CHANNEL_ERROR` — each non-SUBSCRIBED status triggers a re-fetch. The full GAME_EVENT union (8 members, D-05) is defined in a single types file that Phase 3 extends but does not reshape.

Two gotchas require attention: (1) `createBrowserClient` is a **module-level singleton** in browser environments — the `realtime` options passed on first call are the only ones that take effect; adding them to the factory in `src/lib/supabase/client.ts` is the correct approach. (2) React 19 / Next.js 15.3 enables StrictMode in development by default, which fires `useEffect` twice in quick succession — the channel cleanup (`supabase.removeChannel(channel)`) on the first unmount must fully teardown the subscription so the second mount creates a fresh channel, otherwise the channel enters an errored state.

**Primary recommendation:** Extend `src/lib/supabase/client.ts` to accept and forward `realtime` options; use a `useRef`-backed channel reference inside `useGameSync` to handle StrictMode double-mount cleanly; re-fetch authoritative state in the `SUBSCRIBED` callback only, and separately on `visibilitychange` if the channel is not already `SUBSCRIBED`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Broadcast channel subscription | Browser / Client | — | WebSocket connection is client-held; serverless functions cannot hold long-lived WebSocket |
| Presence tracking (`track()`) | Browser / Client | — | Presence is per-connection state; must live in the client that holds the WebSocket |
| Authoritative state fetch (`GET /api/game/state`) | API / Backend | — | Reads DB (games + questions_public); uses anon key via Route Handler; single source of truth |
| Server-side broadcast trigger | API / Backend | — | Uses `broadcast()` REST helper (service_role); fires from server action in demo |
| Realtime client configuration (`worker`, heartbeat, jitter) | Browser / Client | — | `RealtimeClientOptions` are constructor-time config for the browser WebSocket client |
| GAME_EVENT type union | Shared (types file) | — | Pure TypeScript types; imported by both client hook and server action for type safety |
| `/sync-demo` harness | Browser / Client + API / Backend | — | Page is a client component; host-trigger buttons call a server action |

---

## Standard Stack

### Core (Phase 1 deliverables — consume, do not re-create)

| Asset | Version / Path | Purpose | Status |
|-------|---------------|---------|--------|
| `@supabase/supabase-js` | 2.106.2 (installed) | Realtime channel, presence, DB queries | Installed |
| `@supabase/ssr` | 0.10.0 (installed, `^0.10.0`) | `createBrowserClient` singleton factory | Installed |
| `src/lib/supabase/client.ts` | — | Typed browser `createClient()` | **Must extend with `realtime` options** |
| `src/lib/supabase/admin.ts` | — | `broadcast(topic, event, payload)` REST helper | Reuse as-is |
| `src/types/database.ts` | — | Generated `Database` type | Reuse as-is |
| Next.js | 15.3.9 (installed) | App Router, Route Handlers, Server Actions | Installed |
| React | 19.x | Hooks, StrictMode | Installed |
| TypeScript | ^5.9.0 | Strict type checking | Installed |

### New in Phase 2

| Asset | Purpose | Notes |
|-------|---------|-------|
| `src/hooks/useGameSync.ts` | Headless hook returning `{ state, status, participantCount }` | Client component only; uses `"use client"` guard |
| `src/lib/realtime/events.ts` | GAME_EVENT discriminated union (8 members, D-05) | Pure types file; no runtime code |
| `src/app/api/game/state/route.ts` | `GET /api/game/state` reconnect-resync endpoint | Route Handler pattern; uses `adminClient` |
| `src/app/sync-demo/page.tsx` | Throwaway demo harness | Removed/replaced in Phases 4–6 |
| `src/app/actions/demo-broadcast.ts` | Server Action wrapping `broadcast()` for demo buttons | Server-only; throwaway alongside demo |

**No new npm packages required.** All dependencies are installed.

---

## Package Legitimacy Audit

> No new packages are installed in Phase 2. All required packages were installed in Phase 1. Audit is vacuous.

| Package | Registry | Status | Disposition |
|---------|----------|--------|-------------|
| `@supabase/supabase-js@2.106.2` | npm | Installed Phase 1 | Approved — verified in node_modules |
| `@supabase/ssr@0.10.x` | npm | Installed Phase 1 | Approved — verified in node_modules |

**Packages removed due to slopcheck:** none  
**Packages flagged as suspicious:** none  
**New installs this phase:** none

---

## Architecture Patterns

### System Architecture Diagram

```
[/sync-demo page]
      │
      ├── [SubscriberPane A]  <── useGameSync("game-id", "stub-player-a")
      │         │
      │         └── WebSocket ──► Supabase Realtime "game:{gameId}" channel
      │                  │              (Broadcast + Presence)
      │                  │
      ├── [SubscriberPane B]  <── useGameSync("game-id", "stub-player-b")
      │         │
      │         └── WebSocket ──► (same channel, second subscriber)
      │
      └── [HostControls]
              │
              └── Server Action ──► broadcast() REST helper
                                          │
                               POST /realtime/v1/api/broadcast
                                          │
                                  Supabase Realtime cluster
                                  fans out to both subscribers

On (re)subscription SUBSCRIBED event:
  useGameSync ──► GET /api/game/state?gameId=X&playerId=Y
                              │
                     adminClient reads:
                       games row (phase, current_question_id)
                       + questions_public row (body, option_a, option_b)
                       + answers row for playerId (choice or null)
                              │
                     returns GameStateResponse JSON
```

### Recommended Project Structure (Phase 2 additions)

```
src/
├── hooks/
│   └── useGameSync.ts          # headless hook: subscribe + fetch + presence
├── lib/
│   ├── realtime/
│   │   └── events.ts           # GAME_EVENT discriminated union (8 members)
│   └── supabase/
│       └── client.ts           # MODIFIED: add realtime options
├── app/
│   ├── api/
│   │   └── game/
│   │       └── state/
│   │           └── route.ts    # GET /api/game/state
│   ├── actions/
│   │   └── demo-broadcast.ts   # Server Action for demo host buttons (throwaway)
│   └── sync-demo/
│       └── page.tsx            # throwaway demo harness
```

### Pattern 1: Extending createClient with Realtime Options

`createBrowserClient` is a **module-level singleton**: the first call in a browser process creates and caches the client; subsequent calls return the cached instance. Realtime options passed after first creation are ignored.

The correct approach is to add `realtime` options inside `createClient()` in `src/lib/supabase/client.ts`:

```typescript
// Source: @supabase/supabase-js src/lib/types.ts line 222
//         @supabase/realtime-js dist/main/RealtimeClient.d.ts
// [VERIFIED: npm registry — confirmed in installed node_modules]

// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        // Web Worker heartbeat: harder for iOS to throttle (Pitfall 12)
        worker: true,

        // 15s heartbeat (default is 25s — too close to iOS kill threshold)
        heartbeatIntervalMs: 15_000,

        // Jittered reconnect: spreads 100 simultaneous reconnects over 2s window
        // Default is stepped [1000, 2000, 5000, 10000] with no jitter (Pitfall 3)
        reconnectAfterMs: (tries: number) => {
          const base = [1_000, 2_000, 5_000, 10_000][Math.min(tries - 1, 3)];
          return base + Math.random() * 2_000;
        },
      },
    }
  );
}
```

**Key facts verified from installed source:**
- `RealtimeClientOptions.worker` — boolean, defaults to `false` [VERIFIED: npm registry]
- `RealtimeClientOptions.heartbeatIntervalMs` — number (ms), defaults to **25000** (not 30000) [VERIFIED: npm registry — `CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL = 25000` in `RealtimeClient.js:12`]
- `RealtimeClientOptions.reconnectAfterMs` — `(tries: number) => number`, defaults to stepped `[1000, 2000, 5000, 10000]` capped at 10000 [VERIFIED: npm registry — `RECONNECT_INTERVALS` in `RealtimeClient.js:16`]
- `SupabaseClientOptions.realtime` — `RealtimeClientOptions | undefined`, passed directly to the internal `RealtimeClient` constructor [VERIFIED: npm registry — `src/lib/types.ts:222`]
- `createBrowserClient` accepts `SupabaseClientOptions` via its `options` parameter (spread into `createClient()`) [VERIFIED: npm registry — `createBrowserClient.d.ts`]

### Pattern 2: Subscribe-then-Fetch with Reconnect Re-fetch

```typescript
// Source: .planning/research/ARCHITECTURE.md §"Pattern 1: Subscribe-then-Fetch"
// [VERIFIED: @supabase/realtime-js REALTIME_SUBSCRIBE_STATES enum in installed node_modules]

// src/hooks/useGameSync.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GameEvent } from "@/lib/realtime/events";

export type SyncStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export type GameStateSnapshot = {
  phase: "lobby" | "question" | "locked" | "revealed" | "ended";
  currentQuestionId: string | null;
  currentQuestion: {
    id: string;
    body: string;
    optionA: string;
    optionB: string;
  } | null;
  myAnswer: "A" | "B" | null; // null until Phase 3 populates
  correctOption: "A" | "B" | null; // null until revealed
};

export function useGameSync(gameId: string, playerId: string) {
  const supabase = createClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [state, setState] = useState<GameStateSnapshot | null>(null);
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [participantCount, setParticipantCount] = useState(0);

  // Stable fetch function — does not change across renders
  const fetchState = async () => {
    const res = await fetch(
      `/api/game/state?gameId=${gameId}&playerId=${playerId}`
    );
    if (res.ok) {
      const data: GameStateSnapshot = await res.json();
      setState(data);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel(`game:${gameId}`)
      // Broadcast: each GAME_EVENT triggers a state re-fetch (D-06)
      .on("broadcast", { event: "GAME_EVENT" }, async ({ payload }) => {
        const event = payload as GameEvent;
        // event carries only type + minimal ids; re-fetch for authoritative data
        await fetchState();
        // Optionally store last event type for demo display
      })
      // Presence: derive participantCount from presenceState() on sync
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState();
        setParticipantCount(Object.keys(presenceState).length);
      })
      .subscribe(async (status) => {
        // status values: "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR"
        // [VERIFIED: REALTIME_SUBSCRIBE_STATES enum in @supabase/realtime-js]
        if (status === "SUBSCRIBED") {
          setStatus("connected");
          // subscribe-then-fetch: fetch authoritative state NOW
          await fetchState();
          // Track presence with stub identity (Phase 3 swaps for real display_name)
          const deviceToken =
            typeof window !== "undefined"
              ? localStorage.getItem("device_token") ?? "stub-token"
              : "stub-token";
          await channel.track({
            player_id: playerId,
            device_token: deviceToken,
          });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setStatus("reconnecting");
          // SDK auto-reconnects; on next SUBSCRIBED we re-fetch
        } else if (status === "CLOSED") {
          setStatus("error");
        }
      });

    channelRef.current = channel;

    // visibilitychange: re-subscribe + re-fetch when tab becomes visible (Pitfall 12)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        // Re-subscribe only if not already subscribed
        // SDK may have already reconnected; status check prevents duplicate track()
        await fetchState();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // supabase.removeChannel fully tears down the channel
      // StrictMode fires this cleanup then re-runs the effect once — that's correct
      supabase.removeChannel(channel);
    };
  }, [gameId, playerId]); // stable dependency list

  return { state, status, participantCount };
}
```

### Pattern 3: GAME_EVENT Discriminated Union (D-05)

```typescript
// src/lib/realtime/events.ts
// 8-member union covering all host transitions (HOST-02..07) + cosmetic countdown (DISP-08)

export type GameEvent =
  | { type: "GAME_STARTED";      gameId: string }
  | { type: "QUESTION_STARTED";  gameId: string; questionId: string }
  | { type: "ANSWERS_LOCKED";    gameId: string; questionId: string }
  | { type: "ANSWER_REVEALED";   gameId: string; questionId: string; correctOption: "A" | "B" }
  | { type: "SCORES_UPDATED";    gameId: string }
  | { type: "ROUND_RESET";       gameId: string; questionId: string }
  | { type: "GAME_ENDED";        gameId: string }
  | { type: "COUNTDOWN_STARTED"; gameId: string; seconds: number };
```

All payloads carry only `type` + minimal IDs. Consumers re-fetch `GET /api/game/state` for authoritative data (D-06). Phase 3 may **add** members or optional fields but must not reshape existing members.

### Pattern 4: GET /api/game/state Route Handler

Modeled on `src/app/api/skeleton-answer/route.ts` (adminClient + NextResponse + typed error codes):

```typescript
// src/app/api/game/state/route.ts
// [VERIFIED: skeleton-answer pattern in codebase; Database type in src/types/database.ts]

import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import type { GameStateSnapshot } from "@/hooks/useGameSync";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get("gameId");
  const playerId = searchParams.get("playerId"); // may be null for TV/host

  if (!gameId) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }

  // Fetch games row
  const { data: game, error: gameError } = await adminClient
    .from("games")
    .select("phase, current_question_id")
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  // Fetch current question via questions_public view (hides correct_option pre-reveal)
  let currentQuestion = null;
  if (game.current_question_id) {
    const { data: q } = await adminClient
      .from("questions_public")
      .select("id, body, option_a, option_b")
      .eq("id", game.current_question_id)
      .single();
    if (q) {
      currentQuestion = {
        id: q.id!,
        body: q.body!,
        optionA: q.option_a!,
        optionB: q.option_b!,
      };
    }
  }

  // Fetch player's existing answer (null if not yet answered or playerId not supplied)
  let myAnswer: "A" | "B" | null = null;
  if (playerId && game.current_question_id) {
    const { data: answer } = await adminClient
      .from("answers")
      .select("choice")
      .eq("player_id", playerId)
      .eq("question_id", game.current_question_id)
      .maybeSingle();
    if (answer?.choice === "A" || answer?.choice === "B") {
      myAnswer = answer.choice;
    }
  }

  // correctOption: only readable after reveal; Phase 3 populates via direct questions read
  // For Phase 2, stub as null — will be populated by Phase 3's reveal write path
  const correctOption: "A" | "B" | null = null; // stub — Phase 3 will fill

  const snapshot: GameStateSnapshot = {
    phase: game.phase as GameStateSnapshot["phase"],
    currentQuestionId: game.current_question_id,
    currentQuestion,
    myAnswer,
    correctOption,
  };

  return NextResponse.json(snapshot);
}
```

**Important:** `questions_public` is the correct view to query (hides `correct_option`). Do not query `questions` base table from the client path until `phase === 'revealed'`. In Phase 2 the endpoint always stubs `correctOption: null` — Phase 3's reveal write path will update `questions.correct_option` and Phase 3 will update this endpoint to return it.

### Pattern 5: Demo Server Action for Host Trigger Buttons

```typescript
// src/app/actions/demo-broadcast.ts — throwaway, removed with /sync-demo
"use server";

import { broadcast } from "@/lib/supabase/admin";
import type { GameEvent } from "@/lib/realtime/events";

export async function demoBroadcast(gameId: string, event: GameEvent) {
  await broadcast(`game:${gameId}`, "GAME_EVENT", event as Record<string, unknown>);
}
```

### Anti-Patterns to Avoid

- **Creating the channel inside the render function body (not `useEffect`):** The channel is created on every render. `useEffect` with stable `[gameId, playerId]` deps is the correct placement.
- **Calling `channel.track()` in a render loop or on every broadcast event:** Presence flooding. Track once in the `SUBSCRIBED` callback only (D-04, Pitfall 3).
- **Using `.on('postgres_changes', ...)` in any client component for game state tables:** Violates RT-02 and runs 100 RLS queries per host action at scale (Pitfall 1). Verified success criterion 5 requires zero such subscriptions.
- **Passing `realtime` options to a second `createClient()` call in the browser:** `createBrowserClient` is a module-level singleton; only first-call options apply. The factory in `src/lib/supabase/client.ts` must carry all options.
- **Trusting `document.visibilityState` as the reconnect trigger alone:** The SDK may already have reconnected. The `visibilitychange` handler should always call `fetchState()` — the re-fetch is idempotent and cheap. Avoid calling `channel.subscribe()` again if the channel is already `SUBSCRIBED`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket reconnect with backoff | Custom retry loop with `setTimeout` | `reconnectAfterMs` option in `RealtimeClientOptions` | SDK handles all reconnect state machine; custom retry creates a second reconnect loop that races with the SDK |
| Heartbeat keepalive | `setInterval` ping to Supabase | `heartbeatIntervalMs: 15_000` + `worker: true` | SDK heartbeat runs off the main thread via Web Worker; custom interval runs on main thread and is throttled by iOS Safari |
| Fan-out to 100 clients | `postgres_changes` subscriptions | Supabase Broadcast REST API (existing `broadcast()` helper) | Postgres Changes runs 1 RLS query per subscriber per event; Broadcast runs 0 DB queries for delivery |
| Presence participant count | Custom player-connected table with polling | `channel.presenceState()` + `on('presence', { event: 'sync' })` | SDK maintains this automatically; no DB polling needed |
| Authoritative state de-duplication | Client-side event buffering | Always re-fetch `GET /api/game/state` on every reconnect | Broadcast is ephemeral; the DB is always correct; re-fetch is the only safe source of truth |

**Key insight:** Every custom solution for these problems is either slower, less reliable, or breaks iOS Safari's aggressive WebSocket throttling.

---

## Common Pitfalls

### Pitfall 1: Default Heartbeat (25s) Is Too Close to iOS Kill Threshold

**What goes wrong:** iOS Safari kills the WebSocket heartbeat when the phone is locked or the tab is backgrounded. The default heartbeat interval in `@supabase/realtime-js@2.106.2` is **25 seconds** (verified in `RealtimeClient.js:12`: `HEARTBEAT_INTERVAL: 25000`). iOS Safari's kill threshold for background JavaScript is approximately 30 seconds — leaving only a 5-second margin. Under any additional latency (venue Wi-Fi, CPU throttling) the heartbeat misses and the connection drops silently.

**Why it happens:** Developers assume the default is safe. It is not for live events on locked phones.

**How to avoid:** Set `heartbeatIntervalMs: 15_000` in `RealtimeClientOptions`. This gives iOS a 2× safety margin and means disconnection is detected in 15s not 25s (so reconnect starts sooner).

**Warning signs:** Supabase connection graph shows periodic drops during testing when phone is locked. Guests report "game froze" after checking another app.

---

### Pitfall 2: React StrictMode Double-Subscribe (Channel in Bad State)

**What goes wrong:** Next.js 15.3 enables React StrictMode by default in development (`reactStrictMode` is true unless explicitly disabled). StrictMode fires `useEffect`, then immediately unmounts and remounts the component. If `supabase.removeChannel(channel)` in the cleanup does not fully teardown the subscription before the second mount creates a new channel with the same name, the second channel starts in an errored or orphaned state. The demo subscriber pane never reaches `SUBSCRIBED`.

**Why it happens:** Supabase channel names are strings on a shared client instance. If a channel with the same topic string is created while the previous one is still tracked (even briefly), the internal channel map has a conflict.

**How to avoid:** `supabase.removeChannel(channel)` fully removes the channel from the client's internal registry. The cleanup function in the `useEffect` return must call this. Because `createBrowserClient` is a singleton, the second mount's `createClient()` call returns the same client instance — `removeChannel` correctly operates on the same registry. The sequence is: effect1 creates channel → cleanup1 removes channel → effect2 creates fresh channel with the same topic string → reaches `SUBSCRIBED` normally.

**Warning signs:** Demo subscriber pane shows `CHANNEL_ERROR` immediately in development but works in production. Or the pane gets stuck on `connecting` after a fast refresh.

---

### Pitfall 3: `track()` Called on Every Broadcast Event (Presence Flooding)

**What goes wrong:** The `on('broadcast', ...)` callback or a `useEffect` dependency causes `channel.track()` to be called on every received broadcast event. With 100 guests, every host action triggers 100 simultaneous `track()` calls across all clients, flooding the presence channel and degrading performance for all subscribers.

**Why it happens:** Developers call `track()` inside the broadcast handler to "refresh" presence state, or call it during re-renders triggered by state updates.

**How to avoid:** Call `channel.track()` exactly once: in the `SUBSCRIBED` callback, after the initial state fetch. Never call `track()` in a render-triggered callback. The presence state updates automatically via `on('presence', { event: 'sync' }, ...)` — `track()` only needs to be called when the client connects or reconnects.

**Warning signs:** Supabase Presence logs show continuous `track` events. `participantCount` flickers during gameplay. Presence `sync` callbacks fire more than once per second during normal play.

---

### Pitfall 4: `visibilitychange` Reconnect Calls `subscribe()` on an Already-Subscribed Channel

**What goes wrong:** The `visibilitychange` handler calls `channel.subscribe()` again after the tab becomes visible. If the SDK already reconnected during backgrounding, the second `subscribe()` call creates a duplicate subscription, and subsequent `removeChannel()` cleanup only removes one of them.

**Why it happens:** The SDK's auto-reconnect may complete before `visibilitychange` fires (especially on Android Chrome which is less aggressive about killing WebSockets). Calling `subscribe()` on an already-`SUBSCRIBED` channel creates an orphaned subscription.

**How to avoid:** The `visibilitychange` handler should only call `fetchState()`. If the connection was dropped, the SDK's auto-reconnect fires its own `SUBSCRIBED` callback which also calls `fetchState()` — so both paths converge. Do NOT call `channel.subscribe()` in the `visibilitychange` handler.

**Warning signs:** Demo shows `participantCount` doubling after tab focus change. Console shows multiple `SUBSCRIBED` log entries for the same channel.

---

### Pitfall 5: `GET /api/game/state` Queries `questions` Instead of `questions_public`

**What goes wrong:** The route handler reads `questions` base table, which includes `correct_option`. During the `question` and `locked` phases, this leaks the correct answer to any client that calls the endpoint — breaking game fairness.

**Why it happens:** The `questions_public` view exists specifically to hide `correct_option`. Developers reading `adminClient` (which bypasses RLS) may not realize RLS would have protected against this on the anon client.

**How to avoid:** `GET /api/game/state` MUST query `questions_public` for the current question data in all phases. For Phase 2, `correctOption` is always `null` in the response. Phase 3 adds the `revealed` phase path that reads `correct_option` directly from the base `questions` table.

**Warning signs:** Pre-reveal `GET /api/game/state` response contains a non-null `correctOption` value.

---

### Pitfall 6: `createBrowserClient` Singleton Ignores Second-Call `realtime` Options

**What goes wrong:** A developer adds `realtime` options to a second call to `createClient()` (e.g. in a different component) expecting them to override the defaults. Because `createBrowserClient` returns a cached instance in browser environments, the options on subsequent calls are silently ignored. The client was initialized with empty options on the first call (the current `createClient()` in `client.ts`), so `worker: false`, default heartbeat (25s), and no jitter apply regardless of what later calls pass.

**How to avoid:** All `realtime` options must be in the **single factory function** `createClient()` in `src/lib/supabase/client.ts`. This is the only call site that matters.

---

## Code Examples

### Verified RealtimeClientOptions from Installed node_modules

```typescript
// Source: @supabase/realtime-js@2.106.2 dist/main/RealtimeClient.d.ts (installed)
// [VERIFIED: npm registry]
type RealtimeClientOptions = {
  worker?: boolean;                              // default: false
  workerUrl?: string;                            // default: https://realtime.supabase.com/worker.js
  heartbeatIntervalMs?: number;                  // default: 25000 (CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL)
  reconnectAfterMs?: (tries: number) => number;  // default: [1000,2000,5000,10000] stepped, capped 10000
  // ... other options (transport, timeout, headers, etc.)
};
```

### Verified subscribe() callback signature

```typescript
// Source: @supabase/realtime-js@2.106.2 dist/main/RealtimeChannel.d.ts line 207
// [VERIFIED: npm registry]
enum REALTIME_SUBSCRIBE_STATES {
  SUBSCRIBED    = "SUBSCRIBED",
  TIMED_OUT     = "TIMED_OUT",
  CLOSED        = "CLOSED",
  CHANNEL_ERROR = "CHANNEL_ERROR",
}

channel.subscribe(
  (status: REALTIME_SUBSCRIBE_STATES, err?: Error) => void,
  timeout?: number
): RealtimeChannel;
```

### Verified Presence API

```typescript
// Source: @supabase/realtime-js@2.106.2 dist/main/RealtimeChannel.d.ts
// [VERIFIED: npm registry]

// track() — call once in SUBSCRIBED callback only
channel.track(payload: { [key: string]: any }, opts?: { [key: string]: any }): Promise<RealtimeChannelSendResponse>;

// presenceState() — returns map of presenceKey → array of Presence objects
channel.presenceState<T extends { [key: string]: any } = {}>(): RealtimePresenceState<T>;
// RealtimePresenceState<T> = { [key: string]: Array<{ presence_ref: string } & T> }

// Presence events: "sync" | "join" | "leave"
channel.on("presence", { event: "sync" }, () => void): RealtimeChannel;
channel.on("presence", { event: "join" }, (payload: RealtimePresenceJoinPayload<T>) => void): RealtimeChannel;
channel.on("presence", { event: "leave" }, (payload: RealtimePresenceLeavePayload<T>) => void): RealtimeChannel;

// Deriving participantCount
const count = Object.keys(channel.presenceState()).length;
```

### Verified broadcast .on() signature

```typescript
// Source: @supabase/realtime-js@2.106.2 dist/main/RealtimeChannel.d.ts line 281
// [VERIFIED: npm registry]

channel.on(
  "broadcast",
  { event: string },   // event name filter
  (payload: {
    type: "broadcast";
    event: string;
    payload: T;           // typed payload
    meta?: { replayed?: boolean; id: string };
  }) => void
): RealtimeChannel;
```

### createBrowserClient Singleton Behavior

```javascript
// Source: @supabase/ssr@0.10.x dist/main/createBrowserClient.js (installed)
// [VERIFIED: npm registry]

let cachedBrowserClient;  // module-level singleton

function createBrowserClient(url, key, options) {
  const shouldUseSingleton = options?.isSingleton === true ||
    ((!options || !("isSingleton" in options)) && isBrowser());

  if (shouldUseSingleton && cachedBrowserClient) {
    return cachedBrowserClient;  // RETURNS CACHED — options ignored
  }
  // ... creates new client
  if (shouldUseSingleton) {
    cachedBrowserClient = client;
  }
  return client;
}
```

**Implication:** Realtime options in `createClient()` must be set before the first render. The factory in `src/lib/supabase/client.ts` is the correct and only place.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2023 | Old package deprecated; `@supabase/ssr` provides `createBrowserClient`/`createServerClient` |
| `heartbeatIntervalMs` default 30s (community assumption) | **25s** (verified in installed v2.106.2) | Undocumented change | Phase 2 target is 15s regardless; but the default is 25s not 30s |
| `framer-motion` package | `motion` package, import from `motion/react` | 2024 | Not relevant Phase 2 (headless); relevant Phase 4+ |
| Supabase Postgres Changes for game state | Supabase Broadcast (verified as correct) | Always — but commonly misused | 100x query amplification at scale; Broadcast is the standard for this pattern |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `visibilitychange` on Android Chrome and iOS Safari both fire reliably when a locked-phone tab returns to foreground | Common Pitfalls / Pattern 2 | Phase 2 simulates via DevTools; real-device proof deferred to Phase 7. If the event doesn't fire on some devices, the hook's `SUBSCRIBED` re-fetch path is the fallback — state is still recovered, just with a ~15s delay | 
| A2 | `worker: true` delegates heartbeat to a Web Worker at `https://realtime.supabase.com/worker.js`, which iOS Safari does not kill on lock | Architecture Patterns / Standard Stack | `workerUrl` defaults to the Supabase CDN worker; if the CDN URL is unavailable the worker fails silently and falls back to main-thread heartbeat. No impact on correctness, only on iOS resilience |
| A3 | The `questions_public` view is readable by `adminClient` (which bypasses RLS) | Pattern 4: GET /api/game/state | adminClient uses service_role key which bypasses all RLS; views are still readable. Verified by the fact that Phase 1's skeleton route uses `adminClient.from("games")` successfully |

**If this table is empty:** All claims in this research were verified or cited. The three assumptions above are behavioral properties that require runtime observation, not API correctness claims.

---

## Open Questions

1. **Does the `worker: true` heartbeat survive iOS 17+ background kill?**
   - What we know: `worker: true` uses an offloaded Web Worker for heartbeats; official Supabase docs recommend it for mobile; the pitfall research documents it as the correct mitigation.
   - What's unclear: Whether iOS 17+ specifically allows Web Workers from Supabase's CDN to remain alive during screen lock. The behavior is confirmed as community best practice but not officially documented by Supabase for the 60s lock case.
   - Recommendation: Implement `worker: true` + `heartbeatIntervalMs: 15_000` + `visibilitychange` as the triple defense. Accept that Phase 2 proves it via DevTools simulation (D-08) and defers real-device proof to Phase 7 (RT-08). This is the correct per-CONTEXT.md decision and requires no further resolution in Phase 2.

2. **Should `GET /api/game/state` use anon key or adminClient?**
   - What we know: The route fetches `games` (public readable via anon RLS), `questions_public` (anon readable), and `answers` for a specific `player_id` (anon RLS is USING(false) — blocked for anon reads). Phase 2 stubs `myAnswer` as null. But Phase 3 must populate it.
   - What's unclear: When Phase 3 populates `myAnswer`, should the endpoint use adminClient (bypasses RLS) or add an anon SELECT policy on `answers`?
   - Recommendation: Use `adminClient` in the Route Handler for Phase 2. Document this as a Phase 3 decision point. The security boundary is enforced by the route handler itself (only returns data for the `playerId` in the query string), not by RLS on the endpoint. This is consistent with the `skeleton-answer` pattern.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/supabase-js` | `useGameSync`, all Realtime | Yes | 2.106.2 | — |
| `@supabase/ssr` | `createBrowserClient` | Yes | ^0.10.0 | — |
| `@supabase/realtime-js` | (transitive dep) | Yes | 2.106.2 | — |
| Next.js 15.3.9 | Route Handlers, Server Actions | Yes | 15.3.9 | — |
| Supabase cloud project | Realtime channel, DB | Yes (Phase 1 deployed) | Pro plan | — |
| `src/lib/supabase/admin.ts` | `broadcast()` helper | Yes (Phase 1) | — | — |
| `src/types/database.ts` | Typed DB queries | Yes (Phase 1) | — | — |

**Missing dependencies with no fallback:** none  
**Missing dependencies with fallback:** none

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None configured (CLAUDE.md: "No test framework is configured") |
| Config file | none |
| Quick run command | n/a |
| Full suite command | n/a |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RT-01 | Two tabs on same channel receive broadcast within 1s | Manual (two-tab demo) | n/a | n/a |
| RT-03 | Re-fetch fires on `SUBSCRIBED` (initial + reconnect) | Manual (DevTools offline toggle) | n/a | n/a |
| RT-04 | `worker: true` + jitter set in client config | Code review (grep `realtime:` in client.ts) | n/a | n/a |
| RT-06 | Hook is headless; no layout-blocking code | Code review | n/a | n/a |

### Verification Approach (no test framework)

Phase 2 success criteria are verified manually via the `/sync-demo` harness:
1. **SC1** (two-tab broadcast): Open two browser tabs to `/sync-demo?gameId=X`; click host-trigger button in one tab; observe both subscriber panes update within 1s.
2. **SC2** (60s screen-lock): Use DevTools Network → Offline for 60s; go Online; observe auto-reconnect and state display without manual refresh.
3. **SC3** (client config): `grep "worker: true" src/lib/supabase/client.ts` + `grep "heartbeatIntervalMs" src/lib/supabase/client.ts` pass; no matches in Phase 2 code for `.on('postgres_changes'`.
4. **SC4** (visibilitychange): Background the browser tab for 30s; bring to foreground; observe state-fetch fires.
5. **SC5** (no postgres_changes): `grep -r "postgres_changes" src/` returns zero matches in client components.

### Wave 0 Gaps

None — no test framework to configure. Verification is via the `/sync-demo` harness (built as part of Phase 2) and manual checklist.

---

## Security Domain

### Applicable ASVS Categories (security_enforcement: true, ASVS Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase 2 has no auth gate (demo is unauthenticated; host auth is Phase 3/4) |
| V3 Session Management | No | No session tokens in Phase 2 |
| V4 Access Control | Partial | `GET /api/game/state` must not return `correct_option` pre-reveal (queries `questions_public` view, not base `questions` table) |
| V5 Input Validation | Yes | `gameId` and `playerId` query params must be validated as UUID strings before DB query; reject empty/malformed inputs with 400 |
| V6 Cryptography | No | No new cryptographic operations |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Spoofed `playerId` in `GET /api/game/state` query param | Information Disclosure | Endpoint only returns that player's own answer; no other player data is exposed; no auth gate required for Phase 2 (answers are stub null) |
| Answer-spoofing via `correct_option` leak from state endpoint | Tampering | Query `questions_public` view (not base `questions` table); view omits `correct_option` column; verified in Phase 1 `questions_public` definition |
| Service role key in client bundle via accidental import | Elevation of Privilege | `src/lib/supabase/admin.ts` has `import "server-only"` guard; `GET /api/game/state` uses `adminClient` which is server-only; enforced by build error if imported client-side |
| GAME_EVENT payload injection | Tampering | Events are broadcast server→client only; clients receive events but cannot inject them into the channel (Broadcast is fire-from-server; client Broadcast requires channel auth which is not configured here) |

---

## Sources

### Primary (HIGH confidence)

- `@supabase/realtime-js@2.106.2` installed source — `RealtimeClient.d.ts`, `RealtimeChannel.d.ts`, `RealtimePresence.d.ts`, `RealtimeClient.js:11-17` — exact option names, status enum values, presence API, default heartbeat (25s) and reconnect schedule ([1000,2000,5000,10000])
- `@supabase/supabase-js@2.106.2` installed source — `src/lib/types.ts:222` (`SupabaseClientOptions.realtime?: RealtimeClientOptions`), `src/lib/constants.ts:35` (`DEFAULT_REALTIME_OPTIONS = {}`)
- `@supabase/ssr@0.10.x` installed source — `createBrowserClient.js:9-17` (singleton caching behavior, `isSingleton` flag)
- `.planning/research/ARCHITECTURE.md` — subscribe-then-fetch pattern, channel design, component responsibilities (HIGH confidence, cited from official Supabase Realtime docs)
- `.planning/research/PITFALLS.md` — iOS Safari WebSocket kill (Pitfall 12), thundering herd jitter (Pitfall 3), Postgres Changes fan-out (Pitfall 1), presence flooding (Anti-Pattern 3)
- `.planning/research/STACK.md` — pinned versions, `@supabase/ssr` pattern, Realtime integration patterns
- `.planning/phases/01-foundation-schema/01-ARTIFACTS.md` — canonical Phase 1 symbols
- `src/lib/supabase/admin.ts` — `broadcast()` helper signature and implementation (verified in codebase)
- `src/lib/supabase/client.ts` — current `createClient()` (no `realtime` options; gap identified)
- `src/app/api/skeleton-answer/route.ts` — Route Handler pattern (NextResponse + adminClient + typed error codes)
- `src/types/database.ts` — generated `Database` type with all table shapes

### Secondary (MEDIUM confidence)

- `.planning/research/ARCHITECTURE.md §"Pattern 1: Subscribe-then-Fetch"` — subscribe-before-fetch race prevention (verified by community post-mortems cited in PITFALLS.md)

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Realtime client API (option names, types) | HIGH | Verified from installed node_modules source (`@supabase/realtime-js@2.106.2`) |
| Default values (heartbeat 25s, reconnect schedule) | HIGH | Verified from `RealtimeClient.js` runtime constants in installed node_modules |
| `createBrowserClient` singleton behavior | HIGH | Verified from `createBrowserClient.js` in installed node_modules |
| Subscribe-then-fetch pattern | HIGH | Verified via ARCHITECTURE.md + community post-mortems in PITFALLS.md |
| iOS Safari `worker: true` behavior | MEDIUM | Community consensus + Supabase docs recommendation; not officially benchmarked for 60s lock |
| `visibilitychange` cross-platform reliability | MEDIUM | Standard browser API; behavior on specific iOS/Android versions needs Phase 7 real-device proof |
| `GET /api/game/state` correctness (`questions_public` for pre-reveal) | HIGH | `questions_public` view schema verified in `src/types/database.ts` and Phase 1 artifacts |

**Research date:** 2026-06-02
**Valid until:** 2026-08-01 (Supabase Realtime API is stable; verify if `@supabase/realtime-js` major version bumps)
