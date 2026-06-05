---
phase: 06-tv-display-mode
reviewed: 2026-06-05T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - package.json
  - src/app/display/page.tsx
  - src/app/globals.css
  - src/components/display/DisplayStatusDot.tsx
  - src/components/display/LoadingDisplay.tsx
  - src/components/display/LobbyDisplay.tsx
  - src/components/display/LockedDisplay.tsx
  - src/components/display/QuestionDisplay.tsx
  - src/components/display/RevealDisplay.tsx
  - src/components/display/WinnerDisplay.tsx
  - src/hooks/useGameSync.ts
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-06-05T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 6 implements the TV/projector display surface. The realtime plumbing in `useGameSync` is well-defended — presence flooding prevention, StrictMode cleanup, and the typed-signal-then-refetch contract are correctly applied. The display components are structurally sound and follow the project's phase-screen pattern.

Three blockers were found: a rounding bug that causes A+B percentages to sum to 99% or 101% (present in two files), a stale doc-comment that describes countdown features never implemented (misdirects future readers), and an unhandled promise rejection on `requestFullscreen` that will fire a global error on iOS Safari. Four warnings cover a `correctOption === null` edge case that silently dims both option cards, an unprotected `/display` route, a `scale-150` approach that clips content at the outer container boundary, and a missing `error` check in the broadcast handler. Three info items cover minor quality gaps.

---

## Critical Issues

### CR-01: Percentage rounding causes A+B to sum to 99% or 101%

**File:** `src/components/display/LockedDisplay.tsx:87-88`, `src/components/display/RevealDisplay.tsx:119-120`

**Issue:** Both files compute:
```ts
const pctA = total > 0 ? Math.round((dist.A / total) * 100) : 0;
const pctB = total > 0 ? Math.round((dist.B / total) * 100) : 0;
```
`Math.round` applied independently to two complementary fractions does not guarantee they sum to 100. With e.g. 1 vote A / 2 votes B: `round(0.333*100)=33`, `round(0.667*100)=67` → 100. But with 1/3: `round(33.3)=33`, `round(66.7)=67` → 100. The pathological case is e.g. 1 A / 3 B total 4: pctA=25, pctB=75 — fine. Try 2 A / 3 B total 5: pctA=`round(40)=40`, pctB=`round(60)=60` — fine. The real trigger: two bars are shown side-by-side on a TV and guests will notice "40% + 61% = 101%" on distributions like 2/5. The standard fix is the "largest remainder method": compute one value, derive the other as `100 - pctA` to guarantee the invariant.

**Fix:**
```ts
// In both LockedDisplay and RevealDisplay:
const pctA = total > 0 ? Math.round((dist.A / total) * 100) : 0;
const pctB = total > 0 ? 100 - pctA : 0;   // guarantees sum === 100
```

---

### CR-02: Stale docstring describes countdown/CountdownOverlay features that were never implemented

**File:** `src/app/display/page.tsx:13-18`

**Issue:** The JSDoc comment explicitly describes three behaviours that do not exist in the implementation:

> - Countdown state (D-09): intercepted from useGameSync onEvent callback before fetchState() re-run. setInterval drives the 3→2→1 decrement…
> - CountdownOverlay renders ALONGSIDE the phase screen (z-layered), never as an early return so useGameSync updates flow through (Pitfall 7).

The countdown feature was removed in commit `c166757 feat(06): remove countdown feature — manual trigger had no purpose`. No `CountdownOverlay` component exists, no `onEvent` is passed to `useGameSync`, no `setInterval` appears in the file. The docstring is factually incorrect and will mislead the next developer, causing them to hunt for non-existent logic or—worse—believe the component already has countdown guard rails when it does not. This is a documentation correctness defect on a public-API surface (the shell that all six phase screens depend on).

**Fix:** Delete lines 13–18 from the docstring. Replace with an accurate description of what the file actually does:
```ts
 * Key responsibilities:
 *   - Fullscreen button (D-10): direct click handler calls
 *     containerRef.current.requestFullscreen(). fullscreenchange listener
 *     hides the button after entering fullscreen.
 *   - DisplayStatusDot is always visible (D-11, DISP-02).
```

---

### CR-03: Unhandled promise rejection from `requestFullscreen()` on iOS Safari / permission-denied

**File:** `src/app/display/page.tsx:106`

**Issue:**
```ts
onClick={() => containerRef.current?.requestFullscreen()}
```
`requestFullscreen()` returns a `Promise<void>` that rejects when:
- The browser does not support the Fullscreen API (iOS Safari < 16.4 — common on older wedding venue iPads/AppleTVs used as projector drivers)
- The document is cross-origin framed
- The user agent blocks fullscreen for policy reasons

