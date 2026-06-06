# Phase 7: Polish & Pre-Event Hardening - Research

**Researched:** 2026-06-05
**Domain:** motion/react animations, canvas-confetti, CSS gradient utilities, production dry-run verification
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: AnimatePresence scope** — TV display only. Guest app stays CSS-only conditional re-renders.
`motion/react` AnimatePresence introduced only to `src/app/display/page.tsx` and its screen components.

**D-02: TV phase transition style** — Slide + fade. New screen slides up and fades in; old screen fades
out. Wrap screen components in `motion.div` with `variants` reproducing the existing `slide-up` / `fade-scale`
CSS keyframes. Use `AnimatePresence mode="wait"` so the old screen exits before the new one enters.

**D-03: Leaderboard stagger** — Stagger in on both `RevealDisplay` (top-5) and `WinnerDisplay` (full
leaderboard). Each row delays `0.08s × index`. Parent uses `staggerChildren: 0.08`. `delayChildren: 0.1`.
Per-row: `duration: 0.25, ease: "easeOut"`, `{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }`.

**D-04: Guest motion** — Tap feedback only. `whileTap={{ scale: 0.96 }}` on `motion.button` in
`QuestionScreen.tsx`. No AnimatePresence on guest app.

**D-05: Gradient placement** — Hero text and accents only. No animated background gradient.

**D-06: Gradient targets** — 4 elements only:
1. TV `LobbyDisplay` — game title `<h1>`
2. TV `WinnerDisplay` — #1 hero player name `<p>`
3. Guest `NameGate` — Playfair Display `<h1>`
4. TV `RevealDisplay` — correct answer option label (at reveal time)

**D-07: Gradient style** — Static CSS gradient, no keyframe. `.text-gradient-gold` utility in globals.css.
`background: linear-gradient(135deg, var(--color-gold), var(--color-champagne)); background-clip: text;
-webkit-background-clip: text; color: transparent;`

**D-08: Guest correct-answer confetti** — `canvas-confetti` burst on `RevealScreen` when player answered
correctly. `{ particleCount: 60, spread: 50, origin: { y: 0.6 }, colors: ["#f0c060", "#f5e6c8", "#d4a843"] }`.
Ref-guard + dynamic import pattern. Fires once per correct reveal.

**D-09: TV winner confetti** — `WinnerDisplay` gets `canvas-confetti` on mount when `ended` phase is shown.
`{ particleCount: 150, spread: 100, origin: { x: 0.5, y: 0.3 }, colors: ["#f0c060", "#f5e6c8", "#d4a843", "#e8a0a0"] }`.
Same dynamic-import + ref-guard pattern. This overrides Phase 6 CONTEXT.md D-09 ("confetti is guest-side only").

### Claude's Discretion

None — discussion stayed within phase scope.

### Deferred Ideas (OUT OF SCOPE)

None declared.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RT-07 | Soft-luxury wedding aesthetic — glassmorphism accents, animated gradients, subtle confetti, smooth transitions | CSS `.text-gradient-gold` utility + AnimatePresence TV transitions + canvas-confetti pattern documented below. All dependencies already installed. |
| RT-08 | Pre-event production dry run validates concurrency, reconnect, and host flow on a real device | Dry-run protocol and checklist documented in Environment Availability and Common Pitfalls sections. |
</phase_requirements>

---

## Summary

Phase 7 is a surgical animation and polish layer added on top of six completed phases of functional code.
No new packages are installed, no schema changes, no new API routes. Every dependency (`motion` 12.40.0,
`canvas-confetti` 1.9.4) is already present in `package.json`. The work is eight precise file modifications
guided by detailed specs in 07-CONTEXT.md and 07-UI-SPEC.md.

The primary technical risk is a field-name discrepancy: `07-CONTEXT.md` references
`state.playerAnsweredCorrectly` for the confetti trigger in `RevealScreen`, but this field does not exist in
`GameStateSnapshot`. The actual shape uses `state.myAnswer` and `state.correctOption`. The correct-answer
condition must be derived as `state.myAnswer !== null && state.myAnswer === state.correctOption`. The
planner must use this derivation — not the non-existent field name.

The dry-run requirement (RT-08) is a human gate, not automated code. It requires coordination: production
Vercel deployment live, Supabase Pro plan active, 5+ real devices available. The planner should create a
dedicated dry-run task with an explicit checklist rather than treating it as a code task.

