---
phase: 07-polish-pre-event-hardening
reviewed: 2026-06-06T00:00:00Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - src/app/globals.css
  - src/app/display/page.tsx
  - src/components/display/LobbyDisplay.tsx
  - src/components/display/RevealDisplay.tsx
  - src/components/display/WinnerDisplay.tsx
  - src/components/guest/QuestionScreen.tsx
  - src/components/guest/NameGate.tsx
  - src/components/guest/RevealScreen.tsx
  - src/app/api/game/answer/route.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** deep
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 7 introduces aesthetic polish (`.text-gradient-gold`, AnimatePresence phase transitions,
staggered leaderboard) and production hardening (UPSERT for answer changes, WR-01 race handler).
The motion variant choices (opacity + y only) are compositor-safe throughout. The reduced-motion
fallback paths and `confettiFired` ref guards are structurally correct.

Three issues require attention before the event:

1. **BLOCKER** — `game.current_question_id!` non-null assertion in the answer route can produce a
   `null` question_id, silently inserting an answer row bound to `null`, corrupting scoring.
2. **MAJOR** — `RevealScreen.tsx` confetti uses an empty-deps closure that captures `state` at
   mount time — if `state.myAnswer` or `state.correctOption` is `null` at the moment the
   component first mounts, confetti is permanently skipped even for correct answers.
3. **MAJOR** — `WinnerDisplay` / `RevealDisplay` leaderboard row keys use `entry.name` as part of
   the composite key. Duplicate names produce duplicate keys, causing React reconciliation
   errors and potentially scrambled leaderboard rendering in the final winner screen.

---

## Critical Issues

### CR-01: Non-null assertion on `current_question_id` can produce a null DB write

**File:** `src/app/api/game/answer/route.ts:119`

