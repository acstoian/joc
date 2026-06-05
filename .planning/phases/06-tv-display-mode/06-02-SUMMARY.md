---
phase: 06-tv-display-mode
plan: "02"
subsystem: display
status: checkpoint
tags: [tv-display, question-screen, locked-bars, reveal-effect, leaderboard]
dependency_graph:
  requires: [06-01]
  provides: [QuestionDisplay-real, LockedDisplay-real, RevealDisplay-real]
  affects:
    - src/components/display/QuestionDisplay.tsx
    - src/components/display/LockedDisplay.tsx
    - src/components/display/RevealDisplay.tsx
tech_stack:
  added: []
  patterns:
    - CSS @keyframes slide-up via [animation:...] arbitrary class + key re-mount for per-question re-trigger
    - CSS transition-[width] on bar fill div for live A/B percentage animation
    - JSX-conditional reveal classes (no useEffect) per Pitfall 5 avoidance
    - scale-150 origin-top wrapper around LeaderboardPanel for TV readability
    - null-guard pattern: state.distribution ?? { A: 0, B: 0 }
key_files:
  created: []
  modified:
    - src/components/display/QuestionDisplay.tsx
    - src/components/display/LockedDisplay.tsx
    - src/components/display/RevealDisplay.tsx
decisions:
  - RevealDisplay applies gold-glow + scale-[1.03] + opacity-40 via JSX conditionals at render time (no useEffect) — classes are present when the component first mounts, transition-transform/opacity handle the smooth visual
  - LeaderboardPanel wrapped in scale-150 origin-top div — reuses Phase 5 component unmodified, scales for TV readability per Finding 5 from 06-RESEARCH.md
  - No new files created outside files_modified — OptionWithBar helper defined locally in LockedDisplay.tsx and RevealDisplay.tsx (separate copies, consistent with files_modified constraint)
metrics:
  duration: "~12 minutes"
  completed: "2026-06-05"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 3
---

# Phase 6 Plan 02: Live Gameplay Display Screens Summary

**One-liner:** QuestionDisplay (slide-up entry + A/B cards), LockedDisplay (live-filling percentage bars), and RevealDisplay (gold-glow correct option + dimmed wrong + top-5 leaderboard) replace the 06-01 stubs with full implementations.

## What Was Built

### Task 1: QuestionDisplay (commit `ecaf6de`)

**`src/components/display/QuestionDisplay.tsx`** — Full replacement of the 06-01 stub.

Layout: `flex min-h-dvh flex-col items-center justify-center gap-[5vh] px-[5vw]`

- **Phase label:** Static `"Întrebarea"` — `text-[1.5vw] font-normal font-body text-champagne-dim/70 uppercase tracking-widest` (Label role from UI-SPEC)
- **Question `<h2>`:** `key={state.currentQuestionId}` so React re-mounts (and re-fires the slide-up animation) on every question change. Classes: `text-[6vw] font-bold font-heading text-champagne leading-snug max-w-[80vw] [animation:slide-up_400ms_ease-out_forwards]`. Content: `q?.body ?? "Se încarcă întrebarea..."`.
- **A/B option cards:** `grid grid-cols-2 gap-[3vw] w-full max-w-[90vw]`. Each `OptionCard` is a module-scope helper: `.glass rounded-2xl flex flex-col items-center justify-center gap-[1.5vh] px-[4vw] py-[3vh] min-h-[18vh]` with letter prefix (`text-[1.5vw]`) and option text (`text-[2vw]`). No bars.

### Task 2: LockedDisplay + RevealDisplay (commit `89ce8e8`)

**`src/components/display/LockedDisplay.tsx`** — Full replacement of the 06-01 stub.

