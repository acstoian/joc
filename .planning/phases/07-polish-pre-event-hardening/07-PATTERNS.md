# Phase 7: Polish & Pre-Event Hardening - Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 8 modified files (no new files created)
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/globals.css` | config/style | transform | `.glass-gold` block in same file (lines 63-68) | exact |
| `src/app/display/page.tsx` | component (shell) | event-driven | self — surgical wrap of `{screen}` on line 110 | exact |
| `src/components/display/LobbyDisplay.tsx` | component | event-driven | `src/components/display/WinnerDisplay.tsx` (same surface, same heading) | role-match |
| `src/components/display/RevealDisplay.tsx` | component | event-driven | `src/components/guest/LeaderboardPanel.tsx` (row structure) | role-match |
| `src/components/display/WinnerDisplay.tsx` | component | event-driven | `src/components/guest/WinnerScreen.tsx` | exact |
| `src/components/guest/QuestionScreen.tsx` | component | request-response | self — convert `<button>` to `motion.button` | exact |
| `src/components/guest/NameGate.tsx` | component | request-response | `src/components/display/LobbyDisplay.tsx` (same heading swap) | role-match |
| `src/components/guest/RevealScreen.tsx` | component | event-driven | `src/components/guest/WinnerScreen.tsx` | exact |

---

## Pattern Assignments

### `src/app/globals.css` (config/style — CSS utility addition)

**Analog:** `src/app/globals.css` lines 63-68 (`.glass-gold` block) and lines 90-94 (`prefers-reduced-motion` block)

**Existing utility structure to copy** (lines 63-68):
```css
.glass-gold {
  background-color: oklch(from var(--color-gold-muted) l c h / 0.15);
  backdrop-filter: blur(12px) saturate(1.4);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
  border: 1px solid oklch(from var(--color-gold) l c h / 0.3);
}
```

**Existing `prefers-reduced-motion` block to extend** (lines 90-94):
```css
@media (prefers-reduced-motion: reduce) {
  @keyframes slide-up  { from { opacity: 1; transform: none; } to { opacity: 1; transform: none; } }
  @keyframes fade-scale { from { opacity: 1; transform: none; } to { opacity: 1; transform: none; } }
  .animate-pulse { animation: none; }
}
```

**New code — insert after `.glass-gold` block (after line 68), before `.thin-divider`:**
```css
/* ── Gold gradient text accent — hero headings only (D-06/D-07) ── */
.text-gradient-gold {
  background: linear-gradient(135deg, var(--color-gold), var(--color-champagne));
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}
```

**New code — add inside the existing `@media (prefers-reduced-motion: reduce)` block:**
```css
  /* Prevent invisible text when gradient is stripped (Pitfall 7) */
  .text-gradient-gold {
    background: none;
    color: var(--color-gold);
  }
```

**Critical:** The `prefers-reduced-motion` override is mandatory. Without it, `color: transparent` makes the text invisible on devices with reduced motion enabled.

---

### `src/app/display/page.tsx` (component shell — AnimatePresence wrap)

**Analog:** `src/app/display/page.tsx` itself — surgical replacement of line 110 `{screen}`

**Current imports** (lines 19-28) — add motion imports:
```tsx
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
```

**Current screen render** (line 110):
```tsx
      {/* Phase screen */}
      {screen}
