# Phase 5: Guest App - Research

**Researched:** 2026-06-04
**Domain:** Mobile-first React/Next.js game UI — join flow, real-time sync, A/B tap UX, reveal, leaderboard, winner screen
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01** — Guest app lives at `/` (root route). `src/app/page.tsx` becomes the guest app entry point, replacing the sync-demo.

**D-02** — `GAME_ID` baked into the client via `NEXT_PUBLIC_GAME_ID`. No URL-based game ID. QR code links to `NEXT_PUBLIC_APP_URL`.

**D-03** — Full-screen name-entry gate on first load. No device token in localStorage → gate. Returning guests skip straight to game view.

**D-04** — Two large full-width stacked buttons (A on top, B below). Display `optionA` / `optionB` text. Substantial screen height — easy tap targets.

**D-05** — Color scheme: glass idle, gold locked. Idle: `.glass` card buttons, champagne text. Selected/locked: gold border + gold text glow, other option fades (reduced opacity, pointer-events-none).

**D-06** — Reveal feedback in-place on the buttons. Correct answer: gold glow. Wrong locked choice: red-500/40 overlay. Both buttons remain visible. No modal/splash. Within 1s of host action.

**D-07** — Single page, conditional rendering per phase. Switch on `state.phase` from `useGameSync`. No additional routing segments. No `AnimatePresence` in Phase 5 (deferred to Phase 7). Simple conditional re-renders.

**D-08** — Leaderboard always visible below question/reveal when non-empty. After reveal, appears below A/B result area. Guest can scroll. Host drives advancement.

**D-09** — Game-end/winner screen: full leaderboard with #1 featured prominently (larger name + gold/champagne treatment), plus `canvas-confetti` burst once on entering `ended` phase.

**D-10** — Name-entry gate: centered glassmorphism card, ink-dark background, Playfair Display heading, name text input, "Joacă!" submit button. Inline error copy: "Numele nu poate fi gol." / "Ceva nu a mers. Încearcă din nou."

**D-11** — QR code in lobby screen (phase = "lobby"). Encodes `NEXT_PUBLIC_APP_URL`. Use `react-qr-code` or `qrcode` package — planner picks lightest maintained option.

**D-12** — Reconnect UX: subtle top badge. `"connecting"` → "Se conectează..." (champagne-dim); `"reconnecting"` → "Reconectare..." + pulse; `"connected"` → no badge; `"error"` → "Eroare conexiune" (red-500). Non-blocking — never hides content.

### Claude's Discretion

None declared.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| JOIN-04 | Guest waits in a lobby that shows live state until the host starts | Lobby screen driven by `state.phase === "lobby"` from `useGameSync`; `participantCount` from presence |
| JOIN-05 | Lobby shows a join QR code / link for easy guest onboarding | `react-qr-code` renders `NEXT_PUBLIC_APP_URL`; no server needed |
| PLAY-01 | Guest sees current question with A and B pushed live (no refresh) | `useGameSync` broadcast re-fetch delivers `state.currentQuestion` within 1s |
| PLAY-02 | Guest can select exactly one answer (A or B) | `POST /api/game/answer` with `deviceToken + choice`; 403/409 guards enforce one-answer |
| PLAY-03 | Submitting locks the guest's answer for the round; cannot be changed | Optimistic lock in local state + server 409 on retry; refreshed state from `state.myAnswer` |
| PLAY-04 | Guest UI clearly shows selected/locked answer and waiting state | Gold border/glow on locked button; other option fades; D-05 |
| PLAY-05 | Guest sees correct-answer reveal live when host reveals | `state.correctOption` populated on phase=revealed; in-place button feedback D-06 |
| PLAY-06 | Guest sees leaderboard update live between rounds | `state.leaderboard` from `useGameSync`; rendered below A/B area D-08 |
| PLAY-07 | Guest sees game-end / winner state live | `state.phase === "ended"` triggers winner screen + confetti D-09 |
</phase_requirements>

---

## Summary

Phase 5 wires together all the infrastructure built in Phases 2–4 into a complete guest-facing game experience. The entire guest journey — join gate, lobby, A/B question answering, reveal, leaderboard, winner screen — is driven by a single `useGameSync` hook that already exists and is fully production-ready. The guest app is a pure consumer of existing primitives: it calls `POST /api/game/join` once to register, reads `state.phase` to switch screens, and calls `POST /api/game/answer` to submit a choice. All real-time sync, reconnect handling, presence counting, and state normalization are handled upstream.

The dominant implementation challenge is not technical integration (the seams are clean and fully typed) but rather **mobile UX correctness**: the A/B tap buttons must be large enough to be reliable on a phone screen, locking must be immediate and visually unambiguous, and reconnect state must never block the guest from reading the screen. The `useGameSync` hook's `SyncStatus` enum feeds directly into the D-12 badge — the research confirms the exact status string values and their mapping to UI copy.

