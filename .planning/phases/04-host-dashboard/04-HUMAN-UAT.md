---
status: partial
phase: 04-host-dashboard
source: [04-VERIFICATION.md]
started: 2026-06-03T16:20:00Z
updated: 2026-06-03T16:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Password gate (Plan 01)
expected: Visiting /host shows the "Dashboard Gazda" gate (not tabs). A wrong password shows the inline red "Parola gresita. Incearca din nou." and no dashboard. The correct password reveals the three-tab shell (Control · Intrebari · Statistici) with a connection-status badge. Reload keeps you logged in; closing + reopening the tab prompts again. Requires HOST_PASSWORD in .env.local.
result: [pending]

### 2. Phase control buttons (Plan 02)
expected: In lobby only "Porneste Jocul" is enabled; the rest dimmed. Tapping a valid button disables all buttons (spinner + "...") and they re-enable only when the phase badge changes (~1s, Broadcast-confirmed). Rapid double-tap advances exactly one step. A second /host tab reflects phase + button state within ~2s. A 409 shows "Starea jocului s-a schimbat...". In locked phase the A/B reveal picker appears.
result: [pending]

### 3. Question CRUD + reorder + correct-mark (Plan 03)
expected: In "Intrebari", create a question (body + A + B), mark A correct, Save → persists across reload (QSTN-01/04). Edit body → persists (QSTN-02). Add a second question, reorder with ▲/▼ → new order persists (QSTN-05). Delete via the confirm dialog → gone (QSTN-03). Trying to delete the currently-active question shows the toast "Aceasta intrebare este activa in joc..." and does not delete (Pitfall 4). A request without x-host-password returns 401.
result: [pending]

### 4. Live stats (Plan 04)
expected: In "Statistici", the participant count rises within ~2s as a guest joins, no refresh (HOST-08). After a question starts and a guest answers, the A/B distribution updates live (HOST-09). Expanding "Vezi cine a raspuns" shows the guest's name under the option they chose (HOST-10). After reveal, the leaderboard populates ranked by score.
result: [pending]

### 5. Emergency recovery (Plan 05)
expected: Expand "Controale de urgenta". "Reseteaza Runda" (after confirm) returns the phase to "Intrebare" and clears the distribution within ~2s across tabs (SC5). "Sari la Intrebarea #N" makes question N active within ~2s. "Incheie Fortat Jocul" (after confirm) ends the game from ANY phase — badge shows "Incheiat" across all tabs even mid-question (proves force_end from a non-revealed state).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
