# Phase 2: Realtime Core - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers the **`useGameSync` sync primitive** — the shared client hook that subscribes to the `game:{gameId}` Supabase Broadcast channel, recovers authoritative state on (re)connect via subscribe-then-fetch, and survives unstable mobile connections. This is the heartbeat all three later surfaces (guest, host, TV) sit on top of.

**In scope (MVP vertical slice):**
- A headless `useGameSync(gameId, playerId)` hook returning `{ state, status, participantCount }`.
- The `GET /api/game/state` reconnect-resync endpoint.
- A typed broadcast **event contract** (full GAME_EVENT union) + the realtime client configuration (worker, jitter, heartbeat, visibilitychange).
- Presence wiring (`channel.track()` + `participantCount`) using a stub identity.
- A **throwaway `/sync-demo` harness** (host-trigger buttons + two subscriber panes) that proves all Phase 2 success criteria, then is removed/replaced by real surfaces in later phases.

**Out of scope (belongs to later phases):**
- Real guest join / device-token handshake / real player identity → Phase 3 (JOIN-02/03).
- Real host controls + host-picks-correct write → Phase 3 (HOST-04) / Phase 4 (QSTN-04).
- Any production guest/host/TV UI → Phases 4/5/6.
- Scoring, answer writes, state-machine transitions on the server → Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Hook Surface & Deliverable
- **D-01:** `useGameSync` is **headless** — it exposes `{ state, status, participantCount }` (and whatever connection-status enum is needed) for consumers to render. It ships **no production UI** in Phase 2.
- **D-02:** Phase 2's visible/shippable proof is a **throwaway `/sync-demo` harness** (full version): host-side buttons fire each GAME_EVENT via a server action that calls the existing `broadcast()` helper; **two subscriber panes** display connection status, `participantCount`, the last received event type, and the re-fetched authoritative state. Modeled on Phase 1's `/skeleton/ping` throwaway pattern — removed/replaced when real surfaces are built.

### Reconnect Resync Endpoint
- **D-03:** `GET /api/game/state` returns the **fuller authoritative shape** — the `games` row (`phase`, `current_question_id`) **plus** the current question and the player's existing answer — with fields **stubbed/null where Phase 3's write path will fill them in**. This sets the Phase 2/3 boundary: the endpoint contract is defined now; Phase 3 populates the join/answer-dependent parts.

### Presence (Participant Count)
- **D-04:** Presence is **wired into the hook now**. The hook calls `channel.track()` with a **device-token stub identity** (localStorage device token + placeholder name) and exposes `participantCount` derived from `presenceState()`. Phase 3 swaps the stub for the real player's `display_name` (JOIN-02/03). Must respect the presence pitfall: **do not flood `track()`** — track once per (re)connection, never in a render loop.

### Broadcast Event Contract
- **D-05:** Phase 2 defines the **full 8-member GAME_EVENT discriminated union now**: `GAME_STARTED`, `QUESTION_STARTED`, `ANSWERS_LOCKED`, `ANSWER_REVEALED`, `SCORES_UPDATED`, `ROUND_RESET`, `GAME_ENDED`, `COUNTDOWN_STARTED`. Covers every host transition (HOST-02–07) plus the cosmetic countdown (DISP-08). Phase 3 may **extend** the union but should not need to reshape it.
- **D-06:** **Event semantics = typed signal + always re-fetch.** Events carry `{ type, gameId, ...minimal ids }` only. The event **type** drives which transition/animation a consumer plays, but clients **always re-fetch `GET /api/game/state`** for authoritative data. This honors the roadmap-locked subscribe-then-fetch rule and makes the system immune to missed/out-of-order/un-replayed broadcasts. Events are **not** a second source of truth.
- **D-07:** `ANSWER_REVEALED` is modeled as a **live host action that carries the chosen correct option (A/B)**. Product decision (cross-phase): **the host selects the correct answer live at reveal time, per question — not at authoring time.** In Phase 2 this is exercised only by the demo's reveal control (pick A/B live); the real host-picks-correct write/UI lands in Phase 3 (HOST-04) / Phase 4 (QSTN-04), which MUST honor "choose correct live."

### Reconnect Verification
- **D-08:** Phase 2 acceptance proves the 60s screen-lock reconnect (success criterion 2) via **simulation** — DevTools offline toggle + tab backgrounding to fire `visibilitychange` → immediate reconnect + state-fetch. **Real-device proof is deferred to the Phase 7 production dry run (RT-08), and must cover BOTH iOS Safari and Android Chrome.** `visibilitychange`/`worker` handling is treated as **cross-platform**, not iOS-only.

### Scale
- **D-09:** The primitive must hold at **100+ concurrent clients (RT-05)**. Concretely: jittered reconnect to avoid **reconnect storms** (all clients re-fetching at once), and single-`track()`-per-connection to avoid **presence flooding**. Phase 2 designs for this even though true load is validated in Phase 7.

### Carried Forward (locked by ROADMAP / research — not re-decided here)
- Supabase **Broadcast only**; **no client-side `postgres_changes`** subscription for game state (RT-02).
- Realtime client configured with **`worker: true`**, **jittered `reconnectAfterMs`**, **15s heartbeat**.
- **Subscribe-then-fetch** on connect; **re-fetch on every reconnect**.
- Reuse the existing **`broadcast(topic, event, payload)`** helper in `src/lib/supabase/admin.ts` — Phase 2 consumes it, does not rebuild it.

