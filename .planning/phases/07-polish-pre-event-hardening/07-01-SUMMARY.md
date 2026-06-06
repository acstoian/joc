---
phase: 07-polish-pre-event-hardening
plan: "01"
subsystem: display-shell
tags: [css-utility, animation, motion, tv-display, reduced-motion]
dependency_graph:
  requires: []
  provides:
    - ".text-gradient-gold CSS utility (globals.css) — consumed by plans 02, 03"
    - "AnimatePresence mode=wait phase-transition shell (display/page.tsx) — foundation for all TV phase animations"
  affects:
    - "src/app/globals.css — new .text-gradient-gold utility"
    - "src/app/display/page.tsx — phase screen now wrapped in AnimatePresence"
tech_stack:
  added: []
  patterns:
    - "AnimatePresence mode=wait keyed on state.phase for exit/enter coordination"
    - "useReducedMotion() gate on animation duration (0 vs 0.35s)"
    - "Static CSS gradient via CSS variables — no JS animation on the gradient itself"
key_files:
  created: []
  modified:
    - src/app/globals.css
    - src/app/display/page.tsx
decisions:
  - "Used existing CSS variable tokens (var(--color-gold), var(--color-champagne)) for gradient — no hex literals, consistent with design system"
  - "key={state?.phase ?? 'loading'} chosen over index or static key — phase string changes are the exact AnimatePresence trigger (Pitfall 2)"
  - "Variants animate only opacity and y — width/height/top/left excluded to satisfy Performance Contract for 60fps 4x-CPU-throttle gate in plan 04"
  - "shouldReduce ? 0 : 0.35 pattern — reduced-motion users get instant phase swaps, not 350ms ones"
metrics:
  duration_minutes: 4
  completed_date: "2026-06-06T05:34:13Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 7 Plan 01: CSS Gradient Utility + TV AnimatePresence Shell Summary

**One-liner:** Static `.text-gradient-gold` CSS utility (CSS-variable gradient + reduced-motion override) and `AnimatePresence mode="wait"` slide+fade shell wrapping the TV display phase screen, keyed on `state.phase`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add .text-gradient-gold CSS utility + reduced-motion override | 62d81ad | src/app/globals.css |
| 2 | Wrap TV display phase screen in AnimatePresence mode=wait | 15a6c6a | src/app/display/page.tsx |

## What Was Built

### Task 1 — `.text-gradient-gold` CSS utility (globals.css)

Added a new CSS utility class after `.glass-gold` and before `.thin-divider`:

```css
.text-gradient-gold {
  background: linear-gradient(135deg, var(--color-gold), var(--color-champagne));
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}
```

Added a mandatory reduced-motion override inside the existing `@media (prefers-reduced-motion: reduce)` block:

```css
.text-gradient-gold {
  background: none;
  color: var(--color-gold);
}
```

The override prevents invisible text (`color: transparent` with no gradient) on devices with reduced motion enabled (Pitfall 7 from RESEARCH.md).

### Task 2 — `AnimatePresence mode="wait"` shell (display/page.tsx)

Added `AnimatePresence`, `motion`, and `useReducedMotion` imports from `"motion/react"`. Added `const shouldReduce = useReducedMotion()` after `useGameSync`. Replaced bare `{screen}` render with:

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={state?.phase ?? "loading"}
    variants={{ hidden: { opacity: 0, y: "2vh" }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0, y: "-1vh" } }}
    initial="hidden" animate="visible" exit="exit"
    transition={{ duration: shouldReduce ? 0 : 0.35, ease: "easeInOut" }}
    className="w-full h-full"
  >
    {screen}
  </motion.div>
</AnimatePresence>
```

All prior shell elements preserved: `containerRef`, `isFullscreen`, `HOST_SENTINEL_PLAYER_ID`, fullscreen change listener, `DisplayStatusDot`, and the fullscreen button.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None in the files modified by this plan. (The pre-existing `.glass` comment "placeholder; heavy animation deferred to Phase 7" in globals.css is an unrelated comment in an untouched rule — the Phase 7 animation work is this plan and the plans that follow.)

## Threat Flags

None. This plan adds no new API routes, no new data access, no new user input, and no auth changes. Confirmed: no new `fetch`/`createClient` calls in display/page.tsx; only `useGameSync` (pre-existing hook) is called. No new trust boundaries introduced.

## Self-Check: PASSED

- FOUND: src/app/globals.css
- FOUND: src/app/display/page.tsx
- FOUND: .planning/phases/07-polish-pre-event-hardening/07-01-SUMMARY.md
- FOUND commit: 62d81ad (feat(07-01): add .text-gradient-gold CSS utility + reduced-motion override)
- FOUND commit: 15a6c6a (feat(07-01): wrap TV display phase screen in AnimatePresence mode=wait)
