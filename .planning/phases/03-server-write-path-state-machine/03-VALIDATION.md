---
phase: 3
slug: server-write-path-state-machine
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-02
task_map:
  "infra (prerequisites)":
    - "03-01-T1 — recompute_scores migration 0004 written + pushed to live DB"
    - "03-01-T2 — GameStateSnapshot extended with distribution + leaderboard"
    - "03-01-T3 — validateHostAuth server-only helper"
  JOIN-01: ["03-02-T1"]
  JOIN-02: ["03-02-T1"]
  JOIN-03: ["03-02-T1"]
  "answer-guard (SCOR-03/04 substrate)": ["03-02-T2"]
  HOST-01: ["03-01-T3", "03-03-T1", "03-04-T1", "03-04-T2"]
  HOST-02: ["03-03-T2 (action=start)"]
  HOST-03: ["03-03-T2 (action=lock)"]
  HOST-05: ["03-03-T2 (action=next)"]
  HOST-07: ["03-03-T2 (action=end)"]
  HOST-04: ["03-04-T1 (reveal)"]
  SCOR-01: ["03-01-T1 (recompute_scores RPC)", "03-04-T1 (reveal recompute)"]
  HOST-06: ["03-04-T2 (surgical reset)"]
  SCOR-02: ["03-05-T1 (leaderboard read)"]
  "D-02 (extended read)": ["03-05-T1"]
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None configured (CLAUDE.md: "No test framework is configured") — validation is HTTP smoke tests + `npm run build` (TypeScript) + `npm run lint` (ESLint) |
| **Config file** | none — Wave 1 (Plan 01) adds the migration; a `curl` smoke-test sequence is the manual full-suite |
| **Quick run command** | `npm run build && npm run lint` |
| **Full suite command** | Manual `curl`/HTTP smoke sequence against `npm run dev` (happy path: join → answer → lock → reveal → score → next → end) |
| **Estimated runtime** | ~30s (build+lint); ~2 min (manual smoke sequence) |

---

## Sampling Rate