A new `NEXT_PUBLIC_APP_URL` environment variable is the only infrastructure gap: it must be added to `.env.local` and Vercel before the QR code can render the correct link.

**Primary recommendation:** Replace `src/app/page.tsx` with a single `"use client"` shell that mounts `useGameSync`, reads localStorage for the device token/playerId, and conditionally renders one of five phase screens. All five screens are new components under `src/components/guest/`. No new API routes, no new DB changes, no new realtime patterns.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Identity persistence (device token + playerId) | Browser / Client | — | localStorage only; no server session; established in Phase 3 |
| Join upsert | API / Backend | — | `POST /api/game/join` already exists; client calls once on gate submit |
| Game state sync | Browser / Client | API / Backend | `useGameSync` client hook + `GET /api/game/state` server read on every reconnect |
| Phase-conditional screen rendering | Browser / Client | — | Switch on `state.phase`; D-07 single page |
| A/B answer submission | API / Backend | Browser / Client | `POST /api/game/answer` enforces phase-guard + dedup; client does optimistic lock |
| QR code generation | Browser / Client | — | `react-qr-code` renders entirely client-side; no server involvement |
| Confetti burst | Browser / Client | — | `canvas-confetti` called imperatively once on `ended` phase transition |
| Connection status badge | Browser / Client | — | `status` from `useGameSync` drives badge copy/color |
| Leaderboard ranking | API / Backend | Browser / Client | Computed and sorted in `GET /api/game/state`; client renders received array |

---

## Standard Stack

### Core (already installed)

| Library | Version in package.json | Purpose | Status |
|---------|------------------------|---------|--------|
| `next` | 15.3.9 | App Router, route for `/` | Installed |
| `react` + `react-dom` | ^19.0.0 | UI rendering | Installed |
| `motion` | ^12.40.0 | `whileTap` press animation on A/B buttons | Installed |
| `nanoid` | ^5.0.0 | Already used for device token generation | Installed |
| `@supabase/supabase-js` | ^2.106.0 | Supabase client (via `useGameSync`) | Installed |
| `clsx` + `tailwind-merge` | installed | `cn()` utility via shadcn/ui pattern | Installed |

### New Packages Required

| Library | Version | Purpose | Why This One |
|---------|---------|---------|-------------|
| `react-qr-code` | 2.0.21 | QR code for lobby screen | Lightweight SVG-based React component, no canvas dependency, React 19 compatible. Created 2016-07-28, slopcheck [OK]. Confirmed at npmjs.com. |
| `canvas-confetti` | 1.9.4 | One-shot confetti on winner screen | Already in CLAUDE.md tech stack; imperative API, no React component overhead. Created 2018-02-08, slopcheck [OK]. GitHub: catdad/canvas-confetti. |

`canvas-confetti` also needs its TypeScript types:

| Library | Version | Purpose |
|---------|---------|---------|
| `@types/canvas-confetti` | latest | TypeScript types for canvas-confetti |

**Installation:**
```bash
npm install react-qr-code canvas-confetti
npm install -D @types/canvas-confetti
```

**Version verification:** [VERIFIED: npm registry]
- `react-qr-code@2.0.21` — confirmed via `npm view react-qr-code version` (2026-06-04)
- `canvas-confetti@1.9.4` — confirmed via `npm view canvas-confetti version` (2026-06-04)

---

## Package Legitimacy Audit

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `react-qr-code` | npm | ~10 yrs (2016) | github.com/rosskhanas/react-qr-code | [OK] | Approved |
| `canvas-confetti` | npm | ~8 yrs (2018) | github.com/catdad/canvas-confetti | [OK] | Approved |
| `@types/canvas-confetti` | npm | Mirrors canvas-confetti | github.com/DefinitelyTyped | Not run (DefinitelyTyped — inherently OK) | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

*slopcheck v0.6.1 was available and run on 2026-06-04.*

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Guest Phone)
        |
        | on load
        v
[localStorage check]
     |         |
  has token   no token
     |              |
     v              v
[GuestShell]   [NameGate]
     ^              |
     |         POST /api/game/join
     |              |
     |         { deviceToken, playerId }
     |         → localStorage.set()
     |              |
     +<-------------+
     |
     | useGameSync(GAME_ID, playerId)
     |   → subscribe to game:{gameId} Broadcast
     |   → fetch GET /api/game/state?gameId=&playerId=
     |
     v
[GameStateSnapshot] ──────────────────────────────────────┐
     |                                                     |
  state.phase                                             RT event
     |                                                    → re-fetch
  ┌──┴──────────────────────────────────────────────┐
  |  "lobby"   "question"  "locked"  "revealed"  "ended"  |
  v         v           v          v            v
[Lobby]  [Question] [Question]  [Question]  [Winner]
  QR       A/B btns  locked btn  reveal btn  leaderboard
  count    submit    (disabled)  gold/red    #1 featured
                     POST /api   correct     confetti
                     /game/      shown
                     answer
