---
phase: 06-tv-display-mode
plan: "03"
subsystem: display
status: checkpoint
tags: [tv-display, winner-screen, countdown-overlay, host-dashboard, DISP-07, DISP-08]
dependency_graph:
  requires: [06-01]
  provides: [WinnerDisplay-real, CountdownOverlay-real, ControlTab-countdown-button]
  affects:
    - src/components/display/WinnerDisplay.tsx
    - src/components/display/CountdownOverlay.tsx
    - src/components/host/ControlTab.tsx
tech_stack:
  added: []
  patterns:
    - Trophy icon from lucide-react in winner hero slot
    - key={countdown} span re-mount to re-trigger CSS animation each tick
    - Separate countdownInFlight boolean (not reusing inFlight) — COUNTDOWN_STARTED does not change phase
    - setTimeout 2s self-clear in finally block for cosmetic broadcast
    - LeaderboardPanel reused unmodified in scale-150 wrapper for TV legibility
key_files:
  created: []
  modified:
    - src/components/display/WinnerDisplay.tsx
    - src/components/display/CountdownOverlay.tsx
    - src/components/host/ControlTab.tsx
decisions:
  - countdownInFlight is a separate boolean from inFlight because COUNTDOWN_STARTED does not change state.phase, so the phase-watch useEffect would never clear a shared inFlight value
  - handleCountdown clears via setTimeout in a finally block — always fires regardless of success/failure, and on the 2s delay to match the display overlay duration
  - countdown button uses secondary bg-ink-light/border-champagne/20 styling (not primary gold) to visually distinguish cosmetic from game-state actions
  - anyInFlight declared before handleCountdown to avoid temporal dead zone — const declarations are not hoisted
  - No canvas-confetti in WinnerDisplay — confetti is guest-side only (Phase 5 decision preserved)
metrics:
  duration: "12 minutes"
  completed: "2026-06-05T13:30:00Z"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 3
---

# Phase 6 Plan 03: Winner Screen + Countdown Overlay Summary