- **After every task commit:** Run `npm run build && npm run lint` (every task's `<verify><automated>` is `npm run build`)
- **After every plan wave:** Manual smoke test of the routes touched in that wave (the `<human-check>` blocks)
- **Before `/gsd-verify-work`:** Full end-to-end manual flow must pass with no stuck states
- **Max feedback latency:** ~30 seconds (build+lint)

---

## Per-Task Verification Map

> Mapped to concrete `NN-NN-Tn` task IDs. No automated test framework exists, so "Automated Command" is the `npm run build`/`npm run lint` gate; the secure behavior is proven by the per-task `<human-check>` smoke assertion (curl). Plans 01 + 02 are Wave 1 (parallel); Plans 03 + 04 are Wave 2 (parallel); Plan 05 is Wave 3.

| Req | Wave | Task | Behavior (Secure) | Test Type | Automated / Smoke Command | Status |
|-----|------|------|-------------------|-----------|---------------------------|--------|
| infra | 1 | 03-01-T1 | `0004_recompute_scores.sql` written + PUSHED ([BLOCKING]); RPC exists in live DB; idempotent from-scratch upsert (no increment) | build + manual | `npm run build`; `SELECT proname FROM pg_proc WHERE proname='recompute_scores'` → 1 row | ⬜ pending |
| infra | 1 | 03-01-T2 | `GameStateSnapshot` extended with `distribution`+`leaderboard`; no Phase 2 field reshaped | build | `npm run build` (type errors fail) | ⬜ pending |
| HOST-01 | 1 | 03-01-T3 | `validateHostAuth` server-only; compares `x-host-password`/`Bearer` to `HOST_PASSWORD`; never NEXT_PUBLIC_ | build | `npm run build`; grep `import "server-only"` first line | ⬜ pending |
| JOIN-01 | 1 | 03-02-T1 | POST /api/game/join creates player; name trim+non-empty+≤30, unicode/emoji allowed (D-04) | smoke | `curl -X POST /api/game/join` → 200 + `playerId` | ⬜ pending |
| JOIN-02/03 | 1 | 03-02-T1 | Same deviceToken → same playerId (idempotent upsert on `UNIQUE(game_id,device_token)`); duplicate names allowed (D-03) | smoke | Two identical POSTs return identical `playerId` | ⬜ pending |
| answer-guard | 1 | 03-02-T2 | Answer when phase != 'question' → 403; second answer same question → 409 (23505); neither inserts a row; player_id resolved server-side from device_token (anti-cheat, no client playerId) | smoke | Sequential `curl POST /api/game/answer`; verify answers row-count unchanged | ⬜ pending |
| HOST-01 | 2 | 03-03-T1 | Forged transition (missing/wrong `x-host-password`) → 401, no mutation | smoke | `curl POST /api/host/transition` wrong header → 401 | ⬜ pending |
| HOST-02 | 2 | 03-03-T2 | lobby → question CAS; sets `current_question_id`=first by display_order; broadcasts GAME_STARTED + QUESTION_STARTED | smoke+manual | `curl action=start`; observe phase + current_question_id + broadcast in 2nd tab | ⬜ pending |
| HOST-03 | 2 | 03-03-T2 | question → locked; double-click advance = exactly 1 step (D-07 CAS); same-target → 200 no-op (D-05) | smoke | Rapid double `curl action=lock` advances by 1; repeat target → 200+current | ⬜ pending |
| HOST-05 | 2 | 03-03-T2 | revealed → question advances to `nextQuestionId` (required in body) | smoke | `curl action=next` with nextQuestionId; verify new current_question_id | ⬜ pending |
| HOST-07 | 2 | 03-03-T2 | revealed → ended; illegal transition (expected-from != current && target != current) → 409 + reason (D-06) | smoke | `curl action=end` from wrong phase → 409 `invalid_transition` | ⬜ pending |
| HOST-04 / SCOR-01 | 2 | 03-04-T1 | Reveal sets `questions.correct_option` live (unconditional UPDATE); idempotent recompute → each player `correct_count` = COUNT correct across revealed; re-reveal = identical totals; broadcasts ANSWER_REVEALED + SCORES_UPDATED | smoke | `curl POST /api/host/reveal`; query `scores` (1/correct, 0/wrong); re-reveal → same totals (no double-count) | ⬜ pending |
| HOST-06 | 2 | 03-04-T2 | Round-reset deletes ONLY current question's answers; phase → 'question'; never calls `reset_game()`; never writes `scores` | smoke | Insert answers for current + a prior question, POST reset; verify only current-question answers gone, prior remain | ⬜ pending |
| SCOR-02 / D-02 | 3 | 03-05-T1 | GET /api/game/state returns `correctOption` (revealed only — base questions behind the gate), A/B `distribution` (locked/revealed), `leaderboard` ranked by correct_count DESC; correct_option hidden pre-reveal | smoke | `curl GET /api/game/state` pre/post reveal; verify secrecy + distribution + ordering | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 1 Prerequisite Requirements (Plan 01, [BLOCKING])

- [ ] `supabase/migrations/0004_recompute_scores.sql` written and APPLIED to the live DB via `supabase db push` (idempotent `recompute_scores(p_game_id)` RPC per D-09) — BLOCKING: Plan 04's reveal route calls it by string name; build passes without the push, so this is the only guard against a runtime "function does not exist" failure (Pitfall 7)
- [ ] `GameStateSnapshot` (in `src/hooks/useGameSync.ts`) extended with `distribution` + `leaderboard` BEFORE `GET /api/game/state` is extended in Plan 05
- [ ] `HOST_PASSWORD` confirmed present in `.env.local` (server-only, no `NEXT_PUBLIC_`)
- [ ] Seed game confirmed in `'lobby'` phase (run `reset_game()` if needed) before host-transition smoke tests
- [ ] CAS smoke check: confirm `.update().eq().eq().select()` returns `[]` (not `null`) on 0-row match — RESEARCH Open Question 1; the route guards with `!updated || updated.length === 0` so either shape is safe
- [ ] A `curl` smoke-test sequence for the full happy path (join → answer → lock → reveal → score → next → end)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Broadcast appears in a second tab within 1s of host transition/reveal/reset | HOST-02..07, HOST-04/06, SC4 | Realtime fan-out needs a live WebSocket subscriber; no headless test framework | Open `/sync-demo` (or two tabs on `game:<seed>`), fire the host action, observe both update |
| Best-effort broadcast: DB write succeeds even if broadcast() HTTP fails | D-bcast (Claude's Discretion) | Requires inducing a broadcast failure; not unit-testable without a framework | Temporarily break the broadcast URL, confirm the host route still returns 200 + DB mutated |
| Idempotent score recompute under reset + re-reveal (no double-count) | SCOR-01, D-09 | Needs a stateful reveal → reset → re-reveal sequence against the live RPC | Reveal a question, note scores; reset the round; re-reveal; confirm scores identical |
| Full end-to-end happy path with no stuck states | SC4 (state machine) | Cross-route stateful sequence | Run the Wave 1 smoke sequence script end-to-end |

---

## Validation Sign-Off

- [x] All tasks have a smoke command or build/lint gate (every task `<verify>` is `npm run build` + a `<human-check>` smoke assertion where behavior is observable)
- [x] Sampling continuity: no 3 consecutive tasks without a build/lint or smoke verify (every task gates on `npm run build`)
- [x] Wave 1 (Plan 01) covers all prerequisite references (migration push, type extension, env, CAS shape)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (build+lint)
- [x] `nyquist_compliant: true` set in frontmatter (task IDs mapped above)

**Approval:** mapped — ready for execution
