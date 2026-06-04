---
phase: 05-guest-app
verified: 2026-06-05T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
gaps: []
human_verification:
  - test: "Open / on a phone browser (first visit): enter a name and tap Joacă!"
    expected: "POST /api/game/join succeeds; guest lands in LobbyScreen showing participant count and a scannable QR code; no account creation required"
    why_human: "Full join-to-lobby round-trip requires a live Supabase instance; participant count updates require real Presence tracking; QR scannability requires a physical device"
  - test: "With a game in 'question' phase: open / and confirm screen transitions without page refresh within 1 second of host start action"
    expected: "GuestShell receives Broadcast GAME_EVENT, useGameSync re-fetches, QuestionScreen renders with A and B options within ~1s"
    why_human: "Sub-second latency requirement cannot be verified by static analysis; requires live Broadcast channel and two connected tabs"
  - test: "Tap A (or B) on QuestionScreen; then tap the other button"
    expected: "First tap locks gold immediately (button border-gold, other fades opacity-40); second tap has no effect; both buttons remain in lock state"
    why_human: "Optimistic lock visual state and tap no-op behavior require interactive UI testing; cannot verify rendered classes from static analysis"
  - test: "With a locked answer: refresh the page"
    expected: "Guest skips NameGate (identity in localStorage); QuestionScreen re-mounts; localAnswer is seeded from state.myAnswer returned by GET /api/game/state; locked answer is visible"
    why_human: "Reconnect identity persistence requires localStorage read + live API round-trip; page refresh flow cannot be exercised statically"
  - test: "When host reveals: observe RevealScreen within 1 second"
    expected: "Correct option shows gold glow + CheckCircle + Corect!; guest's wrong answer shows red overlay + XCircle + Greșit; A/B distribution bars appear; leaderboard appears below when non-empty"
    why_human: "Reveal event propagation latency and in-place visual rendering require live host action + connected guest tab"
  - test: "When host ends game: observe WinnerScreen; verify confetti fires exactly once"
    expected: "#1 player featured in glass-gold card with Trophy icon; full leaderboard rendered; confetti burst fires once and does not re-fire on subsequent broadcasts"
    why_human: "Confetti timing and fire-once behavior require visual inspection; winner card requires real leaderboard data from Supabase"
---

# Phase 05: Guest App Verification Report

**Phase Goal:** A guest can join the game on their phone by entering their name, wait in a live lobby, answer questions with a single tap, see their answer lock and the reveal, follow the leaderboard, and reach the winner screen — with the entire journey surviving network drops without losing their identity or score.
**Verified:** 2026-06-05
**Status:** human_needed — all automated checks pass; 6 items require live Supabase + device testing
**Re-verification:** No — initial verification

---

## Pre-Verification Note: Missing npm install

At the start of verification, `npm run build` failed with:

```
Module not found: Can't resolve 'react-qr-code'
Module not found: Can't resolve 'canvas-confetti'
```

Both packages were declared in `package.json` and `package-lock.json` (committed at ab556f1) but were absent from `node_modules/`. Running `npm install` resolved the issue. This is an environment setup gap — the working directory's node_modules was not updated after the phase commits merged. The packages are correctly declared and build passes after install.

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| SC1 | Guest enters name, sees lobby with live participant count and QR code, no account needed | VERIFIED (code) / human for live behavior | `NameGate.tsx` POSTs to `/api/game/join` with `{gameId, deviceToken, displayName}`; `LobbyScreen.tsx` renders `{participantCount} jucători s-au alăturat` and `QRCode` from `react-qr-code` with `window.location.origin` fallback |
| SC2 | Host start → guest screen transitions within 1 second, no page refresh | VERIFIED (code) / human for latency | `page.tsx` `GameView` calls `useGameSync(GAME_ID, identity.playerId)` exactly once; switch on `state.phase` drives `LobbyScreen → QuestionScreen` without routing; Broadcast + re-fetch path wired in `useGameSync` |
| SC3 | A/B tap locks immediately; second tap no-ops; locked state persists through page refresh | VERIFIED (code) / human for visual | `handleTap` returns early when `localAnswer !== null`; `useEffect([state.myAnswer])` seeds `localAnswer` from authoritative server state on reconnect; selected button gets `border-gold text-gold-bright`, unselected gets `opacity-40 pointer-events-none` |
| SC4 | Reveal shows correct/wrong feedback live within 1 second of host action | VERIFIED (code) / human for latency | `RevealScreen.tsx` renders in-place (no Dialog/modal); `getRevealClass()` applies `border-gold-bright` on correct option and `border-red-500/60 bg-red-500/20` on wrong locked choice; `CheckCircle2` + "Corect!" and `XCircle` + "Greșit" satisfy WCAG 1.4.1 (color not sole signal) |
| SC5 | Refresh/reconnect re-links guest to existing player record and shows current state | VERIFIED (code) / human for end-to-end | `identity.ts` uses `localStorage["device_token"]` + `localStorage["player_id"]`; `GuestShell` hydration guard reads identity on mount, skips NameGate if present; `useGameSync` re-fetches via `GET /api/game/state?gameId=&playerId=` on every SUBSCRIBED event; `state.myAnswer` seeds `QuestionScreen.localAnswer` on reconnect |

