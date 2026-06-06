# Phase 6: TV Display Mode - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 delivers a dedicated `/display` route — a cinematic, landscape-optimized big-screen experience projected on a TV/projector during the wedding. It subscribes to the same `useGameSync` hook as the guest app (anonymous, no player identity) and shows each phase of the game with large typography, live A/B bars, a reveal effect, a leaderboard, and a winner screen. A "Go Fullscreen" button lets the host operator enter browser fullscreen with one click. The host dashboard gains a countdown button that broadcasts `COUNTDOWN_STARTED` to the display.

**All 8 requirements in scope:** DISP-01, DISP-02, DISP-03, DISP-04, DISP-05, DISP-06, DISP-07, DISP-08.

**Not in scope (explicit Phase 6 boundary):**
- Full cinematic animation polish (AnimatePresence, staggered reveals, fine timing) → Phase 7
- Performance validation (60fps audit, CPU throttle tests) → Phase 7
- Wedding aesthetic overhaul → Phase 7
- Any changes to the guest app or scoring logic

</domain>

<decisions>
## Implementation Decisions

### Screen Content Per Phase

- **D-01: Lobby screen** — Big game title ("Joc — Cristina & Andrei", Playfair Display) centered, with a live "X jucători s-au alăturat" participant count below it. Animated pulse on the count to signal live updates. Clean, atmospheric — no player name list.

- **D-02: Question screen** (phase = `"question"`) — Large question text at top, two prominent option labels (A: ___ / B: ___) below. **No bars during voting** — keeps the question moment suspenseful. Bars only appear when answers are locked.

- **D-03: Locked screen** (phase = `"locked"`) — Same question + options layout, but A/B percentage bars appear and **fill live** as answers arrive from `useGameSync` re-fetches. Each bar shows the current percentage (e.g. "68% A / 32% B") updating in near-real-time.

- **D-04: Revealed screen** (phase = `"revealed"`) — Same bars as locked, but on reveal: correct option bar **glows gold** (box-shadow + `border-gold-bright`) and **scales up** slightly; wrong option bar drops to 40% opacity. Effect is immediate and clear. No dramatic flash. Top-5 leaderboard appears below the bars.

- **D-05: After-reveal leaderboard** — Compact top-5 player list (rank + name + score) rendered below the A/B result area during `"revealed"` phase. Scrolling not needed (top 5 only).

- **D-06: Winner screen** (phase = `"ended"`) — Full leaderboard with #1 player in a hero slot (larger text, `text-gold-bright`, trophy icon or similar), ranked list below. Cinematic but not over-the-top — consistent with wedding soft-luxury aesthetic.

### Animation Style

- **D-07: Phase 6 animation scope** — Functional transitions only. Phase 6 delivers:
  - Fade-in when a new screen mounts (CSS opacity transition, ~300ms)
  - Slide-up on question text appearing (CSS `translateY` → 0, ~400ms)
  - Gold glow + scale on the correct answer bar (CSS transition)
  - All using native CSS transitions or `motion/react` `animate` with simple values — **no AnimatePresence, no staggered sequences**
  - Phase 7 upgrades to full cinematic with AnimatePresence, staggered leaderboard entries, and tuned durations

### Countdown (DISP-08)

- **D-08: Host triggers countdown from the dashboard** — Phase 6 adds a "Numărătoare inversă" button to the host dashboard (Control tab or Emergency section — planner decides placement). Clicking it calls a new `POST /api/host/countdown` endpoint that broadcasts `COUNTDOWN_STARTED` with `{ seconds: 3 }`. The event already exists in `src/lib/realtime/events.ts`.

- **D-09: Display countdown overlay** — When `COUNTDOWN_STARTED` is received: a full-screen semi-transparent dark overlay (`bg-ink/80`) appears on top of the current phase screen. A giant centered number counts down 3 → 2 → 1 (client-side `setInterval`, 1 second per tick), using Playfair Display, large (`text-[20vw]` or similar), gold text. Overlay unmounts automatically when countdown reaches 0. Does not block `useGameSync` updates behind it.

### Full-Screen Approach

- **D-10: JavaScript Fullscreen API button** — `/display` shows a "Ecran complet" (🖥) button (top-right corner, semi-transparent, disappears after entering fullscreen) that calls `document.requestFullscreen()` on the root container. Requires a user gesture — the host operator clicks it once after opening the URL. Falls back gracefully (button stays visible) on Safari where `requestFullscreen` is supported but may behave differently. CSS baseline: `min-h-dvh w-screen overflow-hidden` ensures the page fills the viewport even without fullscreen.

### Connection Status Indicator

