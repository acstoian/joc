---
phase: 05-guest-app
plan: "02"
subsystem: guest-app
tags: [guest, gameplay, question, reveal, optimistic-lock, leaderboard, realtime]
dependency_graph:
  requires:
    - 05-01  # GuestShell, page.tsx phase switch, LeaderboardPanel, SyncStatusBadge, identity helpers
    - 03-server-write-path-state-machine  # POST /api/game/answer, GET /api/game/state
    - 02-realtime-core  # useGameSync, GameStateSnapshot, SyncStatus
  provides:
    - QuestionScreen — A/B tap UI with optimistic lock, refresh-proof persistence (PLAY-01..04)
    - RevealScreen — in-place correct/wrong feedback + distribution bar + leaderboard (PLAY-05/06)
  affects:
    - src/components/guest/QuestionScreen.tsx — replaced placeholder stub from 05-01
    - src/components/guest/RevealScreen.tsx — replaced placeholder stub from 05-01
tech_stack:
  added: []
  patterns:
    - Optimistic lock with useEffect seed from state.myAnswer (PLAY-03 reconnect pattern)
    - getRevealClass() pure helper for in-place button class derivation (Pattern 4)
    - Distribution bar with transition-[width] and divide-by-zero guard
    - Icon + text accessibility pattern (color not sole signal — WCAG 1.4.1)
key_files:
  created: []
  modified:
    - src/components/guest/QuestionScreen.tsx  # full implementation replacing 05-01 stub
    - src/components/guest/RevealScreen.tsx    # full implementation replacing 05-01 stub
decisions:
  - "Used plain <button> elements (not shadcn Button) for A/B tap buttons — shadcn Button base CVA classes (inline-flex rounded-md text-sm) conflict with the custom layout required (flex-col min-h-[120px] rounded-xl); full className control is cleaner and matches UI spec exactly"
  - "getRevealClass() and getButtonClass() are pure functions outside the component — stable references, not recreated on each render"
  - "Removed role='status' from reveal result divs — these are static result cards, not live regions; role='status' is for dynamic announcements only; plain div with aria-label provides correct accessible description"
  - "Distribution bar rendered conditionally on state.distribution !== null (not empty check) — null means no answers yet, which is semantically different from zero answers"
metrics:
  duration: "~25 min"
  completed: "2026-06-05"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
requirements_satisfied: [PLAY-01, PLAY-02, PLAY-03, PLAY-04, PLAY-05]
---

# Phase 5 Plan 02: Guest App — Question + Reveal Screens Summary

Full A/B gameplay vertical slice: guests tap A or B to lock their answer (immediate, irreversible, refresh-proof), then see the correct/wrong reveal in-place when the host reveals, with distribution bars and a live leaderboard below.

---

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | QuestionScreen — A/B tap with optimistic lock + refresh-proof persistence | 1460146 | src/components/guest/QuestionScreen.tsx |
| 2 | RevealScreen — in-place correct/wrong feedback + distribution + leaderboard | 9a91aa6 | src/components/guest/RevealScreen.tsx |

---

## What Was Built

### src/components/guest/QuestionScreen.tsx

Full replacement of the 05-01 placeholder stub. Exports `QuestionScreen` with props `{ state, identity, status }` matching the call site in `src/app/page.tsx`.

**Lock logic (PLAY-01..04):**
- `localAnswer` state initialized to `null`
- `useEffect([state.myAnswer])` seeds `localAnswer` from authoritative server state on reconnect/refresh — satisfies PLAY-03
- `handleTap(choice)`: early return if `localAnswer !== null` (PLAY-02 no double-tap), then optimistic `setLocalAnswer(choice)`, then fire-and-forget `POST /api/game/answer` with `{ gameId, deviceToken, choice }`. 403 (answers_locked) and 409 (already_answered) are both swallowed — server reconciles on next re-fetch
- `getButtonClass(choice, localAnswer, phase)` pure helper outside component:
  - Idle: `.glass cursor-pointer active:scale-[0.97]`
  - Selected (choice === localAnswer): `.glass-gold border-2 border-gold text-gold-bright shadow-[0_0_12px_0_...]`
  - Unselected: `.glass opacity-40 pointer-events-none`
  - Phase "locked" + no local answer: `.glass opacity-60 pointer-events-none cursor-not-allowed`
- Below locked buttons: `.thin-divider` + "Aștepți dezvăluirea..." (PLAY-04 waiting state)
- A/B buttons: `min-h-[120px] w-full rounded-xl`, `gap-4` between them, `[touch-action:manipulation]`
- `aria-pressed`, `aria-disabled`, `aria-label` on every button

### src/components/guest/RevealScreen.tsx

Full replacement of the 05-01 placeholder stub. Exports `RevealScreen` with props `{ state, status }`.

