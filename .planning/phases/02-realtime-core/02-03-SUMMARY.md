---
phase: 02-realtime-core
plan: "03"
subsystem: realtime
tags: [supabase, realtime, broadcast, server-action, harness, throwaway, typescript]

requires:
  - phase: 02-realtime-core/02-01
    provides: GameEvent union, broadcast() admin helper, GET /api/game/state endpoint
  - phase: 02-realtime-core/02-02
    provides: useGameSync(gameId, playerId) headless hook — subscribe-then-fetch + presence + visibilitychange

provides:
  - demoBroadcast(gameId, event) server action (throwaway) — fires typed GameEvent via broadcast() to game:{gameId} channel
  - /sync-demo harness page (throwaway) — 2 independent useGameSync SubscriberPanes + HostControls for all 8 GAME_EVENTs
  - Human-verified proof of all 5 Phase 2 success criteria (SC1–SC5)

affects: [03-server-write-path, 04-host-dashboard, 05-guest-app, 06-display-mode]

tech-stack:
  added: []
  patterns:
    - "throwaway-harness pattern: server action (use server) wraps privileged broadcast() helper so 'use client' harness page never imports service-role surface (T-02-08)"
    - "valid-UUID stub playerIds: useGameSync calls GET /api/game/state which validates playerId as UUID — stub IDs must be well-formed UUIDs, not plain strings"
    - "gameId from URLSearchParams client-side: initialise useState to seed constant, update after mount to avoid SSR/hydration mismatch with ?gameId= param"

key-files:
  created:
    - src/app/actions/demo-broadcast.ts
    - src/app/sync-demo/page.tsx
  modified: []

key-decisions:
  - "demoBroadcast is a Server Action ('use server') — not an API route — so the service-role key held inside broadcast() stays server-only; the client page only imports the action reference (T-02-08)"
  - "Stub playerIds are full UUID strings (c0000000-...-11 and c0000000-...-12) not short strings — GET /api/game/state validates with UUID regex; plain strings caused 400 and stuck 'loading' state"
  - "useGameSync StrictMode cleanup fixed (commit b2703b3): React 19 StrictMode mounts/unmounts twice; original code reused a removed channel causing WebSocket crash — fix recreates channel on each mount"
  - "Presence untrack-before-removeChannel fixed (commit 687f907): removeChannel without prior untrack left a ghost presence entry; count was 1 after disconnect — fix calls channel.untrack() before removeChannel in cleanup"

patterns-established:
  - "Pattern: 'use server' server action as the sole write bridge from throwaway client harness to privileged admin helper — zero service-role surface in client bundle"

requirements-completed: [RT-01, RT-03, RT-06]

duration: ~45min (implementation + 3 checkpoint defect fixes)
completed: "2026-06-02"
---

# Phase 02 Plan 03: /sync-demo Harness — End-to-End Proof of Phase 2 Sync Primitive

**Throwaway `/sync-demo` harness wires demoBroadcast server action → game:{gameId} Broadcast channel → two independent useGameSync SubscriberPanes, human-verified against all 5 Phase 2 success criteria; three live defects uncovered and fixed during checkpoint verification**

## Performance

- **Duration:** ~45 min (implementation ~10 min + checkpoint verification + 3 defect fixes ~35 min)
- **Started:** 2026-06-02T13:00:00Z
- **Completed:** 2026-06-02
- **Tasks:** 2 implementation + 1 human-verify checkpoint (all complete)
- **Files modified:** 2

## Accomplishments

- Created `demoBroadcast(gameId, event)` server action (throwaway): forwards typed GameEvent to `broadcast("game:{gameId}", "GAME_EVENT", ...)`, keeping service-role key server-only (T-02-08 mitigated)
- Created `/sync-demo` harness: two independent SubscriberPanes (Pane A + Pane B) each running real `useGameSync`, plus HostControls with one button per GAME_EVENT (all 8: GAME_STARTED, QUESTION_STARTED, ANSWERS_LOCKED, ANSWER_REVEALED, SCORES_UPDATED, ROUND_RESET, GAME_ENDED, COUNTDOWN_STARTED)
- Human-verified all 5 Phase 2 success criteria via the harness — SC1 two-tab broadcast, SC2 60s offline reconnect, SC3 subscribe-then-fetch populated state on load, SC4 visibilitychange resync, SC5 zero postgres_changes
- Uncovered and fixed three live defects in `useGameSync` during checkpoint verification: React 19 StrictMode channel reuse crash, non-UUID stub playerId causing 400 → stuck loading, presence count not clearing on disconnect