```

### Recommended Project Structure

```
src/
├── app/
│   └── page.tsx              # GuestShell — replaces sync-demo; "use client"
├── components/
│   └── guest/
│       ├── NameGate.tsx       # Full-screen join card (D-10)
│       ├── LobbyScreen.tsx    # Waiting screen + QR + participant count (JOIN-04/05)
│       ├── QuestionScreen.tsx # A/B buttons + locked state (PLAY-01/02/03/04)
│       ├── RevealScreen.tsx   # In-place button feedback + distribution (PLAY-05)
│       ├── LeaderboardPanel.tsx # Scrollable leaderboard (PLAY-06)
│       ├── WinnerScreen.tsx   # Full leaderboard + #1 featured + confetti (PLAY-07)
│       └── SyncStatusBadge.tsx # Subtle top badge (D-12)
└── lib/
    └── guest/
        └── identity.ts        # localStorage helpers: getDeviceToken, getPlayerId, setIdentity
```

**Why `guest/identity.ts`:** localStorage access needs null-safety wrappers (SSR-safe), and nanoid generation needs to happen exactly once. Centralizing into a non-hook module avoids duplicating the `typeof window` guards across three components (NameGate, GuestShell initial check, reconnect path). This mirrors the existing `src/lib/host/constants.ts` pattern.

### Pattern 1: Guest Shell — Single Page Phase Switch

**What:** `page.tsx` is a single `"use client"` client component. It mounts `useGameSync`, reads localStorage on mount to determine identity, and conditionally renders the correct screen based on `state.phase`.

**When to use:** D-07 mandates this — no additional routing, no AnimatePresence in Phase 5.

```typescript
// Source: CONTEXT.md D-07, existing host page pattern
"use client";

import { useEffect, useState } from "react";
import { useGameSync } from "@/hooks/useGameSync";
import { GAME_ID } from "@/lib/host/constants";
import { getIdentity } from "@/lib/guest/identity";

export default function GuestShell() {
  const [identity, setIdentity] = useState<{ deviceToken: string; playerId: string } | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIdentity(getIdentity()); // reads localStorage safely
    setHydrated(true);
  }, []);

  // Hold render until localStorage read completes (mirrors useHostAuth hydration pattern)
  if (!hydrated) return <main className="min-h-dvh bg-ink" aria-hidden="true" />;

  if (!identity) return <NameGate onJoined={setIdentity} />;

  return <GameView identity={identity} />;
}

function GameView({ identity }: { identity: { deviceToken: string; playerId: string } }) {
  const { state, status, participantCount } = useGameSync(GAME_ID, identity.playerId);

  switch (state?.phase) {
    case "lobby":
      return <LobbyScreen participantCount={participantCount} status={status} />;
    case "question":
    case "locked":
      return <QuestionScreen state={state} identity={identity} status={status} />;
    case "revealed":
      return <RevealScreen state={state} status={status} />;
    case "ended":
      return <WinnerScreen state={state} status={status} />;
    default:
      // state is null (still loading) or unknown phase
      return <LoadingScreen status={status} />;
  }
}
```

### Pattern 2: Name Gate — Join Flow

**What:** Full-screen card. On submit, call `POST /api/game/join`, store the result in localStorage, and call `onJoined` with the identity. Mirrors PasswordGate structure from host page.

```typescript
// Source: CONTEXT.md D-10, host page PasswordGate pattern
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const name = value.trim();
  if (!name) { setError("Numele nu poate fi gol."); return; }

  setChecking(true);
  try {
    const { getOrCreateDeviceToken } = await import("@/lib/guest/identity");
    const deviceToken = getOrCreateDeviceToken(); // nanoid UUID v4, persisted to localStorage

    const res = await fetch("/api/game/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: GAME_ID, deviceToken, displayName: name }),
    });
    const data = await res.json();
    if (!res.ok) { setError("Ceva nu a mers. Încearcă din nou."); return; }

    setIdentity({ deviceToken, playerId: data.playerId }); // persists to localStorage
    onJoined({ deviceToken, playerId: data.playerId });
  } catch {
    setError("Ceva nu a mers. Încearcă din nou.");
  } finally {
    setChecking(false);
  }
}
```

**Key constraint from Phase 3:** `deviceToken` must be a valid UUID v4 string (UUID_REGEX enforced by `POST /api/game/join`). Use `nanoid()` with a UUID v4 format. The `nanoid` package (v5) generates 21-char strings by default — **not** UUID format. Must use `crypto.randomUUID()` (available in Node 14.17+, all modern browsers) or format nanoid output as UUID. [VERIFIED: existing code — `players.device_token` is a UUID column per Accumulated Context note `01-03`]

**Correct approach:** Use `crypto.randomUUID()` for device token generation — built into every modern browser and Node.js 14.17+. No package needed. [VERIFIED: MDN Web Docs — Crypto.randomUUID() is available in all modern browsers]

### Pattern 3: A/B Button Tap with Optimistic Lock

**What:** On tap, immediately update local state to show locked (prevent double-submit), then call `POST /api/game/answer`. If the request fails (403 already locked, 409 already answered), the local state reflects the server's reality on the next `useGameSync` re-fetch (which happens automatically from the next broadcast event or on reconnect).

```typescript
// Source: CONTEXT.md D-04/D-05, POST /api/game/answer route contract
const [localAnswer, setLocalAnswer] = useState<"A" | "B" | null>(null);
// On first render, seed from state.myAnswer (survives refresh — PLAY-03)
useEffect(() => {
  if (state.myAnswer) setLocalAnswer(state.myAnswer);
}, [state.myAnswer]);