**Primary recommendation:** Implement animations in file-modification order (CSS utility first, then
AnimatePresence shell, then display component stagger, then guest tap feedback, then confetti), with the
dry-run checklist as the final gating task.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Phase screen transitions (TV) | Frontend (client component) | — | AnimatePresence wraps JSX output in `display/page.tsx`; no server involvement |
| Staggered leaderboard rows (TV) | Frontend (client component) | — | Inline motion.ul/motion.li in display components; data already in `state.leaderboard` prop |
| A/B tap feedback (guest) | Frontend (client component) | — | `whileTap` is a gesture event; runs in browser only |
| Correct-answer confetti (guest) | Frontend (client component) | — | Imperative canvas-confetti call in `useEffect`; no server involvement |
| Winner confetti (TV) | Frontend (client component) | — | Same dynamic-import pattern; mounts on `ended` phase |
| Gold gradient text | Frontend (CSS utility) | — | Static CSS applied at render; no state or server involvement |
| Production dry run | Human operator | Vercel/Supabase Pro | Manual multi-device test; cannot be automated |

---

## Standard Stack

### Core (all already installed — NO new packages)

| Library | Installed Version | Purpose | Source |
|---------|-------------------|---------|--------|
| `motion` | 12.40.0 | AnimatePresence, motion.div/button, useReducedMotion | [VERIFIED: package.json + npm view] |
| `canvas-confetti` | 1.9.4 | One-shot confetti burst on correct answers and winner | [VERIFIED: package.json + npm view] |
| `@types/canvas-confetti` | 1.9.0 | TypeScript types for canvas-confetti | [VERIFIED: package.json] |

**No installation command needed.** All dependencies are present.

### Key API Facts Verified Against Installed Code

**`motion/react` exports confirmed present** (`AnimatePresence`, `motion`, `m`, `useReducedMotion`) —
verified by loading `node_modules/motion/dist/cjs/react.js` in the project's Node.js environment.
[VERIFIED: codebase]

The `motion/react` package re-exports from `framer-motion` (the internal bundle). Import path:
`import { AnimatePresence, motion, useReducedMotion } from "motion/react"` — this is correct and already
used in the project (CLAUDE.md).

**`canvas-confetti` dynamic import pattern** — already demonstrated verbatim in
`src/components/guest/WinnerScreen.tsx`. The ref-guard and `import("canvas-confetti").then(({ default: confetti }) => {...})` 
pattern is battle-tested in this codebase. [VERIFIED: codebase]

---

## Package Legitimacy Audit

No new packages are introduced in Phase 7. Both animation libraries were audited in prior phases.

| Package | Registry | Notes | slopcheck | Disposition |
|---------|----------|-------|-----------|-------------|
| `motion` | npm | v12.40.0 — installed, already in use | Not required — prior phase audit | Approved |
| `canvas-confetti` | npm | v1.9.4 — installed, already in use (WinnerScreen.tsx) | Not required — prior phase audit | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Host action (lock/reveal/end)
         │
         ▼
Supabase Broadcast → useGameSync (display/page.tsx)
         │
         ▼
   state.phase change
         │
         ▼
┌─────────────────────────────────────┐
│        AnimatePresence mode="wait"  │
│  key={state.phase}                  │
│  ┌──────────────────────────────┐   │
│  │ motion.div (slide+fade)      │   │
│  │   {screen}                   │   │
│  │   ┌──────────────────────┐   │   │
│  │   │ RevealDisplay /      │   │   │
│  │   │ WinnerDisplay        │   │   │
│  │   │  └─ motion.ul        │   │   │
│  │   │      └─ motion.li×N  │   │   │
│  │   │         (stagger)    │   │   │
│  │   └──────────────────────┘   │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘

Guest phone
    │
    ▼
QuestionScreen → motion.button [whileTap scale 0.96]
    │
    ▼ (phase becomes "revealed")
RevealScreen
    └─ state.myAnswer === state.correctOption?
       └─ YES → canvas-confetti mini-burst (once, ref-guarded)

TV WinnerDisplay mount (phase "ended")
    └─ canvas-confetti full burst (once, ref-guarded)