**Issue:** `game.current_question_id` is typed `string | null` in `database.ts` (line 91). The
phase guard on line 88 only checks `game.phase !== "question"` — it does NOT verify that
`current_question_id` is non-null. If a game row is somehow in phase `"question"` with
`current_question_id = null` (race during host's `startQuestion` transition, or data corruption),
the non-null assertion `game.current_question_id!` on line 119 silently evaluates to `null`.
The subsequent upsert then inserts `{ player_id, question_id: null, choice }`, bypassing the
`UNIQUE(player_id, question_id)` constraint behavior (null != null in SQL) and producing a
phantom answer row that is never counted in scoring. The WR-01 cleanup path also uses
`answeredQuestionId` to delete/restore, so the wrong row (or no row) is targeted.

**Fix:**
```typescript
const answeredQuestionId = game.current_question_id;
if (!answeredQuestionId) {
  return NextResponse.json({ error: "no_active_question" }, { status: 409 });
}
```
Replace line 119 with this explicit guard before proceeding to the pre-upsert snapshot and
upsert steps.

---

## Warnings

### WR-01: `RevealScreen` confetti closure captures stale `state` — may skip confetti on correct answers

**File:** `src/components/guest/RevealScreen.tsx:83-98`

**Issue:** The `useEffect` for confetti has empty deps (`[]`), intentionally firing once on
mount. It evaluates `state.myAnswer` and `state.correctOption` via closure from the initial
render. The `RevealScreen` is rendered only when `state.phase === "revealed"`, so both fields
should be populated. However, there is a real scenario where they are not: on reconnect or
page refresh, `useGameSync` calls `fetchState()` after the `SUBSCRIBED` event fires. During
the brief window between mount and the first successful `fetchState()` resolve, `state` may
still carry `myAnswer: null` (the initial fetch is in-flight). If `RevealScreen` is already
mounted during this window (e.g. the parent dispatches `state.phase === "revealed"` from a
cached/stale state object), the closure captures `null` for both fields, `answeredCorrectly`
is `false`, and confetti is permanently blocked by `confettiFired.current` even after state
catches up.

**Fix:** Remove empty deps and add `state.myAnswer, state.correctOption` as dependencies, but
also keep the `confettiFired` ref guard to prevent re-firing on unrelated re-renders:

```typescript
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
}, [state.myAnswer, state.correctOption, shouldReduce]);
// eslint-disable-line react-hooks/exhaustive-deps not needed — deps are explicit
```

The `confettiFired` ref ensures exactly-once firing despite the dependency list.

---

### WR-02: Leaderboard row keys are non-unique for duplicate player names

**File:** `src/components/display/WinnerDisplay.tsx:116,139` and `src/components/display/RevealDisplay.tsx:208,231`

**Issue:** Row keys are constructed as `` `${entry.name}-${rank}` ``. The `rank` part is
derived from the array index, not a stable player ID, and `entry.name` is a display name that
players can freely choose. Two players named "Ana" produce keys `Ana-1` and `Ana-2`, which are
unique in that case. However if leaderboard order changes between render cycles (scores are
live-updated via Realtime), `rank` shifts, and React may reuse the wrong DOM node. More
critically: if two players have EXACTLY the same name and score (same rank on tie), both keys
collapse to `Ana-1` — React will emit a duplicate-key warning and render only one entry, making
the leaderboard appear to have fewer players than it does.

Since `GameStateSnapshot.leaderboard` entries only carry `{ name, score }` (no `id` field),
the safest key is a combination of all three uniqueness signals available:

**Fix:**
```typescript
// In both WinnerDisplay and RevealDisplay — replace key construction:
key={`${entry.name}-${entry.score}-${index}`}
```

This is not perfectly stable under reordering but is collision-resistant in practice and
avoids the tied-name/same-rank collapse. The real fix would be exposing `playerId` in the
leaderboard type, but that is an API change.

---

### WR-03: `WinnerDisplay` confetti fires under `prefers-reduced-motion` on first hydration

**File:** `src/components/display/WinnerDisplay.tsx:51-63`

**Issue:** `useReducedMotion()` from `motion/react` returns `null` on the first render (the
value is not yet determined from `window.matchMedia`). The guard on line 52 is
`if (shouldReduce) return` — `null` is falsy, so this guard does NOT fire when `shouldReduce`
is `null`. The effect then proceeds to set `confettiFired.current = true` and imports
`canvas-confetti`. On the very next re-render, `shouldReduce` resolves to `true` (user has
reduced-motion preference), but `confettiFired.current` is already `true` so the effect skips.
Result: confetti fires exactly once on first mount for users who have `prefers-reduced-motion:
reduce` enabled. This violates the accessibility contract.

`RevealScreen.tsx:87` has the same pattern with the same risk.

**Fix:** Use a strict boolean check:
```typescript
// In both WinnerDisplay and RevealScreen:
if (shouldReduce === true) return;
// or equivalently:
if (shouldReduce !== false) return; // also blocks the null/unknown state
```

This ensures confetti never fires until the reduced-motion preference is definitively `false`.

---

## Info

### IN-01: Duplicate `getRankClasses` / `getScoreClasses` helpers across two files

**File:** `src/components/display/RevealDisplay.tsx:31-40` and `src/components/display/WinnerDisplay.tsx:23-32`

**Issue:** Both files contain identical `getRankClasses` and `getScoreClasses` helper functions
(lines 31-40 in RevealDisplay, lines 23-32 in WinnerDisplay). The comment in each file reads
"copied from LeaderboardPanel — do not import from there", which acknowledges the duplication
but doesn't address it. Any change to rank styling must be made in two places.

**Fix:** Extract to a shared `src/components/display/leaderboardHelpers.ts` (or add to
`src/lib/utils.ts` if preferred). Both files import from there.

---

### IN-02: CSS-level `active:scale-[0.97]` and Framer Motion `whileTap={{ scale: 0.96 }}` coexist on the same button

**File:** `src/components/guest/QuestionScreen.tsx:57,77` (CSS) and `151,175` (motion prop)

**Issue:** Idle and unselected-during-question buttons have both `active:scale-[0.97]` (CSS
`:active` pseudo-class) and `whileTap={{ scale: 0.96 }}` (Framer Motion) applied simultaneously.
Framer Motion uses `transform` via inline styles which override Tailwind's CSS-class transform.
In practice, the motion `scale: 0.96` wins because inline styles have higher specificity. The
CSS `active:scale-[0.97]` is dead code on `motion.button` elements and adds confusion.

**Fix:** Remove `active:scale-[0.97]` from `baseLayout` in `getButtonClass` — the motion
`whileTap` handles all tap feedback consistently.

---

### IN-03: `text-gradient-gold` uses `color: transparent` without a WebKit-only guard

**File:** `src/app/globals.css:75`

**Issue:** The `.text-gradient-gold` rule sets `color: transparent` to reveal the
`background-clip: text` gradient. On browsers that do not support `background-clip: text`
(rare in 2026, but possible on some older embedded WebViews on low-end Android phones brought
to the venue), the text renders as fully transparent — invisible. The reduced-motion override
at line 103-107 correctly restores `color: var(--color-gold)`, but that override only fires
under `prefers-reduced-motion: reduce`, not for unsupported browsers.

**Fix:** Use the standard progressive-enhancement pattern as a baseline fallback:
```css
.text-gradient-gold {
  color: var(--color-gold); /* fallback for browsers without background-clip: text */
  background: linear-gradient(135deg, var(--color-gold), var(--color-champagne));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```
Note: `-webkit-text-fill-color` is better than `color: transparent` for this pattern because
`color` still works for `text-shadow` and `caret-color` when `-webkit-text-fill-color` is
used. Browsers without the support see the `color: var(--color-gold)` fallback.

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