async function handleTap(choice: "A" | "B") {
  if (localAnswer !== null) return; // already locked — no second tap
  setLocalAnswer(choice); // optimistic lock

  try {
    await fetch("/api/game/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: GAME_ID, deviceToken, choice }),
    });
    // 409 (already_answered) is fine — server agrees with optimistic lock
    // 403 (answers_locked) should only happen on race — next broadcast re-fetch will correct
  } catch {
    // Network error — keep optimistic lock; next reconnect re-fetches real state
  }
}
```

**PLAY-03 compliance — persists through refresh:** `state.myAnswer` is populated by `GET /api/game/state` when the player has already answered (from `answers` table). On reconnect/refresh, `useGameSync` re-fetches state, which includes `myAnswer`. The local `useState` is seeded from `state.myAnswer` in a `useEffect`, so the locked visual appears immediately after reconnect.

### Pattern 4: Reveal Feedback — In-Place Button Classes

**What:** When `state.phase === "revealed"`, each button gets a class based on whether it is the correct answer AND whether it is the guest's locked answer. No modal. D-06.

```typescript
// Source: CONTEXT.md D-06
function getButtonClass(option: "A" | "B", state: GameStateSnapshot): string {
  const isLocked = state.myAnswer === option;
  const isCorrect = state.correctOption === option;
  const isPhaseRevealed = state.phase === "revealed";

  if (!isPhaseRevealed) {
    // question/locked phase — D-05 styling
    if (isLocked) return "border-2 border-gold text-gold-bright shadow-[0_0_12px_0_rgba(212,168,67,0.4)]";
    return "opacity-50 pointer-events-none"; // other option fades
  }

  // revealed phase
  if (isCorrect) return "border-2 border-gold-bright text-gold-bright shadow-[0_0_16px_0_rgba(240,192,96,0.5)]";
  if (isLocked && !isCorrect) return "border-2 border-red-500/60 text-champagne bg-red-500/20";
  return "border border-champagne/20 opacity-60"; // neither locked nor correct
}
```

### Pattern 5: Confetti — Imperative, Fire Once

**What:** `canvas-confetti` called imperatively when `state.phase` transitions to `"ended"`. Use a `useRef` fired flag to ensure exactly one burst. [VERIFIED: CLAUDE.md — canvas-confetti already in tech stack]

```typescript
// Source: CONTEXT.md D-09, CLAUDE.md tech stack
import confetti from "canvas-confetti";
import { useEffect, useRef } from "react";

const confettiFired = useRef(false);
useEffect(() => {
  if (!confettiFired.current) {
    confettiFired.current = true;
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
  }
}, []); // fires once on component mount (WinnerScreen only mounts in "ended" phase)
```

### Pattern 6: QR Code in Lobby

```typescript
// Source: react-qr-code README (github.com/rosskhanas/react-qr-code)
import QRCode from "react-qr-code";

