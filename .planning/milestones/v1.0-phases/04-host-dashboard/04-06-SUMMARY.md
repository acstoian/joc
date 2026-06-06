---
phase: 04-host-dashboard
plan: "06"
subsystem: host-dashboard
tags: [gap-closure, emergency-recovery, state-machine, realtime, HOST-11, GAP-04-01]
dependency_graph:
  requires:
    - 04-05 (EmergencyPanel infrastructure — collapsible, AlertDialog pattern, runAction, hostFetch)
    - 03-* (reset_game RPC in migration 0003, GAME_ENDED event in realtime/events.ts)
  provides:
    - reset_game action on POST /api/host/transition (any-phase return-to-lobby)
    - Joc Nou / Reseteaza Jocul confirm-gated control in EmergencyPanel
  affects:
    - /api/host/transition (new action branch added, existing branches unchanged)
    - src/components/host/EmergencyPanel.tsx (4th control, 4th AlertDialog)
tech_stack:
  added: []
  patterns:
    - force_end pattern mirrored for reset_game (any-phase, pre-TRANSITIONS branch, GAME_ENDED reuse)
    - adminClient.rpc("reset_game", { p_game_id }) — existing typed RPC, first call from route
key_files:
  created: []
  modified:
    - src/app/api/host/transition/route.ts
    - src/components/host/EmergencyPanel.tsx
decisions:
  - reset_game branched before TRANSITIONS map (like force_end) — valid from any phase including ended
  - Idempotent noop when already in lobby to avoid needless full wipe + re-broadcast
  - GAME_ENDED event reused for resync — no new GameEvent union member (8 members unchanged)
  - New UI control placed last in EmergencyPanel (most destructive at bottom per UI-SPEC §5.3 C)
  - DISTINCT from /api/host/reset (round-only, returns to question) — different route, action, copy
metrics:
  duration: "~15 min"
  completed: "2026-06-04T04:22:27Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 04 Plan 06: GAP-04-01 Return-to-Lobby Recovery Summary

**One-liner:** Added `reset_game` action to the transition route (calls existing RPC: clears all answers/scores, returns to lobby) and a confirm-gated "Joc Nou / Reseteaza Jocul" EmergencyPanel control, closing GAP-04-01 — an ended game was unrecoverable from the UI without a manual DB edit.

## What Was Built

### Task 1: reset_game action on POST /api/host/transition

Extended `src/app/api/host/transition/route.ts` following the `force_end` pattern exactly:

- Added `"reset_game"` to the `Action` union and `VALID_ACTIONS` Set
- Branched before the `TRANSITIONS[action]` map lookup (valid from ANY phase, including `ended`)
- Reads game, returns 404 on not-found
- Short-circuits with `{ noop: true, phase: "lobby" }` 200 when already in lobby (idempotent)
- Calls `adminClient.rpc("reset_game", { p_game_id: gameId })` — the existing SECURITY DEFINER function from migration 0003 that atomically: deletes all answers, zeroes all scores, sets `phase='lobby'`, `current_question_id=NULL`, `started_at=NULL`, `ended_at=NULL`
- Best-effort broadcasts `GAME_ENDED` so guests/TV re-fetch `GET /api/game/state` and converge to lobby
- Returns `{ ok: true, phase: "lobby" }` 200 on success
- `validateHostAuth(req)` remains the FIRST statement (T-04-18 satisfied)
- `GAME_ENDED` now appears 3 times in the route (end, force_end, reset_game) — reuse confirmed, no new GameEvent member

### Task 2: Joc Nou / Reseteaza Jocul control in EmergencyPanel

Extended `src/components/host/EmergencyPanel.tsx`:

- Added `handleNewGame()` handler calling `runAction("reset_game", "/api/host/transition", { gameId, action: "reset_game" }, ...)`
- Added 4th AlertDialog control placed last in the glass card (most destructive at bottom)
- Trigger button: `variant="destructive"`, label "Joc Nou / Reseteaza Jocul"
- Dialog title: "Resetezi tot jocul?" — textually DISTINCT from "Resetezi runda curenta?" (round-only)
- Dialog description: explains answers + scores cleared, returns to lobby
- Confirm action: "Da, reseteaza jocul" with `bg-red-500 text-white hover:bg-red-600`
- Cancel: "Renunta"
- Behind `disabled={anyBusy}` guard — cannot fire concurrently (T-04-20)
- All existing controls (Reseteaza Runda, jump, Incheie Fortat Jocul) unchanged

### Task 3: Human Verification (PENDING — end-of-phase)

**Status: PENDING** — `workflow.human_verify_mode = end-of-phase`. No code written. Human performs verification at end of Phase 04.

**What to verify:**
1. From ended phase: "Joc Nou / Reseteaza Jocul" → confirm → game returns to lobby within ~2s across all tabs
2. "Porneste Jocul" re-enables; a fresh game starts at question #1 with answers/scores cleared
3. Idempotency: from lobby, clicking "Joc Nou / Reseteaza Jocul" → confirm is a harmless no-op (no error toast)
4. Distinctness: "Reseteaza Runda" still returns to "Intrebare" (not lobby) — round-only reset intact

Full steps in `04-06-PLAN.md` Task 3 `<how-to-verify>`.

**Resume signal:** Type "approved" if all four checks pass; otherwise describe the issue.

## Deviations from Plan

None — plan executed exactly as written. Both tasks follow the specified patterns verbatim (force_end mirror for the route; Incheie Fortat Jocul mirror for the UI control).

**Build note:** The worktree was missing `.env.local` (Supabase credentials) which caused an initial build failure unrelated to the code changes. Copying `.env.local` from the main repo resolved the pre-existing environment gap. TypeScript and build are clean.

## Threat Surface Scan

No new trust boundary surfaces introduced beyond what the plan's `<threat_model>` already covers:

- T-04-18: `reset_game` action is host-auth gated — `validateHostAuth(req)` is the first statement
- T-04-19: Idempotent noop from lobby prevents double-wipe; RPC is inherently idempotent
- T-04-20: Confirm-gated AlertDialog, `disabled={anyBusy}`, positioned last in panel
- T-04-21: `GAME_ENDED` broadcast carries only `{ type, gameId }` — no PII

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `src/app/api/host/transition/route.ts` | FOUND |
| `src/components/host/EmergencyPanel.tsx` | FOUND |
| `.planning/phases/04-host-dashboard/04-06-SUMMARY.md` | FOUND |
| Commit `0646b2f` (Task 1) | FOUND |
| Commit `5496ec7` (Task 2) | FOUND |
| `npx tsc --noEmit` | PASSED (zero errors) |
| `npm run build` | PASSED |