```

**Replacement:**
```tsx
      {/* Phase screen — AnimatePresence slide+fade between phases (D-02) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={state?.phase ?? "loading"}
          variants={{
            hidden:  { opacity: 0, y: "2vh" },
            visible: { opacity: 1, y: 0 },
            exit:    { opacity: 0, y: "-1vh" },
          }}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: shouldReduce ? 0 : 0.35, ease: "easeInOut" }}
          className="w-full h-full"
        >
          {screen}
        </motion.div>
      </AnimatePresence>
```

**Add `useReducedMotion` call** in component body directly after the `useGameSync` call (line 42):
```tsx
  const shouldReduce = useReducedMotion();
```

**Preservation checklist:** `containerRef` (line 32), `isFullscreen` state (line 35), `HOST_SENTINEL_PLAYER_ID` (line 40), fullscreen change listener (lines 46-52), `DisplayStatusDot` (line 93), and fullscreen button (lines 98-107) are ALL untouched. Only `{screen}` on line 110 is replaced.

**Key rule:** `key={state?.phase ?? "loading"}` — must be the phase string. AnimatePresence tracks exit/enter by key changes; if key is static, no animation fires (Pitfall 2 in RESEARCH.md).

---

### `src/components/display/LobbyDisplay.tsx` (component — class swap only)

**Analog:** `src/components/display/LobbyDisplay.tsx` line 39

**Current `<h1>`** (line 39):
```tsx
      <h1 className="text-[6vw] font-bold font-heading text-champagne text-center leading-tight">
        Joc — Cristina &amp; Andrei
      </h1>
```

**Modified `<h1>` — swap `text-champagne` for `text-gradient-gold`:**
```tsx
      <h1 className="text-[6vw] font-bold font-heading text-gradient-gold text-center leading-tight">
        Joc — Cristina &amp; Andrei
      </h1>
```

No other changes. The pulse mechanism (lines 30-34), participant count block (lines 47-63), and waiting subtitle (line 66) are untouched. No new imports needed.

---

### `src/components/display/RevealDisplay.tsx` (component — gradient + staggered leaderboard)

**Analog 1:** `src/components/display/RevealDisplay.tsx` `OptionWithBar` lines 72-80 — for the correct-label gradient target.
**Analog 2:** `src/components/guest/LeaderboardPanel.tsx` lines 17-69 — for row structure and color helpers to copy inline.

**Change 1 — correct option label gradient** in `OptionWithBar` (lines 74-79). Current:
```tsx
        <span
          className={cn(
            "text-[2vw] font-normal font-body text-center",
            isCorrect ? "text-gold-bright" : "text-champagne"
          )}
        >
```

Replace `"text-gold-bright"` with `"text-gradient-gold"`:
```tsx
        <span
          className={cn(
            "text-[2vw] font-normal font-body text-center",
            isCorrect ? "text-gradient-gold" : "text-champagne"
          )}
        >
```

**Change 2 — staggered leaderboard** replaces the `LeaderboardPanel` block (lines 165-173). Current:
```tsx
      <div className="w-full max-w-[55vw] mx-auto">
        <div className="thin-divider" />
        <div className="transform scale-150 origin-top">
          <LeaderboardPanel leaderboard={state.leaderboard.slice(0, 5)} />
        </div>
      </div>
```

**Add new imports at top of file:**
```tsx
import { motion, useReducedMotion } from "motion/react";
import { Separator } from "@/components/ui/separator";
```

**Remove `LeaderboardPanel` import** (no longer used after replacement).

**Add helpers and variants** at module level (after existing `OptionWithBarProps` interface):
```tsx
// ── Local rank helpers (copied from LeaderboardPanel — do not import from there) ──
function getRankClasses(rank: number): string {
  if (rank === 1) return "text-gold-bright font-bold";
  if (rank <= 3) return "text-champagne";
  return "text-champagne-dim";
}
function getScoreClasses(rank: number): string {
  if (rank === 1) return "text-gold-bright font-bold";
  return "text-gold";
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};
```

**Add `useReducedMotion` call** at top of `RevealDisplay` component body:
```tsx
  const shouldReduce = useReducedMotion();
```

**Replacement leaderboard block** (preserves `scale-150 origin-top` wrapper):
```tsx
      <div className="w-full max-w-[55vw] mx-auto">
        <div className="thin-divider" />
        <div className="transform scale-150 origin-top">
          {state.leaderboard.length > 0 && (
            <div className="flex flex-col gap-0 w-full max-w-md mx-auto mt-6">
              <h3 className="text-base font-bold font-heading text-champagne text-center mb-4">
                Clasament
              </h3>
              {shouldReduce ? (
                <ol role="list" className="flex flex-col">
                  {state.leaderboard.slice(0, 5).map((entry, index) => {
                    const rank = index + 1;
                    const isLast = index === Math.min(5, state.leaderboard.length) - 1;
                    return (
                      <li key={`${entry.name}-${rank}`}>
                        <div className="flex items-center gap-3 py-3 px-2">
                          <span className="text-sm text-champagne-dim w-6 text-right shrink-0">#{rank}</span>
                          <span className={`flex-1 text-base truncate ${getRankClasses(rank)}`}>{entry.name}</span>
                          <span className={`text-sm ${getScoreClasses(rank)} shrink-0`}>{entry.score} pt</span>
                        </div>
                        {!isLast && <Separator className="bg-champagne/10" />}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <motion.ol
                  role="list"
                  className="flex flex-col"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {state.leaderboard.slice(0, 5).map((entry, index) => {
                    const rank = index + 1;
                    const isLast = index === Math.min(5, state.leaderboard.length) - 1;
                    return (
                      <motion.li key={`${entry.name}-${rank}`} variants={rowVariants}>
                        <div className="flex items-center gap-3 py-3 px-2">
                          <span className="text-sm text-champagne-dim w-6 text-right shrink-0">#{rank}</span>
                          <span className={`flex-1 text-base truncate ${getRankClasses(rank)}`}>{entry.name}</span>
                          <span className={`text-sm ${getScoreClasses(rank)} shrink-0`}>{entry.score} pt</span>
                        </div>
                        {!isLast && <Separator className="bg-champagne/10" />}
                      </motion.li>
                    );
                  })}
                </motion.ol>
              )}
            </div>
          )}
        </div>
      </div>
```

---

### `src/components/display/WinnerDisplay.tsx` (component — gradient + stagger + confetti)

**Analog:** `src/components/guest/WinnerScreen.tsx` — all three patterns (confetti lines 31-49, winner name line 79, leaderboard lines 107-112).

**Current imports** (lines 12-14):
```tsx
import { Trophy } from "lucide-react";
import type { GameStateSnapshot } from "@/hooks/useGameSync";
import { LeaderboardPanel } from "@/components/guest/LeaderboardPanel";
```

**Replace with:**
```tsx
import { useEffect, useRef } from "react";
import { Trophy } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Separator } from "@/components/ui/separator";
import type { GameStateSnapshot } from "@/hooks/useGameSync";
// LeaderboardPanel removed — replaced with inline stagger
```

**Add confetti + reducedMotion in component body** (copy structure from `WinnerScreen.tsx` lines 31-49, TV params per D-09):
```tsx
  const confettiFired = useRef(false);
  const shouldReduce = useReducedMotion();

  // TV winner confetti — fires once on mount (D-09). Overrides Phase 6 D-09 ("guest-side only").
  useEffect(() => {
    if (shouldReduce) return;
    if (confettiFired.current) return;
    confettiFired.current = true;
    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { x: 0.5, y: 0.3 },
        colors: ["#f0c060", "#f5e6c8", "#d4a843", "#e8a0a0"],
      });
    });
  }, []);
```

**Change 1 — winner name gradient** (line 40 current: `text-gold-bright`):
```tsx
          <p className="text-[6vw] font-bold font-heading text-gradient-gold text-center">
```

**Change 2 — replace LeaderboardPanel** (lines 55-57 current):
```tsx
      {/* Full leaderboard with scale wrapper — staggered (D-03) */}
      <div className="w-full max-w-[55vw] mx-auto transform scale-150 origin-top">