// In LobbyScreen:
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
<QRCode value={appUrl} size={160} bgColor="transparent" fgColor="#f5e6c8" />
```

`bgColor="transparent"` + `fgColor` matching `--color-champagne` integrates cleanly with the ink-dark background without an explicit white background box.

### Anti-Patterns to Avoid

- **Calling `useGameSync` in individual screen components:** Each screen component receives `state` and `status` as props from the single `GameView` hook call. Never mount a second `useGameSync` instance per screen — it creates a duplicate channel subscription (see Phase 2 Pitfall 2 / SDK topic dedup behavior).
- **Reading game data from broadcast payload:** `useGameSync` already re-fetches on every event. Screen components read only from `state` (the snapshot). Never inspect `payload` in a custom broadcast listener.
- **Calling `channel.subscribe()` in the reconnect/visibility path:** Already documented in `useGameSync.ts` as Pitfall 4. `visibilitychange` calls `fetchState()` only.
- **Generating device token with plain `nanoid()`:** `nanoid(21)` produces a non-UUID string. The `POST /api/game/join` endpoint validates `deviceToken` with `UUID_REGEX`. Use `crypto.randomUUID()` instead.
- **Using `sessionStorage` for device token:** CLAUDE.md explicitly flags `sessionStorage` as non-durable (cleared on tab close). Device token MUST go in `localStorage` (persists across sessions) — established in Phase 3.
- **`state === null` without a loading screen:** `useGameSync` starts with `state = null` while the initial fetch is in-flight. The phase switch must handle `null` with a loading/connecting screen — otherwise the switch falls through and renders nothing.
- **`min-h-screen` on mobile:** Use `min-h-dvh` (dynamic viewport height) to account for iOS Safari's collapsible chrome. The host page already uses this pattern.
- **Checking `state.myAnswer` from `useGameSync` without seeding `localAnswer`:** If a guest refreshes mid-question with a locked answer, `state.myAnswer` will be non-null after the reconnect re-fetch but `localAnswer` will start as null. The `useEffect` seed (Pattern 3) is required for PLAY-03 compliance.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR code generation | Custom QR encoding algorithm | `react-qr-code` | Reed-Solomon error correction, multiple QR versions, SVG output, React component |
| Confetti animation | CSS-based particle system | `canvas-confetti` | Already in CLAUDE.md stack; GPU-accelerated canvas, no React overhead |
| Device token UUID | Custom random string format | `crypto.randomUUID()` | Built-in browser API; server validates with UUID_REGEX — no format guessing |
| Real-time state sync | Custom WebSocket reconnect logic | `useGameSync` (already exists) | Complete implementation with jitter, heartbeat, visibilitychange — all edge cases handled |
| A/B answer dedup | Client-side "already submitted" flag | `POST /api/game/answer` 409 + `state.myAnswer` | Server enforces UNIQUE constraint; client reads authoritative answer from state on reconnect |
| Presence count | Polling participant list | `participantCount` from `useGameSync` | Already driven by Supabase Presence in the hook |

**Key insight:** The heaviest engineering work for this phase (sync, reconnect, dedup, presence) is already done. Phase 5 is almost entirely UI composition.

---

## Common Pitfalls

### Pitfall 1: device token format — plain nanoid vs UUID
**What goes wrong:** `nanoid()` generates a 21-character string like `V1StGXR8_Z5jdHi6B-myT`. The `POST /api/game/join` route validates `deviceToken` with `UUID_REGEX` (`/^[0-9a-f]{8}-[0-9a-f]{4}-...$/i`). A non-UUID device token returns 400, and the guest can never join.
**Why it happens:** CLAUDE.md lists `nanoid` in the stack for "device token generation" but the Phase 3 API contract added UUID validation. The existing `useGameSync` stub for tracking also reads `device_token` from localStorage.
**How to avoid:** Use `crypto.randomUUID()` for device token generation. It's a built-in browser API (available in all modern browsers, Node 14.17+) and produces a standard UUID v4 string with no package needed.
**Warning signs:** `POST /api/game/join` returning 400 with `"deviceToken required"` error.

### Pitfall 2: `state === null` fallthrough
**What goes wrong:** `useGameSync` initializes `state = null`. A phase switch that only handles `"lobby" | "question" | "locked" | "revealed" | "ended"` renders nothing on the initial load before the first fetch resolves.
**Why it happens:** TypeScript's `GameStateSnapshot` union doesn't include `null` — it's the `useState` initial value, not a phase value.
**How to avoid:** Handle `state === null` explicitly before the phase switch. Show a loading screen (`status === "connecting"`) or the name gate (if not yet joined).
**Warning signs:** Blank screen on first load lasting >500ms; no loading indicator visible.

### Pitfall 3: Second `useGameSync` instance in a screen component
**What goes wrong:** If `LobbyScreen` or `QuestionScreen` calls `useGameSync` internally (instead of receiving `state` as props), the SDK returns the existing channel (topic dedup), registers a second broadcast listener, and both the prop-state and the internal hook state update — causing double re-renders and presence count inflation.
**Why it happens:** It feels natural to pass just a `gameId` prop and hook up internally. But the Phase 2 architecture document and `useGameSync.ts` inline comments explicitly prohibit this.
**How to avoid:** All screen components receive `state`, `status`, and `participantCount` as props. Only `page.tsx` / `GameView` calls `useGameSync`.
**Warning signs:** `participantCount` showing 2x the real value; presence entries doubling on each navigation.

### Pitfall 4: Name gate not checking for existing join state on load
**What goes wrong:** A returning guest who already joined (localStorage has `deviceToken` + `playerId`) is shown the name gate again. They re-enter their name, which calls `POST /api/game/join` with the same `deviceToken`, which is idempotent (returns the same `playerId`) — but the UX is wrong and causes unnecessary confusion mid-game.
**Why it happens:** The initial localStorage check is done synchronously before React hydrates, or the check is skipped.
**How to avoid:** The `useEffect` in `GuestShell` reads localStorage on mount and populates `identity`. Until `hydrated === true`, render a neutral `bg-ink` main element (no gate, no game). Once hydrated, show the gate only if `identity === null`.
**Warning signs:** Returning guests always see the name gate even after joining.

### Pitfall 5: `NEXT_PUBLIC_APP_URL` missing in `.env.local`
**What goes wrong:** `process.env.NEXT_PUBLIC_APP_URL` is `undefined` at runtime. The QR code encodes `"undefined"`. Guests who scan it land on a 404.
**Why it happens:** New env var, not yet in any env file. Vercel env will also need it.
**How to avoid:** Fallback to `window.location.origin` in the QR code component (client-side only): `const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin`. Add the var to `.env.local` template and document in Vercel env setup. The planner must include a Wave 0 task adding this env var.
**Warning signs:** QR code renders but scan takes guests to a wrong or blank URL.

### Pitfall 6: Answer optimistic lock not seeded from `state.myAnswer` on reconnect
**What goes wrong:** Guest reconnects mid-round after already answering. `state.myAnswer` comes back as `"A"` from the re-fetch. But `localAnswer` in `QuestionScreen` starts as `null`. The A/B buttons display as unselected/idle. Guest taps again → 409 from server. Visual inconsistency.
**Why it happens:** `localAnswer` is local React state initialized to `null`. The reconnect path re-fetches `state` but does not automatically seed `localAnswer`.
**How to avoid:** `useEffect(() => { if (state.myAnswer) setLocalAnswer(state.myAnswer); }, [state.myAnswer])` — seeds local lock state from authoritative answer when it arrives.
**Warning signs:** PLAY-03 failure — "locked state persists through refresh" not satisfied.

### Pitfall 7: Confetti firing on every re-render of WinnerScreen
**What goes wrong:** `canvas-confetti()` is called on every render of `WinnerScreen`. The `"ended"` phase is sticky — once entered, `state.phase` stays `"ended"`. Every broadcast event (even unrelated ones like presence updates) causes `useGameSync` to re-fetch state, which may trigger a re-render, firing confetti again.
**Why it happens:** Calling `confetti()` directly in the render body or in a `useEffect` without a "fired" guard.
**How to avoid:** Use a `useRef(false)` flag as shown in Pattern 5. The `useEffect` in `WinnerScreen` runs once (empty deps array) because `WinnerScreen` only mounts once (D-07 conditional rendering — the component mounts when phase becomes `"ended"` and stays mounted as long as phase stays `"ended"`).
**Warning signs:** Confetti fires repeatedly as other guests join or as presence updates come in.

---

## Code Examples

### Identity Helpers — `src/lib/guest/identity.ts`

```typescript
// Source: Phase 3 CONTEXT.md — device_token must be UUID v4 (note 01-03)
// Source: CLAUDE.md — device token in localStorage (not sessionStorage)

