# Phase 5: Guest App - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 05-guest-app
**Areas discussed:** Routing & URL structure, A/B tap button UX, Phase-screen architecture, Entry flow & QR code

---

## Routing & URL Structure

| Option | Description | Selected |
|--------|-------------|----------|
| / (root) | Guests go to the bare URL; replaces sync-demo placeholder; QR = domain root | ✓ |
| /play | Dedicated sub-path; longer URL for guests | |
| /join | Same as /play, emphasises the join action | |

**User's choice:** `/` (root)
**Notes:** Phase 6's TV display goes to `/display` alongside it.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Baked into client via NEXT_PUBLIC_GAME_ID | Already wired in constants.ts; zero URL complexity | ✓ |
| /[gameId] URL path | Supports multiple games; overkill for single wedding | |
| /?game=<id> query param | Same tradeoffs as path option | |

**User's choice:** `NEXT_PUBLIC_GAME_ID` env var (already in constants.ts)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen name-entry gate | Analogous to host password gate; clear first impression | ✓ |
| Inline name entry in lobby | Lobby visible behind the input | |
| You decide | Leave to planner | |

**User's choice:** Full-screen name-entry gate

---

## A/B Tap Button UX

| Option | Description | Selected |
|--------|-------------|----------|
| Two large full-width stacked (A top, B below) | Easy tap anywhere; handles long option text | ✓ |
| Side by side, equal half-width | Compact but harder to tap on narrow phones | |
| Side by side, large circular | Game-show energy; requires very short labels | |

**User's choice:** Full-width stacked, A on top, B below.
**Notes:** User clarified button labels — A/B show `optionA`/`optionB` text (e.g. "Andu" / "Cristina"). Layout suits wedding-style short name labels.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Glass idle, gold locked | Semi-transparent idle; gold border+glow on selected; other option fades | ✓ |
| A = blush, B = sage (always color-coded) | Each button has own color identity regardless of selection | |
| Both ink-dark; selected fills champagne | High contrast, less glassy | |

**User's choice:** Champagne-on-glass idle; gold glow + border on selected/locked; other option fades.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Correct glows gold; wrong gets red/desaturated overlay | In-place on buttons; both stay visible | ✓ |
| Full-screen result splash (✓/✗ + score change) | Dramatic but harder to do reliably in 1s | |
| You decide | Leave to planner | |

**User's choice:** In-place reveal — correct glows gold, wrong gets subtle red/desaturated overlay.

---

## Phase-Screen Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Single page, conditional rendering per phase | Switch on state.phase; simple and reliable | ✓ |
| Distinct animated screens with AnimatePresence | Cinematic; Phase 7 can layer this in later | |
| Separate route segments per phase | Complex; couples routing to game state | |

**User's choice:** Single page, conditional rendering on `state.phase`.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Below question / always visible when non-empty | Guest scrolls; host controls pacing | ✓ |
| Full-screen takeover when phase = revealed | Dramatic but loses correct/wrong context | |
| Collapsible panel guest opens | Guest-controlled; may feel hidden | |

**User's choice:** Leaderboard below the question/reveal result, always visible when non-empty.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Leaderboard + #1 featured prominently + confetti | canvas-confetti burst; gold/champagne winner treatment | ✓ |
| Simple "Game Over" + final leaderboard | Calm; less celebratory | |
| You decide | Leave to planner | |

**User's choice:** Leaderboard with #1 featured + `canvas-confetti` burst on entering `ended` phase.

---

## Entry Flow & QR Code

| Option | Description | Selected |
|--------|-------------|----------|
| Centered card: logo/title + name input + 'Joacă!' | Glassmorphism card, Playfair Display heading, branded | ✓ |
| Minimal: name input + button only | Fast, no-frills | |
| You decide | Leave to planner | |

**User's choice:** Centered glassmorphism card with game title heading and "Joacă!" submit button.

---

| Option | Description | Selected |
|--------|-------------|----------|
| In lobby screen, links to NEXT_PUBLIC_APP_URL | Guests share with others; new guests land on name-entry gate | ✓ |
| On name-entry gate only | Less common flow | |
| Both gate and lobby | More surface area | |

**User's choice:** QR code in lobby screen only, encodes `NEXT_PUBLIC_APP_URL`.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle badge/dot at top (non-blocking) | Small "Se conectează..." / "Reconectare..." badge; never blocks content | ✓ |
| Full-screen loading overlay on initial connect only | Cleaner first load; perceptible delay on slow connections | |
| You decide | Leave to planner | |

**User's choice:** Subtle top badge for all `SyncStatus` states; guest never blocked.

---

## Claude's Discretion

None — all areas were decided by the user.

## Deferred Ideas

None — discussion stayed within phase scope.