```

### Recommended Project Structure

No new folders or files added. Modifications are in-place to existing files.

```
src/
├── app/
│   ├── globals.css          ← ADD .text-gradient-gold utility + prefers-reduced-motion override
│   └── display/
│       └── page.tsx         ← WRAP {screen} in AnimatePresence mode="wait"
├── components/
│   ├── display/
│   │   ├── LobbyDisplay.tsx    ← text-gradient-gold on <h1>
│   │   ├── RevealDisplay.tsx   ← text-gradient-gold on correct label + staggered leaderboard
│   │   └── WinnerDisplay.tsx   ← text-gradient-gold on winner name + stagger + TV confetti
│   └── guest/
│       ├── NameGate.tsx       ← text-gradient-gold on <h1>
│       ├── QuestionScreen.tsx ← motion.button with whileTap
│       └── RevealScreen.tsx   ← correct-answer confetti
```

### Pattern 1: AnimatePresence Phase Transition (TV display)

**What:** Wraps the `screen` variable (the phase-switch output) so exiting and entering screens animate.
**When to use:** Only in `display/page.tsx` for TV surface. Guest surface does NOT get AnimatePresence.

```tsx
// Source: 07-UI-SPEC.md §Animation Contract + verified against motion/react 12.40.0
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

// Inside DisplayPage:
const shouldReduce = useReducedMotion();

// Replace bare `{screen}` with:
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

**Key:** `key={state?.phase ?? "loading"}` — triggers unmount/remount on every phase change.
**`mode="wait"`** — old screen fully exits before new one enters. Without it, screens overlap.

### Pattern 2: Staggered Leaderboard (TV display)

**What:** Replaces the `<LeaderboardPanel>` call in display components with an inline staggered list.
**When to use:** `RevealDisplay.tsx` and `WinnerDisplay.tsx` only. `LeaderboardPanel` on guest surface is NOT modified.

```tsx
// Source: 07-UI-SPEC.md §Animation 2 + LeaderboardPanel.tsx row structure verified
import { motion, useReducedMotion } from "motion/react";
import { Separator } from "@/components/ui/separator";

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

// In JSX (replaces <LeaderboardPanel leaderboard={...} />):
const shouldReduce = useReducedMotion();

{leaderboard.length > 0 && (
  <div className="flex flex-col gap-0 w-full max-w-md mx-auto mt-6">
    <h3 className="text-base font-bold font-heading text-champagne text-center mb-4">
      Clasament
    </h3>
    {shouldReduce ? (
      <ol role="list" className="flex flex-col">
        {leaderboard.map((entry, index) => {
          const rank = index + 1;
          // ... plain <li> with same row structure as LeaderboardPanel
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
        {leaderboard.map((entry, index) => {
          const rank = index + 1;
          const isLast = index === leaderboard.length - 1;
          return (
            <motion.li key={`${entry.name}-${rank}`} variants={rowVariants}>
              <div className="flex items-center gap-3 py-3 px-2">
                <span className="text-sm text-champagne-dim w-6 text-right shrink-0">
                  #{rank}
                </span>
                <span className={`flex-1 text-base truncate ${getRankClasses(rank)}`}>
                  {entry.name}
                </span>
                <span className={`text-sm ${getScoreClasses(rank)} shrink-0`}>
                  {entry.score} pt
                </span>
              </div>
              {!isLast && <Separator className="bg-champagne/10" />}
            </motion.li>
          );
        })}
      </motion.ol>
    )}
  </div>
)}
```

**Row color helper functions** must be copied from `LeaderboardPanel.tsx` (rank 1 → `text-gold-bright font-bold`,
rank 2-3 → `text-champagne`, rank 4+ → `text-champagne-dim`). Score: rank 1 → `text-gold-bright font-bold`,
others → `text-gold`. These helpers are local to the display file — do NOT import from LeaderboardPanel.

**Stagger math:** 10 rows × 80ms = 800ms total stagger — "building to #1" drum-roll feel.
**Single-fire:** Stagger runs once on component mount. Does NOT re-run on `state.leaderboard` updates within a phase because the component itself does not unmount/remount for score ticks.

### Pattern 3: Guest A/B Tap Feedback

**What:** Convert `<button>` to `motion.button` with `whileTap={{ scale: 0.96 }}`.
**When to use:** Both A and B buttons in `QuestionScreen.tsx` only.

