---
phase: 03-server-write-path-state-machine
plan: "04"
subsystem: host-api
tags: [host, reveal, reset, scoring, state-machine, realtime]
dependency_graph:
  requires:
    - 03-01  # validateHostAuth, adminClient, broadcast, migration 0004
  provides:
    - POST /api/host/reveal (HOST-04, SCOR-01)
    - POST /api/host/reset (HOST-06, D-08)
  affects:
    - Phase 4 host dashboard (consumes these routes)
    - GET /api/game/state (scores updated after reveal)
tech_stack:
  added: []
  patterns:
    - host-auth-guard (validateHostAuth first statement)
    - d07-cas-locked-to-revealed
    - unconditional-correct-option-update (Pitfall 5)
    - rpc-recompute-scores-idempotent (D-09)
    - best-effort-broadcast (D-bcast)
    - surgical-delete-current-question-only (D-08)
key_files:
  created:
    - src/app/api/host/reveal/route.ts
    - src/app/api/host/reset/route.ts
  modified: []
decisions:
  - "RPC type cast via `as any` + eslint-disable: recompute_scores exists in migration 0004 but database.ts types not yet regenerated (migration committed, pending supabase db push to live DB)"
  - "D-07 re-reveal: idempotent re-reveal proceeds through all steps (correct_option overwrite + recompute + broadcast) rather than returning early — ensures reset+re-reveal always converges correctly"
  - "Surgical reset: no CAS on phase reset — valid from any non-lobby phase (question/locked/revealed); lobby guard is a 400 rejection, not a CAS"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-03"
  tasks: 2
  files: 2
---

# Phase 03 Plan 04: Reveal + Scoring Slice and Surgical Round Reset Summary

Host-auth-gated `POST /api/host/reveal` sets `correct_option` unconditionally, calls the `recompute_scores` RPC for idempotent 1-pt-per-correct scoring, and broadcasts `ANSWER_REVEALED` + `SCORES_UPDATED`; `POST /api/host/reset` surgically deletes only the current question's answers and resets phase to `'question'`, broadcasting `ROUND_RESET` — explicitly distinct from `reset_game()`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | POST /api/host/reveal | d49da5f | src/app/api/host/reveal/route.ts |
| 2 | POST /api/host/reset | d4fc56f | src/app/api/host/reset/route.ts |

## Verification Results

- `npm run build` green on both tasks.
- `npm run lint` — no errors in new files; 12733 pre-existing errors in `.next/types/` generated stubs and a stale worktree (out of scope per deviation rules).
- Acceptance criteria grep checks:
  - `grep -c "validateHostAuth" reveal/route.ts` = 3 (≥1 ✓)
  - `grep -c "correct_option" reveal/route.ts` = 8 (≥1 ✓)
  - `grep -c "recompute_scores" reveal/route.ts` = 6 (≥1 ✓)
  - `grep -c "satisfies GameEvent" reveal/route.ts` = 2 (≥1 ✓)
  - `grep -c "validateHostAuth" reset/route.ts` = 3 (≥1 ✓)
  - `grep -c "reset_game" reset/route.ts` = 3 (all in comments — zero actual calls ✓)
  - `grep -c 'from("scores")' reset/route.ts` = 0 (✓)
  - `grep -c "ROUND_RESET" reset/route.ts` = 4 (≥1 ✓)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RPC type cast for recompute_scores**
- **Found during:** Task 1 build (TypeScript compile error)
- **Issue:** `adminClient` is typed via `Database` which only knows `reset_game` — `recompute_scores` was added in migration 0004 but `src/types/database.ts` was generated before that migration was pushed to the live Supabase DB. TypeScript rejected the `rpc("recompute_scores", ...)` call with "Argument of type 'recompute_scores' is not assignable to parameter of type 'reset_game'".
- **Fix:** Cast `adminClient as any` with `// eslint-disable-next-line @typescript-eslint/no-explicit-any` for the single RPC call. The migration SQL is correct and committed; this is purely a stale type generation issue. Types will resolve when `supabase gen types typescript` is re-run after `supabase db push`.
- **Files modified:** src/app/api/host/reveal/route.ts (line 145)
- **Commit:** d49da5f (same task commit)

## Known Stubs

None — both routes are fully wired. The `recompute_scores` RPC call is complete code; its runtime behavior depends on the migration being pushed to the live DB (see Blockers/Concerns below).

## Threat Flags

No new security-relevant surface beyond what the plan's threat model covers. Both routes are gated by `validateHostAuth` (T-03-12); `correct_option` is written only via `adminClient` on the base `questions` table and never exposed pre-reveal (T-03-15); the surgical delete is bounded to `current_question_id` (T-03-14).

## Blockers / Concerns

- **Migration 0004 pending push:** `supabase/migrations/0004_recompute_scores.sql` is committed locally but has not been pushed to the live Supabase DB. The `recompute_scores` RPC call in `POST /api/host/reveal` will fail at runtime with "function does not exist" until `supabase db push` is run. Score recompute is best-effort (logged, not fatal), but this must be resolved before Phase 4 testing.
- **database.ts stale:** `src/types/database.ts` should be regenerated after `supabase db push` to remove the `as any` cast and restore type safety on the RPC call.

## Self-Check: PASSED

| Item | Result |
|------|--------|
| src/app/api/host/reveal/route.ts | FOUND |
| src/app/api/host/reset/route.ts | FOUND |
| commit d49da5f | FOUND |
| commit d4fc56f | FOUND |
