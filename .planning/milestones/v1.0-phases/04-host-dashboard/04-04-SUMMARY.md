---
phase: "04-host-dashboard"
plan: "04"
subsystem: "host-dashboard"
tags: ["host", "stats", "realtime", "ui", "motion", "privacy"]
dependency_graph:
  requires:
    - "04-01"
    - "02-realtime-core"
    - "03-server-write-path-state-machine"
  provides:
    - "host-answers-names-endpoint"
    - "useHostAnswerNames-hook"
    - "distribution-bar-component"
    - "stats-tab-live-surface"
  affects: []
tech_stack:
  added: []
  patterns:
    - "validateHostAuth(req) first statement; names host-gated and never on public /api/game/state (RQ-1, T-04-12)"
    - "answers->players!inner(display_name) embedded join pivoted to {A:[],B:[]}; counts = array lengths"
    - "live counts during question phase from names lengths; state.distribution preferred at locked/revealed"
    - "useHostAnswerNames refetch on questionId change + on collapsible open; no polling"
    - "DistributionBar motion/react animated width + role=meter aria-valuenow (UI-SPEC §9/§10)"
key_files:
  created:
    - "src/app/api/host/answers/route.ts"
    - "src/hooks/useHostAnswerNames.ts"
    - "src/components/host/DistributionBar.tsx"
  modified:
    - "src/components/host/StatsTab.tsx"
decisions:
  - "Used the embedded players!inner(display_name) join (plan's primary path), with a defensive extractName() that handles both object and array embed shapes — no two-step fallback needed; tsc + build clean"
  - "Live A/B counts derive from useHostAnswerNames array lengths when state.distribution is null (question phase), satisfying HOST-09 live updates before lock (RQ-1 bonus, Open Q2)"
  - "Connection status pill maps SyncStatus → sage 'conectat' / pulsing gold 'reconectare...' / blush 'deconectat'"
metrics:
  duration: "~20 min (completed inline by orchestrator after parallel/background executor stream truncation)"
  completed: "2026-06-03T15:40:00Z"
  tasks: 2
  files: 4
---

# Phase 4 Plan 4: Live-Stats Vertical Slice Summary

Gives the host live visibility into the room — how many are connected, how the A/B split is trending, and exactly who answered what — without polluting the public state endpoint (player names stay host-only, RQ-1) or crowding the Control surface (names live in a collapsible, D-04).

## What Was Built

### Task 1: GET /api/host/answers (committed `3ba160b`)
`src/app/api/host/answers/route.ts` — `GET(req)` with `validateHostAuth(req)` as the FIRST statement (401 before any DB access). Reads `gameId` + `questionId` from query params, UUID-validates both (400 on malformed). Queries `adminClient.from("answers").select("choice, players!inner(display_name)").eq("question_id", questionId)` and pivots into `{ A: string[], B: string[] }`. A defensive `extractName()` normalizes the embedded `players` relation whether PostgREST returns it as an object or a single-element array. Player names are returned ONLY here (host-gated) and never added to the public `GET /api/game/state` (T-04-12).

### Task 2: useHostAnswerNames + DistributionBar + StatsTab (committed `5c45f65`)
- `src/hooks/useHostAnswerNames.ts` — `useHostAnswerNames(gameId, questionId, password)` → `{ names, loading, refetch }`. Fetches `/api/host/answers` with `x-host-password`, skips when `questionId` is null, cancelled-guard on the request. Refetch re-runs when `questionId` changes (Broadcast-driven) and on demand when the collapsible opens. No polling.
- `src/components/host/DistributionBar.tsx` — props `a`, `b`, optional `height`. `role="meter"` with `aria-valuenow/min/max = total` (UI-SPEC §10). The gold A-portion width animates via `motion/react` `transition={{ duration: 0.4, ease: "easeOut" }}` (UI-SPEC §9); blush B-portion fills the remainder. Count labels "A: X" / "B: Y".
- `src/components/host/StatsTab.tsx` — replaces the Plan 01 placeholder with four sections per UI-SPEC §5.5:
  - **(A)** participant count card — `text-3xl text-gold-bright` count + "jucatori conectati" + connection-status pill derived from `status`.
  - **(B)** current-question distribution card — `state.currentQuestion.body` header + larger `DistributionBar`. Live counts prefer `state.distribution`; fall back to `useHostAnswerNames` lengths during the `question` phase. "Niciun raspuns inca." empty state.
  - **(C)** "Vezi cine a raspuns" `Collapsible` (default closed) — two columns "Au ales A" / "Au ales B" from `useHostAnswerNames(gameId, state?.currentQuestionId, password)`; "Niciun jucator" per empty column.
  - **(D)** leaderboard card from `state.leaderboard` — rank + name + score, top 3 tinted; "Niciun punctaj inca." when empty.

## Deviations from Plan

**Execution path:** This plan was first attempted by a parallel background executor (truncated after Task 1 in an isolated worktree) — that partial work was discarded and the worktree removed. The orchestrator then re-executed the whole plan inline (both tasks), typechecked (`tsc --noEmit` clean) and built (`npm run build` clean), and committed atomically. No functional deviation from the plan spec.

**Embedded join, no fallback:** The plan allowed a two-step fetch fallback if `players!inner(display_name)` did not type-cleanly (Assumption A4). The embedded join compiled and built cleanly, so the primary path is used; `extractName()` defensively handles both possible embed shapes.

## Human Verification Needed

**Type:** checkpoint:human-verify (deferred to end-of-phase)

**What was built:** The Stats tab — live participant count, live A/B distribution bar, who-answered-what collapsible (names), and leaderboard — backed by useGameSync + the new /api/host/answers endpoint.

**How to verify:**
1. With `HOST_PASSWORD` set, log into `/host` and open "Statistici". Note the participant count.
2. In a second browser/tab, join the game as a guest. Within ~2s the host participant count should increase, no refresh (HOST-08, SC3).
3. Start a question (Control tab). From the guest, submit an A or B answer. The Stats A/B distribution should update live as answers arrive (HOST-09, SC3).
4. Expand "Vezi cine a raspuns" — the guest's display name should appear under the option they chose (HOST-10).
5. Lock + reveal; confirm the leaderboard card populates and is ranked.
6. `curl -s "http://localhost:3000/api/host/answers?gameId=<id>&questionId=<id>"` WITHOUT x-host-password → HTTP 401.

## Known Stubs

None. Endpoint, hook, DistributionBar, and the full StatsTab are implemented.

## Threat Surface Scan

- T-04-12 (Info disclosure): names host-auth-gated; never added to public state endpoint.
- T-04-13 (EoP): `validateHostAuth(req)` is the first statement; 401 before DB access.
- T-04-14 (Input validation): UUID checks on gameId + questionId → 400 on malformed.

## Self-Check: PASSED

- `npx tsc --noEmit` clean; `npm run build` succeeds (route `/api/host/answers` present; `/host` 82.2 kB).
- `motion` imported from `motion/react` in DistributionBar.
- Files: `answers/route.ts`, `useHostAnswerNames.ts`, `DistributionBar.tsx` (created), `StatsTab.tsx` (replaced placeholder).
- Commits: `3ba160b` (endpoint), `5c45f65` (hook + components).