**Score:** 5/5 truths verified at code level

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/guest/identity.ts` | SSR-safe localStorage helpers | VERIFIED | Exports `getOrCreateDeviceToken`, `getIdentity`, `setIdentity`; uses `crypto.randomUUID()` (not nanoid); keys `"device_token"` and `"player_id"` match useGameSync contract; all three functions have `typeof window === "undefined"` guards |
| `src/components/guest/SyncStatusBadge.tsx` | Non-blocking connection badge, hidden when connected | VERIFIED | Returns `null` for `"connected"`; typed `Record<Exclude<SyncStatus, "connected">, string>` for exhaustive copy; correct Romanian copy: "Se conectează...", "Reconectare...", "Eroare conexiune"; `role="status" aria-live="polite"` |
| `src/components/guest/LeaderboardPanel.tsx` | Ranked list, null when empty, top-3 highlighting | VERIFIED | Returns null when `leaderboard.length === 0`; `<ol role="list">` with rank/name/score; `text-gold-bright font-bold` for #1, `text-champagne` for #2-#3, `text-champagne-dim` for #4+; `Separator` between entries, not after last |
| `src/components/guest/NameGate.tsx` | Full-screen join card with POST /api/game/join | VERIFIED | Glass card with Playfair heading, Input `h-12`, Loader2 spinner during request; POSTs `{gameId: GAME_ID, deviceToken, displayName}`; Romanian errors "Numele nu poate fi gol." and "Ceva nu a mers. Încearcă din nou."; `role="alert" aria-live="polite"` on error |
| `src/components/guest/LobbyScreen.tsx` | Lobby with participant count + QR code | VERIFIED | Renders `{participantCount} jucători s-au alăturat`; `QRCode` from `react-qr-code` with `value={NEXT_PUBLIC_APP_URL ?? window.location.origin}`; `size={160} bgColor="transparent" fgColor="#f5e6c8"`; `SyncStatusBadge` at top |
| `src/app/page.tsx` | GuestShell — single `"use client"` component, phase switch | VERIFIED | First line `"use client"`; no `export const dynamic`; hydration guard (`hydrated` state); `useGameSync(GAME_ID, identity.playerId)` called exactly once; switch covers all 5 phases + null + unknown; exhaustiveness check with `never` |
| `src/components/guest/QuestionScreen.tsx` | A/B tap with optimistic lock, refresh-proof | VERIFIED | Uses `state.currentQuestion.body` (not `.text`); POSTs to `/api/game/answer` with `deviceToken` (not `playerId`); `useEffect([state.myAnswer])` seed; `handleTap` no-op guard; `min-h-[120px] w-full`; `gap-4` between buttons; no `useGameSync` call |
| `src/components/guest/RevealScreen.tsx` | In-place reveal feedback + distribution + leaderboard | VERIFIED | No Dialog/modal import; `getRevealClass()` for correct/wrong/neither; `CheckCircle2` + "Corect!" and `XCircle` + "Greșit"; `state.distribution !== null` guard; `total === 0` guard; `LeaderboardPanel` rendered; no `useGameSync` call |
| `src/components/guest/WinnerScreen.tsx` | #1 featured + final leaderboard + one-shot confetti | VERIFIED | Dynamic `import("canvas-confetti")` inside `useEffect` (not static import); `useRef(false)` (`confettiFired`) guard; `state.leaderboard[0] ?? null` graceful fallback; "Câștigător!" heading; "Clasament final" subheading; `LeaderboardPanel` rendered; no `useGameSync` call |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `NameGate.tsx` | `/api/game/join` | `fetch POST {gameId, deviceToken, displayName}` | WIRED | Line 49-53 confirmed |
| `page.tsx` | `useGameSync` | `useGameSync(GAME_ID, identity.playerId)` called once in `GameView` | WIRED | Line 67-70 confirmed, grep count = 1 |
| `LobbyScreen.tsx` | `react-qr-code` | `QRCode value={appUrl}` | WIRED | Line 13 import + line 63 render confirmed |
| `QuestionScreen.tsx` | `/api/game/answer` | `fetch POST {gameId, deviceToken, choice}` | WIRED | Lines 98-106 confirmed |
| `QuestionScreen.tsx` | `state.myAnswer` | `useEffect seeds localAnswer from state.myAnswer` | WIRED | Lines 82-86 confirmed |
| `RevealScreen.tsx` | `LeaderboardPanel.tsx` | `<LeaderboardPanel leaderboard={state.leaderboard} />` | WIRED | Line 183 confirmed |
| `WinnerScreen.tsx` | `canvas-confetti` | `import("canvas-confetti")` inside `useEffect` guarded by `useRef(false)` | WIRED | Lines 41-48 confirmed |
| `WinnerScreen.tsx` | `LeaderboardPanel.tsx` | `<LeaderboardPanel leaderboard={state.leaderboard} />` | WIRED | Line 112 confirmed |

---

## Architecture Compliance (D-01..D-12)

| Decision | Requirement | Status | Evidence |
|----------|-------------|--------|---------|
| D-01 | Guest app at root `/` | VERIFIED | `src/app/page.tsx` is GuestShell; build output confirms `○ / 10.7 kB 188 kB` |
| D-03 | Full-screen gate for first-time; skip for returning | VERIFIED | `GuestShell` checks `identity === null` after hydration; `NameGate onJoined={setIdentity}` |
| D-04 | Two large stacked A/B buttons | VERIFIED | `min-h-[120px] w-full` + `flex flex-col gap-4` in QuestionScreen |
| D-05 | Glass idle / gold locked styling | VERIFIED | `getButtonClass()` applies `.glass` idle, `.glass-gold border-2 border-gold` selected, `opacity-40 pointer-events-none` unselected |
| D-06 | In-place reveal, no modal | VERIFIED | `RevealScreen` uses `<div>` cards; no Dialog import; both options rendered in-place |
| D-07 | Single page, switch on state.phase, no AnimatePresence | VERIFIED | `page.tsx` switch confirmed; no AnimatePresence import |
| D-08 | Leaderboard below reveal when non-empty | VERIFIED | `LeaderboardPanel` renders in RevealScreen + WinnerScreen; returns null when empty |
| D-09 | Winner screen: #1 featured + confetti | VERIFIED | Trophy icon, `text-gold-bright` winner name, `LeaderboardPanel`, dynamic confetti |
| D-10 | Name gate: centered glass card, Playfair heading, "Joacă!" CTA | VERIFIED | `NameGate.tsx` lines 76-144 confirmed |
| D-11 | QR code in lobby via react-qr-code | VERIFIED | `LobbyScreen.tsx` imports and renders `QRCode` |
| D-12 | SyncStatusBadge non-blocking, hidden when connected | VERIFIED | Returns `null` for `"connected"`; absolute-positioned, does not affect layout |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `page.tsx` (GameView) | `state`, `status`, `participantCount` | `useGameSync(GAME_ID, identity.playerId)` → `GET /api/game/state` | Yes — fetches from Supabase DB on every SUBSCRIBED event | FLOWING |
| `LobbyScreen.tsx` | `participantCount` | Supabase Presence tracking via `useGameSync` | Yes — real presence count, not hardcoded | FLOWING |
| `QuestionScreen.tsx` | `state.currentQuestion.body/optionA/optionB`, `state.myAnswer` | Props from `GameView` | Real DB-backed data from `/api/game/state` | FLOWING |
| `RevealScreen.tsx` | `state.correctOption`, `state.distribution`, `state.leaderboard` | Props from `GameView` | Phase-gated by server: `correctOption` only populated in `revealed` phase | FLOWING |
| `WinnerScreen.tsx` | `state.leaderboard` | Props from `GameView` | Real ranked scores from `recompute_scores` RPC | FLOWING |

---

## Requirements Coverage

| Requirement | Plan | Description | Status | Evidence |
|-------------|------|-------------|--------|---------|
| JOIN-04 | 05-01 | Guest waits in lobby with live state until host starts | VERIFIED | `LobbyScreen` with `participantCount` driven by Presence; `useGameSync` phase switch transitions to question |
| JOIN-05 | 05-01 | Lobby shows join QR code / link | VERIFIED | `QRCode` component with `value={NEXT_PUBLIC_APP_URL ?? window.location.origin}` |
| PLAY-01 | 05-02 | Guest sees current question with A/B pushed live, no refresh | VERIFIED | Phase switch `"question"/"locked" → QuestionScreen`; `state.currentQuestion.body/optionA/optionB` rendered |
| PLAY-02 | 05-02 | Guest selects exactly one answer | VERIFIED | `handleTap` returns early when `localAnswer !== null`; only one can be selected |
| PLAY-03 | 05-02 | Submitting locks answer; cannot be changed | VERIFIED | `localAnswer` state + `useEffect([state.myAnswer])` seed for reconnect persistence |
| PLAY-04 | 05-02 | UI shows selected/locked answer + waiting state | VERIFIED | Gold selected button + "Aștepți dezvăluirea..." copy when `isLocked` |
| PLAY-05 | 05-02 | Guest sees correct-answer reveal live when host reveals | VERIFIED | `RevealScreen` with `getRevealClass()` + icon+text feedback (WCAG 1.4.1) |
| PLAY-06 | 05-02/03 | Leaderboard updates live between rounds | VERIFIED | `LeaderboardPanel` in `RevealScreen` (between rounds) + `WinnerScreen` (game end) |
| PLAY-07 | 05-03 | Guest sees game-end / winner state live | VERIFIED | `WinnerScreen` with #1 featured + full leaderboard + confetti |

---

## Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `npm run build` exits 0 | `npm run build` in working directory | Build successful after `npm install` (packages were in package.json, not in node_modules before install) | PASS (after install) |
| `npm run lint` exits 0 | `npm run lint` | No errors, no output other than command invocation | PASS |
| Root route compiled | Build output line `○ / 10.7 kB 188 kB` | Confirmed at 10.7 kB (larger than sync-demo at 3.34 kB — consistent with full GuestShell) | PASS |
| No static canvas-confetti import | `grep "^import.*canvas-confetti" WinnerScreen.tsx` | No top-level import; dynamic `import("canvas-confetti")` inside `useEffect` only | PASS |
| useGameSync called exactly once | `grep -c "useGameSync(" page.tsx` | Count = 1 | PASS |
| Screen components do not call useGameSync | `grep -rn "useGameSync" src/components/guest/` | Only type-only imports (`import type { SyncStatus }`) — no hook calls | PASS |
| crypto.randomUUID used (not nanoid) | `grep "crypto.randomUUID\|nanoid" identity.ts` | `crypto.randomUUID()` on line 30; nanoid only in comment explaining why it is NOT used | PASS |

---

## Anti-Patterns Scan

Files modified by Phase 5: `src/lib/guest/identity.ts`, `src/components/guest/SyncStatusBadge.tsx`, `src/components/guest/LeaderboardPanel.tsx`, `src/components/guest/NameGate.tsx`, `src/components/guest/LobbyScreen.tsx`, `src/components/guest/QuestionScreen.tsx`, `src/components/guest/RevealScreen.tsx`, `src/components/guest/WinnerScreen.tsx`, `src/app/page.tsx`.

| File | Pattern | Severity | Finding |
|------|---------|----------|---------|
| All guest components | TBD / FIXME / XXX | Checked | None found |
| All guest components | TODO / PLACEHOLDER residuals | Checked | None found in QuestionScreen, RevealScreen, WinnerScreen (05-01 stubs fully replaced) |
| `WinnerScreen.tsx` | Static canvas-confetti import | Checked | No static import — dynamic `import()` only — PASS |
| `RevealScreen.tsx` | `return null / [] / {}` (hollow data) | Checked | Distribution section conditionally rendered on `state.distribution !== null`; no hardcoded empty returns |
| `page.tsx` | `export const dynamic` (leftover Server Component) | Checked | Not present — PASS |

No blockers or warnings found.

---

## Environment Gap (Informational)

The packages `react-qr-code@2.0.21` and `canvas-confetti@1.9.4` were correctly added to `package.json` and `package-lock.json` at commit `ab556f1`, but `node_modules/` in the main working directory was not updated after the phase commits merged from the worktree. Running `npm install` resolved the build failure. This is a developer environment action, not a code defect.

**Action required before any developer runs the project for the first time after pulling Phase 5:** run `npm install`.

---

## Human Verification Required

All 5 success criteria are verified at the code level. The following 6 items require a live Supabase environment and a real device/browser to confirm end-to-end behavior:

### 1. Join-to-Lobby Flow (SC1)

**Test:** Open `/` on a phone browser with no prior localStorage state; enter a name; tap "Joacă!"
**Expected:** POST to `/api/game/join` succeeds; player is created in Supabase; LobbyScreen appears showing a non-zero participant count and a scannable QR code encoding the app URL
**Why human:** Requires live Supabase `players` table upsert and real Presence channel tracking; QR scannability requires a physical device with camera

### 2. Host-Start Screen Transition (SC2)

**Test:** With a guest in the lobby, trigger a host "Start" transition; observe the guest's screen
**Expected:** GuestShell transitions from LobbyScreen to QuestionScreen within ~1 second, with no page refresh; question text and A/B options visible
**Why human:** Sub-second latency requires live Broadcast channel; cannot be verified statically

### 3. A/B Tap Lock + Second Tap No-Op (SC3)

**Test:** On QuestionScreen, tap A; then tap B
**Expected:** A locks gold (gold border + glow + other option fades); second tap on B has no visual or network effect; "Aștepți dezvăluirea..." appears below
**Why human:** Interactive tap behavior and rendered CSS classes require UI testing

### 4. Locked Answer Persists Through Refresh (SC3)

**Test:** Tap A to lock; reload the page
**Expected:** NameGate is skipped (identity in localStorage); QuestionScreen shows A still locked (seeded from `state.myAnswer` returned by `/api/game/state`)
**Why human:** Requires localStorage read + live API round-trip after page refresh

### 5. Reveal Screen (SC4)

**Test:** With a guest who tapped A, host reveals with B as correct; observe guest's screen
**Expected:** B glows gold with CheckCircle + "Corect!"; A shows red overlay with XCircle + "Greșit"; distribution bars appear; leaderboard appears below within ~1 second
**Why human:** Requires live reveal broadcast + Supabase score data for distribution and leaderboard

### 6. Winner Screen + Confetti (PLAY-07)

**Test:** Host ends the game; observe guest's screen; navigate away and back to verify confetti behavior
**Expected:** WinnerScreen shows #1 player in glass-gold card with Trophy icon; full leaderboard below; confetti fires once on mount; does not re-fire if other Broadcast events arrive
**Why human:** Requires real leaderboard data; confetti timing requires visual inspection

---

## Gaps Summary

No code-level gaps found. All 9 requirements (JOIN-04, JOIN-05, PLAY-01 through PLAY-07) are implemented with substantive code. All key architectural constraints (D-01 through D-12) are honored. Build and lint pass. Status is `human_needed` because 5 success criteria involve live timing, visual rendering, and end-to-end Supabase round-trips that cannot be verified by static analysis alone.

---

_Verified: 2026-06-05_
_Verifier: Claude (gsd-verifier)_