const DEVICE_TOKEN_KEY = "device_token";
const PLAYER_ID_KEY = "player_id";

/** Get existing device token or generate a new UUID v4 and persist it. */
export function getOrCreateDeviceToken(): string {
  if (typeof window === "undefined") return ""; // SSR guard
  const existing = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (existing) return existing;
  const token = crypto.randomUUID(); // UUID v4 — passes UUID_REGEX in /api/game/join
  localStorage.setItem(DEVICE_TOKEN_KEY, token);
  return token;
}

/** Read identity from localStorage. Returns null if not yet joined. */
export function getIdentity(): { deviceToken: string; playerId: string } | null {
  if (typeof window === "undefined") return null; // SSR guard
  const deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY);
  const playerId = localStorage.getItem(PLAYER_ID_KEY);
  if (!deviceToken || !playerId) return null;
  return { deviceToken, playerId };
}

/** Persist identity after a successful join. */
export function setIdentity(identity: { deviceToken: string; playerId: string }): void {
  localStorage.setItem(DEVICE_TOKEN_KEY, identity.deviceToken);
  localStorage.setItem(PLAYER_ID_KEY, identity.playerId);
}
```

### SyncStatusBadge — `src/components/guest/SyncStatusBadge.tsx`

```typescript
// Source: CONTEXT.md D-12, host page status badge pattern
// Maps SyncStatus → Romanian copy per established project pattern
import type { SyncStatus } from "@/hooks/useGameSync";

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  if (status === "connected") return null; // clean screen when connected

  const copy: Record<Exclude<SyncStatus, "connected">, string> = {
    connecting: "Se conectează...",
    reconnecting: "Reconectare...",
    error: "Eroare conexiune",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "absolute top-3 left-1/2 -translate-x-1/2 z-20",
        "rounded-full px-3 py-1 text-xs font-medium",
        status === "reconnecting" && "animate-pulse bg-gold/20 text-gold",
        status === "connecting" && "bg-champagne/10 text-champagne-dim",
        status === "error" && "bg-red-500/20 text-red-400",
      ].filter(Boolean).join(" ")}
    >
      {copy[status]}
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Polling for game state | Supabase Broadcast → re-fetch pattern (Phase 2) | Sub-second sync, no polling overhead |
| Per-component Supabase channel | Single `useGameSync` hook, state passed as props | No channel dedup collisions, no presence inflation |
| `framer-motion` package | `motion` package, `import { motion } from "motion/react"` | CLAUDE.md mandates `motion`; same API, correct package name |
| `sessionStorage` for device token | `localStorage` for device token | Survives tab close/refresh — PLAY-03 compliance |
| `nanoid()` for UUID | `crypto.randomUUID()` | Generates valid UUID v4 passing server validation |