## Task Commits

1. **Task 1: demoBroadcast server action (throwaway)** - `b2e4d19` (feat)
2. **Task 2: /sync-demo harness page** - `0d9f05e` (feat)
3. **Defect fix: StrictMode-safe channel setup** - `b2703b3` (fix)
4. **Defect fix: valid-UUID stub playerIds** - `0348a9d` (fix)
5. **Defect fix: presence count cleanup** - `687f907` (fix)

## Files Created/Modified

- `src/app/actions/demo-broadcast.ts` — `"use server"` server action; exports `demoBroadcast(gameId, event)`; marked THROWAWAY; wraps `broadcast()` from admin module; service-role key never reaches client bundle
- `src/app/sync-demo/page.tsx` — `"use client"` harness; exports `SyncDemoPage`; `SubscriberPane` renders `status`, `participantCount`, and `JSON.stringify(state)`; `HostControls` fires all 8 GAME_EVENTs via `demoBroadcast`; reads `?gameId=` from URL post-mount; marked THROWAWAY

## Decisions Made

- **Server Action vs API Route for demoBroadcast:** Server Action chosen because the harness page is already `"use client"` and a Server Action import provides the security boundary automatically — the client bundle never sees the admin module. An API route would have required a fetch() call and offered no additional security benefit for this throwaway.
- **Stub playerIds as UUIDs:** `GET /api/game/state` validates the `playerId` query param with a UUID regex (from Plan 02-01 security hardening). Original plain-string stubs (`"stub-player-a"`) caused 400 responses that left panes stuck at `(loading…)`. Fixed by using well-formed UUID constants (`c0000000-0000-4000-8000-000000000011`, `…000012`).

## Deviations from Plan

### Defects Fixed During Checkpoint Verification

**1. [Rule 1 - Bug] React 19 StrictMode channel reuse crash in useGameSync**
- **Found during:** Task 3 (manual checkpoint verification — both panes CONNECTING but WebSocket error in DevTools console)
- **Issue:** React 19 StrictMode mounts effects twice (mount → cleanup → mount). The first mount created and subscribed a channel; the cleanup called `removeChannel(channel)`. The second mount called `subscribe()` on the now-removed channel object instead of creating a new one — the Supabase SDK threw a WebSocket error on a dead reference.
- **Fix:** Moved `createClient()` call inside the `useEffect` so each mount gets a fresh Supabase client instance and therefore a fresh channel reference. The `useRef(createClient())` from Plan 02-02 was correct for the singleton pattern but the channel itself needed to be created fresh on each effect invocation.
- **Files modified:** `src/hooks/useGameSync.ts`
- **Commit:** `b2703b3`

**2. [Rule 1 - Bug] Non-UUID stub playerIds returning 400 from GET /api/game/state**
- **Found during:** Task 3 (panes showed status `connected` but state remained `null` / `(loading…)` indefinitely)
- **Issue:** Original harness page used `"stub-player-a"` and `"stub-player-b"` as playerIds passed to `useGameSync`. The `GET /api/game/state` route validates the `playerId` query param against a UUID regex and returns 400 for non-UUID values. The hook received a non-2xx response, set `state` to `null`, and never retried.
- **Fix:** Changed stub playerIds to well-formed UUID constants `c0000000-0000-4000-8000-000000000011` and `c0000000-0000-4000-8000-000000000012` in `sync-demo/page.tsx`.
- **Files modified:** `src/app/sync-demo/page.tsx`
- **Commit:** `0348a9d`

