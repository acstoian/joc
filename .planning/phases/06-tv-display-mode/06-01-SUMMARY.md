---
phase: 06-tv-display-mode
plan: "01"
subsystem: display
tags: [tv-display, realtime, fullscreen, keyframes, countdown]
dependency_graph:
  requires: [05-guest-app]
  provides: [display-route, useGameSync-onEvent, countdown-endpoint, display-keyframes]
  affects: [src/hooks/useGameSync.ts, src/app/globals.css]
tech_stack:
  added: []
  patterns:
    - Anonymous Supabase Realtime subscriber using HOST_SENTINEL_PLAYER_ID
    - onEvent ref-based callback extension to useGameSync (stale-closure safe)
    - Phase switch shell (DisplayPage mirrors GuestShell / DashboardShell pattern)
    - CSS-only animations via @keyframes in globals.css (no motion/react in Phase 6)
    - Fullscreen API with fullscreenchange listener for button visibility
    - Countdown setInterval with functional updater (Pitfall 3 avoidance)
    - Typed compiling stubs with real prop signatures (drop-in compatible for 06-02/06-03)
key_files:
  created:
    - src/app/display/page.tsx
    - src/app/api/host/countdown/route.ts
    - src/components/display/LoadingDisplay.tsx
    - src/components/display/LobbyDisplay.tsx
    - src/components/display/DisplayStatusDot.tsx
    - src/components/display/QuestionDisplay.tsx
    - src/components/display/LockedDisplay.tsx
    - src/components/display/RevealDisplay.tsx
    - src/components/display/WinnerDisplay.tsx
    - src/components/display/CountdownOverlay.tsx
  modified:
    - src/app/globals.css
    - src/hooks/useGameSync.ts
decisions:
  - useGameSync extended with optional third argument options?.onEvent using a ref to avoid stale-closure bugs and preserve the [gameId, playerId] dep array unchanged
  - POST /api/host/countdown validates seconds as integer 1-10 — rejects (400) rather than silently clamping so buggy callers are immediately visible
  - Typed stubs for QuestionDisplay/LockedDisplay/RevealDisplay/WinnerDisplay/CountdownOverlay use .body (not .text) per Critical Correction #2
  - Host sentinel UUID used as playerId (never null) per Finding 1 — consistent with DashboardShell pattern
metrics:
  duration: "7 minutes"
  completed: "2026-06-05T09:44:37Z"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 12
---

# Phase 6 Plan 01: TV Display Mode Foundation Summary

**One-liner:** Anonymous display subscriber shell at `/display` with `useGameSync(GAME_ID, HOST_SENTINEL_PLAYER_ID, {onEvent})`, lobby screen, status dot, fullscreen button, and all Wave-0 infra (keyframes, countdown endpoint).

## What Was Built

### Task 1: Wave-0 Infrastructure (commit `58c9de8`)

**globals.css keyframes:** Added `@keyframes slide-up` (opacity 0 + translateY(2vh) → 1 + 0) and `@keyframes fade-scale` (opacity 0.4 + scale(0.8) → 1 + 1) after the `.thin-divider` block. A `@media (prefers-reduced-motion: reduce)` block redefines both to no-op and adds `.animate-pulse { animation: none }`. The `@theme` block was not touched.

**useGameSync onEvent extension:** Added optional third argument `options?: UseGameSyncOptions` where `UseGameSyncOptions = { onEvent?: (event: GameEvent) => void }`. The callback is stored in `onEventRef` (updated each render via a side-effect-only `useEffect`) and called in the broadcast handler before `await fetchState()`. The `[gameId, playerId]` dependency array is unchanged — no channel recreation on callback identity change. All existing callers (host, guest) pass no third argument and are completely unaffected.

**POST /api/host/countdown:** Follows `transition/route.ts` pattern exactly — `validateHostAuth(req)` as first statement, JSON parse with try/catch → 400, UUID validation via `isValidUuid()`, integer bounds check (1-10, reject not clamp), best-effort broadcast of `COUNTDOWN_STARTED` in try/catch, returns `{ ok: true }` 200.

### Task 2: Display Shell + Screen Components (commit `573d35e`)

**`src/app/display/page.tsx`:** `"use client"` shell with `containerRef`, `isFullscreen`, `countdown` state. Calls `useGameSync(GAME_ID, HOST_SENTINEL_PLAYER_ID, { onEvent })` — never null. Two `useEffect`s: fullscreenchange listener and countdown setInterval with functional updater. Exhaustive `switch(state.phase)` with `const _exhaustive: never` guard. `CountdownOverlay` renders alongside (not instead of) the phase screen at z-40.