An unhandled rejection becomes a global `unhandledrejection` event. In Next.js production this typically surfaces as a noisy console error but can also trigger error boundaries in some configurations. More practically, the `isFullscreen` state never becomes `true`, so the button stays visible — acceptable — but the rejected promise is silently swallowed rather than informing the operator.

**Fix:**
```ts
onClick={() => {
  containerRef.current?.requestFullscreen().catch(() => {
    // requestFullscreen not supported or denied — button stays visible; no crash.
  });
}}
```

---

## Warnings

### WR-01: When `correctOption` is null both option cards dim to opacity-40, hiding all content

**File:** `src/components/display/RevealDisplay.tsx:39-46`

**Issue:** The `isCorrect` flag is computed as:
```ts
const isCorrect = correctOption !== null && option === correctOption;
```
When `correctOption` is `null` (e.g. the state arrives in `revealed` phase before the DB write completes, or there is a fetch race), `isCorrect` is `false` for both A and B. The outer wrapper applies `"opacity-40"` when `!isCorrect`, so both cards dim simultaneously — the entire question becomes unreadable on the TV. The spec states the `revealed` phase should always have `correctOption` set, but defensive rendering for a brief null window is expected given the async fetch chain. The correct behaviour for `null` is to render both cards at full opacity (pre-reveal appearance).

**Fix:**
```ts
// Only dim when we actually know the correct answer and this isn't it.
const shouldDim = correctOption !== null && option !== correctOption;
// ...
<div className={cn(
  "flex flex-col gap-[1.5vh]",
  shouldDim && "opacity-40 transition-opacity duration-300"
)}>
```

---

### WR-02: `/display` route is completely unauthenticated — questions and distribution data are publicly visible

**File:** `src/app/display/page.tsx` (whole file), `src/app/api/game/state/route.ts`

**Issue:** There is no middleware protecting `/display`. Any person with the URL can open the display page before the event, observe the full question text, correct option (after reveal), distribution counts, and leaderboard. For a wedding game where "surprise questions" are part of the entertainment value, this is a meaningful information leak — a guest who loads `/display` on their phone before the game starts sees the same data the TV shows, including reveals.

The CLAUDE.md documents that `/admin` uses `sessionStorage`-based password auth (acknowledged as not production-grade). There is no equivalent mechanism for `/display`. The page is intentionally described as "public" in the CLAUDE.md stack patterns, but that decision should be a deliberate trade-off, not an omission.

**Fix (minimal):** Add a `middleware.ts` that requires a query-string token for `/display`, or add a mount-time password prompt consistent with the host dashboard pattern. At minimum, document explicitly in the component that public access is intentional, to avoid a future phase adding question spoilers that break this assumption.

---

### WR-03: `scale-150` on `LeaderboardPanel` clips content against the parent container's `overflow-hidden` ancestry

**File:** `src/components/display/RevealDisplay.tsx:170-172`, `src/components/display/WinnerDisplay.tsx:56-58`

**Issue:**
```tsx
<div className="transform scale-150 origin-top">
  <LeaderboardPanel leaderboard={state.leaderboard.slice(0, 5)} />
</div>
```
`scale-150` scales the visual output by 1.5× from the `origin-top` anchor. However, CSS `transform: scale()` does not reflow the document — the element still occupies its original layout footprint but visually overflows. If any ancestor has `overflow-hidden` (the root `<div>` in `DisplayPage` has `overflow-hidden` on line 96 of `page.tsx`), the scaled content is clipped on the right and bottom edges. On a 1920×1080 TV where `LeaderboardPanel` renders at `max-w-md` (~448 px) scaled to 672 px, the right 224 px of text overflows the 80vw container and gets clipped.

**Fix:** Replace the `scale-150` hack with explicit TV-scale typography directly in the leaderboard wrapper, or increase the container width before scaling:
```tsx
{/* Use explicit sizing instead of scale to avoid overflow clipping */}
<div className="w-full max-w-[80vw] mx-auto [&_h3]:text-[2.5vw] [&_.text-base]:text-[2vw] [&_.text-sm]:text-[1.5vw]">
  <LeaderboardPanel leaderboard={state.leaderboard.slice(0, 5)} />
</div>
```
Or if `scale` must be kept, remove `overflow-hidden` from the page root or wrap in an `overflow-visible` container with sufficient horizontal padding to absorb the scaled footprint.

---

### WR-04: Broadcast handler silently drops all errors from `fetchState()` — no status feedback on repeated failures

**File:** `src/hooks/useGameSync.ts:213-217`

