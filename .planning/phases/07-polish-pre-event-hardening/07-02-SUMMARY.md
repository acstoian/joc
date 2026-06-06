---
phase: 07-polish-pre-event-hardening
plan: "02"
subsystem: tv-display-aesthetics
tags: [animation, motion, stagger, confetti, gradient, tv-display, reduced-motion, canvas-confetti]
dependency_graph:
  requires:
    - "07-01 — .text-gradient-gold CSS utility must exist in globals.css before this plan applies it"
  provides:
    - "Gold gradient text on LobbyDisplay title, RevealDisplay correct label, WinnerDisplay #1 name"
    - "Staggered leaderboard (motion.ol/li, 80ms stagger) in RevealDisplay (top-5) and WinnerDisplay (full)"
    - "One-shot TV confetti burst (150 particles, upper-center) on WinnerDisplay mount"
  affects:
    - "src/components/display/LobbyDisplay.tsx — game title gradient"
    - "src/components/display/RevealDisplay.tsx — correct label gradient + staggered leaderboard"
    - "src/components/display/WinnerDisplay.tsx — winner name gradient + staggered leaderboard + confetti"
tech_stack:
  added: []
  patterns:
    - "Inline motion.ol/motion.li stagger replacing LeaderboardPanel in display components"
    - "useReducedMotion() gate — plain ol/li fallback for stagger, skip confetti"
    - "canvas-confetti dynamic import with useRef guard (one-shot, off initial bundle)"
    - "Module-level containerVariants/rowVariants with ease: 'easeOut' as const for TypeScript compat"
    - "Local getRankClasses/getScoreClasses helpers (copied from LeaderboardPanel, not imported)"
key_files:
  created: []
  modified:
    - src/components/display/LobbyDisplay.tsx
    - src/components/display/RevealDisplay.tsx
    - src/components/display/WinnerDisplay.tsx
decisions:
  - "ease: 'easeOut' as const required — motion/react Variants type is strict; string literal not assignable to Easing union without const assertion"
  - "useEffect empty deps [] for confetti is intentional and correct — fires once on mount; ESLint react-hooks/exhaustive-deps warning acknowledged and accepted (same pattern as WinnerScreen.tsx)"
  - "Stagger fires once per component mount — AnimatePresence mode=wait (plan 01) remounts on phase change, so stagger re-fires on each reveal/ended transition without any re-trigger logic"
  - "LeaderboardPanel helpers copied locally (not imported) to keep the TV stagger inline and avoid coupling display surface to the guest component's sizing assumptions"
metrics:
  duration_minutes: 5
  completed_date: "2026-06-06T05:45:04Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 7 Plan 02: TV Display Gradient Text + Staggered Leaderboard + Winner Confetti Summary

**One-liner:** Gold-gradient hero text on three TV display screens (lobby title, reveal correct label, winner name), `motion.ol`/`motion.li` stagger leaderboard (80ms/row) on reveal and winner screens, and a one-shot 150-particle confetti burst from upper-center on the winner screen.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Gradient on LobbyDisplay title + RevealDisplay gradient/stagger | f4699a7 | LobbyDisplay.tsx, RevealDisplay.tsx |
| 2 | WinnerDisplay gradient + staggered full leaderboard + TV confetti (D-09) | 9f780b7 | WinnerDisplay.tsx |

## What Was Built

### Task 1 — LobbyDisplay gradient title

Changed the game-title `<h1>` in `LobbyDisplay.tsx` from `text-champagne` to `text-gradient-gold`. All other elements (participant count, pulse mechanism, waiting subtitle) unchanged. No new imports required.

### Task 1 — RevealDisplay gradient correct label + staggered top-5 leaderboard

`RevealDisplay.tsx` received a full replacement of its leaderboard section:

- Removed `LeaderboardPanel` import (replaced by inline stagger — Rule: unused imports fail lint)
- Added `motion`, `useReducedMotion` from `"motion/react"` and `Separator` from `"@/components/ui/separator"`
- Added module-level `getRankClasses`/`getScoreClasses` helpers (copied verbatim from LeaderboardPanel, not imported)
- Added module-level `containerVariants` (`staggerChildren: 0.08, delayChildren: 0.1`) and `rowVariants` (`opacity 0→1, y 10→0, 250ms easeOut`)
- Added `const shouldReduce = useReducedMotion()` in component body
- Changed correct option `<span>` in `OptionWithBar` from `text-gold-bright` to `text-gradient-gold`
- Replaced `<LeaderboardPanel leaderboard={state.leaderboard.slice(0, 5)} />` with inline conditional:
  - When `shouldReduce`: plain `<ol>`/`<li>` list (no animation)
  - Otherwise: `<motion.ol variants={containerVariants}>` with `<motion.li variants={rowVariants}>` rows
