---
phase: "04-host-dashboard"
plan: "02"
subsystem: "host-dashboard"
tags: ["host", "phase-control", "realtime", "ui", "motion"]
dependency_graph:
  requires:
    - "04-01"
    - "03-server-write-path-state-machine"
  provides:
    - "phase-button-component"
    - "control-tab-live-surface"
    - "phase-actions-map"
    - "in-flight-broadcast-confirmed-re-enable"
  affects:
    - "04-03-PLAN"
    - "04-05-PLAN"
tech_stack:
  added: []
  patterns:
    - "in-flight action guard: setInFlight(action) on click, re-enable in useEffect([state?.phase]) — Broadcast-confirmed (RQ-6)"
    - "5-second fallback setTimeout prevents permanent dashboard lock (T-04-06)"
    - "PHASE_ACTIONS map: lobby→start, question→lock, locked→reveal, revealed→next+end"
    - "motion/react whileTap scale animation for press confirm (UI-SPEC §9)"
    - "motion.div animated width for A/B distribution bar (0.4s easeOut)"
key_files:
  created:
    - "src/components/host/PhaseButton.tsx"
  modified:
    - "src/components/host/ControlTab.tsx"
decisions:
  - "end action enabled only in revealed phase (Open Q1 resolution — TRANSITIONS.end.expectedFrom=revealed; force-end from any state deferred to Plan 05 EmergencyPanel)"
  - "nextQuestionId resolved by fetching GET /api/host/questions (Plan 03 endpoint); graceful 404 fallback with toast if endpoint unavailable"
  - "distribution bar uses two motion.divs: A left-anchored gold, B right-anchored blush — correct split without overlap"
  - "reveal A/B picker visible only when phase===locked; defaulted to A; host picks correct option live at reveal time"
metrics:
  duration: "~40 min"
  completed: "2026-06-03T15:00:00Z"
  tasks: 2
  files: 2
---

# Phase 4 Plan 2: Phase Control Surface (PhaseButton + ControlTab) Summary

JWT-style in-flight lock with Broadcast-confirmed re-enable: five phase-control buttons wired to the Phase 3 transition/reveal routes, enabled only when valid for current phase, locked on tap, re-enabled only when the Supabase Broadcast confirms the new phase.

## What Was Built

### Task 1: PhaseButton component
`src/components/host/PhaseButton.tsx` — single phase-action button with three states:
- **Enabled:** `bg-gold/20 text-gold-bright border-gold/40 hover:bg-gold/30`, `cursor-pointer`
- **Disabled:** same base style + `opacity-40 cursor-not-allowed pointer-events-none`
- **In-flight:** disabled + `Loader2` spinner (`animate-spin`) + `"${label}..."` suffix

Props: `label`, `enabled`, `inFlight`, `anyInFlight`, `onClick`. Sizing `min-h-[56px] w-full` per UI-SPEC §5.3. Accessibility: `aria-disabled={!enabled}` (screen reader phase reason), `aria-busy={inFlight}`. Animation: `motion/react` `whileTap={{ scale: 0.96 }}` press-confirm (200ms). `touchAction: "manipulation"` via `style` prop for mobile tap delay elimination.

### Task 2: ControlTab — live phase-control surface
`src/components/host/ControlTab.tsx` — replaces Plan 01 placeholder with full implementation:

**Section A — Status strip:**
- Phase badge using semantic colors: lobby=sage/20, question=gold/20, locked=blush/20, revealed=gold-bright/20, ended=champagne/10
- Participant count as `text-3xl font-bold text-gold-bright` + "jucatori conectati" label
- Animated A/B distribution bar (`motion.div` width, 0.4s easeOut); "Niciun raspuns inca." when null

**Section B — Phase control buttons:**
- `PHASE_ACTIONS` map: `lobby:{start}`, `question:{lock}`, `locked:{reveal}`, `revealed:{next,end}`, `ended:{}`
- 2-column grid (`grid-cols-1 sm:grid-cols-2`) of PhaseButton components
- `isActionEnabled(action, phase)` helper gates each button

**Reveal A/B picker:**
- Shown only when `phase === "locked"` — host picks the correct option live
- A/B toggle pills with `aria-pressed`, `bg-gold text-ink` when selected
- Passed as `choice` to `POST /api/host/reveal`

