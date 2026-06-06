---
phase: 07-polish-pre-event-hardening
plan: "03"
subsystem: guest-app
tags: [animation, motion, confetti, reduced-motion, guest-polish, whileTap]
dependency_graph:
  requires:
    - "07-01 (provides .text-gradient-gold CSS utility consumed by NameGate)"
  provides:
    - "motion.button whileTap scale 0.96 on A/B answer buttons (QuestionScreen)"
    - "Gold gradient heading on guest join screen (NameGate)"
    - "Correct-answer one-shot confetti mini-burst (RevealScreen)"
  affects:
    - "src/components/guest/QuestionScreen.tsx — motion.button conversion"
    - "src/components/guest/NameGate.tsx — h1 gradient class swap"
    - "src/components/guest/RevealScreen.tsx — confetti useEffect added"
tech_stack:
  added: []
  patterns:
    - "motion.button whileTap with useReducedMotion() gate (QuestionScreen)"
    - "Dynamic import(\"canvas-confetti\") + useRef guard + empty deps (RevealScreen)"
    - "Derived correctness: state.myAnswer !== null && state.myAnswer === state.correctOption"
    - ".text-gradient-gold class applied to NameGate h1 (utility from plan 01)"
key_files:
  created: []
  modified:
    - src/components/guest/QuestionScreen.tsx
    - src/components/guest/NameGate.tsx
    - src/components/guest/RevealScreen.tsx
decisions:
  - "Empty deps [] on confetti useEffect is intentional — fires once on mount; state captured via closure matches WinnerScreen.tsx pattern"
  - "Derived correctness (myAnswer !== null && myAnswer === correctOption) required because GameStateSnapshot has no playerAnsweredCorrectly field"
  - "shouldReduce ? undefined : { scale: 0.96 } — undefined disables whileTap entirely (not scale:1) for correct reduced-motion behavior"
metrics:
  duration_minutes: 3
  completed_date: "2026-06-06T05:44:47Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 7 Plan 03: Guest Surface Polish — Tap Feedback, Gradient Heading, Confetti Reveal Summary

**One-liner:** motion.button whileTap scale 0.96 on A/B answer buttons (with useReducedMotion gate), gold-gradient h1 on NameGate join screen, and one-shot canvas-confetti mini-burst on RevealScreen when the guest's recorded answer equals the correct option.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | A/B tap feedback (motion.button whileTap) + NameGate gradient heading | 3581954 | src/components/guest/QuestionScreen.tsx, src/components/guest/NameGate.tsx |
| 2 | Correct-answer confetti on RevealScreen (derived correctness, D-08) | e929fb1 | src/components/guest/RevealScreen.tsx |

## What Was Built

### Task 1 — motion.button whileTap + NameGate gradient (QuestionScreen + NameGate)

**QuestionScreen.tsx:**

Added `import { motion, useReducedMotion } from "motion/react"` and `const shouldReduce = useReducedMotion()` in the component body after existing `useState` calls.

Converted both A/B `<button type="button" ...>` elements to `<motion.button type="button" ...>` with:
- `whileTap={shouldReduce ? undefined : { scale: 0.96 }}`
- `transition={{ duration: 0.1, ease: "easeOut" }}`

All existing attributes preserved verbatim: `className={getButtonClass(...)}` (carrying `[touch-action:manipulation]` and `focus-visible:ring-2` through the class string), `onClick`, `aria-pressed`, `aria-disabled`, `aria-label`, and all inner `<span>` children. `getButtonClass` and `handleTap` function bodies are unchanged.

**NameGate.tsx:**

Swapped `text-champagne` for `text-gradient-gold` on the `<h1>` heading (line 78). No other changes — form, input, error state, and submit button are untouched. No new imports needed (utility created in plan 01).

### Task 2 — Correct-answer confetti (RevealScreen)

Added `import { useEffect, useRef } from "react"` and `import { useReducedMotion } from "motion/react"` to RevealScreen.

In the component body (before existing distribution variables):
- `const confettiFired = useRef(false)` — ref-guard prevents re-fire
- `const shouldReduce = useReducedMotion()` — skip on reduced-motion devices

Added `useEffect` with empty deps `[]` that:
1. Derives correctness: `const answeredCorrectly = state.myAnswer !== null && state.myAnswer === state.correctOption`
2. Guards in order: `!answeredCorrectly → return`, `shouldReduce → return`, `confettiFired.current → return`
3. Sets `confettiFired.current = true`
4. Fires `import("canvas-confetti").then(({ default: confetti }) => confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 }, colors: ["#f0c060", "#f5e6c8", "#d4a843"] }))`

`getRevealClass`, distribution bar, `CheckCircle2`/`XCircle` indicators, and `LeaderboardPanel` call are all unchanged.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All three changes are fully functional:
- `whileTap` fires on any motion.button tap (no stub condition)
- `text-gradient-gold` renders the live CSS gradient from plan 01
- Confetti derives from real `state.myAnswer` and `state.correctOption` values from `useGameSync`

## Threat Flags

None. This plan modifies three client guest components only:
- No new API routes
- No new user input handling (NameGate form/input/submit unchanged; only h1 class changed)
- A/B tap path unchanged logically (`onClick`/`handleTap` preserved; only visual `whileTap` added)
- Confetti is local imperative call on guest's device — no network requests, no new data access

## Self-Check: PASSED

- FOUND: src/components/guest/QuestionScreen.tsx
- FOUND: src/components/guest/NameGate.tsx
- FOUND: src/components/guest/RevealScreen.tsx
- FOUND: .planning/phases/07-polish-pre-event-hardening/07-03-SUMMARY.md
- FOUND commit: 3581954 (feat(07-03): A/B tap feedback (motion.button whileTap) + NameGate gold gradient)
- FOUND commit: e929fb1 (feat(07-03): correct-answer confetti mini-burst on RevealScreen (D-08))