```tsx
// Source: 07-UI-SPEC.md §Animation 3
import { motion, useReducedMotion } from "motion/react";

const shouldReduce = useReducedMotion();

// Replace <button type="button" className={...} onClick={...}> with:
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

**Preservation checklist:** The `getButtonClass()` function is unchanged. The class string it returns
includes `[touch-action:manipulation]` — this MUST remain on `motion.button` (it is applied via Tailwind
class string, not a prop, so it survives the element type change unchanged). `focus-visible:ring-2` and
all aria attributes must remain.

### Pattern 4: Canvas-Confetti (dynamic import, ref-guard)

**What:** One-shot confetti burst on specific conditions. Already established in `WinnerScreen.tsx`.
**When to use:** Copy verbatim for `RevealScreen.tsx` (correct answer) and `WinnerDisplay.tsx` (TV winner).

```tsx
// Source: WinnerScreen.tsx (verified in codebase)
import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

// In component body:
const confettiFired = useRef(false);
const shouldReduce = useReducedMotion();

// For RevealScreen (correct-answer mini burst):
useEffect(() => {
  // CRITICAL: derive correctness from myAnswer + correctOption, NOT playerAnsweredCorrectly
  // (GameStateSnapshot does not have a playerAnsweredCorrectly field — verified in codebase)
  const answeredCorrectly = state.myAnswer !== null && state.myAnswer === state.correctOption;
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
}, []); // empty deps — fires once on mount; condition checked inside

// For WinnerDisplay (TV full burst):
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

### Pattern 5: `.text-gradient-gold` CSS Utility

**File:** `src/app/globals.css` — add after `.glass-gold` block.

```css
/* ── Gold gradient text accent — hero headings only (D-06/D-07) ── */
.text-gradient-gold {
  background: linear-gradient(135deg, var(--color-gold), var(--color-champagne));
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

/* Reduced motion: flat gold, no gradient */
@media (prefers-reduced-motion: reduce) {
  .text-gradient-gold {
    background: none;
    color: var(--color-gold);
  }
}
```

**Usage:** Replace `text-champagne` or `text-gold-bright` on the 4 specific elements in D-06. No other elements receive this class.

### Anti-Patterns to Avoid

- **Static-importing canvas-confetti:** `import confetti from "canvas-confetti"` at the top of a file adds it to the initial bundle. Always dynamic: `import("canvas-confetti").then(...)`.
- **`playerAnsweredCorrectly` field:** This field does NOT exist on `GameStateSnapshot`. Do not reference it. Derive correctness: `state.myAnswer !== null && state.myAnswer === state.correctOption`.
- **Adding AnimatePresence to guest surface:** The guest app explicitly has no AnimatePresence (D-01). Low-end Android reliability is the reason.
- **Animating layout properties:** All `motion/react` animations must only animate `opacity` and `transform`. Never animate `width`, `height`, `top`, `left` — these cause layout recalculation and drop frames on 4x CPU throttle.
- **Re-running stagger on leaderboard updates:** The stagger `initial/animate` should NOT have `state.leaderboard` in deps. The component re-mounts on phase change (via AnimatePresence key), not on score ticks within a phase.
- **Applying `.text-gradient-gold` to more than 4 elements:** D-06 is specific. Do not apply to nav, labels, or secondary headings.
- **Modifying `LeaderboardPanel.tsx`:** Guest surface keeps the original. TV stagger is inline in display components only.
- **Modifying `WinnerScreen.tsx`:** Already has canvas-confetti. Do not duplicate or change it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase transition orchestration | Custom CSS class toggling on phase change | `AnimatePresence mode="wait"` from motion/react | Handles enter/exit lifecycle, unmount timing, and concurrent render edge cases |
| Confetti particle system | Custom canvas drawing | `canvas-confetti` (already installed) | Physics simulation, spread, gravity — thousands of lines if rolled by hand |
| Reduced-motion detection | `window.matchMedia("(prefers-reduced-motion: reduce)")` listener | `useReducedMotion()` from motion/react | Hook handles SSR, media query change events, and React lifecycle automatically |
| Stagger timing logic | `setTimeout` chains per row | `staggerChildren` in motion/react variants | Declarative, interruptible, respects `useReducedMotion` |

---

## CRITICAL FINDING: `playerAnsweredCorrectly` Does Not Exist

**What the CONTEXT.md and UI-SPEC say:** `RevealScreen` confetti should fire when
`state.playerAnsweredCorrectly === true`.

