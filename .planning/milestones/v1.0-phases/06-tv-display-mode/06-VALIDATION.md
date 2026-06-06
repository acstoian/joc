---
phase: 06
slug: tv-display-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — "No test framework is configured." per CLAUDE.md |
| **Config file** | none |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npm run lint` |

**Note:** CLAUDE.md explicitly states "No test framework is configured." Verification is performed via manual UAT (two browser tabs: host dashboard + /display) and build-time type checks.

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| DISP-01 | `/display` route renders full-screen landscape layout, large typography | smoke (manual) | `npm run build` exits 0; visit `/display` in browser | Visual check — fonts readable from 3+ metres |
| DISP-02 | Display syncs within 1s of host action; connection dot visible | integration (manual) | Open host + display in separate tabs; trigger each phase transition | Timing is real-device verification |
| DISP-03 | Question screen has slide-up animation; locked phase shows live A/B bars | visual (manual) | Observe question screen on host start + lock | CSS transition must be visible |
| DISP-04 | Live A/B percentage bars fill as answers arrive | integration (manual) | Simulate guest answers; observe LockedDisplay | Requires live Supabase + guest joins |
| DISP-05 | Correct bar glows gold + scales on reveal; wrong dims | visual (manual) | Host reveals; observe RevealDisplay | Gold glow CSS transition |
| DISP-06 | Top-5 leaderboard appears below bars after reveal | integration (manual) | Observe RevealDisplay leaderboard section | Requires at least 1 completed round |
| DISP-07 | Winner screen at game end with #1 hero slot | integration (manual) | Host ends game; observe WinnerDisplay | Requires full game run |
| DISP-08 | Countdown overlay 3→2→1 appears on host trigger | integration (manual) | Click countdown button in host dashboard | Client-side setInterval drives ticks |

---

## Build Gate (substitute for unit tests)

```bash
npm run build   # TypeScript compilation catches type errors in all display components
npm run lint    # ESLint catches import/pattern violations
```

---

## Wave 0 Gaps

- [ ] `@keyframes slide-up` and `@keyframes fade-scale` added to `src/app/globals.css`
- [ ] `useGameSync` extended with optional `onEvent` callback (or alternative countdown routing)
- [ ] `/api/host/countdown` route created with `validateHostAuth` + `seconds` clamp (1–10)

*No test framework — no test file gaps.*
