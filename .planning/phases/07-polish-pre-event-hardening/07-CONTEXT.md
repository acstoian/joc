# Phase 7: Polish & Pre-Event Hardening - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 delivers the final polish and production-readiness layer across all three surfaces (guest app, host dashboard, TV display). This phase upgrades functional Phase 6 animations to a cinematic, wedding-luxury feel — adding AnimatePresence transitions and staggered leaderboard entries on the TV display, gold-gradient text accents on key headings, tap feedback on guest A/B buttons, and confetti moments on correct answers and the winner screen. The phase closes with a mandatory end-to-end dry run on production (Vercel + Supabase Pro) with 5+ real devices before the wedding.

**All 2 requirements in scope:** RT-07, RT-08.

**Explicit Phase 7 scope from ROADMAP.md SC:**
1. All three surfaces carry soft-luxury wedding aesthetic: glassmorphism accents, animated gradients, subtle confetti on correct answers/winner screen, smooth phase transitions
2. Chrome DevTools 4x CPU throttle test on guest A/B tap screen holds 60fps; no layout-triggering animations; leaderboard FLIP animation runs once per reveal
3. Full end-to-end dry run on production with 5+ real devices including iPhone on Safari — no stuck states, no sync gaps, emergency controls verified

**Not in scope:**
- New game features or scoring changes
- Host dashboard aesthetic overhaul (functional dashboard stays functional)
- Multi-device / multi-game support
- Any schema or API changes

</domain>

<decisions>
## Implementation Decisions

### Animation Upgrade — TV Display

- **D-01: AnimatePresence scope** — TV display only. The guest app stays with CSS-only conditional re-renders (reliability on low-end phones is the priority). `motion/react` AnimatePresence is introduced only to `src/app/display/page.tsx` and its screen components.

- **D-02: TV phase transition style** — Slide + fade. New screen slides up and fades in; old screen fades out. The CSS keyframes `slide-up` and `fade-scale` already exist in `src/app/globals.css` — wrap screen components in `motion.div` with `variants` that reproduce these effects. Use `AnimatePresence mode="wait"` so the old screen exits before the new one enters.

- **D-03: Leaderboard stagger** — Stagger in on both `RevealDisplay` (top-5) and `WinnerDisplay` (full leaderboard). Each row entry delays `0.08s × index`. Pattern: `motion.div` per row with `variants={{ hidden, visible }}`, parent container uses `staggerChildren: 0.08`. This produces the "building to #1" drum-roll feel described in Phase 6 CONTEXT.md D-07.

### Animation Upgrade — Guest App

- **D-04: Guest motion** — Tap feedback only. Add `whileTap={{ scale: 0.96 }}` to the `motion.div` wrapper on each A/B answer button in `src/components/guest/QuestionScreen.tsx`. No AnimatePresence, no phase transition animations on the guest app. Keeps bundle lean and avoids AnimatePresence complexity on low-end Android.

### Animated Gradients (Text Accents)

- **D-05: Placement** — Hero text and accents only. No animated background gradient. The `.glass` utility in globals.css already provides the glassmorphism atmospheric feel — no background gradient needed on top.

- **D-06: Targets** — Apply the gold-to-champagne gradient text to these four elements:
  1. TV `LobbyDisplay` — game title heading ("Joc — Cristina & Andrei")
  2. TV `WinnerDisplay` — #1 hero player name
  3. Guest `NameGate` — Playfair Display heading
  4. TV `RevealDisplay` — correct answer option label (applied at reveal time)

- **D-07: Style** — Static CSS gradient, no animation. `background: linear-gradient(135deg, var(--color-gold), var(--color-champagne)); background-clip: text; -webkit-background-clip: text; color: transparent;`. A CSS utility class `.text-gradient-gold` should be added to globals.css for reuse. No keyframe animation — the static gradient is visually rich without motion overhead.

### Confetti Scope

