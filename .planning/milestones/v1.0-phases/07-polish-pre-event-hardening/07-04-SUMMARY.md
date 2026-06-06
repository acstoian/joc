---
plan: 07-04
phase: 07-polish-pre-event-hardening
status: complete
completed: 2026-06-06
tasks_completed: 3
tasks_total: 3
---

# Plan 07-04: Performance Audit + Production Dry Run

## What Was Built

Closed Phase 7 and the project's last open gate with a static performance audit,
a 60fps DevTools verification, and a mandatory end-to-end production dry run.

## Task Results

### Task 1 — Static Performance Audit (commit 5e7baa2)

All three audit checks passed:

- **Check 1 PASS** — All Phase 7 `motion/react` variants animate `opacity` and `y`/`scale`
  only. No `width`, `height`, `top`, or `left` found in any variant or `whileTap` prop.
- **Check 2 PASS** — Leaderboard stagger in `RevealDisplay.tsx` and `WinnerDisplay.tsx`
  uses `initial="hidden"` / `animate="visible"` with no `state.leaderboard` dependency.
  AnimatePresence (keyed on `state?.phase`) drives remounting; score ticks do not
  re-trigger the stagger animation.
- **Check 3 PASS** — `canvas-confetti` is dynamically imported via
  `import("canvas-confetti").then(...)` in both `RevealScreen.tsx` and `WinnerDisplay.tsx`.
  No static top-level import exists in either file.
- **Build + Lint** — `npm run build && npm run lint` exits 0.

### Task 2 — 60fps Verification (human-approved)

Guest A/B tap screen holds ~60fps under Chrome DevTools 4x CPU throttle.
No layout/style thrash spikes. TV leaderboard stagger fires once per reveal phase.
**Approved by human.**

### Task 3 — Production Dry Run (human-approved, RT-08 hard gate)

All 13 Dry Run Protocol checks passed on production (Vercel + Supabase Pro)
with 5+ real devices including iPhone on Safari.

| # | Check | Result |
|---|-------|--------|
| 1 | TV `/display` fullscreen → LobbyDisplay with participant count | ✓ |
| 2 | 5+ guests join → names appear, count increments live | ✓ |
| 3 | Host starts game → all phones + TV transition to question screen | ✓ |
| 4 | Guests tap A/B → lock feedback (incl. 0.96 tap scale); host sees distribution | ✓ |
| 5 | Host locks → all phones show "Aștepți dezvăluirea..." | ✓ |
| 6 | Host reveals → TV RevealDisplay with stagger; phones show correct/wrong | ✓ |
| 7 | Correct-answer guests see mini confetti on RevealScreen | ✓ |
| 8 | Host advances → TV slide+fade to next question | ✓ |
| 9 | 2-3 questions → no stuck states, no sync gaps | ✓ |
| 10 | Host ends game → TV WinnerDisplay with confetti + staggered leaderboard | ✓ |
| 11 | Airplane-mode 30s + reconnect → re-links to current game state | ✓ |
| 12 | iPhone Safari screen-lock 60s + unlock → syncs on tab return | ✓ |
| 13 | Emergency reset → game recovers, all clients resync | ✓ |

**PASS — all 13 checks passed. No stuck states, no sync gaps.**

### Post-Dry-Run Fix

During dry run, guests could not change their answer after the first tap.
Fixed in commits `0e5bdfd` and `9af5139`:
- Server route changed from INSERT to UPSERT (ON CONFLICT DO UPDATE)
- Client guard changed from `localAnswer !== null` to `state.phase === "locked"`
- Unselected button restored to full opacity so it reads as tappable
- PLAY-03 seeding effect switched to ref snapshot to prevent stale-server-value override

## Self-Check: PASSED

All RT-08 gates closed. Phase 7 ships to the wedding.