```
Use the same `containerVariants`/`rowVariants`/`getRankClasses`/`getScoreClasses` helpers (module-level, same as RevealDisplay pattern above) and `motion.ol`/`motion.li` structure — without `.slice(0, 5)` (full leaderboard for winner screen).

**Update JSDoc** — remove line 9: `* No canvas-confetti — confetti is guest-side only (Phase 5).` Replace with note that D-09 adds TV confetti.

---

### `src/components/guest/QuestionScreen.tsx` (component — `motion.button` conversion)

**Analog:** `src/components/guest/QuestionScreen.tsx` lines 136-155 and 158-177 (the two `<button>` elements).

**Current Button A open tag** (line 136):
```tsx
          <button
            type="button"
            className={getButtonClass("A", localAnswer, state.phase)}
            onClick={() => handleTap("A")}
            aria-pressed={localAnswer === "A"}
            aria-disabled={isLocked && localAnswer !== "A"}
            aria-label={`Opțiunea A: ${q?.optionA ?? "A"}`}
          >
```

**Add import:**
```tsx
import { motion, useReducedMotion } from "motion/react";
```

**Add in component body** (after existing `useState` calls):
```tsx
  const shouldReduce = useReducedMotion();
```

**Replace Button A open tag:**
```tsx
          <motion.button
            type="button"
            className={getButtonClass("A", localAnswer, state.phase)}
            onClick={() => handleTap("A")}
            whileTap={shouldReduce ? undefined : { scale: 0.96 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            aria-pressed={localAnswer === "A"}
            aria-disabled={isLocked && localAnswer !== "A"}
            aria-label={`Opțiunea A: ${q?.optionA ?? "A"}`}
          >
```

**Replace Button B open tag** (line 158, same pattern with "B"):
```tsx
          <motion.button
            type="button"
            className={getButtonClass("B", localAnswer, state.phase)}
            onClick={() => handleTap("B")}
            whileTap={shouldReduce ? undefined : { scale: 0.96 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            aria-pressed={localAnswer === "B"}
            aria-disabled={isLocked && localAnswer !== "B"}
            aria-label={`Opțiunea B: ${q?.optionB ?? "B"}`}
          >
```

**Close tags:** Change both `</button>` to `</motion.button>`.

**Preservation checklist:**
- `getButtonClass()` (lines 40-72) — unchanged. Its return string already includes `[touch-action:manipulation]` as a Tailwind class; it carries over to `motion.button` via the same `className` prop automatically.
- All aria attributes — preserved verbatim.
- Inner `<span>` children — unchanged.
- `handleTap` async function — unchanged.

---

### `src/components/guest/NameGate.tsx` (component — class swap only)

**Analog:** `src/components/guest/NameGate.tsx` line 78

**Current `<h1>`** (line 78):
```tsx
          <h1 className="font-heading text-2xl font-bold text-champagne leading-tight">
            Joc — Cristina &amp; Andrei
          </h1>
```

**Modified `<h1>` — swap `text-champagne` for `text-gradient-gold`:**
```tsx
          <h1 className="font-heading text-2xl font-bold text-gradient-gold leading-tight">
            Joc — Cristina &amp; Andrei
          </h1>
```

No other changes. Form, input, error state, and submit button are untouched. No new imports needed.

---

### `src/components/guest/RevealScreen.tsx` (component — confetti addition)

**Analog:** `src/components/guest/WinnerScreen.tsx` lines 17-49 — verbatim confetti pattern with smaller particle params (D-08).

**Current imports** (lines 21-25):
```tsx
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";
import type { GameStateSnapshot, SyncStatus } from "@/hooks/useGameSync";
import { SyncStatusBadge } from "@/components/guest/SyncStatusBadge";
import { LeaderboardPanel } from "@/components/guest/LeaderboardPanel";
```

**Add:**
```tsx
import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
```

**Add in component body** (after `RevealScreen` function signature, before existing distribution variables):
```tsx
  const confettiFired = useRef(false);
  const shouldReduce = useReducedMotion();

  // Correct-answer mini confetti burst — fires once on mount (D-08).
  // CRITICAL: GameStateSnapshot has NO playerAnsweredCorrectly field.
  // Derive correctness from myAnswer + correctOption (verified RESEARCH.md §CRITICAL FINDING).
  useEffect(() => {
    const answeredCorrectly =
      state.myAnswer !== null && state.myAnswer === state.correctOption;
    if (!answeredCorrectly) return;
    if (shouldReduce) return;
    if (confettiFired.current) return;
    confettiFired.current = true;
    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({
        particleCount: 60,
        spread: 50,
        origin: { y: 0.6 },
        colors: ["#f0c060", "#f5e6c8", "#d4a843"],
      });
    });
  }, []); // empty deps — fires once on mount; state captured via closure
```

No other changes. The existing `getRevealClass` function, `CheckCircle2`/`XCircle` indicators, distribution bar, and `LeaderboardPanel` are all untouched.

---

## Shared Patterns

### Pattern A: Canvas-Confetti (dynamic import + ref-guard)
**Source:** `src/components/guest/WinnerScreen.tsx` lines 17-49
**Apply to:** `src/components/guest/RevealScreen.tsx` (new addition), `src/components/display/WinnerDisplay.tsx` (new addition)

Four invariants required in every confetti `useEffect`:
1. `const confettiFired = useRef(false)` guard checked before firing
2. `import("canvas-confetti").then(({ default: confetti }) => {...})` — always dynamic, never static top-level import
3. Empty `[]` deps — fires exactly once on mount
4. `if (shouldReduce) return` — skip entirely when `useReducedMotion()` is true

### Pattern B: `useReducedMotion()` gate
**Source:** RESEARCH.md §Pitfall 6
**Apply to:** `src/app/display/page.tsx`, `src/components/display/RevealDisplay.tsx`, `src/components/display/WinnerDisplay.tsx`, `src/components/guest/QuestionScreen.tsx`, `src/components/guest/RevealScreen.tsx`

```tsx
import { useReducedMotion } from "motion/react";
const shouldReduce = useReducedMotion();
// whileTap: whileTap={shouldReduce ? undefined : { scale: 0.96 }}
// confetti: if (shouldReduce) return;
// AnimatePresence duration: duration: shouldReduce ? 0 : 0.35
```

### Pattern C: `.text-gradient-gold` application (class swap)
**Source:** CONTEXT.md D-06/D-07, globals.css (new utility)
**Apply to:** 4 elements only — `LobbyDisplay.tsx` `<h1>` line 39, `WinnerDisplay.tsx` winner `<p>` line 40, `NameGate.tsx` `<h1>` line 78, `RevealDisplay.tsx` correct option `<span>` lines 74-79
**Method:** Replace `text-champagne` or `text-gold-bright` with `text-gradient-gold`

### Pattern D: Staggered leaderboard (inline `motion.ol`/`motion.li`)
**Source:** `src/components/guest/LeaderboardPanel.tsx` lines 17-69 (row structure + color helpers)
**Apply to:** `src/components/display/RevealDisplay.tsx`, `src/components/display/WinnerDisplay.tsx`

Row color helpers to copy verbatim from `LeaderboardPanel.tsx` lines 21-30:
```tsx
function getRankClasses(rank: number): string {
  if (rank === 1) return "text-gold-bright font-bold";
  if (rank <= 3) return "text-champagne";
  return "text-champagne-dim";
}
function getScoreClasses(rank: number): string {
  if (rank === 1) return "text-gold-bright font-bold";
  return "text-gold";
}
```

Stagger variant constants (module-level, same in both files):
```tsx
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};
```

---

## No Analog Found

None — all 8 files have direct in-codebase analogs.

---

## Critical Implementation Notes

1. **`playerAnsweredCorrectly` does not exist** on `GameStateSnapshot`. TypeScript strict mode will error. Use `state.myAnswer !== null && state.myAnswer === state.correctOption`.

2. **`LeaderboardPanel` imports must be removed** from `RevealDisplay.tsx` and `WinnerDisplay.tsx` after replacing with inline stagger — otherwise TypeScript/ESLint flags unused imports.

3. **`scale-150 origin-top` wrapper preserved** in both display leaderboard replacements — required for TV readability per Phase 6 Finding 5.

4. **Do NOT modify** `src/components/guest/WinnerScreen.tsx` or `src/components/guest/LeaderboardPanel.tsx`.

5. **`"use client"` directive** — all target files already have it; do not add a second one.

---

## Metadata

**Analog search scope:** `src/app/`, `src/components/display/`, `src/components/guest/`
**Files read:** `globals.css`, `display/page.tsx`, `display/LobbyDisplay.tsx`, `display/RevealDisplay.tsx`, `display/WinnerDisplay.tsx`, `guest/QuestionScreen.tsx`, `guest/NameGate.tsx`, `guest/RevealScreen.tsx`, `guest/WinnerScreen.tsx`, `guest/LeaderboardPanel.tsx`
**Pattern extraction date:** 2026-06-06