**Issue:**
```ts
.on("broadcast", { event: "GAME_EVENT" }, async ({ payload }) => {
  const event = payload as GameEvent;
  onEventRef.current?.(event);
  await fetchState();
})
```
`fetchState()` swallows non-`ok` HTTP responses silently (it checks `res.ok` but takes no action when false — it simply returns without calling `setState`). The subscribe callback also never transitions `status` to `"error"` on repeated failed fetches. So if the `/api/game/state` endpoint is down, the TV display shows stale game state with a green "connected" dot, giving the host false confidence that the display is in sync. The same silent-drop behaviour exists in the `visibilitychange` handler.

**Fix:** Track consecutive fetch failures and reflect them in `status`:
```ts
const fetchState = async () => {
  const res = await fetch(`/api/game/state?gameId=${gameId}&playerId=${playerId}`);
  if (cancelled) return;
  if (res.ok) {
    const data: GameStateSnapshot = await res.json();
    if (cancelled) return;
    setState(data);
  } else {
    // Non-2xx from the state endpoint — signal degraded status so the dot goes amber
    setStatus("reconnecting");
  }
};
```

---

## Info

### IN-01: `LobbyDisplay` pulses on mount (participantCount=0) — unnecessary animation on initial render

**File:** `src/components/display/LobbyDisplay.tsx:30-34`

**Issue:**
```ts
useEffect(() => {
  setPulsing(true);
  const t = setTimeout(() => setPulsing(false), 600);
  return () => clearTimeout(t);
}, [participantCount]);
```
The effect runs on mount with the initial value (0), so the count pulses immediately on page load when nothing has changed. This is harmless but produces a visual artifact.

**Fix:** Add a mount-guard using `useRef`:
```ts
const mountedRef = useRef(false);
useEffect(() => {
  if (!mountedRef.current) { mountedRef.current = true; return; }
  setPulsing(true);
  const t = setTimeout(() => setPulsing(false), 600);
  return () => clearTimeout(t);
}, [participantCount]);
```

---

### IN-02: `QuestionDisplay` applies `slide-up` animation via arbitrary `[animation:...]` Tailwind class — not using the `@keyframes` utility name

**File:** `src/components/display/QuestionDisplay.tsx:83`

**Issue:**
```tsx
className="... [animation:slide-up_400ms_ease-out_forwards]"
```
`slide-up` is defined in `globals.css` as a `@keyframes` rule. The arbitrary property syntax works in Tailwind v4, but there is no `animate-slide-up` utility defined in the `@theme` block, so the `prefers-reduced-motion` override in `globals.css` (lines 90-93) does NOT apply to this animation. The reduced-motion block only overrides the `@keyframes slide-up` rule itself — which does suppress the motion — but the `animation` property is still applied (just with a no-op keyframe). On a TV set connected to a screen reader or assistive device the animation property may still fire the `animationstart`/`animationend` events. The behaviour is correct but fragile.

**Fix (minimal):** Define a utility in `globals.css`:
```css
.animate-slide-up {
  animation: slide-up 400ms ease-out forwards;
}
```
Then use `className="... animate-slide-up"` — the reduced-motion block already overrides `@keyframes slide-up` so the behaviour is automatically correct.

---

### IN-03: `HOST_SENTINEL_PLAYER_ID` used in `DisplayPage` causes a DB lookup for a player that will never match

**File:** `src/app/display/page.tsx:44-47`, `src/lib/host/constants.ts:27`

**Issue:** The TV display passes `HOST_SENTINEL_PLAYER_ID` as `playerId` to every `fetchState()` call. The server in `route.ts` (step 3) executes a Supabase query against the `answers` table filtering by `player_id = HOST_SENTINEL_PLAYER_ID`. This will always return 0 rows (correct) but wastes one DB round-trip per state fetch. On a 100-guest event with each guest triggering broadcasts, the display page performs `N × (1 answer query)` useless DB reads per game event. The constant is also imported from a host module (`@/lib/host/constants`) which is semantically odd for a display component.

**Fix (minimal):** Pass `null` or a distinct `DISPLAY_SENTINEL_PLAYER_ID` and short-circuit the answer query on the server:
```ts
// In route.ts step 3 — already guarded, just clarify the skip condition:
if (playerId && playerId !== HOST_SENTINEL_PLAYER_ID && game.current_question_id) {
```
Or define a `DISPLAY_PLAYER_ID = null` sentinel and pass it as an empty query param so the server skips step 3 entirely. Alternatively, the server's existing `if (playerId && ...)` guard already skips the query when `playerId` is the null sentinel — but the fetch URL still sends the UUID, which does exercise the `isValidUuid` check. Medium-priority: at 100 guests this is 100 extra queries per game event but not incorrect.

---

_Reviewed: 2026-06-05T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