**What the codebase shows:** `GameStateSnapshot` (in `src/hooks/useGameSync.ts`) has no
`playerAnsweredCorrectly` field. The state shape is:
```typescript
export type GameStateSnapshot = {
  phase: "lobby" | "question" | "locked" | "revealed" | "ended";
  currentQuestionId: string | null;
  currentQuestion: { id, body, optionA, optionB } | null;
  myAnswer: "A" | "B" | null;
  correctOption: "A" | "B" | null;
  distribution: { A: number; B: number } | null;
  leaderboard: { name: string; score: number }[];
};
```
[VERIFIED: codebase — `src/hooks/useGameSync.ts` lines 53-66 and `src/app/api/game/state/route.ts`]

**The correct derivation for confetti trigger:**
```typescript
const answeredCorrectly = state.myAnswer !== null && state.myAnswer === state.correctOption;
```

This matches how `RevealScreen.tsx` already derives correctness for its UI (lines 112-125, 134-145 of the existing file — it checks `state.correctOption === option` and `state.myAnswer === option`).

**The planner MUST use this derivation, not the non-existent field name.**

---

## Common Pitfalls

### Pitfall 1: `playerAnsweredCorrectly` Field Does Not Exist
**What goes wrong:** Confetti never fires (TypeScript compiles with `undefined` but the condition is always false) or TypeScript strict mode flags the unknown field.
**Why it happens:** The CONTEXT.md spec was written aspirationally; the field was never added to the type.
**How to avoid:** Use `state.myAnswer !== null && state.myAnswer === state.correctOption` — verified against the actual `GameStateSnapshot` type and `RevealScreen.tsx` existing logic.
**Warning signs:** TypeScript error `Property 'playerAnsweredCorrectly' does not exist on type 'GameStateSnapshot'`.

### Pitfall 2: AnimatePresence Key Must Be `state?.phase`
**What goes wrong:** If the key is a counter or UUID, AnimatePresence may not remount when expected. If key is missing or static, no animation fires.
**Why it happens:** AnimatePresence tracks exit/enter by `key` changes. If the key doesn't change, no animation.
**How to avoid:** Use `key={state?.phase ?? "loading"}` — phase string changes are the exact trigger.

### Pitfall 3: `motion.button` with `[touch-action:manipulation]`
**What goes wrong:** Tap feedback feels broken on iOS (300ms tap delay returns). Native browser cancels the fast-tap optimization.
**Why it happens:** `touch-action: manipulation` must remain on the interactive element. `getButtonClass()` already includes `[touch-action:manipulation]` as a Tailwind class string — this carries over automatically when `motion.button` receives the same `className` prop.
**How to avoid:** Pass `className={getButtonClass(...)}` unchanged to `motion.button`. The class string includes the touch-action directive.

### Pitfall 4: Static Import of `canvas-confetti`
**What goes wrong:** Confetti bundle loads on every page load for every guest, including those who never answer correctly. Adds ~30KB to initial JS bundle.
**Why it happens:** `import confetti from "canvas-confetti"` at the top of the file.
**How to avoid:** Always use `import("canvas-confetti").then(({ default: confetti }) => {...})` inside the `useEffect`. Never static-import.

### Pitfall 5: Stagger Animation on Score Updates
**What goes wrong:** Leaderboard stagger re-runs on every score update within the `revealed` phase, creating jank.
**Why it happens:** If `initial="hidden"` and `animate="visible"` are tied to a state dependency that changes within the phase.
**How to avoid:** Use empty `initial` props (driven by AnimatePresence mount/unmount cycle via `mode="wait"`). The component remounts when phase changes; within a phase, leaderboard data updates don't remount the component. The `initial="hidden"` / `animate="visible"` triggers on mount only.

### Pitfall 6: `useReducedMotion()` Not Called in Every Motion Component
**What goes wrong:** WCAG 2.3.3 (motion animation from interactions) fails. Safari users with "Reduce Motion" enabled still see animations.
**Why it happens:** Forgetting to add the hook or conditionally skip it.
**How to avoid:** Call `useReducedMotion()` at the top of: `display/page.tsx`, `QuestionScreen.tsx`, `RevealDisplay.tsx`, `WinnerDisplay.tsx`, `RevealScreen.tsx`, `WinnerDisplay.tsx`. Gate all animation props behind `shouldReduce` check.