**In-place reveal (PLAY-05, D-06):**
- Both A/B options rendered as `<div>` result cards in the same layout — no modal, no Dialog import
- `getRevealClass(option, state)` pure helper:
  - Correct: `border-2 border-gold-bright text-gold-bright bg-gold-muted/20 shadow-[0_0_16px_0_...]`
  - Wrong locked (myAnswer === option && correctOption !== option): `border-2 border-red-500/60 text-champagne bg-red-500/20`
  - Neither: `border border-champagne/20 opacity-60`
- Inside correct button: `CheckCircle2` icon (lucide-react) + "Corect!" text (WCAG 1.4.1 — color not sole signal)
- Inside wrong locked button: `XCircle` icon + "Greșit" text
- `aria-label` on each result div includes option text + correct/wrong verdict

**Distribution bar:**
- `state.distribution?.A ?? 0` / `state.distribution?.B ?? 0` — null guard
- `getPct(count, total)`: `total === 0` guard → 0% (divide-by-zero safe)
- Fill: `bg-gold h-full rounded-full transition-[width] duration-300` with inline `style={{ width: \`${pct}%\` }}`
- Entire distribution section conditionally rendered when `state.distribution !== null`

**Leaderboard:**
- `<LeaderboardPanel leaderboard={state.leaderboard} />` rendered below distribution
- LeaderboardPanel self-hides when `leaderboard.length === 0` (D-08)

---

## Deviations from Plan

### Pre-execution: Worktree merge required

- **Found during:** Setup (before Task 1)
- **Issue:** Worktree branch was at Phase 1 commit; Phase 2-5 source files only on `main`. All `read_first` files were absent from the worktree.
- **Fix:** `git merge main` (fast-forward) — identical pattern to 05-01 execution. `.env.local` copied from main (gitignored; not committed).
- **Commit:** No separate commit — merge was pre-execution setup.

### Rule 2 — Removed incorrect role="status" from reveal divs

- **Found during:** UI/UX Pro Max skill review after Task 2 write
- **Issue:** Initial implementation applied `role="status"` to the A/B reveal result divs. `role="status"` is a live-region ARIA role for dynamic status announcements — not appropriate for static result cards. Screen readers would treat the divs as announcement containers, not result descriptions.
- **Fix:** Removed `role="status"`. `aria-label` on each div carries the full accessible description. Plain div semantics are correct for static result cards.
- **Files modified:** `src/components/guest/RevealScreen.tsx`
- **Commit:** Included in 9a91aa6

---

## Known Stubs

None. Both QuestionScreen and RevealScreen are fully implemented. No placeholder text or hardcoded empty values flow to the UI.

---

## Threat Surface Scan

No new network endpoints. RevealScreen is read-only (no submissions). QuestionScreen calls the pre-existing `/api/game/answer` endpoint with the same `deviceToken`-based anti-cheat pattern established in Phase 3.

Plan threat model mitigations honored:
- T-05-04 (Spoofing): `identity.deviceToken` sent in POST body — server resolves `player_id` from `(game_id, device_token)`; client never supplies `playerId` directly
- T-05-05 (Tampering): Optimistic client lock + 409 server dedup + 403 phase-guard; both treated as expected and non-fatal
- T-05-06 (Information Disclosure): RevealScreen only renders in `state.phase === "revealed"` — server already gates `correctOption` population to the revealed phase

---

## Self-Check

### Modified Files
- [x] `src/components/guest/QuestionScreen.tsx` — FOUND (175 lines, full implementation)
- [x] `src/components/guest/RevealScreen.tsx` — FOUND (193 lines, full implementation)

### Commits
- [x] 1460146 — feat(05-02): QuestionScreen
- [x] 9a91aa6 — feat(05-02): RevealScreen

### Verifications
- [x] `npm run build` exits 0 after Task 1
- [x] `npm run build` exits 0 after Task 2
- [x] `npx eslint src/components/guest/` — no errors after Task 2
- [x] `currentQuestion.body` accessed via `q = state.currentQuestion; q?.body` (not `.text`)
- [x] `deviceToken: identity.deviceToken` in POST body (not `playerId`)
- [x] `handleTap` returns early when `localAnswer !== null`
- [x] `useEffect([state.myAnswer])` seeds `localAnswer` from server state
- [x] `min-h-[120px] w-full` on all A/B buttons
- [x] `border-gold` + `text-gold-bright` on selected button; `opacity-40 pointer-events-none` on unselected
- [x] No `useGameSync` call in QuestionScreen or RevealScreen
- [x] `CheckCircle2` + "Corect!" on correct button; `XCircle` + "Greșit" on wrong button
- [x] `state.distribution !== null` guard; `total === 0` divide-by-zero guard
- [x] `<LeaderboardPanel leaderboard={state.leaderboard} />` rendered in RevealScreen

## Self-Check: PASSED
