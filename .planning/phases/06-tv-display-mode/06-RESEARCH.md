# Phase 6: TV Display Mode - Research

**Researched:** 2026-06-05
**Domain:** Next.js 15 client component — anonymous Supabase Realtime subscriber, CSS-only animations, Fullscreen API, countdown overlay, host dashboard extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01** — Lobby screen: big game title centered, live "X jucători s-au alăturat" participant count, animated pulse on count. No player name list.

**D-02** — Question screen (phase = "question"): large question text, two option labels. No bars during voting.

**D-03** — Locked screen (phase = "locked"): question + options, A/B percentage bars appear and fill live. Updates from useGameSync re-fetches.

**D-04** — Revealed screen (phase = "revealed"): correct bar glows gold (box-shadow + border-gold-bright) and scales up slightly; wrong bar drops to 40% opacity. Top-5 leaderboard below.

**D-05** — After-reveal leaderboard: compact top-5 player list (rank + name + score). No scrolling needed.

**D-06** — Winner screen (phase = "ended"): full leaderboard, #1 in hero slot (larger text, text-gold-bright, trophy icon).

**D-07** — Phase 6 animation scope — functional transitions only: fade-in on mount, slide-up on question text, gold glow + scale on correct bar. CSS transitions or motion/react animate with simple values. No AnimatePresence, no staggered sequences.

**D-08** — Host triggers countdown from the dashboard — "Numărătoare inversă" button in Control tab. Calls POST /api/host/countdown which broadcasts COUNTDOWN_STARTED { gameId, seconds: 3 }.

**D-09** — Display countdown overlay: full-screen bg-ink/80 overlay, giant countdown number 3→2→1 (client-side setInterval), Playfair Display text-[20vw], gold text. Unmounts at 0. Does not block useGameSync.

**D-10** — JavaScript Fullscreen API button: "Ecran complet" top-right, calls document.requestFullscreen() on root container. Disappears after entering fullscreen. Baseline: min-h-dvh w-screen overflow-hidden.

**D-11** — Persistent connection dot indicator: fixed top-right. connected → green dot only; reconnecting → amber pulsing dot + "Reconectare..."; connecting → amber dot + "Se conectează..."; error → red dot + "Eroare". Driven by status from useGameSync.

### Claude's Discretion

None declared.

### Deferred Ideas (OUT OF SCOPE)

- Full cinematic animation polish (AnimatePresence, staggered reveals, fine timing) → Phase 7
- Performance validation (60fps audit, CPU throttle tests) → Phase 7
- Wedding aesthetic overhaul → Phase 7
- Any changes to the guest app or scoring logic

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISP-01 | Dedicated Display Mode route optimized for TV/projector (landscape, large typography, readable from afar) | New `src/app/display/page.tsx` client component; viewport-unit typography from 06-UI-SPEC.md verified in globals.css |
| DISP-02 | Display auto-syncs in real time with host actions, independent of host dashboard | `useGameSync(GAME_ID, HOST_SENTINEL_PLAYER_ID)` — anonymous subscriber with stable sentinel UUID; subscribe-then-fetch contract already proven in Phase 2 |
| DISP-03 | Display shows current question with animated transitions | CSS `@keyframes slide-up` on h2 with `key={questionId}` re-mount; conditional render on state.phase |
| DISP-04 | Display shows live A/B answer percentages | `state.distribution.A/B` from useGameSync re-fetch; `transition-[width] duration-500` on bar fill div |
| DISP-05 | Display shows correct-answer reveal with reveal effects | Conditional class on RevealDisplay mount: `border-gold-bright shadow-[0_0_40px_...] scale-[1.03]` for correct option; `opacity-40` for wrong |
| DISP-06 | Display shows the leaderboard | `LeaderboardPanel` from Phase 5 imported unmodified; `state.leaderboard.slice(0,5)` for after-reveal |
| DISP-07 | Display shows the winner screen at game end | WinnerDisplay component; `state.leaderboard[0]` for hero slot; Trophy icon from lucide-react |
| DISP-08 | Display supports host-initiated cosmetic countdown | POST /api/host/countdown → COUNTDOWN_STARTED broadcast → CountdownOverlay with client-side setInterval |
</phase_requirements>

---

## Summary