### Pitfall 7: `prefers-reduced-motion` Override Missing in globals.css
**What goes wrong:** `.text-gradient-gold` renders as `color: transparent` on devices with reduced motion enabled, making text invisible.
**Why it happens:** The CSS `background-clip: text; color: transparent` trick requires the gradient background. If the gradient is stripped (e.g. by a reset), text becomes invisible.
**How to avoid:** The `@media (prefers-reduced-motion: reduce)` block MUST include `.text-gradient-gold { background: none; color: var(--color-gold); }`. The UI-SPEC already specifies this — follow it exactly.

### Pitfall 8: Dry Run Not Treated as a Hard Gate
**What goes wrong:** Code ships to the wedding without validation. A stuck state or reconnect gap at the event has no recovery time.
**Why it happens:** Dry run is treated as "nice to have" rather than a gating task.
**How to avoid:** The dry-run task must be the LAST task in the phase plan and must be marked as a `checkpoint:human-verify`. The planner should include an explicit checklist (see Dry Run Protocol below).

---

## Existing Code Verified Before Implementation

The following files were read and their current state confirmed. Implementers must re-read these files before modifying them — the spec is calibrated to their exact current state.

| File | Current State | Phase 7 Change |
|------|--------------|----------------|
| `src/app/globals.css` | Has `.glass`, `.glass-gold`, `slide-up`, `fade-scale` keyframes, `prefers-reduced-motion` block | Add `.text-gradient-gold` after `.glass-gold`; add override in `prefers-reduced-motion` block |
| `src/app/display/page.tsx` | `{screen}` is a bare JSX expression, no AnimatePresence; fullscreen button and DisplayStatusDot present | Wrap `{screen}` in AnimatePresence; add `useReducedMotion` and motion imports |
| `src/components/display/LobbyDisplay.tsx` | `<h1 className="... text-champagne ...">` | Swap `text-champagne` for `text-gradient-gold` on the h1 |
| `src/components/display/RevealDisplay.tsx` | `<span className={cn("...", isCorrect ? "text-gold-bright" : "text-champagne")}>` in OptionWithBar; uses `<LeaderboardPanel leaderboard={state.leaderboard.slice(0, 5)} />` in a `scale-150` wrapper | Replace `text-gold-bright` with `text-gradient-gold` in OptionWithBar; replace LeaderboardPanel with staggered inline list |
| `src/components/display/WinnerDisplay.tsx` | `<p className="... text-gold-bright ...">` for winner name; uses `<LeaderboardPanel leaderboard={state.leaderboard} />` in `scale-150` wrapper; JSDoc says "No canvas-confetti" | Replace `text-gold-bright` with `text-gradient-gold`; replace LeaderboardPanel with stagger; add canvas-confetti on mount |
| `src/components/guest/QuestionScreen.tsx` | `<button type="button" className={getButtonClass(...)}>` for both A and B | Convert to `motion.button`; add `whileTap` |
| `src/components/guest/NameGate.tsx` | `<h1 className="font-heading text-2xl font-bold text-champagne leading-tight">` | Swap `text-champagne` for `text-gradient-gold` |
| `src/components/guest/RevealScreen.tsx` | No confetti; uses `state.correctOption` and `state.myAnswer` for reveal logic | Add confetti `useEffect` with correct derivation |
| `src/components/guest/WinnerScreen.tsx` | Complete canvas-confetti implementation already present | DO NOT MODIFY |
| `src/components/guest/LeaderboardPanel.tsx` | Has `getRankClasses(rank)` and `getScoreClasses(rank)` helper functions | DO NOT MODIFY — copy helpers to display stagger implementations |

---

## Dry Run Protocol (RT-08)

The dry run is a human-verified gate. The planner should create a final task with this checklist as its
acceptance criteria.

**Prerequisites:**
- Production Vercel deployment live with latest Phase 7 code
- Supabase Pro plan active (connection limits safe for 100+ guests)
- 5+ real devices available (must include at least 1 iPhone on Safari)
- Host device prepared with credentials

**Dry Run Checklist:**

