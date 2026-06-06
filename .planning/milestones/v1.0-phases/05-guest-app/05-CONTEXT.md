# Phase 5: Guest App - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers the complete guest-side game journey running on guests' phones:
- **Name-entry gate** → idempotent join → **live lobby** (participant count + QR code) → **A/B question answering** (tap to lock) → **reveal** (correct/wrong feedback) → **leaderboard between rounds** → **winner / game-end screen** with confetti.
- The entire journey survives network drops: device-token-based reconnect re-links the guest to their existing player record and shows current game state.

**All 9 requirements in scope:** JOIN-04, JOIN-05, PLAY-01, PLAY-02, PLAY-03, PLAY-04, PLAY-05, PLAY-06, PLAY-07.

**Not in scope (explicit Phase 5 boundary):**
- TV / Display Mode route → Phase 6
- Animation polish, performance validation, dry-run testing → Phase 7
- Host dashboard changes (already complete in Phase 4)
- Any additional game phases or scoring variations

</domain>

<decisions>
## Implementation Decisions

### Routing & URL Structure
- **D-01:** The guest app lives at **`/` (root route)**. `src/app/page.tsx` becomes the guest app entry point, replacing the throwaway `sync-demo` placeholder. Guests open the bare domain URL. Phase 6's TV display sits at `/display` alongside it.
- **D-02:** `GAME_ID` is **baked into the client** via `NEXT_PUBLIC_GAME_ID` env var — already wired in `src/lib/host/constants.ts`. No URL-based game ID. Guests open one URL and the app knows which game. QR code links to `NEXT_PUBLIC_APP_URL` (new env var — the deployed domain root).
- **D-03:** **Full-screen name-entry gate** on first load. If no device token / player record exists in localStorage, a full-screen gate is shown (analogous to the host password gate). Once the guest submits their name, call `POST /api/game/join`, store `{ deviceToken, playerId }` in localStorage, and drop them into the live game view. Returning guests (localStorage has valid token + playerId) skip the gate directly to the game view.

### A/B Tap Button UX
- **D-04:** **Two large full-width stacked buttons**, A on top, B below. Each button displays the question's `optionA`/`optionB` text (e.g. "Andu" / "Cristina" style labels). Buttons take up a substantial portion of screen height — easy to tap anywhere on them.
- **D-05:** **Color scheme — glass idle, gold locked:**
  - Idle (unselected): semi-transparent `.glass` card buttons, champagne text on ink background.
  - Selected / locked: the chosen button gets a gold border + gold text glow; the other option fades out (reduced opacity, pointer-events-none). Uses existing `gold`, `gold-bright`, and `champagne` tokens.
