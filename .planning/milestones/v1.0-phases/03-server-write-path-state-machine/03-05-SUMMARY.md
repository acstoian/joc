---
phase: 03-server-write-path-state-machine
plan: "05"
subsystem: state-read-api
tags: [state-machine, read-path, leaderboard, distribution, answer-secrecy, scor-02, host-04]
dependency_graph:
  requires:
    - 03-01  # GameStateSnapshot type extension (distribution + leaderboard fields)
    - 03-04  # reveal route populates correct_option + scores (real data to read)
  provides:
    - GET /api/game/state returns correctOption (revealed-only, base questions behind gate)
    - GET /api/game/state returns distribution (locked/revealed)
    - GET /api/game/state returns leaderboard ranked by correct_count desc (SCOR-02)
  affects:
    - useGameSync (Phase 2) — every subscribe-then-fetch and GAME_EVENT re-fetch now returns full snapshot
    - Phase 4 host dashboard — leaderboard + distribution data available immediately
    - Phase 5 guest app — correctOption and distribution available post-reveal
    - Phase 6 TV display — full leaderboard available for cinematic reveal
tech_stack:
  added: []
  patterns:
    - phase-gated-read (correctOption only at revealed)
    - base-questions-behind-gate (one place reads base table, inside revealed branch)
    - client-side-answer-count (distribution via filter, ≤100 players — A3)
    - scores-inner-join-players (leaderboard via supabase-js !inner join)
key_files:
  created: []
  modified:
    - src/app/api/game/state/route.ts
decisions:
  - "Phase-gated correctOption: base questions table read is the single exception to the questions_public rule — fenced inside if (phase === 'revealed') (Pitfall 3)"
  - "Distribution client-side count: rows.filter().length is sufficient for ≤100 players; no GROUP BY needed at this scale (A3)"
  - "Leaderboard join: scores!inner(display_name) pattern with type assertion — supabase-js PostgREST join via FK relationship; build confirmed green"
  - "All Phase 2 reads preserved: questions_public view, maybeSingle myAnswer, isValidUuid validation — no behavior changes to existing fields"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-03"
  tasks: 1
  files: 1
---

# Phase 03 Plan 05: GET /api/game/state Read-Path Extension Summary

Extended `GET /api/game/state` to populate the three Phase-2 stub fields: `correctOption` (read from base `questions` table via adminClient, gated behind `phase === 'revealed'` for answer secrecy), `distribution: { A, B }` (answer counts for `locked`/`revealed`), and `leaderboard: { name, score }[]` ranked by `correct_count` desc for all non-lobby phases — closing SC5 via D-01's re-fetch interpretation. All Phase 2 reads preserved unchanged.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend GET /api/game/state with phase-gated correctOption, distribution, leaderboard | 062b252 | src/app/api/game/state/route.ts |

## Verification Results

- `npm run build` green — TypeScript type-checks the extended snapshot against the `GameStateSnapshot` type from Plan 01.
- `npm run lint` — zero errors in any `src/` file; pre-existing errors in `.next/` build artifacts from a stale worktree (out of scope per deviation rules, same as Plan 04).
- Acceptance criteria grep checks:
  - `grep -c "questions_public" src/app/api/game/state/route.ts` = 6 (≥1 — question-text read still uses the view ✓)
  - `grep -c "ascending: false" src/app/api/game/state/route.ts` = 1 (≥1 — leaderboard ordered desc, SCOR-02 ✓)
  - `grep -n 'from("questions")' src/app/api/game/state/route.ts` — both occurrences are inside the `if (game.phase === "revealed")` gate (Pitfall 3 ✓)
  - Build satisfies the extended `GameStateSnapshot` type (all 7 fields present ✓)
  - Phase 2 reads: UUID validation, games fetch, questions_public currentQuestion read, maybeSingle myAnswer — all preserved unchanged ✓

## Deviations from Plan

None — plan executed exactly as written. The `players!inner(display_name)` leaderboard join (A4 pattern) compiled without error so the two-query fallback was not needed.

## Known Stubs

None — all three fields are fully wired to live DB queries. Runtime behavior depends on the Phase 3 write path (03-04) having populated `correct_option` and `scores` rows; in phases before any reveal, `correctOption` returns null, `distribution` returns null, and `leaderboard` returns `[]` — which are the correct values for those phases.

## Threat Flags

No new security surface beyond the plan's threat model. The correctOption secrecy constraint (T-03-17) is enforced: the base `questions` read is fenced inside `if (phase === "revealed")`; the question-text read remains on `questions_public` which omits `correct_option`.

## Self-Check: PASSED

| Item | Result |
|------|--------|
| src/app/api/game/state/route.ts | FOUND |
| commit 062b252 | FOUND |
| `questions_public` still used for question-text read | CONFIRMED |
| `from("questions")` only inside revealed gate | CONFIRMED |
| `ascending: false` in leaderboard order | CONFIRMED |
| build green | CONFIRMED |
