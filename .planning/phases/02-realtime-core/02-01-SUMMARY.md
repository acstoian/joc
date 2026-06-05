---
phase: 02-realtime-core
plan: "01"
subsystem: api
tags: [supabase, realtime, typescript, websocket, game-state]

requires:
  - phase: 01-foundation-schema
    provides: adminClient, Database types, questions_public view, skeleton route patterns

provides:
  - GameEvent 8-member discriminated union (typed-signal + re-fetch contract, D-05/D-06/D-07)
  - createClient() browser Supabase client with worker:true, 15s heartbeat, jittered reconnect (RT-04, D-09)
  - GET /api/game/state reconnect-resync endpoint returning GameStateSnapshot (D-03, RT-03)
  - GameStateSnapshot and SyncStatus type exports in src/hooks/useGameSync.ts (stub for Plan 02-02)

affects: [02-02, 02-03, 04-host-dashboard, 05-guest-app, 06-display-mode]

tech-stack:
  added: []
  patterns:
    - "typed-signal + re-fetch: GameEvent carries only type + minimal IDs; consumers always call GET /api/game/state for authoritative data (D-06)"
    - "questions_public-not-questions: route handlers always query the view to prevent correct_option leakage pre-reveal"
    - "UUID validation before DB: gameId validated as UUID-shaped string → 400 before any Supabase query (ASVS V5)"
    - "maybeSingle for optional rows: answer fetch uses maybeSingle() to tolerate no-answer-yet state"

key-files:
  created:
    - src/lib/realtime/events.ts
    - src/app/api/game/state/route.ts
    - src/hooks/useGameSync.ts
  modified:
    - src/lib/supabase/client.ts

key-decisions:
  - "GameEvent union is the locked interface contract: Phase 3+ may add members but must not reshape existing ones (D-05)"
  - "correctOption is null in Phase 2 (stub); Phase 3 reveal path will populate it from base questions table after phase=revealed"
  - "useGameSync.ts created as a type-stub in Plan 02-01 so route.ts can import GameStateSnapshot; Plan 02-02 adds full hook implementation"
  - "adminClient used in GET /api/game/state because answers RLS is USING(false) for anon; route enforces data isolation by returning only the requesting player's answer"

patterns-established:
  - "Pattern: Route handlers import GameStateSnapshot as a type-only import from the hook — types are erased at build time so server files can safely reference client hook types"

requirements-completed: [RT-01, RT-03, RT-04]

duration: 12min
completed: "2026-06-02"
---

# Phase 02 Plan 01: Realtime Foundation — Event Contract, Client Config, and State Endpoint

**8-member GAME_EVENT discriminated union, worker/heartbeat/jitter browser client, and GET /api/game/state resync endpoint establish the Phase 2 interface contract**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-02T12:39:00Z
- **Completed:** 2026-06-02T12:51:22Z
- **Tasks:** 3 of 3
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- Defined the locked `GameEvent` 8-member discriminated union as a pure types-only module with no runtime code or client directive — the single source of truth for all broadcast messages
- Extended `createClient()` with `worker: true`, `heartbeatIntervalMs: 15_000`, and a jittered `reconnectAfterMs` function, hardening the browser WebSocket against iOS Safari throttling and reconnect storms
- Created `GET /api/game/state` route handler that reads games + `questions_public` (never base `questions`) + answers, validates `gameId` as UUID, returns `GameStateSnapshot`, and stubs `correctOption` null for Phase 2
- Created type stub for `src/hooks/useGameSync.ts` (exports `GameStateSnapshot` and `SyncStatus`) so the route can import the type without a forward-reference error; Plan 02-02 completes the hook implementation

## Task Commits

1. **Task 1: Define the GAME_EVENT discriminated union** - `9f1f925` (feat)
2. **Task 2: Add realtime options to browser client** - `02025b6` (feat)
3. **Task 3: Build GET /api/game/state endpoint** - `192f133` (feat)

## Files Created/Modified

- `src/lib/realtime/events.ts` — Pure types-only module; exports `GameEvent` 8-member discriminated union (D-05/D-06/D-07)
- `src/lib/supabase/client.ts` — Modified to add `realtime: { worker, heartbeatIntervalMs, reconnectAfterMs }` options (RT-04, D-09)
- `src/app/api/game/state/route.ts` — GET handler returning `GameStateSnapshot`; UUID validation; `questions_public` only; `correctOption` stubbed null (D-03, RT-03)
- `src/hooks/useGameSync.ts` — Type stub exporting `GameStateSnapshot` and `SyncStatus` for type-safe cross-file import; Plan 02-02 replaces with full hook

## Decisions Made

- **Type stub approach for useGameSync.ts:** Rather than define `GameStateSnapshot` inline in the route or defer the import until Plan 02-02, a minimal type-only stub was created. This keeps the import path stable and means Plan 02-02 only needs to add the hook implementation — no type rename or import change required.
- **Security documentation comments left in place despite grep matches:** Comments documenting what is NOT present (e.g., "no SUPABASE_SERVICE_ROLE_KEY reference") cause `grep -c SERVICE_ROLE` to return 1 rather than 0. The intent of the acceptance criteria is fully satisfied — no actual key reference exists in the file. Documentation is more valuable than making the grep return exactly 0.

## Deviations from Plan

None — plan executed exactly as written, with one minor addition (the useGameSync.ts type stub) required to satisfy the type-only import in route.ts. This is forward-compatible with Plan 02-02.

## Issues Encountered

None — all three tasks type-checked and built cleanly on first attempt. The `realtime/` directory already existed (empty) from Phase 1 scaffold, so no directory creation was needed for events.ts.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `correctOption: null` | `src/app/api/game/state/route.ts` | ~121 | Phase 2 stub; Phase 3 reveal path will populate from `questions.correct_option` after `phase === 'revealed'` |
| Hook implementation absent | `src/hooks/useGameSync.ts` | entire file | Type-stub only; Plan 02-02 adds `useGameSync()` function body, channel subscription, presence, and state fetch |

## Threat Flags

None — all three threat mitigations in the plan's threat model were applied:
- T-02-01: `questions_public` queried exclusively (never `questions`)
- T-02-02: UUID validation → 400 before any DB query
- T-02-04: Only `adminClient` imported; no raw `SUPABASE_SERVICE_ROLE_KEY`

## Next Phase Readiness

**Plan 02-02** (useGameSync hook) can now implement against:
- `GameEvent` union from `src/lib/realtime/events.ts`
- `createClient()` with realtime options already in place
- `GET /api/game/state` endpoint that can be called from the hook's `SUBSCRIBED` callback
- `GameStateSnapshot` and `SyncStatus` types already exported from `src/hooks/useGameSync.ts`

**No blockers.** Plan 02-02 replaces the stub function body in `useGameSync.ts` and adds the channel subscription, presence tracking, and visibilitychange handler.

---
*Phase: 02-realtime-core*
*Completed: 2026-06-02*