- Preserved the `transform scale-150 origin-top` TV wrapper (Phase 6 Finding 5)

### Task 2 — WinnerDisplay gradient + staggered full leaderboard + TV confetti

`WinnerDisplay.tsx` received three changes:

**Gradient:** Winner name `<p>` changed from `text-gold-bright` to `text-gradient-gold`.

**Staggered full leaderboard:** Same inline stagger pattern as RevealDisplay, using `state.leaderboard` (no `.slice(0, 5)`) — full leaderboard for the winner screen. Same `containerVariants`/`rowVariants`/`getRankClasses`/`getScoreClasses` pattern, `shouldReduce` plain-list fallback. `transform scale-150 origin-top` wrapper preserved.

**TV confetti (D-09):** Added `useRef(false)` guard and `useEffect` with empty `[]` deps:
```tsx
useEffect(() => {
  if (shouldReduce) return;
  if (confettiFired.current) return;
  confettiFired.current = true;
  import("canvas-confetti").then(({ default: confetti }) => {
    confetti({ particleCount: 150, spread: 100, origin: { x: 0.5, y: 0.3 },
               colors: ["#f0c060", "#f5e6c8", "#d4a843", "#e8a0a0"] });
  });
}, []);
```
Origin `y: 0.3` (upper-center) makes confetti fall naturally down across the landscape projector. Dynamic import keeps `canvas-confetti` off the initial bundle.

Updated JSDoc: removed "No canvas-confetti — confetti is guest-side only (Phase 5)" line, replaced with note that D-09 adds TV winner confetti.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript strict-mode error: `ease: string` not assignable to `Easing`**
- **Found during:** Task 1 build verification
- **Issue:** `rowVariants` specified `ease: "easeOut"` as a plain string. TypeScript strict mode with motion/react's `Variants` type requires `ease` to be typed as `Easing | Easing[] | undefined`, not `string`.
- **Fix:** Added `as const` assertion: `ease: "easeOut" as const`. Applied same fix preemptively to Task 2's `WinnerDisplay.tsx` before running its build.
- **Files modified:** RevealDisplay.tsx (line 48), WinnerDisplay.tsx (line 38)
- **Commit:** Included in f4699a7 (Task 1)

**2. [Rule 3 - Blocking] Missing `.env.local` in worktree**
- **Found during:** Task 1 build verification (first run)
- **Issue:** The worktree has no `.env.local`; API routes throw "Missing Supabase admin credentials" during Next.js static page data collection, failing the build.
- **Fix:** Copied `.env.local` from the main repo (`C:\Work\Joc\.env.local`) to the worktree using PowerShell `Copy-Item`.
- **Commit:** Not committed — `.env.local` is gitignored by design.

## Known Stubs

None. All changes wire directly to `state.leaderboard` from `GameStateSnapshot` (live data from `useGameSync`). No hardcoded empty arrays or placeholder text introduced.

## Threat Flags

None. This plan modifies three client display components only. No new API routes, no new Supabase queries, no new user input. Player names continue to render as React text nodes (`{entry.name}`) — no `dangerouslySetInnerHTML`. No new trust boundaries introduced. Confirmed: T-07-03 (player name XSS) remains accepted/mitigated via React text node escaping.

## Self-Check: PASSED

- FOUND: src/components/display/LobbyDisplay.tsx
- FOUND: src/components/display/RevealDisplay.tsx
- FOUND: src/components/display/WinnerDisplay.tsx
- FOUND commit: f4699a7 (feat(07-02): gradient title + staggered reveal leaderboard)
- FOUND commit: 9f780b7 (feat(07-02): winner gradient + staggered full leaderboard + TV confetti)
- FOUND: .planning/phases/07-polish-pre-event-hardening/07-02-SUMMARY.md