Phase 6 is a pure subscriber surface — it builds on the exact same `useGameSync` hook that powers both the guest app and host dashboard, using an anonymous sentinel UUID as the playerId (not `null` — see Critical Finding #1 below). The display page is structurally identical to the Phase 5 GuestShell: one `useGameSync` call at the top of a client component, a `switch` on `state.phase`, and screen components that receive state as props.

The one architectural novelty is the COUNTDOWN_STARTED event routing. Because `useGameSync` discards event payloads and only calls `fetchState()` on every broadcast, the display page must intercept the raw event type before the re-fetch. The research identifies the exact mechanism: the broadcast handler in useGameSync currently voids the payload — the display needs a callback or Zustand atom to surface the event type from inside the hook. The UI-SPEC explicitly defers this to the planner; the research confirms the concrete implementation options and their tradeoffs.

The countdown button is a clean addition to ControlTab — a new "Section D: Ecran TV" glass card between the phase control buttons (Section B) and EmergencyPanel. It uses its own `countdownInFlight` boolean (separate from the `inFlight: string | null` pattern) because it is fire-and-forget with no Broadcast confirmation. The API route follows the transition/route.ts pattern exactly.

No new npm packages are needed. All functionality uses existing project dependencies already audited in Phase 5.

**Primary recommendation:** Create `src/app/display/page.tsx` as a `"use client"` component calling `useGameSync(GAME_ID, HOST_SENTINEL_PLAYER_ID)`. Add a `onCountdown` callback to useGameSync OR intercept COUNTDOWN_STARTED via a Zustand atom in the display page (Zustand is already installed). Build 8 new display components under `src/components/display/`. Add POST /api/host/countdown following the transition route pattern. Add Section D to ControlTab.tsx.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Real-time game state sync | Client (browser) | API / Backend (GET /api/game/state) | useGameSync subscribes to Supabase Broadcast on the client; authoritative re-fetch to backend on every event |
| Phase screen rendering | Browser / Client | — | All display screens are pure client components receiving state as props from the single useGameSync call |
| Countdown overlay | Browser / Client | API / Backend | Client-side setInterval drives the countdown number; backend only fires the initial COUNTDOWN_STARTED broadcast |
| Countdown trigger | API / Backend | — | POST /api/host/countdown validates host auth and broadcasts the event; no DB write needed |
| Fullscreen API | Browser / Client | — | document.requestFullscreen() — browser-native, requires user gesture, called only in the client component |
| Connection status display | Browser / Client | — | Derived from SyncStatus enum returned by useGameSync |
| A/B percentage bars | Browser / Client | — | state.distribution from useGameSync re-fetch; CSS transition-[width] for animation |
| Leaderboard rendering | Browser / Client | — | LeaderboardPanel is a pure display component; data comes from state.leaderboard |

---

## Critical Findings

### Finding 1: useGameSync Does NOT Accept null playerId [VERIFIED: codebase]

**The hook signature is `useGameSync(gameId: string, playerId: string)`** — TypeScript strict mode requires a `string`. Passing `null` will cause a TypeScript compilation error.

The display page MUST use `HOST_SENTINEL_PLAYER_ID` (already exported from `src/lib/host/constants.ts`):

```typescript
// CORRECT — matches host dashboard pattern
useGameSync(GAME_ID, HOST_SENTINEL_PLAYER_ID)

// WRONG — TypeScript error in strict mode
useGameSync(GAME_ID, null)  // TS2345: Argument of type 'null' is not assignable to parameter of type 'string'
```

`HOST_SENTINEL_PLAYER_ID = "00000000-0000-4000-8000-000000000000"` — a valid UUID v4 shape that passes the server-side UUID_REGEX, never matches a real player, so `state.myAnswer` is always `null` (correct for a display observer that does not answer questions).

The display page's `useGameSync` call is functionally identical to the host dashboard's call. The display diverges only in what it renders on top of the state.

**Impact:** The 06-CONTEXT.md and 06-UI-SPEC.md both reference `useGameSync(GAME_ID, null)` as the intended call. This is incorrect TypeScript. The planner MUST use `HOST_SENTINEL_PLAYER_ID` instead. No hook changes needed.

### Finding 2: COUNTDOWN_STARTED Event Routing Requires Explicit Design [VERIFIED: codebase]

The broadcast handler in `useGameSync` currently reads:

```typescript
.on("broadcast", { event: "GAME_EVENT" }, async ({ payload }) => {
  const _event = payload as GameEvent;
  void _event; // intentionally unused — triggers re-fetch only
  await fetchState();
})
```

The event type is cast then discarded. `fetchState()` does not return a COUNTDOWN_STARTED in the `GameStateSnapshot` — it is a transient signal, not a persistent state value.

**The display page needs to intercept the event type BEFORE the payload is discarded.** Three concrete options with tradeoffs:

**Option A: Extend useGameSync to accept an optional onEvent callback** (RECOMMENDED)

```typescript
// Hook signature change:
export function useGameSync(
  gameId: string,
  playerId: string,
  options?: { onEvent?: (event: GameEvent) => void }
)

// In broadcast handler:
.on("broadcast", { event: "GAME_EVENT" }, async ({ payload }) => {
  const event = payload as GameEvent;
  options?.onEvent?.(event);  // fire callback BEFORE re-fetch
  await fetchState();
})

// Display page usage:
const [countdown, setCountdown] = useState<number | null>(null);
useGameSync(GAME_ID, HOST_SENTINEL_PLAYER_ID, {
  onEvent: (event) => {
    if (event.type === "COUNTDOWN_STARTED") {
      setCountdown(event.seconds);
    }
  }
});
```

Pros: Clean, typed, no new dependency. Callback is optional — all existing callers (host, guest) are unaffected.
Cons: Modifies the existing Phase 2 hook. Must be done carefully to avoid breaking existing consumers.

**Option B: Zustand atom as one-shot trigger (Zustand already installed)**

```typescript
// A Zustand store for transient display events:
type DisplayEventStore = {
  pendingCountdown: number | null;
  triggerCountdown: (seconds: number) => void;
  clearCountdown: () => void;
};

// Inside useGameSync broadcast handler (or via a parallel channel subscription in the display page):
// The display page subscribes to the SAME channel independently just for COUNTDOWN_STARTED events
```

Pros: No hook change. Cons: Requires a parallel channel subscription on the same topic, which triggers the SDK's topic-dedup exception handling path (the `try/catch` in useGameSync for shared channels). More complexity.

**Option C: Separate useEffect in display page that subscribes to channel events via Supabase client**

The display page could open a secondary `on("broadcast")` listener on the same channel for COUNTDOWN_STARTED only, while useGameSync handles game state. The SDK dedup path (the `try/catch` in useGameSync) handles this — the secondary subscription gets the broadcast handler attached but falls into the catch path for presence.

Pros: Completely isolated from useGameSync. Cons: Most complex, interacts with the StrictMode guard.

**Recommendation:** Option A — add optional `onEvent` callback to useGameSync. It is the cleanest, most explicit, and the least risky. The existing hook consumers (host page passes `HOST_SENTINEL_PLAYER_ID`, guest page passes real playerId) simply don't pass the third argument, so they are completely unaffected.

### Finding 3: ControlTab In-Flight Pattern Requires Separate Boolean for Countdown [VERIFIED: codebase]

The existing `inFlight: string | null` pattern in ControlTab re-enables ONLY in `useEffect([state?.phase])` — it waits for a Broadcast-confirmed phase change. The countdown button broadcasts `COUNTDOWN_STARTED` which does NOT change `state.phase`, so the phase-change effect would never fire and `inFlight` would never clear.

The countdown button MUST use its own `countdownInFlight: boolean` state that clears on a fixed timeout (2 seconds as specified in 06-UI-SPEC.md), independent of the `inFlight` game-state guard.

```typescript
// In ControlTab — separate from inFlight
const [countdownInFlight, setCountdownInFlight] = useState(false);

async function handleCountdown() {
  if (countdownInFlight || anyInFlight) return;
  setCountdownInFlight(true);
  try {
    await hostFetch("/api/host/countdown", password, {
      method: "POST",
      body: JSON.stringify({ gameId, seconds: 3 }),
    });
  } catch { /* silent — cosmetic broadcast */ }
  // 2-second timeout regardless of success/failure
  setTimeout(() => setCountdownInFlight(false), 2000);
}
```

The button is also disabled when `anyInFlight` is true (a game-state action is in flight) to prevent a cosmetic broadcast during a state transition.

### Finding 4: CSS Custom Keyframes Not Yet Defined in globals.css [VERIFIED: codebase]

The current `globals.css` defines the `@theme` block, `.glass`, `.glass-gold`, and `.thin-divider` utilities. It does NOT yet define `@keyframes slide-up` or `@keyframes fade-scale` — these are new additions required by Phase 6.

The planner must include a task to add these keyframes to `globals.css` as part of Phase 6 Wave 0 or Wave 1:

```css
@keyframes slide-up {
  from { opacity: 0; transform: translateY(2vh); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fade-scale {
  from { opacity: 0.4; transform: scale(0.8); }
  to   { opacity: 1;   transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  @keyframes slide-up  { from { opacity: 1; transform: none; } to { opacity: 1; transform: none; } }
  @keyframes fade-scale { from { opacity: 1; transform: none; } to { opacity: 1; transform: none; } }
}
```

### Finding 5: LeaderboardPanel Uses px/rem Typography — Will Render Small on TV [VERIFIED: codebase]

`LeaderboardPanel.tsx` uses fixed `text-base`, `text-sm`, and `text-xs` classes — mobile-oriented sizes that will render at approximately 16px, 14px, and 12px on a 1920px TV display. This is readable but smaller than the rest of the display surface which uses viewport-relative units.

The 06-UI-SPEC.md acknowledges this: "If the text is too small in practice, the planner should wrap the LeaderboardPanel in a scaling container (`transform: scale(...)`) or create a `DisplayLeaderboardPanel` variant."

**Recommendation:** The planner should wrap `<LeaderboardPanel>` in a `div` with a scaling transform for the display route. A `transform: scale(1.5)` with `transform-origin: top center` and corresponding width reduction will scale the panel proportionally without changing the component:

```typescript
// In RevealDisplay.tsx and WinnerDisplay.tsx:
<div className="w-full max-w-[80vw] mx-auto mt-[4vh] transform scale-150 origin-top">
  <LeaderboardPanel leaderboard={state.leaderboard.slice(0, 5)} />
</div>
```

Alternatively, create `DisplayLeaderboardPanel.tsx` mirroring the same logic but with `text-[2vw]` sizes per the UI-SPEC typography table. The planner decides; both approaches work.

---

## Standard Stack

### Core (No New Packages — Phase 6 Uses Existing Dependencies)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Next.js | 15.3.x | App Router, client components, route handlers | Already installed |
| React | 19.x | UI rendering, useState, useEffect, useRef | Already installed |
| TypeScript | 5.9.x (strict) | Type safety | Already installed |
| Tailwind CSS | 4.3.x | Styling, transition-[width], animate-pulse | Already installed |
| @supabase/supabase-js | 2.106.x | Supabase client (via useGameSync) | Already installed |
| motion (motion/react) | 12.40.x | Available but NOT used in Phase 6 (D-07: CSS only) | Already installed |
| lucide-react | latest | Trophy icon in WinnerDisplay | Already installed |
| clsx + tailwind-merge | latest | `cn()` utility | Already installed |

### No New npm Packages Required

The 06-UI-SPEC.md explicitly confirms: "No new third-party registries or npm packages are introduced in Phase 6. All functionality uses existing project dependencies." [VERIFIED: 06-UI-SPEC.md §Registry Safety]

**Installation:** None required.

---

## Package Legitimacy Audit

No new packages installed in Phase 6. This section is not applicable.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Host Dashboard (ControlTab)
  └── [Section D: Numărătoare inversă button]
        └── POST /api/host/countdown
              └── broadcast(game:{gameId}, GAME_EVENT, COUNTDOWN_STARTED{seconds:3})
                    │
                    ▼
              Supabase Realtime Channel (game:{gameId})
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
   useGameSync (guest)   useGameSync (display)
   (playerId = uuid)     (playerId = HOST_SENTINEL)
          │                    │
          │              onEvent(COUNTDOWN_STARTED) → setCountdown(3)
          │                    │
          │              fetchState() → GET /api/game/state
          │                    │
          │              GameStateSnapshot → switch(state.phase)
          │                    │
          │         ┌──────────┴─────────────────────────┐
          │         │          │            │             │
          │    LobbyDisplay  QuestionDisplay  LockedDisplay  RevealDisplay  WinnerDisplay
          │                                              
          │              CountdownOverlay (z-40 above screen)
          │              setInterval(1s) 3→2→1→unmount
```

### Recommended Project Structure

```
src/
├── app/
│   ├── display/
│   │   └── page.tsx                     ← DisplayPage ("use client") — shell + phase switch
│   └── api/
│       └── host/
│           └── countdown/
│               └── route.ts             ← POST /api/host/countdown
├── components/
│   ├── display/
│   │   ├── LobbyDisplay.tsx
│   │   ├── QuestionDisplay.tsx
│   │   ├── LockedDisplay.tsx
│   │   ├── RevealDisplay.tsx
│   │   ├── WinnerDisplay.tsx
│   │   ├── LoadingDisplay.tsx
│   │   ├── DisplayStatusDot.tsx
│   │   └── CountdownOverlay.tsx
│   ├── guest/
│   │   └── LeaderboardPanel.tsx         ← imported as-is (no changes)
│   └── host/
│       └── ControlTab.tsx               ← modified: Section D countdown button
└── hooks/
    └── useGameSync.ts                   ← modified: optional onEvent callback (Option A)
```

### Pattern 1: Display Shell (Anonymous Subscriber)

The DisplayPage follows the exact same shell pattern as the host DashboardShell and guest GameView — single `useGameSync` call, props-down to screen components:

```typescript
// Source: src/app/host/page.tsx (DashboardShell) + src/app/page.tsx (GameView)
"use client";

import { useState, useRef, useEffect } from "react";
import { useGameSync } from "@/hooks/useGameSync";
import { GAME_ID, HOST_SENTINEL_PLAYER_ID } from "@/lib/host/constants";

export default function DisplayPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const { state, status, participantCount } = useGameSync(
    GAME_ID,
    HOST_SENTINEL_PLAYER_ID,
    {
      onEvent: (event) => {
        if (event.type === "COUNTDOWN_STARTED") {
          setCountdown(event.seconds);
        }
      }
    }
  );

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Countdown setInterval — clears when countdown reaches 0
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const t = setInterval(() => {
      setCountdown((c) => (c !== null && c > 1 ? c - 1 : null));
    }, 1000);
    return () => clearInterval(t);
  }, [countdown]);

  // ... phase switch + overlay render
}
```

### Pattern 2: POST /api/host/countdown Route

Follows the transition/route.ts pattern — validateHostAuth first, then broadcast. No DB write needed (COUNTDOWN_STARTED is a purely cosmetic signal):

```typescript
// Source: src/app/api/host/transition/route.ts (pattern)
import { NextRequest, NextResponse } from "next/server";
import { broadcast } from "@/lib/supabase/admin";
import { validateHostAuth } from "@/lib/auth/host";
import type { GameEvent } from "@/lib/realtime/events";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!validateHostAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { gameId, seconds } = body as Record<string, unknown>;

  if (typeof gameId !== "string" || typeof seconds !== "number") {
    return NextResponse.json({ error: "gameId and seconds required" }, { status: 400 });
  }

  try {
    await broadcast(`game:${gameId}`, "GAME_EVENT", {
      type: "COUNTDOWN_STARTED",
      gameId,
      seconds,
    } satisfies GameEvent as Record<string, unknown>);
  } catch (err) {
    console.error("[countdown] broadcast failed:", err);
    // Best-effort — still return 200 (cosmetic signal, not a DB mutation)
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
```

### Pattern 3: CSS Keyframe Animation via key Re-Mount

The slide-up animation on question text and the tick animation on countdown numbers both use the same pattern — define the animation in `globals.css`, apply via a Tailwind arbitrary `[animation:...]` class, and re-trigger by changing the React `key`:

```typescript
// Source: 06-UI-SPEC.md §QuestionDisplay
// The h2 gets key={state.currentQuestionId} so React re-mounts it on every question change
// The CSS animation runs on every mount (forwards fill preserves final state)
<h2
  key={state.currentQuestionId}
  className="text-[6vw] font-bold font-heading text-champagne leading-snug max-w-[80vw]
             [animation:slide-up_400ms_ease-out_forwards]"
>
  {state.currentQuestion.text}
</h2>

// Countdown number — key={countdown} re-mounts on each tick
<span
  key={countdown}
  className="text-[20vw] font-bold font-heading text-gold-bright leading-none select-none
             [animation:fade-scale_200ms_ease-out]"
>
  {countdown}
</span>
```

### Pattern 4: Live Bar Fill (transition-[width])

The A/B percentage bars in LockedDisplay and RevealDisplay use CSS `transition-[width]` — this is a layout-triggering property (not compositor-only), but it is acceptable here because: (1) the display surface has no mobile perf budget, and (2) Phase 7 can upgrade to `transform: scaleX()` if needed:

```typescript
// Source: 06-UI-SPEC.md §LockedDisplay
<div className="flex-1 h-[1.5vh] rounded-full bg-ink-muted overflow-hidden">
  <div
    className="h-full rounded-full bg-gold transition-[width] duration-500 ease-out"
    style={{ width: `${pct}%` }}
  />
</div>
```

### Pattern 5: Countdown setInterval Cleanup

Canonical React pattern for a client-side countdown — `setInterval` inside `useEffect`, cleared via the cleanup return. The key insight: the effect re-runs only when `countdown` changes, and the interval callback uses the functional updater form to avoid stale closure capture:

```typescript
// Source: 06-UI-SPEC.md §CountdownOverlay + React docs on setInterval
const [countdown, setCountdown] = useState<number | null>(null);

useEffect(() => {
  if (countdown === null || countdown <= 0) return;
  const t = setInterval(() => {
    setCountdown((c) => (c !== null && c > 1 ? c - 1 : null));
    // When c reaches 1: next tick sets to null → useEffect cleanup clears interval
  }, 1000);
  return () => clearInterval(t); // cleanup on re-run or unmount
}, [countdown]); // re-run when countdown changes (from 3 to 2, etc.)
```

**Critical:** `setCountdown((c) => ...)` uses the functional updater form — this avoids capturing the stale `countdown` value from the closure at effect creation time. Without this, the interval would always read the initial `countdown` value (3) and never decrement.

### Pattern 6: Participant Count Pulse on Change

The lobby pulse is a `useEffect` that toggles `pulsing` state for 600ms when `participantCount` changes. This is a one-shot `setTimeout`, not a continuous `animate-pulse`:

```typescript
// Source: 06-UI-SPEC.md §LobbyDisplay
const [pulsing, setPulsing] = useState(false);
useEffect(() => {
  setPulsing(true);
  const t = setTimeout(() => setPulsing(false), 600);
  return () => clearTimeout(t);
}, [participantCount]);

// Applied as: cn("text-[4vw] ...", pulsing && "animate-pulse")
```

### Anti-Patterns to Avoid

- **Calling useGameSync with playerId = null:** TypeScript strict mode rejects `null`. Use `HOST_SENTINEL_PLAYER_ID`. [VERIFIED: codebase — hook signature is `string`, not `string | null`]
- **Using `inFlight` for countdown button:** The existing `inFlight: string | null` re-enables only on `state?.phase` change. `COUNTDOWN_STARTED` does not change the phase. Use a separate `countdownInFlight: boolean` with a setTimeout. [VERIFIED: codebase — ControlTab.tsx lines 152-158]
- **Reading COUNTDOWN_STARTED from GameStateSnapshot:** The event is transient — it does not appear in `state`. It must be captured via the onEvent callback (or equivalent) before `fetchState()` overwrites the hook state.
- **Using `document.requestFullscreen()` outside a user gesture:** Will fail silently (DOMException). The fullscreen button must be in direct response to a click event — not called from a `useEffect`. [ASSUMED — browser security policy]
- **Using `setInterval` without cleanup:** Always return `() => clearInterval(t)` from the useEffect. Without cleanup, the interval survives component unmount on React 19 StrictMode's double-mount and keeps firing. [VERIFIED: codebase — useGameSync cleanup pattern established]
- **`min-h-screen` instead of `min-h-dvh`:** The Phase 5 pattern (already in GuestShell and LobbyScreen) uses `min-h-dvh` to handle iOS Safari viewport bugs. Use it consistently on the display route even though it targets a laptop browser (future-proof + consistent with project style).
- **Importing canvas-confetti in display components:** Per 06-UI-SPEC.md §WinnerDisplay, no confetti on the TV display — that is a guest-side effect only. Do not add canvas-confetti to any display component.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Realtime subscription + reconnect | Custom WebSocket handler | `useGameSync(GAME_ID, HOST_SENTINEL_PLAYER_ID)` | Full reconnect resilience, iOS visibilitychange, subscribe-then-fetch — all already proven in Phases 2-5 |
| Leaderboard UI | New ranked list component | `LeaderboardPanel` from `src/components/guest/` | Already built and tested; import unmodified |
| Host auth validation on new route | Custom auth check | `validateHostAuth(req)` from `@/lib/auth/host` | Already used by all 4 host routes; consistent security boundary |
| Broadcast from route handler | Custom WebSocket server | `broadcast()` from `@/lib/supabase/admin` | Stateless HTTP POST to Supabase REST Broadcast API — proven across Phase 3-4 routes |
| Tailwind class merging | Custom classname concat | `cn()` from `@/lib/utils` | Already in project; handles conditional class merging without conflicts |
| Design tokens | Ad-hoc hex colors | `@theme` tokens from `globals.css` | `ink`, `champagne`, `gold`, `gold-bright`, `sage`, `.glass`, `.glass-gold` already defined |

**Key insight:** Phase 6 is almost entirely composition of prior phase primitives. The only genuinely new code is the display screen layout and the countdown API endpoint — everything else is reuse.

---

## Common Pitfalls

### Pitfall 1: TypeScript Rejects null playerId
**What goes wrong:** Passing `null` as the second argument to `useGameSync` causes a TS2345 compilation error under strict mode. The build fails.
**Why it happens:** The hook's type signature is `(gameId: string, playerId: string)` — not `string | null`. This was intentional in Phase 2 (anonymous hosts use a sentinel, not null).
**How to avoid:** Always use `HOST_SENTINEL_PLAYER_ID` for anonymous subscribers (display, host). Never pass null.
**Warning signs:** TypeScript error in `src/app/display/page.tsx` during dev.

### Pitfall 2: COUNTDOWN_STARTED Never Surfaces Without Hook Extension
**What goes wrong:** The display page renders correctly but the countdown overlay never appears, even when the host clicks "Numărătoare inversă".
**Why it happens:** The broadcast handler in `useGameSync` casts the payload to `GameEvent` and then explicitly discards it (`void _event`). `fetchState()` is called but `GameStateSnapshot` has no `countdownSeconds` field — COUNTDOWN_STARTED is a transient signal that has no representation in DB state.
**How to avoid:** Implement the `onEvent` callback extension to useGameSync (Option A). Verify the callback fires before `fetchState()` in the broadcast handler.
**Warning signs:** Host API call returns 200, Supabase Broadcast succeeds in logs, but display shows no overlay.

### Pitfall 3: Countdown setInterval Stale Closure
**What goes wrong:** The countdown sticks at 3 (or the initial value) and never decrements; OR it decrements too fast (multiple intervals running simultaneously).
**Why it happens:** (a) Using `setCountdown(countdown - 1)` captures the stale `countdown` value from the closure, not the current value. (b) Without proper dependency array, the effect runs on every render and spawns multiple intervals.
**How to avoid:** Always use the functional updater form: `setCountdown((c) => c !== null && c > 1 ? c - 1 : null)`. Keep `[countdown]` in the dependency array so the interval is recreated on each tick.
**Warning signs:** Countdown jumps multiple steps at once, or freezes at 3.

### Pitfall 4: Fullscreen API on Element vs. Document
**What goes wrong:** Fullscreen request works but the display area doesn't fill the screen (shows the page title bar area); or `document.fullscreenElement` is always null.
**Why it happens:** Calling `document.documentElement.requestFullscreen()` instead of `containerRef.current.requestFullscreen()`. The display route wants the specific root `<div>` to go fullscreen.
**How to avoid:** Store a `ref` on the outermost `<div>` of the display page. Call `containerRef.current?.requestFullscreen()`. Check `document.fullscreenElement !== null` (not `=== containerRef.current`) for the button visibility state.
**Warning signs:** Fullscreen button stays visible even after clicking, or fullscreen shows a white background area outside the display.

### Pitfall 5: Reveal Effect Classes Applied Too Late
**What goes wrong:** The gold glow and scale on the correct bar never appear (bars look the same as in locked phase).
**Why it happens:** Applying the reveal classes inside a `useEffect` with a state update introduces a render cycle delay. The reveal is a per-render conditional (the component mounts with `state.phase === "revealed"` already set) — no `useEffect` needed.
**How to avoid:** Apply the reveal classes directly in the JSX conditionally: `className={cn("...", state.correctOption === "A" && "border-gold-bright shadow-[...] scale-[1.03]")}`. The `transition-transform duration-300` makes the class application smooth.
**Warning signs:** Bars look identical on revealed and locked screens.

### Pitfall 6: LeaderboardPanel Text Too Small on TV
**What goes wrong:** After-reveal leaderboard and winner screen show player names in 12-16px text — unreadable from 3-4 metres.
**Why it happens:** `LeaderboardPanel` uses `text-sm` / `text-base` (14px/16px) from the mobile-first guest app context.
**How to avoid:** Wrap the component in a `transform scale-[1.5] origin-top` container, or create a `DisplayLeaderboardPanel` variant with `text-[2vw]` sizes. The UI-SPEC acknowledges this explicitly.
**Warning signs:** Leaderboard entries are barely readable on a live TV preview.

### Pitfall 7: CountdownOverlay Blocks useGameSync Updates
**What goes wrong:** While the countdown is showing, the underlying phase screen freezes — when the host advances the phase during the countdown, the screen behind the overlay doesn't update.
**Why it happens:** Rendering the overlay conditionally with early return: `if (countdown) return <CountdownOverlay />` stops the phase switch from rendering.
**How to avoid:** Render the overlay ABOVE the phase content using absolute positioning and `z-index`, never instead of it: `{countdown !== null && <CountdownOverlay ... />}` rendered alongside the phase screen, not replacing it.
**Warning signs:** Phase screen shows old content after countdown ends.

---

## Code Examples

### DisplayPage Shell (complete skeleton)

```typescript
// Source: derived from src/app/host/page.tsx + src/app/page.tsx + 06-UI-SPEC.md
"use client";

import { useState, useRef, useEffect } from "react";
import { useGameSync } from "@/hooks/useGameSync";
import { GAME_ID, HOST_SENTINEL_PLAYER_ID } from "@/lib/host/constants";
import { LobbyDisplay } from "@/components/display/LobbyDisplay";
import { QuestionDisplay } from "@/components/display/QuestionDisplay";
import { LockedDisplay } from "@/components/display/LockedDisplay";
import { RevealDisplay } from "@/components/display/RevealDisplay";
import { WinnerDisplay } from "@/components/display/WinnerDisplay";
import { LoadingDisplay } from "@/components/display/LoadingDisplay";
import { DisplayStatusDot } from "@/components/display/DisplayStatusDot";
import { CountdownOverlay } from "@/components/display/CountdownOverlay";

export default function DisplayPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const { state, status, participantCount } = useGameSync(
    GAME_ID,
    HOST_SENTINEL_PLAYER_ID,
    {
      onEvent: (event) => {
        if (event.type === "COUNTDOWN_STARTED") {
          setCountdown(event.seconds);
        }
      },
    }
  );

  // Fullscreen change detection
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Countdown interval — functional updater prevents stale closure
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const t = setInterval(() => {
      setCountdown((c) => (c !== null && c > 1 ? c - 1 : null));
    }, 1000);
    return () => clearInterval(t);
  }, [countdown]);

  // Phase screen render
  let screen: React.ReactNode;
  if (!state) {
    screen = <LoadingDisplay />;
  } else {
    switch (state.phase) {
      case "lobby":    screen = <LobbyDisplay participantCount={participantCount} />; break;
      case "question": screen = <QuestionDisplay state={state} />; break;
      case "locked":   screen = <LockedDisplay state={state} />; break;
      case "revealed": screen = <RevealDisplay state={state} />; break;
      case "ended":    screen = <WinnerDisplay state={state} />; break;
      default: {
        const _: never = state.phase;
        void _;
        screen = <LoadingDisplay />;
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative min-h-dvh w-screen overflow-hidden bg-ink"
    >
      {/* Persistent connection dot — fixed, always visible */}
      <DisplayStatusDot status={status} />

      {/* Fullscreen button — hidden after entering fullscreen */}
      {!isFullscreen && (
        <button
          type="button"
          onClick={() => containerRef.current?.requestFullscreen()}
          className="fixed top-4 right-4 z-50 glass rounded-lg px-4 py-2
                     text-[1.5vw] font-body text-champagne-dim
                     hover:text-champagne transition-opacity duration-300"
          aria-label="Activează ecran complet"
        >
          Ecran complet
        </button>
      )}

      {/* Countdown overlay — z-40, above screen content, below fullscreen button */}
      {countdown !== null && (
        <CountdownOverlay countdown={countdown} />
      )}

      {/* Phase screen — always rendered, overlay sits on top */}
      {screen}
    </div>
  );
}
```

### useGameSync onEvent Extension

```typescript
// Source: src/hooks/useGameSync.ts — minimal change to add optional callback
// Add to function signature:
export function useGameSync(
  gameId: string,
  playerId: string,
  options?: { onEvent?: (event: GameEvent) => void }
)

// In broadcast handler (line ~180 in current useGameSync.ts):
.on("broadcast", { event: "GAME_EVENT" }, async ({ payload }) => {
  const event = payload as GameEvent;
  options?.onEvent?.(event);  // fire callback BEFORE re-fetch
  await fetchState();
})
```

### CountdownOverlay Component

```typescript
// Source: 06-UI-SPEC.md §CountdownOverlay
"use client";

export function CountdownOverlay({ countdown }: { countdown: number }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center
                    bg-ink/80 backdrop-blur-sm">
      <span
        key={countdown}
        className="text-[20vw] font-bold font-heading text-gold-bright
                   leading-none select-none
                   [animation:fade-scale_200ms_ease-out]"
      >
        {countdown}
      </span>
    </div>
  );
}
```

### DisplayStatusDot Component

```typescript
// Source: 06-UI-SPEC.md §DisplayStatusDot
"use client";