- **D-06:** **Reveal feedback — in-place on the buttons:**
  - Correct answer: glows gold (ring + text color: `gold-bright`).
  - Wrong answer (guest's locked choice): subtle red/desaturated overlay — `red-500/40` overlay or opacity drop.
  - Both buttons remain visible — guest sees which option was correct even if they didn't pick it.
  - No modal / full-screen splash — the reveal happens in-place within ~1 second of the host action.

### Phase-Screen Architecture
- **D-07:** **Single page, conditional rendering per phase.** One React client component renders different content based on `state.phase` from `useGameSync`. Switch/conditional on `"lobby" | "question" | "locked" | "revealed" | "ended"`. No additional routing — no Next.js route segments per phase, no AnimatePresence phase transitions in Phase 5 (Phase 7 handles animation polish). Phase transitions are simple conditional re-renders, which is reliable and fast.
- **D-08:** **Leaderboard placement — always visible below the question / reveal result when non-empty.** After reveal, the leaderboard appears below the A/B result area. Guest can scroll to see rankings. It does not take over the screen — host moves to the next question when ready and the leaderboard content updates live.
- **D-09:** **Game-end / winner screen** — full leaderboard with #1 featured prominently (larger name + gold/champagne treatment), plus a `canvas-confetti` burst fired once on entering the `ended` phase. Celebratory but not over-the-top — matches the soft-luxury wedding aesthetic.

### Entry Flow & QR Code
- **D-10:** **Name-entry gate visual** — centered glassmorphism card on a full ink-dark background. Playfair Display heading (e.g. "Joc — Cristina & Andrei" or equivalent game title), a name text input, and a primary "Joacă!" submit button. Romanian copy throughout. Error state: inline "Numele nu poate fi gol." / "Ceva nu a mers. Încearcă din nou." without page reload.
- **D-11:** **QR code lives in the lobby screen** (phase = `"lobby"`). Once a guest has joined and is waiting, they see a QR code they can show/share with other guests who haven't joined yet. The QR code encodes `NEXT_PUBLIC_APP_URL` (the root URL of the deployed app). New guests who scan it land on the name-entry gate. Use `qrcode` npm package or `react-qr-code` — planner to pick the lightest well-maintained option.
- **D-12:** **Reconnect / connecting UX — subtle non-blocking status indicator.** A small badge/dot at the top of the screen shows `SyncStatus`:
  - `"connecting"` → "Se conectează..." badge (champagne-dim text)
  - `"reconnecting"` → "Reconectare..." badge with a gentle pulse
  - `"connected"` → no badge (clean screen)
  - `"error"` → "Eroare conexiune" badge (red-500 text)
  The guest is never blocked from seeing current content during reconnect — this is a background signal, not a full-screen overlay. The `status` field from `useGameSync` drives this directly.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Sync Primitive (Phase 2)
- `src/hooks/useGameSync.ts` — The headless sync hook. `useGameSync(gameId, playerId)` returns `{ state: GameStateSnapshot | null, status: SyncStatus, participantCount: number }`. Subscribe-then-fetch pattern; typed `GameStateSnapshot` shape drives all guest UI rendering. **Read the full file** — pitfalls, reconnect behavior, presence flooding prevention (D-04, D-09 in Phase 2 context), and the `SyncStatus` enum are all documented inline.
- `src/lib/realtime/events.ts` — Full 8-member `GameEvent` discriminated union. Guest app must NOT add new union members — all events already exist.

### Server APIs (Phase 3)
- `src/app/api/game/join/route.ts` — `POST /api/game/join` — body: `{ gameId, deviceToken, displayName }`, returns `{ ok: true, playerId }`. Idempotent upsert on `(game_id, device_token)`.
- `src/app/api/game/answer/route.ts` — `POST /api/game/answer` — body: `{ gameId, deviceToken, choice: "A" | "B" }`. Phase-guarded (403 if not `question`), DB-deduped (409 on repeat). **Sends `deviceToken`, NOT `playerId`** — server resolves player server-side (anti-cheat, D in Phase 3 context).
- `src/app/api/game/state/route.ts` — `GET /api/game/state?gameId=&playerId=` — returns full `GameStateSnapshot`. Called by `useGameSync` on every reconnect; guest UI consumes via the hook, NOT by calling this directly.

### Constants & Theme (Phase 4)
- `src/lib/host/constants.ts` — `GAME_ID` (`NEXT_PUBLIC_GAME_ID` env), reusable UUID logic. Guest app needs a parallel guest-constants file or can read `GAME_ID` directly from here.
- `src/app/globals.css` — `@theme` block: ink, champagne, gold, blush, sage color tokens; `.glass` utility. Guest UI MUST use these tokens — no ad-hoc color values.

### Requirements
- `.planning/REQUIREMENTS.md` §"Guest Experience" — JOIN-04, JOIN-05, PLAY-01..07 (9 requirements, all Phase 5).
- `.planning/ROADMAP.md` §"Phase 5: Guest App" — Success criteria (5 items) that VERIFICATION.md must check against.

### Prior Phase Contexts (locked decisions to honor)
- `.planning/phases/02-realtime-core/02-CONTEXT.md` — subscribe-then-fetch contract, presence flooding prevention (track() once per reconnect only), `visibilitychange` pitfall.
- `.planning/phases/03-server-write-path-state-machine/03-CONTEXT.md` — device token = UUID v4 in localStorage, duplicate names allowed, Romanian diacritics/emoji OK in display names, answer endpoint takes `deviceToken` not `playerId`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/hooks/useGameSync.ts` — Ready to use. Pass `GAME_ID` (from constants) and `playerId` (from localStorage after join). Returns the full `GameStateSnapshot` — all guest screens read from this single source.
- `src/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `badge.tsx`, `skeleton.tsx` — All installed shadcn/ui primitives. Guest UI should use these, not hand-roll.
- `.glass` CSS utility — `src/app/globals.css`. Use for the name-entry card, A/B buttons (idle state), and lobby card.
- `src/lib/host/constants.ts` — `GAME_ID` can be imported directly in guest components (`NEXT_PUBLIC_` prefix, client-safe).

### Established Patterns
- **Subscribe-then-fetch** — never read data off broadcast payload; always re-fetch via `useGameSync`. Guest components receive state as props from the hook, not by subscribing themselves.
- **Device token in localStorage** — Phase 3 established: generate with `nanoid()` as UUID v4; persist across sessions; used as the `deviceToken` field in join/answer calls.
- **Romanian copy** — All user-facing strings in Romanian. Examples from Phase 4: "Se conectează", "Eroare conexiune", "Joacă!", "Aștepți...".
- **`adminClient` (server-only)** — Guest app's API routes already use `adminClient` from `@/lib/supabase/admin`. No new server-side client patterns needed.
- **Ink-dark background, champagne text** — `body` in globals.css sets the baseline. Guest screens inherit this; no need to reset background per component.

### Integration Points
- `src/app/page.tsx` — **Replace entirely** with the guest app shell. The sync-demo content goes away. This file becomes the root client component that mounts `useGameSync` and conditionally renders the phase-specific screen.
- `src/app/layout.tsx` — Already has font loading (Playfair Display, Inter) and base `<body>` class. Guest app inherits these — no layout changes needed.
- `NEXT_PUBLIC_GAME_ID` env var — Must be set in `.env.local` and Vercel env for the guest app to know which game to join. Already used by the host dashboard.
- **New env var needed:** `NEXT_PUBLIC_APP_URL` — the deployed root URL, used to generate the QR code in the lobby. Planner must add to `.env.local` template and Vercel.

</code_context>

<specifics>
## Specific Ideas

- **Wedding branding on name-entry gate:** Heading should reference the couple — e.g. "Joc — Cristina & Andrei" or just "Joc" with a subtitle. Planner can use the game title from PROJECT.md or derive from an env var. Playfair Display font for the heading.
- **A/B button label format:** The buttons display `optionA` / `optionB` text from the current question (populated by the host during question authoring in Phase 4). Example: A = "Andu", B = "Cristina". The layout handles short labels (names) naturally with the full-width stacked design.
- **"Joacă!" button copy** — Romanian for "Play!" — confirmed submit button label for the name-entry gate.
- **QR code library:** `react-qr-code` or the `qrcode` npm package — planner picks the lightest well-maintained option. No special styling needed beyond sizing it to fit the lobby card.
- **`canvas-confetti`** — Already listed in CLAUDE.md's tech stack. Import imperatively in a client component; fire once when `state.phase` transitions to `"ended"`. Do not use `react-confetti`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 5-Guest App*
*Context gathered: 2026-06-04*