- Reuses the question + phase-label layout without the slide-up animation (phase change, not a new question).
- Adds `"Răspunsurile au fost blocate"` notice below the question.
- A/B grid uses `OptionWithBar` (module-scope helper): `.glass` card + a percentage row with a bar track (`bg-ink-muted overflow-hidden`) containing a fill div (`bg-gold transition-[width] duration-500 ease-out`) with `style={{ width: \`${pct}%\` }}`.
- Distribution null guard: `const dist = state.distribution ?? { A: 0, B: 0 }` before reading `.A`/`.B`.

**`src/components/display/RevealDisplay.tsx`** — Full replacement of the 06-01 stub.

- `OptionWithBar` helper takes `correctOption: "A" | "B" | null`. Computes `isCorrect = correctOption !== null && option === correctOption`.
- Correct option wrapper: no opacity change. Card gets `glass-gold border-2 border-gold-bright shadow-[0_0_40px_0_rgba(240,192,96,0.45)] scale-[1.03] transition-transform duration-300`. Option text: `text-gold-bright`. Bar fill: `bg-gold-bright`.
- Incorrect option wrapper: `opacity-40 transition-opacity duration-300`. Card: `.glass`. Bar fill: `bg-gold`.
- All reveal classes applied via JSX conditionals at render time — no `useEffect` (Pitfall 5 from 06-RESEARCH.md).
- After bars: `.thin-divider` + `<LeaderboardPanel leaderboard={state.leaderboard.slice(0, 5)} />` wrapped in `<div className="transform scale-150 origin-top">` for TV readability.
- `LeaderboardPanel` imported from `@/components/guest/LeaderboardPanel` — unmodified.

## Deviations from Plan

None — plan executed exactly as written. All critical corrections (#1–#6) applied as specified. No new files created outside `files_modified`.

## Known Stubs

None in this plan — all three components are full implementations.

The following components remain as stubs from 06-01 (to be replaced in 06-03):

| File | Stub reason | Replaced by |
|------|-------------|-------------|
| `src/components/display/WinnerDisplay.tsx` | Hero slot + full leaderboard | 06-03 |
| `src/components/display/CountdownOverlay.tsx` | Cinematic number with fade-scale animation | 06-03 |

## Threat Surface Scan

No new threat surface beyond the plan's threat model:
- T-06-04: All question/option/leaderboard strings rendered as React text nodes — no `dangerouslySetInnerHTML` in any of the three new components. XSS-safe.
- T-06-05: `state.correctOption` is rendered in RevealDisplay as a conditional class selector — the correct answer is intentionally public in the revealed phase, consistent with the accept disposition.
- T-06-SC: No new packages installed.

## Checkpoint Pending

Task 3 is a `checkpoint:human-verify` — the user must run the dev server and visually verify question entry animation, live locked bars, and the gold reveal + top-5 leaderboard across host-driven phase transitions.

## Self-Check: PASSED

Files verified:
- `src/components/display/QuestionDisplay.tsx` — exists, exports `QuestionDisplay`, 79 lines (>30 min)
- `src/components/display/LockedDisplay.tsx` — exists, exports `LockedDisplay`, ~120 lines (>40 min)
- `src/components/display/RevealDisplay.tsx` — exists, exports `RevealDisplay`, ~170 lines (>50 min)
- `src/components/guest/LeaderboardPanel.tsx` — NOT modified (confirmed via `git diff HEAD`)

Commits verified:
- `ecaf6de` — QuestionDisplay Task 1
- `89ce8e8` — LockedDisplay + RevealDisplay Task 2

Build output confirmed: `/display` route listed at 3.17 kB, exit 0.

Acceptance criteria verified via grep:
- `key={state.currentQuestionId}` on h2 in QuestionDisplay ✓
- `[animation:slide-up_400ms_ease-out_forwards]` in QuestionDisplay ✓
- `transition-[width]` in LockedDisplay ✓
- `border-gold-bright` in RevealDisplay ✓
- `opacity-40` in RevealDisplay ✓
- `state.leaderboard.slice(0, 5)` in RevealDisplay ✓
- No `.text` references in any display component ✓
