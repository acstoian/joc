---
phase: "04-host-dashboard"
plan: "05"
subsystem: "host-dashboard"
tags: ["host", "emergency", "recovery", "state-machine", "ui"]
dependency_graph:
  requires:
    - "04-02"
    - "04-03"
    - "03-server-write-path-state-machine"
  provides:
    - "force-end-transition-action"
    - "emergency-panel-component"
    - "host-11-emergency-recovery"
  affects: []
tech_stack:
  added: []
  patterns:
    - "force_end branched before TRANSITIONS map — valid from any non-ended phase (decision #4)"
    - "CAS-style .neq('phase','ended') guard; 0 rows / already-ended -> idempotent noop (T-04-16)"
    - "reuse existing GAME_ENDED event — no new GameEvent union member"
    - "destructive emergency actions guarded by AlertDialog (T-04-17)"
    - "jump-to-question resolves 1-based number to display_order-ordered question id"
key_files:
  created:
    - "src/components/host/EmergencyPanel.tsx"
  modified:
    - "src/app/api/host/transition/route.ts"
    - "src/components/host/ControlTab.tsx"
decisions:
  - "force_end split Action into StandardAction | 'force_end' so TRANSITIONS Record stays complete and TS narrows action to StandardAction after the force_end early-return"
  - "EmergencyPanel receives the ordered questions list as a prop from ControlTab (already fetched there) rather than calling useHostQuestions again — single fetch source"
  - "Jump uses the existing `next` action (expectedFrom=revealed); a 409 from a non-revealed phase surfaces the standard CAS toast (documented constraint — jump is reliable between rounds in revealed)"
metrics:
  duration: "~20 min (completed inline by orchestrator)"
  completed: "2026-06-03T16:00:00Z"
  tasks: 2
  files: 3
---

# Phase 4 Plan 5: Emergency Recovery Summary

Completes HOST-11 (SC5): a collapsible Emergency panel in the Control tab giving the host a live safety net — reset the current round, jump to any question by number, or force-end the game from ANY non-ended state. Closes the documented design gap by adding a new `force_end` action to the Phase 3 transition route (the normal "Incheie Jocul" control stays revealed-only; force-end-from-any-state is exclusively the Emergency panel's job).

## What Was Built

### Task 1: force_end transition action (committed `bda5a16`)
`src/app/api/host/transition/route.ts` — extended without touching start/lock/next/end:
- Split the action type: `type StandardAction = "start"|"lock"|"next"|"end"; type Action = StandardAction | "force_end";`. `TRANSITIONS` is now `Record<StandardAction, …>` so it stays exhaustive; `"force_end"` is added to `VALID_ACTIONS` and the `Action` union.
- `force_end` is **branched specially before the TRANSITIONS lookup** (it is valid from any non-ended phase, so it has no single `expectedFrom`). It reads the game, returns idempotent `{ noop: true }` 200 if already `ended`, else runs a CAS-style `UPDATE … SET phase='ended' WHERE id=gameId AND phase != 'ended'` via `.neq("phase","ended").select("phase")` (0 rows → idempotent noop). On a successful flip it broadcasts the **existing** `GAME_ENDED` GameEvent best-effort (no new union member). `validateHostAuth(req)` remains the first statement.

### Task 2: EmergencyPanel + ControlTab wiring (committed `295ff4b`)
`src/components/host/EmergencyPanel.tsx` — a `Collapsible` (default closed) with a subdued red trigger "Controale de urgenta" + ChevronDown, opening a `glass` card with `border-red-500/20`:
- **Reseteaza Runda** → `AlertDialog` ("Resetezi runda curenta?" / "Raspunsurile … revine la 'Intrebare'. Actiunea nu poate fi anulata." / "Renunta" / "Da, reseteaza") → `POST /api/host/reset { gameId }`.
- **Sari la Intrebarea #N** → number `Input` bounded 1..N (N = `questions.length`); resolves the 1-based number to the question id at that `display_order` position → `POST /api/host/transition { gameId, action: "next", nextQuestionId }`.
- **Incheie Fortat Jocul** → destructive `AlertDialog` ("Inchei jocul fortat?" / "Jocul se va incheia imediat din orice stare. Aceasta actiune nu poate fi anulata." / "Renunta" / "Da, incheie") → `POST /api/host/transition { gameId, action: "force_end" }`.
- Each action shows a Romanian success toast or the standard 409 / 4xx / 5xx error toasts; a single `busy` guard prevents concurrent emergency actions.

`src/components/host/ControlTab.tsx` — imports and renders `<EmergencyPanel gameId password questions />` as section C below the phase buttons, passing the ordered question list it already fetches.

## Deviations from Plan

**Execution path:** Completed inline by the orchestrator (Wave 3). Earlier Wave 2 executor subagents truncated mid-stream, so Wave 3 was executed inline for reliability. No functional deviation from the plan spec.

**Action type split:** Adding `force_end` to the `Action` union would have made the `TRANSITIONS` `Record<Action,…>` incomplete (TS error). Resolved by introducing `StandardAction` for the map and keeping `Action = StandardAction | "force_end"`; TypeScript narrows `action` to `StandardAction` after the `force_end` early-return, so `TRANSITIONS[action]` stays type-safe.

## Human Verification Needed

**Type:** checkpoint:human-verify (deferred to end-of-phase)

**What was built:** Emergency Controls collapsible in the Control tab: Reset Round, Jump-to-Question-by-number, and Force-End-from-any-state (new `force_end` transition action).

**How to verify:**
1. With `HOST_PASSWORD` set and ≥2 questions authored, log into `/host` → Control tab. Start the game. Expand "Controale de urgenta".
2. Have a guest answer; click "Reseteaza Runda" → confirm. Within ~2s the phase returns to "Intrebare" and the A/B distribution clears (SC5). Verify in a second tab.
3. Advance to revealed, then "Sari la Intrebarea #2" → "Sari la Intrebare". Within ~2s the active question becomes #2 across tabs (SC5).
4. From ANY phase, click "Incheie Fortat Jocul" → confirm. Within ~2s the phase badge shows "Incheiat" across all tabs, even mid-question (SC5) — proves `force_end` works from a non-revealed state.

## Known Stubs

None. force_end action, EmergencyPanel, and ControlTab wiring are complete.

## Threat Surface Scan

- T-04-15 (EoP): reset/jump/force-end all go through `hostFetch` with `x-host-password`; transition + reset routes call `validateHostAuth` first.
- T-04-16 (Tampering): force_end uses a `.neq("phase","ended")` CAS guard; concurrent transitions converge (0 rows → idempotent noop).
- T-04-17 (DoS / accidental): reset + force-end require AlertDialog confirmation; the panel is collapsed-by-default and visually subdued.

## Self-Check: PASSED

- `npx tsc --noEmit` clean; `npm run build` succeeds.
- `"force_end"` present in VALID_ACTIONS + Action union + branch (3 refs); `EmergencyPanel` rendered in ControlTab (2 refs).
- `src/lib/realtime/events.ts` GameEvent member count unchanged (8) — no new event added.
- Commits: `bda5a16` (force_end), `295ff4b` (EmergencyPanel + wiring).
