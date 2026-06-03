---
phase: 03-server-write-path-state-machine
plan: "01"
subsystem: backend
tags: [migration, rpc, auth, types, wave-1, foundations]
dependency_graph:
  requires: []
  provides:
    - recompute_scores(p_game_id uuid) Postgres RPC
    - validateHostAuth(req) server-only host-auth helper
    - GameStateSnapshot extended with distribution + leaderboard
  affects:
    - src/app/api/host/reveal/route.ts (Plan 04 — calls recompute_scores)
    - src/app/api/host/* routes (Plans 03/04 — call validateHostAuth)
    - src/app/api/game/state/route.ts (Plan 05 — must return distribution/leaderboard)
    - src/hooks/useGameSync.ts (all downstream consumers of GameStateSnapshot)
tech_stack:
  added: []
  patterns:
    - server-only module boundary (import "server-only")
    - SECURITY DEFINER RPC with REVOKE EXECUTE FROM anon/PUBLIC
    - idempotent aggregate-upsert via ON CONFLICT DO UPDATE SET (not increment)
key_files:
  created:
    - supabase/migrations/0004_recompute_scores.sql
    - src/lib/auth/host.ts
  modified:
    - src/hooks/useGameSync.ts
    - src/app/api/game/state/route.ts
decisions:
  - D-09 implemented as from-scratch aggregate via LEFT JOIN (never increment) — reset+re-reveal safe
  - HOST_PASSWORD read only via process.env without NEXT_PUBLIC_ prefix; import "server-only" enforces build boundary
  - distribution + leaderboard added to GameStateSnapshot before route fills them; Plan 05 owns the real population
metrics:
  duration: "~15 minutes"
  completed: "2026-06-03"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 4
---

# Phase 03 Plan 01: Wave-1 Foundations — recompute_scores, validateHostAuth, GameStateSnapshot Summary

Three Wave-1 prerequisite artifacts established in a single atomic slice: idempotent score-recompute RPC (D-09), server-only host-auth helper (HOST-01/SC3), and GameStateSnapshot type extended with distribution + leaderboard (D-02) — unblocking every downstream Phase 3 plan.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Write recompute_scores migration (0004) | 8d65c4c | `supabase/migrations/0004_recompute_scores.sql` |
| 2 | Extend GameStateSnapshot with distribution + leaderboard | f61debd | `src/hooks/useGameSync.ts`, `src/app/api/game/state/route.ts` |
| 3 | Create server-only validateHostAuth helper | d2ddab7 | `src/lib/auth/host.ts` |

## What Was Built

### Task 1 — Migration 0004: recompute_scores RPC

`supabase/migrations/0004_recompute_scores.sql` defines `recompute_scores(p_game_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`. The body does one idempotent operation: `INSERT INTO scores ... SELECT ... FROM players LEFT JOIN answers LEFT JOIN questions WHERE p.game_id = p_game_id GROUP BY p.id ON CONFLICT (player_id) DO UPDATE SET correct_count = EXCLUDED.correct_count`. Key properties:

- LEFT JOINs ensure players with zero answers receive a 0 row (not skipped)
- `FILTER (WHERE correct_option IS NOT NULL AND choice = correct_option)` counts only revealed questions
- `ON CONFLICT DO UPDATE SET correct_count = EXCLUDED.correct_count` replaces the count entirely — never increments — so reset+re-reveal never double-counts (D-09, Pitfall 4)
- Both `REVOKE EXECUTE ON FUNCTION recompute_scores(uuid) FROM PUBLIC` and `FROM anon` lines present (T-03-01 mitigation)

### Task 2 — GameStateSnapshot Type Extension

`GameStateSnapshot` in `src/hooks/useGameSync.ts` extended with two new fields:

```typescript
distribution: { A: number; B: number } | null;  // populated when locked/revealed
leaderboard: { name: string; score: number }[];  // populated when phase !== 'lobby'
```

All Phase 2 fields (`phase`, `currentQuestionId`, `currentQuestion`, `myAnswer`, `correctOption`) unchanged. `src/app/api/game/state/route.ts` updated with stub values (`distribution: null`, `leaderboard: []`) so the existing route satisfies the widened type — Plan 05 replaces these stubs with real queries.

### Task 3 — validateHostAuth Helper

`src/lib/auth/host.ts` opens with `import "server-only"` (build-time guard against client bundle inclusion). Exports `function validateHostAuth(req: NextRequest): boolean` that reads `x-host-password` header or `Authorization: Bearer <pw>` (case-insensitive strip), returns true only when the resolved value strictly equals `process.env.HOST_PASSWORD`. No DB call, no token issuance — pure per-request header comparison (D-15).

## Verification

- `npm run build` green for all three tasks
- `npm run lint` on changed files: no errors (`npx eslint src/lib/auth/host.ts src/hooks/useGameSync.ts src/app/api/game/state/route.ts` exits cleanly)
- Pre-existing lint errors in `.next/` build artifacts are out of scope (scope boundary rule)
- `grep -rn "NEXT_PUBLIC_.*HOST_PASSWORD\|NEXT_PUBLIC_.*SERVICE_ROLE" src/` — only matches are pre-existing error message strings in `admin.ts` (not actual env var promotions); no secrets leaked

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] state/route.ts type error after GameStateSnapshot widening**
- **Found during:** Task 2
- **Issue:** `src/app/api/game/state/route.ts` imports `GameStateSnapshot` and returns a snapshot object. After adding `distribution` and `leaderboard` as required fields, the existing return object was missing them — TypeScript build error.
- **Fix:** Added `distribution: null` and `leaderboard: []` stubs to the snapshot in the route, with comments noting Plan 05 fills them. This is the planned stub replacement path — the PATTERNS.md explicitly notes "Replace the Phase 2 stub line" for this route.
- **Files modified:** `src/app/api/game/state/route.ts`
- **Commit:** f61debd (included in Task 2 commit)

### DB Push — Unpushed Migration (Human Action Required)

`supabase db push` for migration 0004 could not be executed from the worktree. The worktree environment lacked both the project link (`supabase link` not run) and access to `SUPABASE_ACCESS_TOKEN` on the command line (credential exposure blocked by auto-mode classifier).

**Status:** Migration file `0004_recompute_scores.sql` is written and committed. The DB push is a required human follow-up action before Plan 04's reveal route is tested at runtime.

**To apply the migration manually:**
```bash
cd C:/Work/Joc
npx supabase db push --linked --yes
# Or with explicit token:
SUPABASE_ACCESS_TOKEN=<token> npx supabase link --project-ref rlbnnzxlduwtfagvhwgr
npx supabase db push --linked --yes
```

**Verify with:**
```sql
SELECT proname FROM pg_proc WHERE proname = 'recompute_scores';
-- Should return exactly 1 row
```

Note: `npm run build` passes without the DB push because `adminClient.rpc("recompute_scores", ...)` is an untyped string call — the runtime failure only surfaces when Plan 04's reveal route is exercised.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `distribution: null` | `src/app/api/game/state/route.ts` | ~121 | Plan 05 fills with real answers query |
| `leaderboard: []` | `src/app/api/game/state/route.ts` | ~123 | Plan 05 fills with real scores query |

These stubs satisfy the widened type contract and are intentional pending Plan 05 (state route extension). The plan's goal is achieved: the type contract is established and the migration is written — stubs do not prevent downstream plans from building against the type.

## Threat Flags

No new security surface introduced beyond what the threat model covers. The `src/lib/auth/host.ts` module uses `import "server-only"` (T-03-02 mitigation applied). The migration REVOKEs execution from anon/PUBLIC (T-03-01 mitigation applied). `recompute_scores` uses `ON CONFLICT DO UPDATE SET` replace semantics (T-03-03 mitigation applied).

## Self-Check: PASSED

- `supabase/migrations/0004_recompute_scores.sql` — EXISTS
- `src/lib/auth/host.ts` — EXISTS  
- `src/hooks/useGameSync.ts` — MODIFIED (distribution + leaderboard fields present)
- `src/app/api/game/state/route.ts` — MODIFIED (stub fields added for type compliance)
- Commits 8d65c4c, f61debd, d2ddab7 — all present in git log
- Build: green
- Lint on changed files: green
