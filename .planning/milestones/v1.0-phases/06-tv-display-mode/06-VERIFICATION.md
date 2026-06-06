---
phase: 06-tv-display-mode
verified: 2026-06-05T14:30:00Z
status: human_needed
score: 7/8 must-haves verified (DISP-08 descoped per user request)
overrides_applied: 0
descoped:
  - requirement: DISP-08
    reason: "Countdown feature intentionally removed by user — manual trigger had no purpose in the live event flow. All three deliverables (CountdownOverlay component, POST /api/host/countdown route, ControlTab Section D) were removed in commit c166757 at user request."
    commit: "c166757"
human_verification:
  - test: "Live lobby sync — open /display and join from a second tab"
    expected: "The participant count on /display updates within ~1 second when a guest joins at /. No manual refresh needed."
    why_human: "Requires a running Supabase Realtime channel; cannot verify WebSocket delivery with grep."
  - test: "Question entry animation"
    expected: "When host starts the game, the question text slides up from below into the display with a smooth 400ms ease-out. A/B cards appear with no percentage bars."
    why_human: "CSS animation timing and visual quality require browser rendering."
  - test: "Locked-phase live A/B bars fill"
    expected: "When host locks, the display shows A/B percentage bars. Each time a guest submits an answer and useGameSync re-fetches, the bar widths update smoothly via CSS transition-[width]."
    why_human: "Requires live vote submissions and realtime re-fetches to observe bar animation."
  - test: "Reveal gold-glow effect + top-5 leaderboard"
    expected: "The correct option card glows gold and scales up slightly; the wrong option dims to ~40% opacity. A top-5 leaderboard appears below the bars, readable from a few metres."
    why_human: "Visual quality and legibility on TV require human inspection."
  - test: "Winner screen at game end"
    expected: "When host ends the game, the display shows 'Câștigător!' heading, #1 player's name in gold in a glass-gold hero card with a trophy icon, correct-answer count as subtitle, full ranked leaderboard, 'Felicitări tuturor!' footer. No confetti."
    why_human: "Requires a completed game with leaderboard entries and visual inspection."
  - test: "Connection status dot — green when live, amber when reconnecting"
    expected: "Top-right dot is bg-sage (green) when connected with no label. When network is interrupted (DevTools offline), dot turns bg-gold animate-pulse (amber pulsing) with 'Reconectare...' label. Returns to green after reconnect."
    why_human: "Requires network manipulation and visual inspection of the dot color."
  - test: "Fullscreen button enters fullscreen and hides itself"
    expected: "Clicking 'Ecran complet' enters browser fullscreen; the button disappears. Pressing Esc exits fullscreen and the button reappears."
    why_human: "Fullscreen API behavior requires browser interaction."
---

# Phase 6: TV Display Mode Verification Report

**Phase Goal:** A dedicated `/display` route delivers a cinematic, landscape-optimized big-screen experience that auto-syncs with host actions independently — showing each phase of the game with large typography, animated transitions, live answer bars, reveal effects, a leaderboard, and a winner screen.
**Verified:** 2026-06-05T14:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## DISP-08 Descope Notice

Requirement DISP-08 ("Display supports a host-initiated cosmetic countdown for tension") was **intentionally removed** from the codebase at user request prior to verification. Commit `c166757` ("feat(06): remove countdown feature — manual trigger had no purpose") deleted:
- `src/components/display/CountdownOverlay.tsx`
- `src/app/api/host/countdown/route.ts`
- Countdown state/interval/onEvent wiring from `src/app/display/page.tsx`
- Section D "Ecran TV" / "Numărătoare inversă" button from `src/components/host/ControlTab.tsx`

