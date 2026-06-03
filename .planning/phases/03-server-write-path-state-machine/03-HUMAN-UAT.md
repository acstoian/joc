---
status: complete
phase: 03-server-write-path-state-machine
source: [03-VERIFICATION.md]
started: 2026-06-03T04:45:00Z
updated: 2026-06-03T05:20:00Z
---

## Current Test

[all items verified — live smoke test passed 18/18 assertions against the linked Supabase DB on 2026-06-03]

## Tests

### 1. Push migration 0004 and confirm recompute_scores RPC exists
expected: After `supabase db push`, the RPC exists and `POST /api/host/reveal` succeeds; cast removed from reveal/route.ts.
result: PASSED — migration 0004 pushed to live DB; remote migration list shows 0004; database.ts regenerated (recompute_scores in public.Functions); TODO cast removed.

### 2. Join idempotency (SC1)
expected: Same deviceToken twice → same playerId; one players row.
result: PASSED — two joins with deviceToken c0000000-…-0001 returned identical playerId (cfcff3cb-…); second join was an upsert no-op.

### 3. Answer phase-guard + dedup (SC2)
expected: phase=locked → 403; duplicate → 409; no extra rows.
result: PASSED — p1 answer (B) → 200; identical p1 answer → 409 already_answered; p3 answer while phase=locked → 403 answers_locked.

### 4. Host auth on every host route (SC3)
expected: missing/wrong password → 401; correct → proceeds.
result: PASSED (with a temporary injected HOST_PASSWORD) — no-password → 401, wrong-password → 401, correct password → 200. NOTE: the real HOST_PASSWORD is EMPTY in .env.local, so against the unmodified env every host call fails closed (401). See Gaps.

### 5. State machine + compare-and-swap double-click (SC4)
expected: start→lock→reveal→end each advance; double start → noop (200), advances exactly 1 step.
result: PASSED — start → {ok,phase:question}; immediate second start → {noop:true,state.phase:question} (no rewind to lobby); lock/reveal/end all 200; end from revealed → {ok,phase:ended}.

### 6. Scoring after reveal (SC5)
expected: correct_count=1 per correct answerer, 0 others; leaderboard ranked desc; scoped to this game.
result: PASSED — after reveal(correct=B): GET /state correctOption=B, distribution {A:1,B:1}, leaderboard [Smoke One:1, Smoke Two:0, Smoke Three:0] — correctly scoped to this game and ranked descending (CR-01 fix confirmed live).

### 7. WR-01 late-answer race mitigation
expected: late answer crossing a lock is not counted.
result: PARTIAL — the lock→403 path (p3) and dedup→409 path were confirmed; the precise concurrent insert-vs-lock timing window (compensating delete) was not load-tested. Code path verified by inspection in 03-VERIFICATION.md; non-blocking.

## Summary

total: 7
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0
partial: 1

## Gaps

- **CONFIG (not a code defect): `HOST_PASSWORD` is empty in `.env.local`.** With it empty, `validateHostAuth` fails closed and every `/api/host/*` call returns 401 — the host cannot drive the game. Set a strong `HOST_PASSWORD` in `.env.local` (and in the Vercel project env) before the event. The smoke test confirmed auth works correctly once a password is set.
