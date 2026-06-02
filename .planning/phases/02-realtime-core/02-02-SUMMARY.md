---
phase: 02-realtime-core
plan: "02"
subsystem: realtime
tags: [supabase, realtime, broadcast, presence, websocket, hooks, typescript]

requires:
  - phase: 02-realtime-core/02-01
    provides: GameEvent union, createClient() with worker/heartbeat/jitter, GET /api/game/state endpoint, SyncStatus + GameStateSnapshot type stubs

provides:
  - useGameSync(gameId, playerId) headless hook — Broadcast subscription + subscribe-then-fetch + presence + visibilitychange resilience (D-01, RT-01/03/04)
  - SyncStatus type — "connecting" | "connected" | "reconnecting" | "error" (complete, was stub)
  - GameStateSnapshot type — authoritative resync shape (complete, was stub)

affects: [02-03, 04-host-dashboard, 05-guest-app, 06-display-mode]

tech-stack:
  added: []
  patterns:
    - "subscribe-then-fetch: fetch /api/game/state in every SUBSCRIBED callback (initial connect + every reconnect) before processing queued events (RT-03)"
    - "typed-signal + re-fetch: GAME_EVENT payload is ignored for data; re-fetch from DB is always the source of truth (D-06, T-02-05)"
    - "supabaseRef pattern: hold createBrowserClient singleton in useRef to satisfy react-hooks/exhaustive-deps without listing supabase in deps"
    - "track() exactly once per (re)connection in SUBSCRIBED branch — never in render/broadcast paths (D-04/D-09, T-02-07)"
    - "visibilitychange handler calls fetchState() only — must not call channel.subscribe() again (Pitfall 4 prevention)"
    - "removeChannel cleanup before StrictMode double-mount creates orphaned channel (Pitfall 2)"

key-files:
  created: []
  modified:
    - src/hooks/useGameSync.ts

key-decisions:
  - "supabaseRef pattern chosen over declaring supabase in hook body: avoids false-positive react-hooks/exhaustive-deps warning (createBrowserClient is a singleton, the instance is stable, but ESLint cannot verify that)"
  - "Tasks 1 and 2 implemented atomically in a single write: the hook has no useful intermediate state — Task 2 presence/visibilitychange code is inseparable from Task 1 channel setup in the same useEffect block; combined into one commit"
  - "postgres_changes appears only in a documentation comment explaining the prohibition — no actual subscription exists; this mirrors the Plan 02-01 precedent for security documentation comments"

patterns-established:
  - "Pattern: supabaseRef = useRef(createClient()) inside hook body; read as supabaseRef.current inside useEffect to hold stable singleton without deps list leakage"
  - "Pattern: presence .on('presence', { event: 'sync' }) registered BEFORE .subscribe() so the handler fires on the first sync event immediately after SUBSCRIBED"
  - "Pattern: visibilitychange calls only fetchState() — converges with SUBSCRIBED re-fetch path without creating duplicate subscriptions"

requirements-completed: [RT-01, RT-03, RT-04, RT-06]

duration: 4min
completed: "2026-06-02"
---

# Phase 02 Plan 02: useGameSync Hook — Subscribe-then-Fetch, Presence, and Visibilitychange Resilience

**Headless `useGameSync(gameId, playerId)` hook wraps Supabase Broadcast + subscribe-then-fetch + single-track presence + visibilitychange defense into the single sync primitive for all three game surfaces**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-02T12:56:31Z
- **Completed:** 2026-06-02T13:00:00Z
- **Tasks:** 2 of 2 (combined into 1 commit — see Deviations)
- **Files modified:** 1

## Accomplishments

- Replaced the Plan 02-01 type stub with a complete 207-line hook implementation
- Implemented subscribe-then-fetch: `fetchState()` fires in every `SUBSCRIBED` callback (initial connect and every SDK auto-reconnect) — authoritative state is always re-fetched before any queued events are processed (RT-03)
- Wired GAME_EVENT broadcast handler: each event triggers `fetchState()` only; payload data is never trusted (D-06, T-02-05 tamper defense)
- Presence: `.on("presence", { event: "sync" })` registered before `.subscribe()`, derives `participantCount` from `channel.presenceState()`, `track()` called exactly once in `SUBSCRIBED` branch (D-04, D-09, T-02-07)
- Visibilitychange: handler calls `fetchState()` only — does not call `channel.subscribe()` again, preventing orphaned duplicate subscriptions (Pitfall 4)
- StrictMode-safe cleanup: `removeChannel(channel)` fully tears down the channel so the second React 19 StrictMode mount creates a fresh channel (Pitfall 2)
- Used `supabaseRef = useRef(createClient())` to hold the singleton reference stably inside the hook, eliminating the ESLint exhaustive-deps false positive

