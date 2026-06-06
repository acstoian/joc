---
status: resolved
phase: 04-host-dashboard
source: [04-VERIFICATION.md]
started: 2026-06-03T16:20:00Z
updated: 2026-06-04T04:20:00Z
---

## Current Test

All 5 tests complete (5 pass). 1 gap logged (GAP-04-01). See Gaps section.

## Tests

### 1. Password gate (Plan 01)
expected: Visiting /host shows the "Dashboard Gazda" gate (not tabs). A wrong password shows the inline red "Parola gresita. Incearca din nou." and no dashboard. The correct password reveals the three-tab shell (Control · Intrebari · Statistici) with a connection-status badge. Reload keeps you logged in; closing + reopening the tab prompts again. Requires HOST_PASSWORD in .env.local.
result: pass
notes: |
  Two real gate bugs found and FIXED (verified working in browser, committed 46a1e53):
  1. State isolation — useHostAuth is a per-component hook; HostPage and PasswordGate
     held separate instances, so a successful login never swapped HostPage to the
     dashboard. Fixed: single instance lifted to HostPage, passed to PasswordGate as props.
  2. Hydration mismatch — useState read sessionStorage synchronously (SSR null vs client
     stored value). Fixed: post-mount useEffect read behind a `hydrated` flag.
  Prior blocker: HOST_PASSWORD was empty in .env.local (set a dev value: cristina-andrei-2026).
  Gate now: wrong pw -> 401 inline error; correct pw -> dashboard; reload persists; no hydration error.

  CONNECTION BADGE ("eroare conexiune") — investigated thoroughly; NOT a defect:
  - Raw WS to the realtime endpoint connects (101) and phx_join returns status:ok.
  - An isolated single subscription stays SUBSCRIBED indefinitely.
  - The error only appears under `next dev` React StrictMode double-mount: useGameSync's
    removeChannel teardown races the remount; the channel emits CLOSED and the hook maps
    CLOSED -> "error". Production build (no StrictMode) shows "conectat" + presence count.
  - Decision (user): leave Phase 2 realtime as-is; production is unaffected. Dev-only artifact.

### 2. Phase control buttons (Plan 02)
expected: In lobby only "Porneste Jocul" is enabled; the rest dimmed. Tapping a valid button disables all buttons (spinner + "...") and they re-enable only when the phase badge changes (~1s, Broadcast-confirmed). Rapid double-tap advances exactly one step. A second /host tab reflects phase + button state within ~2s. A 409 shows "Starea jocului s-a schimbat...". In locked phase the A/B reveal picker appears.
result: pass
notes: |
  Verified on the production build (badge "conectat"). Driving the reveal button transitioned
  Blocat -> Dezvaluit live (Broadcast-confirmed re-enable), and the phase buttons re-gated to the
  correct set per phase. User confirms all phase-control buttons (start/lock/reveal/next/end) work
  as intended. Participant-count-from-guests is exercised once the Phase 5 guest app exists.

### 3. Question CRUD + reorder + correct-mark (Plan 03)
expected: In "Intrebari", create a question (body + A + B), mark A correct, Save → persists across reload (QSTN-01/04). Edit body → persists (QSTN-02). Add a second question, reorder with ▲/▼ → new order persists (QSTN-05). Delete via the confirm dialog → gone (QSTN-03). Trying to delete the currently-active question shows the toast "Aceasta intrebare este activa in joc..." and does not delete (Pitfall 4). A request without x-host-password returns 401.
result: pass
notes: |
  CREATE verified — added question persisted across reload (DB count 5 -> 6). User confirms
  edit / reorder / delete / active-question-guard all work as intended. 401-without-password
  confirmed via curl. QSTN-01..05 satisfied.

### 4. Live stats (Plan 04)
expected: In "Statistici", the participant count rises within ~2s as a guest joins, no refresh (HOST-08). After a question starts and a guest answers, the A/B distribution updates live (HOST-09). Expanding "Vezi cine a raspuns" shows the guest's name under the option they chose (HOST-10). After reveal, the leaderboard populates ranked by score.
result: pass
notes: |
  Verified via simulated guests (join + answer APIs): Maria->A, Andrei->A, Ioana->B.
  /api/host/answers returned {"A":["Maria","Andrei"],"B":["Ioana"]}; user confirms the Statistici
  tab renders the names under the correct option (HOST-10) and the A:2/B:1 counts (HOST-09).
  CAVEAT: live participant COUNT from real phones (HOST-08, presence) and true per-second live
  updates require the Phase 5 guest app (presence needs a live WS client) — not testable here.
  Distribution is authoritative once the round is locked/revealed; names refresh on collapsible
  open / question change (by design, no per-answer polling).