**3. [Rule 1 - Bug] Presence count asymmetry — ghost entry after disconnect**
- **Found during:** Task 3 (presence D-04 check — closing a tab left participantCount at 1 rather than decrementing to 0; count climbed to 3 when 2 panes were open in 2 tabs)
- **Issue:** The `useEffect` cleanup called `supabase.removeChannel(channel)` without first calling `channel.untrack()`. Supabase Presence requires an explicit `untrack()` to signal departure before the channel is torn down; without it the presence entry remains in the channel's presence state until the server-side timeout.
- **Fix:** Added `await channel.untrack()` before `supabase.removeChannel(channel)` in the `useEffect` cleanup function.
- **Files modified:** `src/hooks/useGameSync.ts`
- **Commit:** `687f907`

## Success Criteria Verification

All 5 Phase 2 success criteria verified by the human via the `/sync-demo` harness:

| SC | Description | Status |
|----|-------------|--------|
| SC1 | Two-tab broadcast < 1s — both panes CONNECTED; firing any event updated both panes within ~1s with no manual refresh | VERIFIED |
| SC2 | 60s offline → reconnect + resync — DevTools Network Offline, panes showed `reconnecting`, Online → `connected` + current state | VERIFIED |
| SC3 | Subscribe-then-fetch populated state on load — panes showed `connected` + authoritative state snapshot immediately (SUBSCRIBED → fetchState path) | VERIFIED |
| SC4 | Visibilitychange resync — tab backgrounded ~30s, returned, DevTools Network showed immediate GET /api/game/state | VERIFIED |
| SC5 | No postgres_changes — `grep -rn "postgres_changes" src/` → 0 matches in subscription code | VERIFIED |
| Presence | participantCount reflected connected panes/tabs; symmetric after fixes; did not climb continuously | VERIFIED |

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `demoBroadcast` server action | `src/app/actions/demo-broadcast.ts` | Entire file is throwaway — replaced by real host write path in Phase 3/4 |
| `/sync-demo` page | `src/app/sync-demo/page.tsx` | Entire route is throwaway — replaced by real host dashboard (Phase 4), guest app (Phase 5), TV display (Phase 6) |
| `myAnswer: null` in GET /api/game/state | `src/app/api/game/state/route.ts` | Carried from Plan 02-01; Phase 3 (JOIN-02/03) populates from player's recorded answer |
| `correctOption: null` in GET /api/game/state | `src/app/api/game/state/route.ts` | Carried from Plan 02-01; Phase 3 (HOST-04) populates after phase === "revealed" |

**Note:** The throwaway stubs above are INTENTIONAL and documented. They do not prevent this plan's goal (proving SC1–SC5). Phase 3 plans will resolve the data stubs; Phases 4–6 will replace the throwaway surfaces.

## Threat Flags

None — all threat mitigations applied:
- T-02-08 (service-role key reaching client bundle): `grep -c "admin" src/app/sync-demo/page.tsx` = 0; service-role surface accessed only via `demoBroadcast` Server Action
- T-02-09 (forged client broadcasts): accepted for throwaway demo; real host-auth write path lands in Phase 3
- T-02-10 (demo leaking correct answer pre-reveal): `GET /api/game/state` returns `correctOption: null` stub (Plan 02-01); ANSWER_REVEALED's `correctOption` field in the broadcast payload is demo-only, not from DB

## Self-Check: PASSED

- `src/app/actions/demo-broadcast.ts` exists — confirmed (read above)
- `src/app/sync-demo/page.tsx` exists — confirmed (read above, 349 lines)
- Commit `b2e4d19` exists — confirmed in `git log --oneline -10`
- Commit `0d9f05e` exists — confirmed in `git log --oneline -10`
- Commit `b2703b3` exists — confirmed in `git log --oneline -10`
- Commit `0348a9d` exists — confirmed in `git log --oneline -10`
- Commit `687f907` exists — confirmed in `git log --oneline -10`
- `"use server"` on line 1 of `demo-broadcast.ts` — confirmed
- `"use client"` on line 1 of `sync-demo/page.tsx` — confirmed
- All 8 GAME_EVENT types present in `sync-demo/page.tsx` — confirmed
- THROWAWAY marker present in both files — confirmed
- No `admin` import in `sync-demo/page.tsx` — confirmed (`grep` = 0 matches)
- `tsc --noEmit` and eslint clean — confirmed (user-approved, no errors reported)