## Task Commits

1. **Tasks 1+2: useGameSync full implementation** - `34fcb59` (feat)

## Files Created/Modified

- `src/hooks/useGameSync.ts` — Full hook implementation replacing the Plan 02-01 type stub; exports `useGameSync`, `SyncStatus`, `GameStateSnapshot`; 207 lines including inline pitfall documentation

## Deviations from Plan

### Implementation Decisions

**1. [Deviation - Atomic Implementation] Tasks 1 and 2 combined into a single commit**
- **Found during:** Task 1 implementation
- **Issue:** The plan intended Task 1 (core subscribe-then-fetch) and Task 2 (presence + visibilitychange) to be separate commits. However, both tasks modify the identical `useEffect` block in the same file. The presence `.on("presence", ...)` handler must be chained before `.subscribe()`, and the visibilitychange handler and its cleanup are both in the same effect closure. There is no meaningful intermediate state to commit.
- **Fix:** Implemented both tasks in a single write pass, committed as a single atomic commit with a message covering both tasks.
- **Files modified:** `src/hooks/useGameSync.ts`
- **Commit:** `34fcb59`

**2. [Deviation - ESLint fix] supabaseRef pattern for stable singleton reference**
- **Found during:** Build verification (Task 1)
- **Issue:** `const supabase = createClient()` in the hook body triggered a `react-hooks/exhaustive-deps` warning because `supabase` was used inside `useEffect` but not in the dependency list.
- **Fix:** Changed to `const supabaseRef = useRef(createClient())` and read as `supabaseRef.current` inside the effect. The ref object is stable (never changes), so it does not need to be in the deps list — this satisfies ESLint without adding a spurious dependency that would re-create the channel on every render. This pattern matches RESEARCH.md Pattern 2 intent.
- **Files modified:** `src/hooks/useGameSync.ts`
- **Commit:** `34fcb59`

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `myAnswer: null` | `src/app/api/game/state/route.ts` | ~121 | Carried from Plan 02-01; Phase 3 (JOIN-02/03) will populate from player's recorded answer |
| `correctOption: null` | `src/app/api/game/state/route.ts` | ~124 | Carried from Plan 02-01; Phase 3 (HOST-04) will populate after phase === "revealed" |
| `device_token: "stub-token"` | `src/hooks/useGameSync.ts` | ~153 | Phase 3 (JOIN-02/03) swaps for real display_name from player join flow; current stub reads localStorage "device_token" with fallback |

## Threat Flags

None — all three threat mitigations in the plan's threat model were applied:
- T-02-05: GAME_EVENT payload never used as data source; always re-fetches `/api/game/state` (D-06)
- T-02-06: Only `createClient` (anon key) imported; no `@/lib/supabase/admin` import in hook; `grep service_role` returns 0
- T-02-07: `channel.track()` called exactly once (grep -c "\.track(" = 1); never in broadcast handler or render path

## Self-Check: PASSED

- `src/hooks/useGameSync.ts` exists and is 207 lines
- Commit `34fcb59` exists in git log
- Build passes cleanly (no errors, no warnings)
- `grep -n "use client" src/hooks/useGameSync.ts` → line 1
- `grep -c "postgres_changes" src/hooks/useGameSync.ts` → 1 (documentation comment only, no actual subscription)
- `grep -c "\.track(" src/hooks/useGameSync.ts` → 1 (exactly one track call)
- `grep -n "removeChannel" src/hooks/useGameSync.ts` → present in cleanup
- `grep -n "presenceState" src/hooks/useGameSync.ts` → present
- `grep -n "visibilitychange" src/hooks/useGameSync.ts` → present
- `export type SyncStatus` and `export type GameStateSnapshot` preserved from Plan 02-01 stub