### 5. Emergency recovery (Plan 05)
expected: Expand "Controale de urgenta". "Reseteaza Runda" (after confirm) returns the phase to "Intrebare" and clears the distribution within ~2s across tabs (SC5). "Sari la Intrebarea #N" makes question N active within ~2s. "Incheie Fortat Jocul" (after confirm) ends the game from ANY phase — badge shows "Incheiat" across all tabs even mid-question (proves force_end from a non-revealed state).
result: pass
notes: |
  Verified via the host endpoints the panel buttons call (state checked before/after each):
  - Reseteaza Runda: 200, phase stayed "question", answers cleared (A:[],B:[]).
  - Sari la Intrebare: lock->reveal->next(jump #4) -> phase "question", active question switched to #4.
  - Incheie Fortat Jocul: from "question" -> "ended" (force_end from non-revealed state); repeat -> noop (idempotent).
  HOST-11 / SC5 satisfied. Panel render + button wiring confirmed visually in Test 2.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
partial: 0
skipped: 0
blocked: 0
gaps: 1
notes: |
  All 5 UAT tests pass. Two real gate bugs found and fixed during testing (state-isolation +
  hydration mismatch). One medium gap logged (GAP-04-01: no New Game / Return-to-Lobby control).
  "eroare conexiune" was investigated and proven to be a dev-only React StrictMode artifact
  (production shows "conectat") — not a defect. HOST-08 live participant count and full live-stats
  cadence await the Phase 5 guest app; stats data layer (HOST-09/10) verified via simulated guests.

## Gaps

### GAP-04-01: No "New Game / Return to Lobby" recovery control (ended is terminal)
status: resolved
resolved_by: 04-06 (commits 0646b2f, 5496ec7)
resolution: |
  Closed by gap-closure plan 04-06. Added a host-auth-gated `reset_game` action to
  POST /api/host/transition (calls the existing migration-0003 reset_game RPC: clears all
  answers, zeroes scores, sets phase=lobby/current_question_id=null; idempotent no-op from
  lobby; reuses the existing GAME_ENDED broadcast for resync — no new GameEvent member) and a
  confirm-gated "Joc Nou / Reseteaza Jocul" control in EmergencyPanel, distinct from the
  round-only "Reseteaza Runda". Code-verified 24/24 in 04-VERIFICATION.md. End-to-end runtime
  re-test (return-to-lobby across tabs from ended, fresh game starts clean, idempotency,
  round-reset distinctness) is tracked as the pending human-verify item #11 in 04-VERIFICATION.md.
severity: medium
requirement: HOST-11 (emergency recovery)
found_in: Test 5 / Emergency panel (surfaced during Test 3)
summary: |
  Once the game reaches the `ended` phase, there is NO host control to start a new game or
  return to `lobby`. The Phase 3 state machine has no `ended -> lobby` (or any -> lobby)
  transition: `start` requires `expectedFrom: lobby`, and `reset` is only valid from
  question/locked/revealed. So after "Incheie Jocul" (or force-end), "Porneste Jocul" and
  "Reseteaza Runda" are both correctly disabled/no-op, leaving the host stuck. The Emergency
  panel (HOST-11) is meant to recover a stuck game, but an ended/accidentally-ended game is
  exactly such a state and cannot be recovered from the UI.
repro: |
  Start game -> ... -> Incheie Jocul (phase=ended). Reload. "Porneste Jocul" is greyed out;
  "Reseteaza Runda" does nothing. No way back to lobby from the dashboard.
fix_outline: |
  Add a "reset-to-lobby / new game" capability:
  - New host-auth-gated action/endpoint (e.g. transition action "reset_game" or
    POST /api/host/new-game) that sets phase='lobby', current_question_id=null, and clears
    answers (and scores) for the game — idempotent, broadcasts an existing event so clients resync.
  - Wire a confirm-gated "Joc Nou / Reseteaza Jocul" control into the Emergency panel
    (destructive AlertDialog, Romanian copy). Distinct from "Reseteaza Runda" (round-only).
workaround_applied: |
  For UAT continuation, the game was reset to lobby directly in the DB (phase=lobby,
  current_question_id=null, answers cleared) via the service-role client.