- **D-11: Persistent dot indicator** (DISP-02 requirement) — Small dot + label fixed in the top-right corner (below the fullscreen button):
  - `"connected"` → green dot, no label text (clean screen)
  - `"reconnecting"` → amber pulsing dot + "Reconectare..." text
  - `"connecting"` → amber dot + "Se conectează..." text
  - `"error"` → red dot + "Eroare" text
  - Driven by `status` from `useGameSync`. Non-blocking, always visible.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Sync Primitive (Phase 2)
- `src/hooks/useGameSync.ts` — `useGameSync(gameId, null)` for anonymous display subscriber. Returns `{ state: GameStateSnapshot | null, status: SyncStatus, participantCount: number }`. Read the full file — anonymous usage (null playerId) is distinct from guest usage; verify it is supported.
- `src/lib/realtime/events.ts` — Full 8-member `GameEvent` union including `COUNTDOWN_STARTED: { gameId, seconds }`. Display MUST NOT add new members.

### Host APIs + Dashboard (Phase 3 + 4)
- `src/app/api/host/transition/route.ts` — Pattern for host API routes (validateHostAuth, broadcast). The new `/api/host/countdown` route follows this pattern.
- `src/app/host/page.tsx` — Host dashboard structure (tabs, PhaseButton pattern). Phase 6 adds a countdown button here.
- `src/lib/host/constants.ts` — `GAME_ID`, `hostFetch` helper — reuse for the countdown API call.

### Guest App Patterns (Phase 5 — reuse for display)
- `src/app/page.tsx` — GuestShell phase-switch pattern. Display page follows same structure but without identity/NameGate.
- `src/components/guest/LeaderboardPanel.tsx` — Reusable ranked leaderboard component built in Phase 5.
- `src/components/guest/SyncStatusBadge.tsx` — Connection status pattern (can adapt or re-implement for dot style).

### Design Tokens
- `src/app/globals.css` — `@theme` block: `ink`, `ink-light`, `champagne`, `champagne-dim`, `gold`, `gold-bright`, `gold-muted`, `blush`, `sage`, `.glass` utility. Display MUST use these tokens — no ad-hoc hex values.

### Requirements
- `.planning/REQUIREMENTS.md` §"TV / Display Mode" — DISP-01 through DISP-08 (8 requirements, all Phase 6).
- `.planning/ROADMAP.md` §"Phase 6: TV Display Mode" — 5 success criteria that VERIFICATION.md must check against.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/hooks/useGameSync.ts` — Ready to use with `playerId = null` for the anonymous display subscriber. All reconnect, presence, and re-fetch logic is already handled.
- `src/components/guest/LeaderboardPanel.tsx` — Phase 5 built this; display can import it directly for after-reveal top-5 and winner screen.
- `src/components/guest/SyncStatusBadge.tsx` — Phase 5 built this as a top badge. Display needs a dot variant (D-11) — re-implement as `DisplayStatusDot.tsx` or extend the existing component.
- `src/app/globals.css` — `.glass` utility, all color tokens already defined.
- `src/lib/host/constants.ts` — `GAME_ID`, `hostFetch` — import in the new countdown API route and host dashboard button.

### Established Patterns
- **Phase switch on `state.phase`** — The guest app's `page.tsx` pattern (switch on `state.phase`, single `useGameSync` call, screens receive state as props) is the template for the display page.
- **`hostFetch`** — Existing host fetch helper with auth header; countdown API call from host dashboard reuses this.
- **Anonymous `useGameSync`** — Display calls `useGameSync(GAME_ID, null)`. Verify Phase 2 hook handles `null` playerId correctly (presence tracking should skip when playerId is null).

### Integration Points
- `src/app/display/page.tsx` — **New file.** Display shell with `useGameSync`, countdown state, fullscreen button, and phase switch.
- `src/components/display/` — **New directory.** All display-specific screen components go here (separate from `src/components/guest/`).
- `src/app/api/host/countdown/route.ts` — **New file.** `POST` endpoint; validates host auth, broadcasts `COUNTDOWN_STARTED { gameId, seconds: 3 }`.
- `src/app/host/page.tsx` — **Modified.** Countdown button added to existing Control tab.

</code_context>

<specifics>
## Specific Ideas

- **"Ecran complet" button** — Romanian label for the fullscreen button. Semi-transparent, top-right corner, disappears (or becomes very subtle) after entering fullscreen.
- **Countdown number typography** — Playfair Display, `text-[20vw]` or similar viewport-relative size, `text-gold-bright`. The number should dominate the screen.
- **Lobby pulse** — The participant count label can use `animate-pulse` (Tailwind) or a simple CSS ring-pulse animation to signal live updates without motion/react overhead.
- **"Numărătoare inversă" button** — Romanian label for the countdown trigger in the host dashboard. Should be visually distinct (secondary/outline style, not a primary action).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 6-TV Display Mode*
*Context gathered: 2026-06-05*