import { cn } from "@/lib/utils";
import type { SyncStatus } from "@/hooks/useGameSync";

export function DisplayStatusDot({ status }: { status: SyncStatus }) {
  const label = {
    connected: null,
    connecting: "Se conectează...",
    reconnecting: "Reconectare...",
    error: "Eroare",
  }[status];

  return (
    <div
      className="fixed top-[calc(3.5rem+0.5rem)] right-4 z-50 flex items-center gap-[0.5vw]"
      role="status"
      aria-live="polite"
    >
      <div className={cn(
        "w-[0.8vw] h-[0.8vw] min-w-[8px] min-h-[8px] rounded-full",
        status === "connected"    && "bg-sage",
        status === "connecting"   && "bg-gold",
        status === "reconnecting" && "bg-gold animate-pulse",
        status === "error"        && "bg-red-500"
      )} />
      {label && (
        <span className={cn(
          "text-[1.5vw] font-normal font-body",
          status === "connecting"   && "text-champagne-dim",
          status === "reconnecting" && "text-gold",
          status === "error"        && "text-red-400"
        )}>
          {label}
        </span>
      )}
    </div>
  );
}
```

### Reveal Bar Conditional Classes (RevealDisplay)

```typescript
// Source: 06-UI-SPEC.md §RevealDisplay
// Applied as a conditional in the JSX render — no useEffect needed
function OptionWithBar({
  option,
  text,
  pct,
  correctOption,
}: {
  option: "A" | "B";
  text: string;
  pct: number;
  correctOption: "A" | "B";
}) {
  const isCorrect = option === correctOption;
  return (
    <div className={cn("flex flex-col gap-[1.5vh]", !isCorrect && "opacity-40 transition-opacity duration-300")}>
      <div className={cn(
        "rounded-2xl flex flex-col items-center justify-center gap-[1.5vh] px-[4vw] py-[3vh] min-h-[18vh]",
        isCorrect
          ? "glass-gold border-2 border-gold-bright shadow-[0_0_40px_0_rgba(240,192,96,0.45)] scale-[1.03] transition-transform duration-300"
          : "glass"
      )}>
        {/* ... option content */}
      </div>
      <div className="flex items-center gap-[1.5vw]">
        <div className="flex-1 h-[1.5vh] rounded-full bg-ink-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-out",
              isCorrect ? "bg-gold-bright" : "bg-gold"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[2vw] font-bold font-body text-champagne w-[5vw] text-right shrink-0">
          {pct}%
        </span>
      </div>
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Anonymous subscriber passes `null` playerId | Anonymous subscriber passes `HOST_SENTINEL_PLAYER_ID` | TypeScript compatibility + consistent with host dashboard pattern |
| framer-motion import | import from `motion/react` | Not used in Phase 6 (D-07); Phase 7 will use it |
| tailwindcss-animate | Native CSS animations via @keyframes | Phase 6 uses only `globals.css` keyframes + Tailwind animate-pulse |
| Per-subscriber Postgres Changes | Supabase Broadcast (single channel) | Phase 2 locked this — no `postgres_changes` subscriptions anywhere |

**Deprecated/outdated:**
- `framer-motion` package name: replaced by `motion` (already using `motion` in project)
- `@supabase/auth-helpers-nextjs`: replaced by `@supabase/ssr` (already using `@supabase/ssr` in project)
- `tailwindcss-animate`: deprecated March 2025 in shadcn/ui; project uses native CSS animations

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `document.requestFullscreen()` works on Chrome/Edge (laptop browsers targeting TV); behavior on Safari may differ slightly | Pitfall 4, Pattern 1 | Fallback: button stays visible on Safari; display still works via CSS `min-h-dvh w-screen` without fullscreen |
| A2 | `document.fullscreenElement !== null` check is the correct way to detect fullscreen state (vs. other fullscreen APIs) | Pattern 1 | Very low risk — this is the standard W3C Fullscreen API |

**If this table is empty:** All other claims in this research were verified against the codebase or existing project documents.

---

## Open Questions

1. **useGameSync onEvent callback — exact diff location**
   - What we know: The broadcast handler is in `useGameSync.ts` around line 180; the callback needs to fire before `fetchState()`.
   - What's unclear: Whether to add `options` as a third argument or use a separate `useEffect` with a Zustand atom in the display page only (Option B) to avoid modifying the Phase 2 hook.
   - Recommendation: Option A (add optional callback) — it is cleanest, all existing callers pass no third argument and are unaffected. One-line hook change plus the display page usage.

2. **LeaderboardPanel scaling approach**
   - What we know: The component uses px/rem text sizes; it will render small on TV.
   - What's unclear: Whether `transform: scale()` wrapper is sufficient or a `DisplayLeaderboardPanel` with viewport units is needed for the wedding day.
   - Recommendation: Start with the scale wrapper (`scale-[1.5]`) — zero risk, zero new components. If it looks off during testing, create `DisplayLeaderboardPanel.tsx`.

---

## Environment Availability

The display route requires no additional tools beyond what is already installed. No new Supabase tables, no new RLS policies, no migration.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase Realtime (Broadcast) | useGameSync + countdown API | ✓ | via @supabase/supabase-js 2.106.x | — |
| lucide-react Trophy icon | WinnerDisplay | ✓ | already installed | Use text emoji "🏆" as fallback |
| HOST_SENTINEL_PLAYER_ID | DisplayPage | ✓ | already exported from constants.ts | — |
| `broadcast()` helper | /api/host/countdown | ✓ | already in src/lib/supabase/admin.ts | — |
| `validateHostAuth()` | /api/host/countdown | ✓ | already in src/lib/auth/host.ts | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

Framework: none — `"No test framework is configured."` per CLAUDE.md.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISP-01 | `/display` route renders landscape layout | smoke (manual) | `npm run build` exits 0; visit `/display` in browser | N/A — manual |
| DISP-02 | Display syncs within 1s of host action | integration (manual) | Open host + display tabs; trigger transition | N/A — manual |
| DISP-03 | Question shows with slide-up animation | visual (manual) | Observe question screen on host start | N/A — manual |
| DISP-04 | Live A/B bars fill as answers arrive | integration (manual) | Simulate answers; observe locked screen | N/A — manual |
| DISP-05 | Correct bar glows gold on reveal | visual (manual) | Host reveals; observe RevealDisplay | N/A — manual |
| DISP-06 | Leaderboard appears after reveal | integration (manual) | Observe RevealDisplay leaderboard section | N/A — manual |
| DISP-07 | Winner screen at game end | integration (manual) | Host ends game; observe WinnerDisplay | N/A — manual |
| DISP-08 | Countdown overlay appears on host trigger | integration (manual) | Click countdown button; observe overlay | N/A — manual |

**Build verification is the primary automated gate:** `npm run build` + `npm run lint` must exit 0 after each task. Manual integration testing in two browser tabs (host dashboard + /display) verifies sync behavior.

### Wave 0 Gaps

No test framework to install. Build + lint gates are sufficient per project configuration.

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` per config.json.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (countdown endpoint) | `validateHostAuth(req)` — already used by all host routes |
| V3 Session Management | No | Display route is public (read-only subscriber) |
| V4 Access Control | Yes (countdown endpoint) | `validateHostAuth(req)` first statement, before any DB access |
| V5 Input Validation | Yes (countdown body) | Validate `typeof gameId === "string"` and `typeof seconds === "number"` |
| V6 Cryptography | No | No new cryptographic operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated countdown trigger | Spoofing / Tampering | `validateHostAuth(req)` as first statement in POST /api/host/countdown |
| Forged COUNTDOWN_STARTED payload with large `seconds` value | Tampering | Validate `seconds` is a number; clamp to max (e.g., `seconds <= 10`) |
| Display route exposed without auth | Information Disclosure | Intentional — display route is public per architecture (D-10 context); no sensitive data exposed |
| XSS via leaderboard player names | Tampering | React text nodes render all strings as text, not HTML — no `dangerouslySetInnerHTML` |

**Security note:** The countdown endpoint needs an input clamp on `seconds` — if the host sends `seconds: 999`, the display would show a 16-minute countdown. Add server-side validation: `if (typeof seconds !== "number" || seconds < 1 || seconds > 10)` return 400.

---

## Sources

### Primary (HIGH confidence — codebase verified)
- `src/hooks/useGameSync.ts` — hook signature, broadcast handler, null playerId constraint, onEvent callback design point
- `src/lib/realtime/events.ts` — COUNTDOWN_STARTED member confirmed; all 8 members verified
- `src/lib/host/constants.ts` — HOST_SENTINEL_PLAYER_ID, GAME_ID, hostFetch signature
- `src/app/host/page.tsx` — DashboardShell pattern (single useGameSync, props-down, sentinel UUID usage)
- `src/app/page.tsx` — GuestShell pattern (hydration guard, phase switch, null state handling)
- `src/components/host/ControlTab.tsx` — inFlight pattern, section structure, EmergencyPanel placement
- `src/app/api/host/transition/route.ts` — host route pattern (validateHostAuth first, broadcast helper, best-effort broadcast)
- `src/lib/supabase/admin.ts` — broadcast() helper signature and usage pattern
- `src/components/guest/LeaderboardPanel.tsx` — px/rem text sizes confirmed; scaling needed for TV
- `src/components/guest/SyncStatusBadge.tsx` — status badge pattern to adapt for dot style
- `src/app/globals.css` — @theme tokens, .glass, .glass-gold, .thin-divider; NO slide-up/fade-scale keyframes yet
- `.planning/phases/06-tv-display-mode/06-CONTEXT.md` — all locked decisions D-01 through D-11
- `.planning/phases/06-tv-display-mode/06-UI-SPEC.md` — complete visual contract, component inventory, file structure
- `.planning/config.json` — nyquist_validation: true (no test framework), security_enforcement: true

### Secondary (MEDIUM confidence — derived from Phase 5)
- `.planning/phases/05-guest-app/05-01-SUMMARY.md` — confirmed packages added (react-qr-code, canvas-confetti); Phase 6 adds none
- `.planning/phases/05-guest-app/05-RESEARCH.md` — Phase 5 patterns that Phase 6 reuses

---

## Metadata

**Confidence breakdown:**
- Critical findings (null playerId, COUNTDOWN_STARTED routing, ControlTab pattern): HIGH — verified directly in codebase
- Architecture patterns: HIGH — derived from existing codebase patterns, not training data
- CSS animation patterns: HIGH — verified against globals.css; keyframes absent confirmed
- Security controls: HIGH — pattern verified in all 4 existing host routes

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable — no planned package upgrades before Phase 6 execution)
