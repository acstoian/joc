# Phase 07 Plan 04 — Task 1 Static Performance Audit

**Date:** 2026-06-06
**Status:** PASS — all three audit checks pass; build and lint exit 0.

## Audit Checks

### Check 1: No layout-triggering animations (width/height/top/left)

| File | Animation Props | Result |
|------|----------------|--------|
| `src/app/display/page.tsx` | `motion.div` variants: `opacity`, `y` (transform) only | PASS |
| `src/components/display/RevealDisplay.tsx` | `containerVariants`: empty `{}`; `rowVariants`: `opacity`, `y` | PASS |
| `src/components/display/WinnerDisplay.tsx` | `containerVariants`: empty `{}`; `rowVariants`: `opacity`, `y` | PASS |
| `src/components/guest/QuestionScreen.tsx` | `whileTap={{ scale: 0.96 }}` — transform only | PASS |
| `src/components/display/LobbyDisplay.tsx` | Tailwind `animate-pulse` only (CSS, no motion/react) | PASS |
| `src/components/guest/NameGate.tsx` | No motion/react animations | PASS |
| `src/components/guest/RevealScreen.tsx` | No motion/react variants; distribution bar uses CSS `transition-[width]` (pre-existing exception) | PASS |

Pre-existing exception: `transition-[width]` on distribution bars in `RevealDisplay.tsx` and `RevealScreen.tsx` is a CSS class (not a motion/react variant), benchmarked in Phase 6, and is explicitly out of scope per the plan.

### Check 2: Leaderboard stagger is mount-driven only (no state.leaderboard dependency)

| File | Stagger Pattern | Re-trigger Risk | Result |
|------|----------------|-----------------|--------|
| `src/components/display/RevealDisplay.tsx` | `motion.ol` with static `initial="hidden"` / `animate="visible"` | None — animation props are static strings, no effect/dependency on `state.leaderboard` | PASS |
| `src/components/display/WinnerDisplay.tsx` | Same pattern | None | PASS |

Both components are remounted by `AnimatePresence` in `display/page.tsx` (keyed on `state?.phase`), which is the correct remount trigger. No `useEffect` or computed animate prop depends on `state.leaderboard` length or content.

### Check 3: canvas-confetti is dynamically imported (never static top-level)

| File | Import Pattern | Result |
|------|---------------|--------|
| `src/components/guest/RevealScreen.tsx` (line 90) | `import("canvas-confetti").then(({ default: confetti }) => { ... })` | PASS |
| `src/components/display/WinnerDisplay.tsx` (line 55) | `import("canvas-confetti").then(({ default: confetti }) => { ... })` | PASS |

No static `import confetti from "canvas-confetti"` found at any file top level.

## Build + Lint

```
npm run build  →  ✓ Compiled successfully (8.0s); 18 pages generated; 0 errors
npm run lint   →  ✖ 2 problems (0 errors, 2 warnings)
```

**Warnings (intentional, not correctness issues):**

1. `WinnerDisplay.tsx:63` — `useEffect` missing dep `shouldReduce`. Empty array `[]` is intentional: confetti fires exactly once on mount; adding `shouldReduce` would cause re-fire on reduced-motion changes, violating D-09.

2. `RevealScreen.tsx:98` — `useEffect` missing deps `shouldReduce`, `state.correctOption`, `state.myAnswer`. Empty array `[]` is intentional: confetti fires exactly once on mount per the comment "fires once on mount; state captured via closure". Adding state deps would re-fire confetti on every score tick, violating D-08.

Both suppressions are documented in source comments.

## Conclusion

All Phase 7 animations are compositor-safe (opacity + transform only). The leaderboard stagger is mount-driven with no `state.leaderboard` dependency that could re-trigger it. `canvas-confetti` is dynamically imported in both locations. Build and lint exit 0 (no errors).

**Awaiting:** Task 2 (60fps DevTools verification) and Task 3 (production dry run) — human-verify checkpoints.