Per the verification instruction, DISP-08 is treated as **descoped**, not a gap. The `UseGameSyncOptions` / `onEvent` infrastructure in `useGameSync.ts` was retained (it's a backward-compatible hook extension) but is now unused.

Note: `REQUIREMENTS.md` still lists DISP-08 as `Pending` in Phase 6 and ROADMAP.md success criterion 5 still references the countdown. These are documentation inconsistencies only — the codebase reflects the user's decision. The traceability table in REQUIREMENTS.md and ROADMAP SC 5 should be updated to reflect the descope, but this is a documentation cleanup task, not a code gap.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Opening `/display` shows a full-screen landscape layout with large viewport-unit typography on bg-ink, independent of host dashboard (DISP-01) | VERIFIED | `src/app/display/page.tsx` — root `<div className="relative min-h-dvh w-screen overflow-hidden bg-ink">`. All components use vw/vh units (6vw headings, 2vw body, 1.5vw labels). No layout.tsx needed per design. |
| 2 | Display auto-syncs in real time via a single `useGameSync` subscription; shows a persistent connection status dot green/amber (DISP-02) | VERIFIED | `useGameSync(GAME_ID, HOST_SENTINEL_PLAYER_ID)` at line 39-42. `<DisplayStatusDot status={status} />` rendered unconditionally at line 93. DisplayStatusDot maps connected→bg-sage, reconnecting→bg-gold animate-pulse. |
| 3 | Question screen shows animated entry — question text slides up with CSS animation; A/B cards visible with no percentage bars (DISP-03) | VERIFIED (human check needed) | `src/components/display/QuestionDisplay.tsx` line 83: `[animation:slide-up_400ms_ease-out_forwards]`. `key={state.currentQuestionId}` on `<h2>` re-mounts per question. No bars. `@keyframes slide-up` in globals.css lines 80-83. |
| 4 | Locked phase shows live A/B percentage bars that update as answers arrive (DISP-04) | VERIFIED (human check needed) | `src/components/display/LockedDisplay.tsx` — `transition-[width] duration-500 ease-out` on bar fill div with `style={{ width: \`${pct}%\` }}`. Distribution null-guarded: `const dist = state.distribution ?? { A: 0, B: 0 }`. pctB = 100 - pctA guarantees sum (CR-01 fix applied in commit a4becd7). |
| 5 | Reveal screen highlights the correct option with gold glow + scale-up; wrong option dims to ~40% opacity (DISP-05) | VERIFIED (human check needed) | `src/components/display/RevealDisplay.tsx` — `isCorrect` flag drives `glass-gold border-2 border-gold-bright shadow-[0_0_40px...] scale-[1.03]` on correct card, `isDimmed = correctOption !== null && !isCorrect` drives `opacity-40` on wrong card (WR-01 fix applied). JSX-conditional, no useEffect. |
| 6 | A leaderboard of ranked players appears after each reveal (DISP-06) | VERIFIED | `RevealDisplay.tsx` line 171: `<LeaderboardPanel leaderboard={state.leaderboard.slice(0, 5)} />` inside scale-150 wrapper (capped at max-w-[55vw] per WR-03 fix). LeaderboardPanel imported unmodified from `@/components/guest/LeaderboardPanel`. |
| 7 | Winner screen appears at game end with cinematic #1 hero presentation + full leaderboard (DISP-07) | VERIFIED (human check needed) | `src/components/display/WinnerDisplay.tsx` — Trophy from lucide-react, glass-gold hero slot with winner.name in text-gold-bright, `{winner.score} răspunsuri corecte`, full `state.leaderboard` (unsliced) via LeaderboardPanel in scale-150 wrapper (capped at max-w-[55vw]). Winner null-guarded: `state.leaderboard[0] ?? null`. |
| 8 | Host-triggered cosmetic countdown overlay (DISP-08) | DESCOPED | Removed in commit c166757 at user request. CountdownOverlay, /api/host/countdown, and ControlTab Section D no longer exist. |

**Score:** 7/7 active requirements verified (DISP-08 descoped)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/display/page.tsx` | DisplayPage shell with useGameSync, phase switch, fullscreen button | VERIFIED | 113 lines, exports default DisplayPage, useGameSync(GAME_ID, HOST_SENTINEL_PLAYER_ID), exhaustive switch, 5 phase cases + default never-guard |
| `src/components/display/LoadingDisplay.tsx` | Pre-sync spinner | VERIFIED | CSS spinner border-t-gold animate-spin, "Se încarcă..." text, full-screen bg-ink |
| `src/components/display/LobbyDisplay.tsx` | Game title + pulsing participant count | VERIFIED | participantCount prop, 600ms pulse via animate-pulse, Romanian plural ternary, "Așteptăm să înceapă..." subtitle |
| `src/components/display/DisplayStatusDot.tsx` | Fixed status dot driven by SyncStatus | VERIFIED | All four SyncStatus states handled, bg-sage connected, bg-gold animate-pulse reconnecting, label only for non-connected states |
| `src/components/display/QuestionDisplay.tsx` | Question screen with slide-up animation | VERIFIED | 97 lines, key={state.currentQuestionId}, [animation:slide-up_400ms_ease-out_forwards], uses .body not .text, two OptionCard helper, no bars |
| `src/components/display/LockedDisplay.tsx` | Live A/B percentage bars | VERIFIED | 143 lines, transition-[width] bars, distribution null-guard, pctB=100-pctA |
| `src/components/display/RevealDisplay.tsx` | Gold-glow correct + dimmed wrong + top-5 leaderboard | VERIFIED | 177 lines, JSX-conditional gold classes, isDimmed null-safe guard, LeaderboardPanel.slice(0,5) in scale wrapper |
| `src/components/display/WinnerDisplay.tsx` | Winner hero slot + full leaderboard | VERIFIED | 65 lines, Trophy from lucide-react, leaderboard[0]??null guard, full unsliced leaderboard |
| `src/components/display/CountdownOverlay.tsx` | 3→2→1 tick overlay | DESCOPED | Deleted in c166757 per user request |
| `src/app/globals.css` | slide-up + fade-scale keyframes + reduced-motion overrides | VERIFIED | Lines 79-94: @keyframes slide-up, @keyframes fade-scale, @media(prefers-reduced-motion) block with both overrides + animate-pulse:none |
| `src/hooks/useGameSync.ts` | onEvent callback extension (optional third arg) | VERIFIED | UseGameSyncOptions type at lines 39-42, options?: UseGameSyncOptions at line 82, onEventRef pattern at lines 96-101, onEventRef.current?.(event) at line 215 (infrastructure intact even though DisplayPage no longer uses it) |
| `src/app/api/host/countdown/route.ts` | POST endpoint with host auth + seconds clamp | DESCOPED | Deleted in c166757 per user request |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/display/page.tsx` | `src/hooks/useGameSync.ts` | `useGameSync(GAME_ID, HOST_SENTINEL_PLAYER_ID)` | WIRED | Line 39-42; HOST_SENTINEL_PLAYER_ID imported from @/lib/host/constants |
| `src/app/display/page.tsx` | `src/components/display/DisplayStatusDot.tsx` | `<DisplayStatusDot status={status} />` | WIRED | Line 93; status is the SyncStatus returned by useGameSync |
| `src/components/display/RevealDisplay.tsx` | `src/components/guest/LeaderboardPanel.tsx` | `<LeaderboardPanel leaderboard={state.leaderboard.slice(0, 5)} />` | WIRED | Line 171; LeaderboardPanel imported at line 25 |
| `src/components/display/WinnerDisplay.tsx` | `src/components/guest/LeaderboardPanel.tsx` | `<LeaderboardPanel leaderboard={state.leaderboard} />` | WIRED | Line 57; full unsliced leaderboard |
| `src/components/display/LockedDisplay.tsx` | `state.distribution` | `const dist = state.distribution ?? { A: 0, B: 0 }` | WIRED | Line 85; pctA computed from dist.A/total, pctB=100-pctA |
| `src/components/display/RevealDisplay.tsx` | `state.correctOption` | `isCorrect = option === correctOption` | WIRED | Line 39-40; gold classes conditionally applied in JSX |
| `src/app/api/host/countdown/route.ts` | `src/lib/auth/host.ts` | `validateHostAuth(req)` | DESCOPED | Route deleted in c166757 |
| `src/components/host/ControlTab.tsx` | `src/app/api/host/countdown/route.ts` | `hostFetch('/api/host/countdown', ...)` | DESCOPED | Section D removed in c166757 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `LobbyDisplay` | `participantCount` | `useGameSync` → Supabase Presence `presenceState()` in SUBSCRIBED callback (useGameSync.ts:228-231) | Yes — counts keys in live presence state | FLOWING |
| `QuestionDisplay` | `state.currentQuestion.body` | `useGameSync` → `fetchState()` → `GET /api/game/state` → Supabase DB query | Yes — DB-backed via subscribe-then-fetch | FLOWING |
| `LockedDisplay` | `state.distribution` | Same fetch chain → scores aggregation in `/api/game/state` | Yes — DB query per broadcast event | FLOWING |
| `RevealDisplay` | `state.correctOption`, `state.leaderboard` | Same fetch chain | Yes | FLOWING |
| `WinnerDisplay` | `state.leaderboard` | Same fetch chain | Yes — full leaderboard from DB | FLOWING |

---

## Behavioral Spot-Checks

Step 7b skipped for phase-switch rendering behaviors — they require a running dev server with Supabase connected. Visual and realtime behaviors are routed to human verification.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| /display route file exists | Glob check | `src/app/display/page.tsx` found | PASS |
| All 7 display components exist | Glob check | 7 .tsx files in src/components/display/ | PASS |
| No useGameSync(GAME_ID, null) in DisplayPage | grep check | No match found | PASS |
| state.currentQuestion?.body used (not .text) | Grep on display components | QuestionDisplay line 86, LockedDisplay line 114, RevealDisplay line 146 — all use .body | PASS |
| No canvas-confetti in display components | Grep check | No matches | PASS |
| pctB = 100 - pctA (CR-01 fix) | Code read | LockedDisplay line 88, RevealDisplay line 120 — both use 100-pctA | PASS |
| requestFullscreen().catch() (CR-03 fix) | Code read | page.tsx line 101: `.catch(() => {})` | PASS |
| isDimmed = correctOption !== null && !isCorrect (WR-01 fix) | Code read | RevealDisplay line 40 | PASS |

---

## Probe Execution

Step 7c: No probe scripts found in `scripts/*/tests/probe-*.sh`. Phase does not declare probes. Skipped.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DISP-01 | 06-01-PLAN | Full-screen landscape TV/projector route | SATISFIED | DisplayPage with min-h-dvh, w-screen, bg-ink, vw/vh typography |
| DISP-02 | 06-01-PLAN | Auto-sync real-time + connection dot | SATISFIED | useGameSync subscription + DisplayStatusDot always rendered |
| DISP-03 | 06-02-PLAN | Question with animated transitions | SATISFIED | QuestionDisplay with [animation:slide-up] + key re-mount |
| DISP-04 | 06-02-PLAN | Live A/B answer percentage bars | SATISFIED | LockedDisplay with transition-[width] bars |
| DISP-05 | 06-02-PLAN | Correct-answer reveal effect | SATISFIED | RevealDisplay gold-glow + opacity-40 via JSX conditionals |
| DISP-06 | 06-02-PLAN | Leaderboard after reveal | SATISFIED | RevealDisplay LeaderboardPanel.slice(0,5) |
| DISP-07 | 06-03-PLAN | Winner screen at game end | SATISFIED | WinnerDisplay with Trophy hero slot + full leaderboard |
| DISP-08 | 06-03-PLAN | Host-triggered cosmetic countdown | DESCOPED | Removed per user request (c166757). REQUIREMENTS.md and ROADMAP.md SC 5 still reference this — documentation update needed. |

---

## Anti-Patterns Found

Code-review findings CR-01/02/03 and WR-01/03 were all addressed in commit `a4becd7`. The following items remain from the REVIEW.md but are warnings/info, not blockers:

| File | Issue | Severity | Status |
|------|-------|----------|--------|
| `src/hooks/useGameSync.ts:213-217` | fetchState() silently drops non-2xx responses; status stays "connected" even when state endpoint is down (WR-04 from code review) | WARNING | Not yet addressed — state dot shows green while stale |
| `src/app/display/page.tsx` | Route is completely unauthenticated — question text, correct options, distribution, and leaderboard visible to anyone with the URL before the event (WR-02 from code review) | WARNING | Intentional per CLAUDE.md "public" designation, but undocumented as deliberate trade-off |
| `src/components/display/LobbyDisplay.tsx:30-34` | Pulse fires on mount (participantCount=0) — unnecessary animate-pulse on initial render (IN-01 from code review) | INFO | Minor visual artifact only |
| `src/components/display/QuestionDisplay.tsx:83` | `[animation:slide-up_...]` arbitrary class — `prefers-reduced-motion` override suppresses keyframe but animation property still fires events (IN-02) | INFO | Fragile but functionally correct |
| `src/hooks/useGameSync.ts` | UseGameSyncOptions/onEvent infrastructure retained but now unused since DisplayPage no longer calls it (countdown descoped) | INFO | Dead code — no functional impact |
| `REQUIREMENTS.md` | DISP-08 still listed as "Pending" in Phase 6 | INFO | Documentation inconsistency — should be marked descoped/removed |
| `ROADMAP.md` | Success Criterion 5 ("countdown overlay") still present in Phase 6 section | INFO | Documentation inconsistency — should note descope |

No `TBD`, `FIXME`, or `XXX` debt markers found in display component files.

---

## Human Verification Required

### 1. Live Lobby Sync

**Test:** Run `npm run dev`. Open `/display` in one tab, open `/` in a second tab/device and join with a name.
**Expected:** Within 1-2 seconds the participant count on `/display` increases and briefly pulses — without refreshing the display tab.
**Why human:** Requires running Supabase Realtime channel; WebSocket delivery cannot be verified with grep.

### 2. Question Entry Animation

**Test:** With host at lobby, open `/host` and start the game. Observe `/display`.
**Expected:** The question text slides up from below into place with a smooth 400ms animation. Two A/B option cards appear with no percentage bars visible.
**Why human:** CSS animation quality requires browser rendering to evaluate.

### 3. Locked-Phase Live Vote Bars

**Test:** From a phone/third tab, join the game and submit an answer. Then lock from the host. Observe `/display`.
**Expected:** A/B percentage bars appear and animate as votes fill them. Bars sum to exactly 100% in all cases.
**Why human:** Requires live vote submissions to observe bar filling; realtime re-fetch needed.

### 4. Reveal Gold Glow + Top-5 Leaderboard

**Test:** From host, reveal the correct answer. Observe `/display`.
**Expected:** Correct option card glows gold, scales up slightly. Wrong option dims to ~40% opacity. A compact top-5 leaderboard appears below, scaled for TV readability.
**Why human:** Visual quality and readability from TV distance require human judgment.

### 5. Winner Screen

**Test:** Drive game to end via "Incheie Jocul". Observe `/display`.
**Expected:** "Câștigător!" heading, #1 player name in gold inside a glass-gold hero card with trophy icon, correct-answer count as subtitle, full ranked leaderboard below, "Felicitări tuturor!" footer. No confetti.
**Why human:** Requires completed game with leaderboard entries and visual inspection.

### 6. Connection Status Dot Behavior

**Test:** With `/display` open and connected, toggle network off in DevTools. Observe dot. Re-enable. Observe dot recovery.
**Expected:** Dot turns amber + pulsing ("Reconectare..." label) when disconnected. Returns to green (no label) on reconnect.
**Why human:** Requires network manipulation and color/animation observation.

### 7. Fullscreen Button

**Test:** On `/display`, click "Ecran complet". Then press Esc.
**Expected:** Clicking enters browser fullscreen; button disappears. Pressing Esc exits fullscreen; button reappears.
**Why human:** Fullscreen API behavior and button visibility require browser interaction.

---

## Gaps Summary

No gaps blocking goal achievement. All 7 active DISP requirements (DISP-01 through DISP-07) are satisfied in the codebase. DISP-08 is descoped per user decision.

**Outstanding warnings from code review (not blocking):**
- WR-04: `fetchState()` does not set status to "reconnecting" on non-2xx responses — display can show green dot with stale state if `/api/game/state` is unavailable
- WR-02: `/display` route is unauthenticated — guests with the URL can see questions/reveals before the event

These are quality improvements, not blockers for the phase goal. They are candidates for Phase 7 (Polish & Pre-Event Hardening).

---

_Verified: 2026-06-05T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