### Claude's Discretion
- Exact hook return-type shape and file location (e.g. `src/hooks/useGameSync.ts`).
- Location/structure of the event-union TypeScript types (e.g. `src/lib/realtime/events.ts`).
- How realtime client options (`worker`, `heartbeatIntervalMs`, `reconnectAfterMs`) are injected — extend `src/lib/supabase/client.ts` vs a dedicated realtime-client factory. **Note:** current `createClient()` passes **no** `realtime` options, so Phase 2 must add them.
- `/sync-demo` route path naming and (throwaway) styling.
- Connection-status enum naming and the precise `state` object surface.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Realtime architecture & sync primitive
- `.planning/research/ARCHITECTURE.md` — channel design (one `game:{gameId}` channel for all surfaces), the `useGameSync` subscribe-then-fetch sketch, reconnect/resync strategy, and the `GET /api/game/state` contract (see §"Channel Design", §"Reconnect and Resync Strategy", §"Pattern 1: Subscribe-then-Fetch").
- `.planning/research/PITFALLS.md` — Postgres Changes fan-out (avoid), iOS Safari screen-lock disconnects (`worker:true` + `visibilitychange`), reconnect storms (jitter + always state-fetch), presence `track()` flooding.
- `.planning/research/STACK.md` — pinned `@supabase/supabase-js` / `@supabase/ssr` versions and realtime client options; `motion` import path (later phases).

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 2: Realtime Core" — goal + the 5 success criteria (the prescriptive locked mechanics).
- `.planning/REQUIREMENTS.md` — RT-01, RT-03, RT-04, RT-06 (this phase) + RT-02, RT-05 (carried-forward constraints).

### Existing Phase 1 assets (consume, don't rebuild)
- `.planning/phases/01-foundation-schema/01-ARTIFACTS.md` — authoritative list of Phase 1 symbols (`broadcast()`, `createClient()`, `adminClient`, `games` schema, `/api/skeleton-answer` pattern, `Database` type).
- `src/lib/supabase/admin.ts` — server-only `adminClient` + `broadcast(topic, event, payload)` REST-broadcast helper (used by the demo server action).
- `src/lib/supabase/client.ts` — browser `createClient()` (the hook builds on this; needs realtime options added).
- `src/app/api/skeleton-answer/route.ts` — Route Handler pattern (NextResponse + `adminClient`) to model `GET /api/game/state` on.
- `src/types/database.ts` — generated `Database` type for typed queries.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`broadcast(topic, event, payload)`** (`src/lib/supabase/admin.ts`): server-side REST broadcast. The `/sync-demo` host buttons fire GAME_EVENTs through this from a server action — no server-side WebSocket.
- **`createClient()`** (`src/lib/supabase/client.ts`): typed `createBrowserClient<Database>` (anon key). The hook subscribes via this client. **Gap:** it currently sets no `realtime` options — Phase 2 must add `worker:true`, `heartbeatIntervalMs`, jittered `reconnectAfterMs`.
- **`games` row** (schema in `01-ARTIFACTS.md`): canonical state machine (`phase` in lobby/question/locked/revealed/ended, `current_question_id`). `GET /api/game/state` reads from it.
- **`/api/skeleton-answer`**: existing Route Handler showing the `adminClient` + `NextResponse` + error-code pattern to mirror for `GET /api/game/state`.

### Established Patterns
- **Throwaway harness pattern** (Phase 1's `/skeleton/ping` + `/api/skeleton-answer`): a self-contained route that proves a stack capability and is removed when the real feature arrives. `/sync-demo` follows this.
- **Key isolation**: service-role only via server-only modules (`import "server-only"`); browser uses anon key. The hook is client-side (anon); the demo's broadcast trigger is server-side (service role).

### Integration Points
- The hook connects browser clients to the `game:{gameId}` Broadcast channel and to `GET /api/game/state`.
- The demo server action connects host actions to `broadcast()`.
- `participantCount` from presence is the integration seam Phase 4's HOST-08 live count will reuse.

</code_context>

<specifics>
## Specific Ideas

- "The game will have 100+ players" — the sync primitive (presence fan-out, broadcast delivery, reconnect re-fetch) must not choke at 100+ concurrent (RT-05).
- "I want the host to select the answer live, for each question" — correct A/B is chosen by the host at reveal time during the game, not pre-set at authoring. Reflected in `ANSWER_REVEALED` (D-07) and the demo's reveal control; real write deferred to Phase 3/4.
- Reconnect resilience must be proven on **both iOS and Android** (real-device pass in Phase 7), not iOS-only.

</specifics>

<deferred>
## Deferred Ideas

- **Reusable "Reconnecting…" UI component** — Phase 2's hook only exposes `status`; a shared visible indicator lands with the real surfaces (Phase 5/6).
- **Real player identity in presence** (`display_name`) — Phase 3 (JOIN-02/03) swaps the device-token stub.
- **Real host-picks-correct write + UI** — Phase 3 (HOST-04) / Phase 4 (QSTN-04); must implement "choose correct live, per question" per D-07.
- **Per-event self-contained payloads** — current decision (D-06) is typed-signal + re-fetch; revisit only if a measured latency need appears.
- **Real-device 60s screen-lock proof (iOS Safari + Android Chrome)** — Phase 7 production dry run (RT-08).
- **True 100+ concurrent load test** — Phase 7 dry run (RT-05/RT-08); Phase 2 only designs against the pitfalls.

</deferred>

---

*Phase: 02-realtime-core*
*Context gathered: 2026-06-02*
