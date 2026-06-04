---
phase: 05-guest-app
plan: "03"
subsystem: guest-app
tags: [guest, winner-screen, confetti, leaderboard, game-end]
dependency_graph:
  requires:
    - 05-01  # LeaderboardPanel, SyncStatusBadge, GameStateSnapshot/SyncStatus types
    - 02-realtime-core  # useGameSync hook types (GameStateSnapshot, SyncStatus)
  provides:
    - WinnerScreen component — full game-end screen (PLAY-07, D-09)
    - canvas-confetti one-shot burst via dynamic import (T-05-07)
    - Final-state full leaderboard display (PLAY-06 game-end portion)
  affects:
    - src/components/guest/WinnerScreen.tsx — replaces 05-01 placeholder stub
tech_stack:
  added: []
  patterns:
    - Dynamic import for canvas-confetti (bundle split — Performance Contract)
    - useRef(false) fire-once guard (Pitfall 7 prevention)
    - Graceful array bounds handling (state.leaderboard[0] ?? null)
    - glass-gold Card for featured #1 slot (D-09 gold/champagne treatment)
key_files:
  created: []
  modified:
    - src/components/guest/WinnerScreen.tsx  # replaces placeholder stub from 05-01
decisions:
  - "Dynamic import pattern chosen over static import for canvas-confetti — keeps confetti out of main bundle until phase=ended (Performance Contract, T-05-07)"
  - "useRef(false) guard on confettiFired — WinnerScreen mounts once per game-end but presence/broadcast re-renders could re-trigger a useEffect without empty-deps; ref is the correct tool here (Pitfall 7)"
  - "winner/fallback ternary uses ?? null on leaderboard[0] — TypeScript-safe; fallback renders Felicitari tuturor instead of crashing on undefined"
  - "Card py-0 override added to suppress shadcn Card built-in py-6 — avoids 48px double-padding when only CardContent is present"
  - "thin-divider my-0 + explicit mt-6 margin — suppresses divider built-in CSS margin (1.5rem auto from globals.css) to avoid clash with flex parent spacing"
metrics:
  duration: "~20 min"
  completed: "2026-06-05"
  tasks_completed: 1
  files_created: 0
  files_modified: 1
requirements_satisfied: [PLAY-06, PLAY-07]
---

# Phase 5 Plan 03: WinnerScreen — Game-End Celebratory Screen Summary

Full WinnerScreen replacing the 05-01 placeholder: #1 player featured in a glass-gold trophy card with gold-bright name, full final leaderboard via LeaderboardPanel, and a one-shot canvas-confetti burst dynamically imported and ref-guarded against re-fire.

---

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | WinnerScreen — #1 featured + full leaderboard + one-shot confetti | 546ed00 | src/components/guest/WinnerScreen.tsx |

---

## What Was Built

### src/components/guest/WinnerScreen.tsx

Replaces the 05-01 placeholder stub entirely. Full implementation of the game-end screen per UI-SPEC Screen 7 and CONTEXT.md D-09:

**Layout (`min-h-dvh bg-ink flex flex-col items-center px-4 pt-12 pb-[env(safe-area-inset-bottom)]`):**
- `SyncStatusBadge` at top (absolute-positioned, non-blocking)
- `h1` "Castigator!" — `font-heading text-2xl font-bold text-champagne`
- `.thin-divider` gold rule
- `glass-gold` `Card` (py-0 override to suppress double padding) featuring the winner:
  - `Trophy` icon from lucide-react (`size-8 text-gold-bright`)
  - Winner name: `text-2xl font-bold font-heading text-gold-bright` (from `state.leaderboard[0]?.name`)
  - Score sub-line: `{score} raspunsuri corecte` in `text-sm text-champagne-dim`
  - Empty-leaderboard fallback: renders "Felicitari tuturor!" instead of crashing on undefined
- Second `.thin-divider`
- `h2` "Clasament final" — `text-base font-bold font-heading text-champagne`
- `<LeaderboardPanel leaderboard={state.leaderboard} />` — full final ranked list (PLAY-06)

**Confetti (T-05-07, Pitfall 7):**

`useRef(false)` flag prevents re-fire across re-renders. Dynamic import splits canvas-confetti out of the main bundle. Empty deps array — effect runs once on mount (WinnerScreen is conditionally rendered, single mount per game-end).

---

## Pre-execution Deviation: Worktree Merge Required

Same pattern as 05-01 (documented in 05-01-SUMMARY.md):
- **Found during:** Setup
- **Issue:** Worktree branch was at Phase 1 commit; Phases 2-5 work only existed in `main`. All referenced files (WinnerScreen placeholder, LeaderboardPanel, useGameSync, etc.) were missing from the worktree.
- **Fix:** `git merge main` — fast-forward to `f5adb83` (05-01 complete). Also copied `.env.local` from main working directory and ran `npm install`.
- **Commit:** No separate commit — pre-execution setup.

---

## Deviations from Plan

None — plan executed exactly as written.

The UI-SPEC thin-divider spacing (built-in CSS `margin: 1.5rem auto` clashing with flex layout) was handled by adding `my-0` and explicit `mt-6` overrides. Layout correctness fix, not a plan deviation.

---

## Threat Surface Scan

No new network endpoints. WinnerScreen is read-only — reads `state.leaderboard` from props only.

- **T-05-07 (confetti DoS/perf):** `useRef(false)` + dynamic import — fires once, off main bundle.
- **T-05-08 (XSS via display names):** All names rendered as React text content via LeaderboardPanel — no `dangerouslySetInnerHTML`.

---

## Known Stubs

None. The WinnerScreen stub from 05-01 is fully replaced.

---

## Self-Check

### Modified Files

- [x] `src/components/guest/WinnerScreen.tsx` — FOUND

### Commits

- [x] 546ed00 — feat(05-03): WinnerScreen — #1 featured + full leaderboard + one-shot confetti

### Acceptance Criteria

- [x] `WinnerScreen` uses `import("canvas-confetti")` inside `useEffect` — NOT static import
- [x] `useRef(false)` flag (`confettiFired`) guards the confetti call
- [x] `state.leaderboard[0]` read with graceful fallback when undefined
- [x] "Castigator!" heading present
- [x] "Clasament final" subheading present
- [x] `<LeaderboardPanel leaderboard={state.leaderboard} />` rendered
- [x] Component does NOT call `useGameSync`
- [x] `npm run build` exits 0
- [x] `npm run lint` reports no errors

## Self-Check: PASSED