**Deprecated/outdated:**
- `framer-motion`: Legacy package name. Use `motion` (installed). Import from `motion/react`.
- `@supabase/auth-helpers-nextjs`: Deprecated, superseded by `@supabase/ssr`. Already using correct package.
- `tailwindcss-animate`: Removed from shadcn/ui March 2025. Not needed — native Tailwind v4 animation classes used.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `crypto.randomUUID()` is available in the production browser environment (iOS Safari 15.4+, Chrome 92+) | Architecture Patterns (Pattern 2) | Guests on very old iOS (<15.4) can't generate device token; fallback needed. Very low risk for wedding event. [ASSUMED — not explicitly verified against minimum iOS target] |
| A2 | `NEXT_PUBLIC_APP_URL` is the correct env var name for the deployed domain (D-11 from CONTEXT.md) | Architecture Patterns, Pitfalls | If the var name changes, QR code fallback to `window.location.origin` still works |
| A3 | The leaderboard is capped at 20 entries in `GET /api/game/state` (`.limit(20)`) | Architecture Patterns | At 100 guests, only top 20 shown; PLAY-06 is satisfied by "leaderboard updates live," not "full leaderboard" |

**All other claims are VERIFIED against existing codebase (grep confirmed) or CITED against established project decisions.**

---

## Open Questions

1. **`NEXT_PUBLIC_APP_URL` env var — fallback strategy**
   - What we know: D-11 specifies this env var for QR code generation; it does not yet exist in any env file.
   - What's unclear: Whether a `window.location.origin` fallback is sufficient for local dev (it works for dev but may return the Vercel preview URL instead of the canonical wedding domain in staging).
   - Recommendation: Add the env var as a Wave 0 task; the QR code component uses `process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin` as a safety fallback.

2. **`GAME_ID` import in guest components — `lib/host/constants.ts` or new `lib/guest/constants.ts`?**
   - What we know: `GAME_ID` is exported from `src/lib/host/constants.ts` and is safe to import in client code (NEXT_PUBLIC_ prefix). The file name says "host" but the constant is used by all surfaces.
   - What's unclear: Whether Phase 6 (TV display) also imports from `host/constants.ts`, which would make the file naming mismatch more visible.
   - Recommendation: Import `GAME_ID` directly from `@/lib/host/constants` in Phase 5 guest components. Creating a duplicate `guest/constants.ts` adds confusion. Phase 7 or a separate refactor can rename the module if needed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tooling | Yes | v24.14.0 | — |
| npm | Package install | Yes | 11.9.0 | — |
| `NEXT_PUBLIC_GAME_ID` | `useGameSync` + join call | Set in Vercel (Phase 4 already uses it) | — | Falls back to seed UUID in `constants.ts` |
| `NEXT_PUBLIC_APP_URL` | QR code in LobbyScreen | NOT YET SET | — | `window.location.origin` (client-side fallback) |
| `NEXT_PUBLIC_SUPABASE_URL` | All Supabase calls | Set (Phase 1+) | — | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All Supabase calls | Set (Phase 1+) | — | — |

**Missing dependencies with no fallback:** None that block execution.

**Missing dependencies with fallback:**
- `NEXT_PUBLIC_APP_URL`: Not yet in `.env.local`. QR code falls back to `window.location.origin`. Planner should add a Wave 0 task to document and set this env var.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None configured (`"No test framework is configured."` — CLAUDE.md) |
| Config file | none |
| Quick run command | `npm run build` (type check + build verification) |
| Full suite command | `npm run build && npm run lint` |

**Note:** CLAUDE.md explicitly states "No test framework is configured." The `nyquist_validation: true` setting in config.json applies, but verification must be done via manual UAT and build-time checks given the absence of a test runner.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| JOIN-04 | Lobby shows live player count | manual-only | — | Requires Supabase Realtime; automated infra not configured |
| JOIN-05 | Lobby shows QR code | manual-only | — | Visual QR + scan verification required |
| PLAY-01 | Question appears within 1s of host start | manual-only | — | Requires live host action; timing is real-device verification |
| PLAY-02 | Exactly one A or B selectable | manual-only | — | Tap interaction on mobile |
| PLAY-03 | Lock persists through refresh | manual-only | — | Requires localStorage + server state check |
| PLAY-04 | Locked answer visually highlighted | manual-only | — | Visual assertion |
| PLAY-05 | Correct/wrong reveal within 1s | manual-only | — | Requires host reveal action |
| PLAY-06 | Leaderboard updates live | manual-only | — | Requires completed round |
| PLAY-07 | Winner screen + confetti appear | manual-only | — | Requires host end-game action |

