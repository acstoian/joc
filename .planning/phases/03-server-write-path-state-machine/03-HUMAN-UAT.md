---
status: partial
phase: 03-server-write-path-state-machine
source: [03-VERIFICATION.md]
started: 2026-06-03T04:45:00Z
updated: 2026-06-03T04:45:00Z
---

## Current Test

[awaiting human testing — requires live Supabase DB + running server]

## Tests

### 1. Push migration 0004 and confirm recompute_scores RPC exists
expected: After `npx supabase db push --linked --yes`, `SELECT proname FROM pg_proc WHERE proname = 'recompute_scores'` returns exactly 1 row. The `POST /api/host/reveal` RPC call then succeeds instead of erroring "function does not exist". The `TODO(migration-0004)` cast in reveal/route.ts can be removed after `npx supabase gen types typescript --linked > src/types/database.ts`.
result: [pending]

### 2. Join idempotency (SC1)
expected: `POST /api/game/join` with the same deviceToken twice returns `{ ok: true, playerId: <same uuid> }` both times; the players table has exactly one row for that device_token.
result: [pending]

### 3. Answer phase-guard + dedup (SC2)
expected: `POST /api/game/answer` while phase='locked' returns 403 `{ error: 'answers_locked' }`; a second identical answer while phase='question' returns 409 `{ error: 'already_answered' }`; the answers table gains exactly one row across the whole sequence.
result: [pending]

### 4. Host auth on every host route (SC3)
expected: Any `/api/host/*` call with no `x-host-password` → 401; wrong password → 401; correct password → proceeds. (timingSafeEqual + fail-closed guard already code-verified.)
result: [pending]

### 5. State machine + compare-and-swap double-click (SC4)
expected: Full sequence start → lock → reveal → next → end each returns the expected new phase and broadcasts a game_state event. Two rapid `action=start` posts: first returns `{ ok: true, phase: 'question' }`, second returns `{ noop: true }` (200) with no second broadcast; phase advances by exactly 1 step.
result: [pending]

### 6. Scoring after reveal + reset re-reveal (SC5)
expected: For a question with correct='A', after reveal every player who chose 'A' has scores.correct_count=1, others 0; GET /api/game/state leaderboard is ranked by correct_count desc. After reset + re-reveal with correct='B', 'B' players have correct_count=1 and 'A' players 0 — no double-counting.
result: [pending]

### 7. WR-01 late-answer race mitigation
expected: `POST /api/game/answer` fired concurrently with a host `lock` — when the lock commits before the post-insert re-read, the compensating delete fires and the late answer never appears in the leaderboard/distribution.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