**Real components:**
- `LoadingDisplay`: CSS spinner (border-t-gold animate-spin) + "Se încarcă..." in champagne-dim on bg-ink
- `LobbyDisplay`: game title (6vw Playfair), thin-divider, pulsing count (animate-pulse for 600ms on change), Romanian plural (`jucător` vs `jucători`), "Așteptăm să înceapă..." subtitle
- `DisplayStatusDot`: fixed top-right dot driven by SyncStatus — bg-sage connected, bg-gold connecting, bg-gold animate-pulse reconnecting, bg-red-500 error; label only for non-connected states

**Typed stubs (06-02/06-03 replace these):** `QuestionDisplay`, `LockedDisplay`, `RevealDisplay` all use `state.currentQuestion?.body` (Critical Correction #2: not `.text`). `WinnerDisplay` reads `state.leaderboard[0]`. `CountdownOverlay` renders the countdown number at z-40 with bg-ink/80 backdrop.

## Deviations from Plan

**1. [Rule 3 - Blocking] Worktree branch was forked before phases 2-5**

- **Found during:** Task 1 — source files (hooks, components) absent from worktree
- **Issue:** The worktree branch `worktree-agent-a3da93f2cff3cbd9e` was forked from an old commit (`fd91e66`) before phases 2-5 were merged to main. The worktree had only `src/app/`, `src/lib/`, `src/types/` — no `src/hooks/`, `src/components/`.
- **Fix:** `git merge main --no-edit` — fast-forward merge brought the branch to `9064750` with all phase 2-5 source files. The globals.css edit made before discovering this was preserved in the merge.
- **Impact:** None — fast-forward, no conflicts.

**2. [Rule 3 - Blocking] `.env.local` absent from worktree**

- **Found during:** Task 1 build verification
- **Issue:** Next.js build failed with "Missing Supabase admin credentials" because `.env.local` exists in the main repo but not in the worktree directory.
- **Fix:** Copied `.env.local` from main repo to worktree. The file is gitignored so it does not appear as an untracked file.
- **Impact:** None — standard worktree setup requirement.

**3. [Auto-improvement] Romanian plural in LobbyDisplay**

- **Found during:** Task 2 — implementing LobbyDisplay
- **Issue:** The plan spec says `"{participantCount} jucători s-au alăturat"` (always plural). Romanian requires singular form for count = 1: "jucător" vs "jucători".
- **Fix:** Added ternary: `participantCount === 1 ? "jucător s-a alăturat" : "jucători s-au alăturat"`.
- **Rule:** Rule 2 (correctness) — the plan's static string is grammatically incorrect for 1 participant.

## Known Stubs

The following five components are intentional placeholder stubs with real prop signatures, to be replaced by plans 06-02 and 06-03:

| File | Stub reason | Replaced by |
|------|-------------|-------------|
| `src/components/display/QuestionDisplay.tsx` | Full question + options layout | 06-02 |
| `src/components/display/LockedDisplay.tsx` | Live A/B percentage bars | 06-02 |
| `src/components/display/RevealDisplay.tsx` | Gold reveal effect + top-5 leaderboard | 06-02 |
| `src/components/display/WinnerDisplay.tsx` | Hero slot + full leaderboard | 06-03 |
| `src/components/display/CountdownOverlay.tsx` | Cinematic number with fade-scale animation | 06-03 |

These stubs render minimal placeholder content that compiles and passes the build gate. They do NOT prevent the plan's goal (DISP-01, DISP-02: lobby renders live) from being achieved. The stub designation is intentional per the plan's `<artifacts_this_phase_produces>` table.

## Checkpoint Pending

Task 3 is a `checkpoint:human-verify` — the user must open `/display` in a browser, confirm the lobby renders, participant count syncs live from a guest join, fullscreen button works, and the status dot shows green when connected.

## Threat Surface Scan

No new threat surface beyond what was planned:

- `POST /api/host/countdown` is in the plan's threat model (T-06-01, T-06-02) and both mitigations are implemented: `validateHostAuth` first statement, seconds range validation with 400 rejection.
- `/display` route is intentionally public (T-06-03, accept disposition).
- No `dangerouslySetInnerHTML` in any display component (T-06-04).

## Self-Check: PASSED

Files verified:
- `src/app/display/page.tsx` — exists, exports default DisplayPage
- `src/app/api/host/countdown/route.ts` — exists, exports POST
- `src/components/display/` — 8 files present (LoadingDisplay, LobbyDisplay, DisplayStatusDot, QuestionDisplay, LockedDisplay, RevealDisplay, WinnerDisplay, CountdownOverlay)
- `src/hooks/useGameSync.ts` — modified, contains UseGameSyncOptions type and onEventRef
- `src/app/globals.css` — modified, contains @keyframes slide-up

Commits verified:
- `58c9de8` — Wave-0 infra (globals.css, useGameSync, countdown route)
- `573d35e` — Display shell + all 8 components

Build output confirmed: `/display` route listed, `/api/host/countdown` route listed, exit 0.