### Build Gate (substitute for unit tests)

```bash
npm run build  # TypeScript compilation catches type errors in all guest components
npm run lint   # ESLint catches import/pattern violations
```

### Wave 0 Gaps

- [ ] `NEXT_PUBLIC_APP_URL` env var documented in `.env.local` template (or `README`/`CONTRIBUTING.md` equivalent)
- [ ] `react-qr-code` and `canvas-confetti` + `@types/canvas-confetti` installed

*No test file gaps — no test framework configured per CLAUDE.md.*

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Guest is anonymous; no auth credentials |
| V3 Session Management | Partial | Device token in localStorage — not a session token; no server-side session |
| V4 Access Control | Yes | Server enforces phase guard (403) and identity binding (deviceToken → playerId server-side) |
| V5 Input Validation | Yes | `displayName` trimmed, non-empty, ≤30 chars (Unicode code point count); enforced in `POST /api/game/join` |
| V6 Cryptography | No | No cryptographic operations in guest UI |

### Known Threat Patterns for Guest App Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Answer forgery (submitting as another player) | Spoofing | Server resolves player_id from (game_id, device_token) — never trusts client-supplied player_id (Phase 3 anti-cheat) |
| Double-answer submission | Tampering | UNIQUE(player_id, question_id) DB constraint; 409 on retry |
| Late answer after lock | Tampering | Phase guard in `POST /api/game/answer` (403 when phase != 'question') + WR-01 compensating delete |
| XSS via display name | Tampering | React renders all display names as text content (not innerHTML); no dangerouslySetInnerHTML |
| Device token leakage | Information Disclosure | localStorage only accessible to same origin; NEXT_PUBLIC_ keys are intentionally public (anon key) |

**No new security surface is introduced in Phase 5.** All mutations go through existing API routes with existing guards. The guest UI is read-only with respect to game state — it only writes via `POST /api/game/join` (once) and `POST /api/game/answer` (once per question).

---

## Sources

### Primary (HIGH confidence)

- `src/hooks/useGameSync.ts` — Full implementation read; SyncStatus enum, GameStateSnapshot shape, subscribe-then-fetch contract, all pitfalls documented inline
- `src/app/api/game/join/route.ts` — Confirmed UUID validation requirement, displayName constraints, idempotent upsert contract
- `src/app/api/game/answer/route.ts` — Confirmed deviceToken (not playerId) body field, phase guard, 409 dedup
- `src/app/api/game/state/route.ts` — Confirmed myAnswer, correctOption, distribution, leaderboard fields; leaderboard .limit(20)
- `src/lib/realtime/events.ts` — Full 8-member GameEvent union confirmed; no new members needed for Phase 5
- `src/app/globals.css` — All color tokens confirmed: ink, ink-light, ink-muted, champagne, champagne-dim, gold, gold-bright, gold-muted, blush, blush-deep, sage, sage-light; .glass utility confirmed
- `src/app/host/page.tsx` — Hydration pattern (hydrated useState + useEffect), PasswordGate structure, SyncStatus badge pattern
- `src/lib/host/constants.ts` — GAME_ID export, client-safe pattern confirmed
- `src/lib/supabase/client.ts` — worker:true, heartbeatIntervalMs:15000, jittered reconnectAfterMs confirmed
- `.planning/phases/05-guest-app/05-CONTEXT.md` — All 12 locked decisions confirmed
- `package.json` — motion@^12.40.0, nanoid@^5.0.0, @supabase/supabase-js@^2.106.0, react@^19.0.0 confirmed installed

### Secondary (MEDIUM confidence)

- `npm view react-qr-code version` → 2.0.21 (2026-06-04); slopcheck [OK]; github.com/rosskhanas/react-qr-code
- `npm view canvas-confetti version` → 1.9.4 (2026-06-04); slopcheck [OK]; github.com/catdad/canvas-confetti
- CLAUDE.md — canvas-confetti explicitly in tech stack; `crypto.randomUUID()` not mentioned but established via codebase grep and MDN

### Tertiary (LOW confidence)

- A1: `crypto.randomUUID()` browser availability on iOS 15.4+ [ASSUMED — not verified against wedding guest device targets]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing dependencies verified in package.json; two new packages verified via npm registry + slopcheck
- Architecture: HIGH — all API contracts verified by reading actual route implementations; `useGameSync` fully read
- Pitfalls: HIGH — all pitfalls derived from inline hook documentation and Phase 2/3 accumulated context decisions

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (stable stack; Supabase realtime contracts unlikely to change in 30 days)