- **D-08: Guest correct-answer confetti** — Add a small `canvas-confetti` burst on `RevealScreen` when `playerAnsweredCorrectly === true`. Fewer particles than the winner burst (e.g. `particleCount: 60, spread: 50` vs winner's `particleCount: 150, spread: 100`). Same implementation pattern as `WinnerScreen`: ref-guard (`confettiFired.current`), dynamic import inside `useEffect`, fires exactly once per correct reveal.

- **D-09: TV winner confetti** — `WinnerDisplay` gets `canvas-confetti` on mount when the `ended` phase is shown. Overrides Phase 6 CONTEXT.md D-09 ("confetti is guest-side only") — that decision was deferred to Phase 7. Same dynamic-import + ref-guard pattern. This is the room's celebration moment on the big screen.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Animation — core pattern
- `src/app/globals.css` — `@theme` tokens (gold, champagne, ink, blush, sage and variants), `.glass` / `.glass-gold` utilities, `slide-up` / `fade-scale` CSS keyframes, `prefers-reduced-motion` overrides. The new `.text-gradient-gold` utility goes here too.
- `src/app/display/page.tsx` — TV display shell. AnimatePresence wraps the phase `screen` variable here. Read the full file before modifying — fullscreen state, `HOST_SENTINEL_PLAYER_ID` usage, and countdown overlay must all be preserved.

### Display screen components (all get animation upgrades)
- `src/components/display/LobbyDisplay.tsx` — Add `.text-gradient-gold` to game title.
- `src/components/display/QuestionDisplay.tsx` — Wraps in motion.div for slide+fade entry.
- `src/components/display/LockedDisplay.tsx` — Wraps in motion.div for slide+fade entry.
- `src/components/display/RevealDisplay.tsx` — Wraps in motion.div; staggered leaderboard rows; `.text-gradient-gold` on correct option label.
- `src/components/display/WinnerDisplay.tsx` — Wraps in motion.div; staggered leaderboard rows; `.text-gradient-gold` on #1 name; add canvas-confetti on mount.

### Guest screen components
- `src/components/guest/QuestionScreen.tsx` — Add `whileTap={{ scale: 0.96 }}` to A/B button wrapper (convert to `motion.div` or `motion.button`). Read the existing touch-action and focus-visible classes — preserve them.
- `src/components/guest/RevealScreen.tsx` — Add small canvas-confetti burst on correct answer. Read existing reveal logic (gold glow, opacity transitions) before modifying.
- `src/components/guest/NameGate.tsx` — Add `.text-gradient-gold` to the Playfair Display heading.
- `src/components/guest/WinnerScreen.tsx` — Already has canvas-confetti (ref-guarded, dynamic import). Read before touching — do not duplicate the confetti pattern.

### Sync + state hook
- `src/hooks/useGameSync.ts` — `playerAnsweredCorrectly` field in `GameStateSnapshot` drives the correct-answer confetti trigger in RevealScreen. Verify the field name before implementing.

### Prior phase context (locked decisions to honor)
- `.planning/phases/06-tv-display-mode/06-CONTEXT.md` — All D-01 through D-11 decisions from Phase 6 are locked (screen layouts, bar behavior, countdown overlay, fullscreen button). Phase 7 adds animation on top; it does NOT change screen structure.
- `.planning/phases/05-guest-app/05-CONTEXT.md` — D-04 (gold button lock style), D-05 (glass idle / gold locked), D-06 (in-place reveal feedback). Phase 7 adds tap scale and confetti on top; button layout and color semantics are locked.

### Requirements
- `.planning/REQUIREMENTS.md` — RT-07 (soft-luxury aesthetic audit), RT-08 (performance validation + dry run gate).
- `.planning/ROADMAP.md` §"Phase 7: Polish & Pre-Event Hardening" — 3 success criteria (aesthetic, 60fps, dry run).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/globals.css` — `slide-up` / `fade-scale` keyframes already defined; replicate as `motion/react` `variants` for AnimatePresence usage. `.glass` and `.glass-gold` utilities for glassmorphism already implemented. New `.text-gradient-gold` goes here as a CSS utility class.
- `src/components/guest/WinnerScreen.tsx` — Complete, working example of the `canvas-confetti` pattern (dynamic import, ref-guard, once-on-mount). Copy this pattern verbatim to `RevealScreen` and `WinnerDisplay`.
- `src/components/guest/LeaderboardPanel.tsx` — Built in Phase 5; display components may already reuse this. Check before creating a new staggered variant.
- All shadcn/ui primitives (`button.tsx`, `card.tsx`, `badge.tsx`) are installed — don't hand-roll UI.

### Established Patterns
- **motion/react** — Already installed (`motion` package, import from `motion/react`). Versions compatible per CLAUDE.md.
- **canvas-confetti** — Already installed; dynamic import pattern established in `WinnerScreen`. Never static-import (keeps it out of the initial bundle).
- **`prefers-reduced-motion` override** — globals.css already sets `animate-pulse: none` and flattens CSS keyframes under `prefers-reduced-motion: reduce`. Any new CSS animations must also be overridden there. For motion/react components, use `useReducedMotion()` hook.
- **Romanian copy** — All user-facing strings in Romanian. Keep existing labels; no new English UI strings.
- **`@theme` tokens** — All color values via CSS variables (e.g., `var(--color-gold)`), not hex literals. The `.text-gradient-gold` class uses `var(--color-gold)` and `var(--color-champagne)`.

### Integration Points
- `src/app/display/page.tsx` — AnimatePresence wraps the `screen` variable (the phase switch output). The key for AnimatePresence must be `state.phase` so it unmounts/remounts on phase change.
- `src/components/guest/QuestionScreen.tsx` — The A/B button element needs to become `motion.div` or `motion.button` to support `whileTap`. Must not break `touch-action: manipulation` or `pointer-events-none` on locked state.
- `src/app/globals.css` — Add `.text-gradient-gold` utility class here; no new CSS files.

</code_context>

<specifics>
## Specific Ideas

- **`.text-gradient-gold` CSS utility** — `background: linear-gradient(135deg, var(--color-gold), var(--color-champagne)); background-clip: text; -webkit-background-clip: text; color: transparent;` — Add to globals.css alongside `.glass`.
- **AnimatePresence `mode="wait"`** — Ensures the exiting phase screen fully fades/slides out before the entering one begins. Without it, both screens overlap during transition.
- **Stagger variants pattern** — Parent: `transition: { staggerChildren: 0.08 }`. Child row: `variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}`.
- **Confetti particle counts** — Correct-answer mini-burst: `{ particleCount: 60, spread: 50, origin: { y: 0.6 } }`. Winner full burst: keep the existing WinnerScreen parameters or make it larger for the TV.
- **TV confetti origin** — For TV/landscape screens, consider firing from `{ origin: { x: 0.5, y: 0.3 } }` so confetti falls from upper-center rather than bottom-up.
- **`useReducedMotion()` from motion/react** — Gate all AnimatePresence and whileTap interactions behind this hook; fall back to instant transitions.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 7-Polish & Pre-Event Hardening*
*Context gathered: 2026-06-05*