**One-liner:** Real WinnerDisplay (gold #1 hero + Trophy + full leaderboard) and stateless CountdownOverlay (key-remount fade-scale tick), plus ControlTab Section D "Numărătoare inversă" button with separate countdownInFlight boolean and 2s self-clear.

## What Was Built

### Task 1: WinnerDisplay + CountdownOverlay (commit `e61fd0b`)

**`src/components/display/WinnerDisplay.tsx`** — Replaced the 06-01 stub with the full winner screen (DISP-07):
- Heading "Câștigător!" in `text-[6vw] font-bold font-heading text-champagne`
- `thin-divider` separator
- Hero slot rendered only when `state.leaderboard[0]` is non-null (Correction 2 guard): `glass-gold rounded-3xl` card with `Trophy` from lucide-react (`text-gold-bright w-[5vw] h-[5vw]`), winner name in `text-[6vw] font-bold font-heading text-gold-bright`, and subtitle `{winner.score} răspunsuri corecte` in `text-[2vw] text-champagne-dim` (Correction 1)
- `thin-divider`, "Clasament final" heading
- Full `state.leaderboard` (not sliced) via `LeaderboardPanel` inside a `transform scale-150 origin-top` wrapper for TV legibility (Finding 5)
- Footer "Felicitări tuturor!" in `text-[1.5vw] text-champagne-dim/60`
- No `canvas-confetti` import (guest-side only)

**`src/components/display/CountdownOverlay.tsx`** — Replaced the 06-01 stub with the real animation overlay (DISP-08 client side):
- Stateless — no `useState`, no `setInterval` (interval lives in DisplayPage shell, Correction 6)
- `fixed inset-0 z-40 bg-ink/80 backdrop-blur-sm` overlay
- `<span key={countdown}>` with `[animation:fade-scale_200ms_ease-out]` — `key` prop re-mounts the element on each tick to re-fire the CSS animation from start
- `text-[20vw]` as documented one-off exception (UI-SPEC §Typography exceptions)

### Task 2: ControlTab Section D (commit `b3e9de2`)

**`src/components/host/ControlTab.tsx`** — Added DISP-08 host trigger:
- `const [countdownInFlight, setCountdownInFlight] = useState(false)` — separate boolean from `inFlight` (Correction 3, Finding 3). COUNTDOWN_STARTED does not change `state.phase`, so the existing phase-watch `useEffect` would never clear a shared `inFlight` value
- `handleCountdown()` async function: early-return guard on `countdownInFlight || anyInFlight`; calls `hostFetch("/api/host/countdown", password, { method: "POST", body: { gameId, seconds: 3 } })`; silently swallows errors (cosmetic broadcast); `setTimeout(() => setCountdownInFlight(false), 2000)` in `finally` block — always fires regardless of success/failure
- `anyInFlight` and `phase` `const` declarations moved before `handleCountdown` to avoid temporal dead zone (Rule 1 fix — `const` is not hoisted)
- Section D JSX: `glass rounded-2xl px-5 py-4 shadow-xl` card titled "Ecran TV", single `<button>` with secondary `bg-ink-light border-champagne/20 text-champagne-dim` styling (not primary gold), `disabled={countdownInFlight || anyInFlight}`, button text `{countdownInFlight ? "Se porneste..." : "Numărătoare inversă"}`, placed between Section B (phase control) and `<EmergencyPanel />`
- Existing `inFlight` logic, `PhaseButton` wiring, reveal picker, and EmergencyPanel unchanged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing .env.local in worktree**

- **Found during:** Task 1 build verification
- **Issue:** `npm run build` failed with "Missing Supabase admin credentials" — `.env.local` exists in the main repo but not in the worktree directory (same issue as 06-01 Deviation 2)
- **Fix:** Copied `.env.local` from `C:/Work/Joc/.env.local` to the worktree root. File is gitignored.
- **Files modified:** `.env.local` (gitignored, not committed)
- **Commit:** N/A

**2. [Rule 1 - Bug] anyInFlight temporal dead zone**

- **Found during:** Task 2 implementation — reviewing code order
- **Issue:** `handleCountdown` was initially placed before `const anyInFlight = inFlight !== null`. In JavaScript, `const` is not hoisted — calling `handleCountdown()` at runtime would throw "Cannot access 'anyInFlight' before initialization"
- **Fix:** Moved `anyInFlight` and `phase` const declarations above `handleCountdown` so they are in scope when the function executes
- **Files modified:** `src/components/host/ControlTab.tsx`
- **Commit:** `b3e9de2` (included in Task 2 commit)

## Known Stubs

None in this plan. The two stubs from 06-01 (WinnerDisplay, CountdownOverlay) have been replaced with real implementations. All five 06-01 stubs are now resolved:

| Component | Replaced by |
|-----------|-------------|
| QuestionDisplay | 06-02 |
| LockedDisplay | 06-02 |
| RevealDisplay | 06-02 |
| WinnerDisplay | 06-03 (this plan) |
| CountdownOverlay | 06-03 (this plan) |

## Checkpoint Pending

Task 3 is a `checkpoint:human-verify` — the user must open `/display` and `/host`, verify the countdown overlay (non-blocking behavior) and the winner screen render correctly.

**Verification steps:**
1. `npm run dev`. Open `/display` (TV) and `/host` (host password entered) with at least one completed round.
2. Countdown (DISP-08): click "Numărătoare inversă" in the "Ecran TV" card on the Control tab. Display should show full-screen dark overlay with gold "3" → "2" → "1", then unmount. Button briefly shows "Se porneste..." and re-enables after ~2s.
3. Countdown non-blocking (Pitfall 7): trigger countdown, then advance a phase while it's counting. Underlying screen must update — overlay must not freeze state.
4. Winner (DISP-07): drive game to end via "Incheie Jocul". Display must show "Câștigător!" heading, #1 player in gold hero card with Trophy icon, their score as subtitle, full ranked leaderboard, "Felicitări tuturor!" footer.
5. Confirm no confetti on TV winner screen.
6. Confirm connection dot stays green throughout.

## Threat Surface Scan

No new threat surface beyond what was in the plan's threat model:
- T-06-01: `hostFetch` sends password via `x-host-password` header; endpoint validates via `validateHostAuth` (06-01)
- T-06-02: Button hard-codes `seconds: 3`; endpoint clamps 1-10 (06-01)
- T-06-04: Winner name and leaderboard rendered as React text nodes — no `dangerouslySetInnerHTML`
- T-06-06: `countdownInFlight || anyInFlight` disables button for 2s, throttling broadcast spam

## Self-Check: PASSED

Files verified:
- `src/components/display/WinnerDisplay.tsx` — exists, exports `WinnerDisplay`, contains `Trophy`, `LeaderboardPanel`, `winner.score răspunsuri corecte`, `scale-150`, no `canvas-confetti`
- `src/components/display/CountdownOverlay.tsx` — exists, exports `CountdownOverlay`, contains `key={countdown}`, `[animation:fade-scale_200ms_ease-out]`, `text-[20vw]`, no useState/setInterval
- `src/components/host/ControlTab.tsx` — exists, contains `countdownInFlight`, `handleCountdown`, `/api/host/countdown`, `Numărătoare inversă`, `Ecran TV`

Commits verified:
- `e61fd0b` — Task 1: WinnerDisplay + CountdownOverlay
- `b3e9de2` — Task 2: ControlTab countdown button

Build output: exit 0, `/display` and `/host` routes listed.