**In-flight pattern (SC4, RQ-6):**
- `handleAction(action)` guards double-tap: `if (inFlight !== null) return`
- Sets `inFlight = action` immediately on click (all buttons disabled)
- Success path: does NOT call `setInFlight(null)` — only the `useEffect([state?.phase])` does
- Error paths: 409 / 4xx / 5xx call `setInFlight(null)` immediately + Romanian toast
- 5s fallback `setTimeout(() => setInFlight(null), 5000)` in separate `useEffect([inFlight])`

**Next question resolution:**
- Fetches `GET /api/host/questions?gameId=` (Plan 03 endpoint) on mount
- Sorts by `display_order`, finds current question index, returns `questions[idx+1].id`
- If endpoint returns 404 (Plan 03 not yet deployed): toast error, button stays enabled visually but action aborted

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Implementation Notes

**nextQuestionId resolution path (plan asked to document):**
The plan noted "if no nextQuestionId is resolvable, the next button may call transition with the current logic and the executor should document the resolution path." Resolution: ControlTab fetches `GET /api/host/questions?gameId=` on mount and re-fetches after each `next` action. The `resolveNextQuestionId()` function finds `currentQuestionId` in the ordered list and returns `questions[currentIdx+1].id`. If the endpoint returns 404 (Plan 03 not yet deployed), a toast fires and the action aborts without calling the route. This ensures the button is never silently broken.

**PHASE_ACTIONS.question does not include "end":**
The UI-SPEC §5.3 table listed "question / revealed" for "Incheie Jocul" but the `transition` route's `TRANSITIONS.end.expectedFrom = "revealed"`. The route is authoritative — Open Q1 is resolved as "end from revealed only". Force-end-from-any-state is the Emergency Panel's job in Plan 05.

## Human Verification Needed

**Type:** checkpoint:human-verify

**What was built:** The live Control tab: phase status strip (badge + participant count + A/B distribution bar) and five phase-control buttons wired to the Phase 3 transition/reveal routes with in-flight locking.

**How to verify:**
1. Ensure `.env.local` has `HOST_PASSWORD` set and the seed game exists with at least one question (add via Supabase Studio or wait for Plan 03). Run `npm run dev`, log into `/host`.
2. On the Control tab, confirm only "Porneste Jocul" is enabled in lobby; the rest are dimmed (opacity-40).
3. Tap "Porneste Jocul" — it should disable immediately (spinner + "..."), and ALL buttons stay disabled until the phase badge changes to "Intrebare", at which point "Blocheaza Raspunsurile" becomes enabled. Time from tap to re-enable should be ~1s (Broadcast).
4. Rapidly double-tap a valid button — the game must advance by exactly one step (no double-advance).
5. Open a second tab also on `/host`; trigger a phase change from tab A and confirm tab B's badge + button states update within ~2s.
6. Force a 409 (e.g. tap a button twice fast across two tabs) — expect the "Starea jocului s-a schimbat..." toast and buttons reflecting the real phase.
7. In locked phase, verify the A/B picker appears above the buttons; select B, tap "Dezvaluie Raspunsul" — the reveal should record B as correct.

## Known Stubs

None — all five phase-control buttons are fully wired to live routes. The "Urmatoarea Intrebare" button requires `GET /api/host/questions` (Plan 03) to resolve `nextQuestionId`; until Plan 03 deploys, tapping it shows a toast and aborts cleanly without calling the route.

## Threat Surface Scan

No new security-relevant surface beyond the plan's threat model:
- All calls go through `hostFetch` which attaches `x-host-password` header (T-04-04 mitigated)
- In-flight guard + server CAS prevents double-advance race (T-04-05 mitigated)
- 5s fallback timeout prevents permanent lock on Broadcast failure (T-04-06 mitigated)

## Self-Check: PASSED

Files confirmed present:
- `src/components/host/PhaseButton.tsx` — created
- `src/components/host/ControlTab.tsx` — replaced placeholder

Commits verified:
- `e128735` — feat(04-02): PhaseButton component
- `d8ebeee` — feat(04-02): ControlTab live phase-control surface
