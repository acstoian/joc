---
phase: 03-server-write-path-state-machine
plan: 03
subsystem: host-state-machine
tags: [host-auth, state-machine, CAS, broadcast, realtime]
dependency_graph:
  requires:
    - "03-01 (validateHostAuth helper at src/lib/auth/host.ts)"
    - "03-01 (GameEvent union at src/lib/realtime/events.ts)"
    - "Phase 1 schema (games.phase column + CHECK constraint)"
  provides:
    - "POST /api/host/transition — host-auth + D-07 CAS phase machine + broadcast"
  affects:
    - "Host dashboard (Phase 4) — primary caller of this route"
    - "All realtime subscribers (Phase 4/5/6) — receive broadcast signals after transitions"
tech_stack:
  added: []
  patterns:
    - "D-07 CAS distinguishing rule (same-target→200 no-op / illegal→409 / CAS UPDATE→200 ok)"
    - "Atomic multi-column UPDATE (phase + current_question_id in one UPDATE statement)"
    - "satisfies GameEvent type assertion on all broadcast payloads"
    - "GamesUpdate typed payload to satisfy Supabase PostgREST strict type checking"
key_files:
  created:
    - "src/app/api/host/transition/route.ts"
  modified: []
decisions:
  - "Typed GamesUpdate payload: Record<string,unknown> rejected by Supabase PostgREST type system; used Database['public']['Tables']['games']['Update'] alias instead (Rule 1 auto-fix during build)"
  - "Both tasks implemented in single file: Task 2 extends Task 1 in-place per plan instructions; the full CAS + broadcast logic was written together with the auth guard to keep the file coherent"
metrics:
  duration: "~15 min"
  completed: "2026-06-03"
  tasks: 2
  files: 1
---

# Phase 3 Plan 3: Host Transition State Machine Summary

**One-liner:** `POST /api/host/transition` delivering the full lobby→question→locked / revealed→question / revealed→ended machine with host-password auth (HOST-01), D-07 CAS (idempotent no-op / 409 illegal / CAS UPDATE), atomic `current_question_id` assignment on start/next, and best-effort `GameEvent` broadcasts.

## What Was Built

Single new route handler: `src/app/api/host/transition/route.ts`

The route accepts `{ gameId, action: "start"|"lock"|"next"|"end", nextQuestionId? }` and drives the game state machine:

| Action | expectedFrom | target | Extra payload |
|--------|-------------|--------|---------------|
| start  | lobby       | question | Sets `current_question_id` to first question by `display_order` |
| lock   | question    | locked | Phase only |
| next   | revealed    | question | Sets `current_question_id` to `nextQuestionId` from body |
| end    | revealed    | ended | Phase only |

(`locked → revealed` is handled by Plan 04's reveal route.)

### D-07 CAS Flow

1. Read current `games.phase`
2. If `current == target` → 200 `{ noop: true, state }` (D-05 — double-tap safe)
3. If `current != expectedFrom` → 409 `{ error: "invalid_transition", current, expected }` (D-06)
4. CAS UPDATE `.eq("id", gameId).eq("phase", expectedFrom).select()` (NO `.single()` — Pitfall 1)
5. If 0 rows affected (`!updated || updated.length === 0`) → 200 `{ noop: true }` (D-07 third bullet)
6. Success → best-effort broadcast + 200 `{ ok: true, phase: target }`

### Broadcast Signals

Each successful transition fires the matching `GameEvent` via `broadcast(`game:${gameId}`, "GAME_EVENT", ...)`:

- `start` → `GAME_STARTED` + `QUESTION_STARTED` (two signals)
- `lock`  → `ANSWERS_LOCKED`
- `next`  → `QUESTION_STARTED`
- `end`   → `GAME_ENDED`

All payloads use `satisfies GameEvent` for exhaustiveness checking. Broadcast is wrapped in try/catch; a failure does not fail the host request (D-bcast, T-03-11).

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Host-auth guard + transition request contract | 92a9a1c | src/app/api/host/transition/route.ts |
| 2 | D-07 CAS state machine + broadcast | (in 92a9a1c) | src/app/api/host/transition/route.ts |

Note: Task 2 was implemented together with Task 1 in the same file creation. The plan called for Task 2 to "extend in place" — since the complete implementation was coherent to write as a single unit, both tasks share one commit. This is intentional, not a deviation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Typed update payload for Supabase strict type checking**
- **Found during:** Task 1/2 (build verification)
- **Issue:** TypeScript error: `Record<string, unknown>` is not assignable to `RejectExcessProperties<GamesUpdate>` — Supabase PostgREST's type system rejects the loose type for `.update()` arguments.
- **Fix:** Added `import type { Database }` and defined `type GamesUpdate = Database["public"]["Tables"]["games"]["Update"]`. Changed `updatePayload` from `Record<string, unknown>` to `GamesUpdate`.
- **Files modified:** `src/app/api/host/transition/route.ts`
- **Commit:** 92a9a1c (same commit — corrected before committing)

No other deviations. Plan executed with the auth guard, D-07 CAS logic, atomic `current_question_id`, and broadcast all as specified.

## Verification

- `npm run build` — green (TypeScript + all routes compiled)
- `grep -c "validateHostAuth" src/app/api/host/transition/route.ts` → 3 (guard present)
- `grep -c "satisfies GameEvent" src/app/api/host/transition/route.ts` → 5 (all broadcasts typed)
- `.eq("phase", expectedFrom)` on CAS UPDATE — confirmed (line 162)
- `!updated || updated.length === 0` lost-race check — confirmed (line 174); no `.single()` in CAS UPDATE region
- D-07 same-target → 200 `{ noop: true, state }` — confirmed (line 112)
- D-07 wrong expectedFrom → 409 `{ error: "invalid_transition", current, expected }` — confirmed (line 119)
- `current_question_id` set atomically for `start` (line 145) and `next` (line 148)

## Known Stubs

None. This route is fully implemented with no placeholders.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model (T-03-08 through T-03-11). All mitigations implemented:
- T-03-08: `validateHostAuth(req)` as first statement
- T-03-09: CAS `.eq("phase", expectedFrom)` serializes concurrent requests
- T-03-10: D-07 rule rejects `expectedFrom != current && target != current` with 409
- T-03-11: Best-effort broadcast — broadcast failure does not fail the host request

## Self-Check: PASSED

- FOUND: src/app/api/host/transition/route.ts
- FOUND: commit 92a9a1c