| # | Check | Devices | Expected |
|---|-------|---------|---------|
| 1 | TV display opens at `/display`, enters fullscreen | TV browser | LobbyDisplay shows with participant count |
| 2 | 5+ guests join from real phones via name entry | All guest phones | All names appear in lobby count; count increments live |
| 3 | Host starts game | Host device | All phones + TV transition to QuestionDisplay |
| 4 | All guests tap A or B | Guest phones | Lock feedback visible; host dashboard shows answer distribution |
| 5 | Host locks answers | Host device | All phones show "Aștepți dezvăluirea..." |
| 6 | Host reveals | Host device | TV shows RevealDisplay with stagger animation; guest phones show correct/wrong feedback |
| 7 | Correct-answer guests see confetti | Correct-answer guest phones | Mini confetti burst on RevealScreen |
| 8 | Host advances to next question | Host device | TV animates to next QuestionDisplay (slide+fade) |
| 9 | Repeat for 2-3 questions | All devices | No stuck states, no sync gaps |
| 10 | Host ends game | Host device | TV shows WinnerDisplay with confetti + staggered leaderboard |
| 11 | One guest disconnects (airplane mode 30s) and reconnects | One guest phone | Reconnects to current game state correctly |
| 12 | iPhone Safari screen-lock test: lock phone 60s, unlock | iPhone | Game state syncs on tab return |
| 13 | Host uses emergency reset control | Host device | Game recovers; all clients resync |

**Pass criteria:** All 13 checks pass with no manual server restarts, no stuck clients, no phase desync.

---

## Environment Availability

| Dependency | Required By | Available | Version | Notes |
|------------|------------|-----------|---------|-------|
| Node.js | Next.js build | Confirmed | 24.14.0 | Detected via Bash tool |
| `motion` package | AnimatePresence, whileTap | Confirmed | 12.40.0 | In node_modules, exports verified |
| `canvas-confetti` package | Confetti bursts | Confirmed | 1.9.4 | In node_modules, `@types/canvas-confetti` present |
| Vercel deployment | RT-08 dry run | Human-verify | — | Must be live before dry run |
| Supabase Pro plan | RT-08 dry run | Human-verify | — | Free tier unsafe for 100+ concurrent guests |
| 5+ real devices (incl. iPhone) | RT-08 dry run | Human-verify | — | Not automatable |

**Missing dependencies with no fallback:**
- Vercel production deployment (must be manually set up before dry run)
- Supabase Pro (must be upgraded before dry run — STATE.md confirms this is a known blocker)

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`. However, the project has no test framework configured (`CLAUDE.md`: "No test framework is configured"). Validation for Phase 7 is manual and performance-based.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None configured |
| Config file | None |
| Quick run command | `npm run build` (TypeScript compilation as proxy for correctness) |
| Full suite command | Manual dry run per Dry Run Protocol above |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| RT-07 | Gold gradient text renders on 4 elements | Visual manual | `npm run build` confirms TypeScript; visual inspection required | CSS gradient — cannot unit test |
| RT-07 | AnimatePresence fires on phase change | Visual manual | `npm run dev` + host action | Browser observation |
| RT-07 | Leaderboard stagger fires on mount | Visual manual | Same as above | 10 rows × 80ms observable |
| RT-07 | `whileTap` scale on A/B buttons | Physical device test | `npm run dev` + phone tap | Requires real device or DevTools mobile mode |
| RT-07 | Confetti on correct answer | Physical device test | Same | Requires correct answer scenario |
| RT-07 | TV winner confetti | Visual manual | `npm run dev` + end game | Observable on screen |
| RT-08 | 60fps on 4x CPU throttle (guest tap screen) | Chrome DevTools Performance | Manual: DevTools > Performance > 4x CPU throttle > tap A/B | No layout-triggering animations; `opacity` + `transform` only |
| RT-08 | Full e2e dry run on production | Human gate | Dry Run Protocol checklist | 5+ real devices, Vercel + Supabase Pro |

### Wave 0 Gaps

None — existing infrastructure (TypeScript compilation + manual testing) covers all phase requirements. No test framework to install.

---

## Security Domain

`security_enforcement: true` in config. ASVS Level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase 7 has no auth changes |
| V3 Session Management | No | No session changes |
| V4 Access Control | No | No new routes or data access |
| V5 Input Validation | No | No new user input |
| V6 Cryptography | No | No cryptographic operations |

### Phase 7 Security Notes

- **No new API routes** — no new attack surface
- **No `dangerouslySetInnerHTML`** — all player names rendered as React text nodes (existing pattern maintained from Phase 5)
- **`canvas-confetti` dynamic import** — keeps confetti out of initial bundle; no remote code execution risk (local npm package, already audited)
- **CSS gradient utility** — pure CSS, no JavaScript; no XSS vector
- **`useReducedMotion()`** — respects OS accessibility settings; no data collection
- **Service-role key still server-only** — Phase 7 adds no new client-side Supabase queries; this invariant is maintained

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` package name | `motion` package, import from `motion/react` | 2024 | Legacy package still works but `motion` is canonical; project already uses correct package |
| `tailwindcss-animate` for shadcn/ui animations | Native CSS animation utilities | March 2025 | Not applicable to Phase 7 (no shadcn animation changes) |
| Static confetti import | Dynamic import inside `useEffect` | Established in Phase 5 | ~30KB off initial bundle per page that uses confetti |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | (none) | — | — |

All claims in this research were verified against the codebase or installed packages. No assumed knowledge was used for actionable implementation decisions.

**Notable verification:** `motion/react` exports `AnimatePresence` and `useReducedMotion` — confirmed by loading `node_modules/motion/dist/cjs/react.js` in the project environment.

---

## Open Questions

1. **`LeaderboardPanel` scale-150 wrapper in display components**
   - What we know: `RevealDisplay.tsx` and `WinnerDisplay.tsx` both use `<div className="transform scale-150 origin-top">` wrapping `<LeaderboardPanel>`. This is the "Finding 5 scale wrapper" from Phase 6.
   - What's unclear: Should the staggered inline list also be inside a `scale-150` wrapper to maintain the same visual size on the TV?
   - Recommendation: Yes — preserve the `scale-150 origin-top` wrapper around the staggered `motion.ol` to maintain TV readability. The UI-SPEC does not explicitly address this but the wrapper is part of the existing visual contract.

2. **`WinnerDisplay` JSDoc comment**
   - What we know: The JSDoc says "No canvas-confetti — confetti is guest-side only (Phase 5)." This is now superseded by D-09.
   - What's unclear: N/A — D-09 explicitly overrides this.
   - Recommendation: Update the JSDoc when adding confetti.

---

## Sources

### Primary (HIGH confidence)
- `src/hooks/useGameSync.ts` — `GameStateSnapshot` type definition (field verification)
- `src/app/api/game/state/route.ts` — API response shape (confirms no `playerAnsweredCorrectly`)
- `src/components/guest/WinnerScreen.tsx` — canvas-confetti reference implementation
- `src/components/guest/QuestionScreen.tsx` — button structure for whileTap migration
- `src/components/guest/RevealScreen.tsx` — correctness derivation pattern
- `src/components/display/RevealDisplay.tsx` — leaderboard wrapper + OptionWithBar structure
- `src/components/display/WinnerDisplay.tsx` — winner name element + leaderboard wrapper
- `src/components/display/LobbyDisplay.tsx` — title h1 class
- `src/components/guest/NameGate.tsx` — heading h1 class
- `src/components/guest/LeaderboardPanel.tsx` — row structure + color helper functions
- `src/app/display/page.tsx` — AnimatePresence insertion point
- `src/app/globals.css` — existing utility classes and prefers-reduced-motion block
- `package.json` — installed library versions
- `node_modules/motion/dist/cjs/react.js` — confirmed exports: `AnimatePresence`, `motion`, `m`, `useReducedMotion`
- `.planning/phases/07-polish-pre-event-hardening/07-CONTEXT.md` — locked decisions D-01 through D-09
- `.planning/phases/07-polish-pre-event-hardening/07-UI-SPEC.md` — animation contract, exact parameter values, screen-by-screen change spec

### Secondary (MEDIUM confidence)
- `npm view motion version` → 12.40.0 (registry current)
- `npm view canvas-confetti version` → 1.9.4 (registry current)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies present in node_modules, exports verified
- Architecture: HIGH — all target files read and current state documented
- Pitfalls: HIGH — primary pitfall (`playerAnsweredCorrectly`) verified directly from codebase
- Dry run protocol: MEDIUM — checklist derived from RT-08 + STATE.md blockers; actual pass/fail depends on production environment

**Research date:** 2026-06-05
**Valid until:** 2026-09-26 (wedding date) — stack is stable; no API changes expected
