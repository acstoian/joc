---
phase: 05-guest-app
plan: "01"
subsystem: guest-app
tags: [guest, identity, realtime, qr-code, join-flow, lobby]
dependency_graph:
  requires:
    - 03-server-write-path-state-machine  # POST /api/game/join, POST /api/game/answer, GET /api/game/state
    - 02-realtime-core                    # useGameSync hook, SyncStatus enum, GameStateSnapshot type
    - 04-host-dashboard                   # GAME_ID from lib/host/constants, shadcn/ui primitives
  provides:
    - guest identity helpers (getOrCreateDeviceToken, getIdentity, setIdentity)
    - SyncStatusBadge component
    - LeaderboardPanel component
    - GuestShell (page.tsx) phase switch — ready for 05-02/05-03 screen drop-in
    - NameGate (join flow)
    - LobbyScreen (lobby with QR code)
    - QuestionScreen, RevealScreen, WinnerScreen placeholder stubs
  affects:
    - src/app/page.tsx — replaced sync-demo Server Component with GuestShell client component
    - package.json — added react-qr-code, canvas-confetti, @types/canvas-confetti
    - .env.example — added NEXT_PUBLIC_APP_URL and NEXT_PUBLIC_GAME_ID documentation
tech_stack:
  added:
    - react-qr-code@2.0.21 (SVG-based QR code for lobby screen)
    - canvas-confetti@1.9.4 (winner confetti — consumed by 05-03)
    - "@types/canvas-confetti (dev, TypeScript types)"
  patterns:
    - Hydration guard (hydrated useState + useEffect) — mirrors host page pattern
    - SSR-safe localStorage helpers (typeof window === "undefined" guards)
    - Single useGameSync instance in GameView; all screens receive state as props (Pitfall 3)
    - crypto.randomUUID() for device token (UUID v4, passes server UUID_REGEX validation)
key_files:
  created:
    - src/lib/guest/identity.ts
    - src/components/guest/SyncStatusBadge.tsx
    - src/components/guest/LeaderboardPanel.tsx
    - src/components/guest/NameGate.tsx
    - src/components/guest/LobbyScreen.tsx
    - src/components/guest/QuestionScreen.tsx   # placeholder — replaced by 05-02
    - src/components/guest/RevealScreen.tsx     # placeholder — replaced by 05-02
    - src/components/guest/WinnerScreen.tsx     # placeholder — replaced by 05-03
  modified:
    - src/app/page.tsx  # replaced sync-demo Server Component with "use client" GuestShell
    - .env.example      # added NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_GAME_ID documentation
    - package.json      # react-qr-code@2.0.21, canvas-confetti@1.9.4
    - package-lock.json
decisions:
  - "Imported GAME_ID from @/lib/host/constants (not a new guest/constants.ts) — GAME_ID is NEXT_PUBLIC_ safe for client use; renaming deferred per RESEARCH open question 2"
  - "QuestionScreen/RevealScreen/WinnerScreen created as intentional placeholder stubs per plan spec — plan 05-02 and 05-03 replace these files entirely without touching page.tsx imports"
  - "Worktree needed git merge main before execution — worktree branch was at Phase 1 commit; merged Phases 2-4 work before starting implementation"
metrics:
  duration: "~35 min"
  completed: "2026-06-04"
  tasks_completed: 3
  files_created: 10
  files_modified: 4
requirements_satisfied: [JOIN-04, JOIN-05]
---

# Phase 5 Plan 01: Guest App Foundation + Join to Lobby Slice Summary

GuestShell replaces sync-demo at `/`; first-time guests see a glass name-entry gate, join via POST /api/game/join, and land in a live lobby with participant count and scannable QR code; returning guests skip the gate; full phase switch wires all five game screens so 05-02/05-03 only add their own screen files.

---

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Install packages + NEXT_PUBLIC_APP_URL env var | ab556f1 | package.json, .env.example |
| 2 | Identity helpers + SyncStatusBadge + LeaderboardPanel | b601bbe | src/lib/guest/identity.ts, SyncStatusBadge.tsx, LeaderboardPanel.tsx |
| 3 | NameGate + LobbyScreen + GuestShell phase switch | 2b6225a | src/app/page.tsx, NameGate.tsx, LobbyScreen.tsx, placeholder screens |

---

## What Was Built

### src/lib/guest/identity.ts
SSR-safe localStorage helper module. Exports three functions:
- `getOrCreateDeviceToken()` — generates UUID v4 via `crypto.randomUUID()` (not nanoid — server validates UUID_REGEX), persists to `"device_token"` key, SSR-safe
- `getIdentity()` — reads `"device_token"` + `"player_id"` from localStorage; returns null if either missing
- `setIdentity()` — persists both keys after a successful join

### src/components/guest/SyncStatusBadge.tsx
Non-blocking top connection badge driven by `SyncStatus`. Returns `null` when `"connected"`. Renders `absolute top-3 left-1/2` pill for connecting/reconnecting/error states. Typed `Record<Exclude<SyncStatus, "connected">, string>` ensures exhaustive copy mapping. Accessibility: `role="status" aria-live="polite"`.

### src/components/guest/LeaderboardPanel.tsx
Ranked `<ol role="list">` with top-3 gold highlighting (rank #1 to `text-gold-bright font-bold`; #2-#3 to `text-champagne`; #4+ to `text-champagne-dim`). Returns null when leaderboard is empty. `Separator` between entries, not after last. Reused by RevealScreen and WinnerScreen in 05-02/05-03.

### src/components/guest/NameGate.tsx
Full-screen centered glass `Card` with Playfair heading "Joc — Cristina & Andrei", visible label, Input with `h-12`, Loader2 spinner in button during POST, "Joaca!" CTA. Calls `getOrCreateDeviceToken()` then `POST /api/game/join` then `setIdentity()` then `onJoined()`. Inline Romanian errors: empty name to "Numele nu poate fi gol."; non-ok response to "Ceva nu a mers. Incearca din nou.". Input and button disabled during request.

### src/components/guest/LobbyScreen.tsx
Live lobby: participant count displayed as `{N} jucatori s-au alaturat`, QRCode from `react-qr-code` with `value={NEXT_PUBLIC_APP_URL ?? window.location.origin}` fallback (Pitfall 5), `bgColor="transparent"` + `fgColor="#f5e6c8"` (champagne). Safe area bottom padding. SyncStatusBadge at top.

### src/app/page.tsx (GuestShell)
Replaces sync-demo Server Component entirely. `"use client"` with hydration guard — blank `bg-ink` until `hydrated === true`, then gate (identity null) or GameView (identity present). `GameView` calls `useGameSync(GAME_ID, identity.playerId)` exactly once; switches on `state?.phase`; handles `null` state with `LoadingScreen`. Default branch uses `never` for exhaustiveness checking.

---

## Known Stubs

Three screen files are intentional placeholder stubs per plan spec — they exist to make the build pass now and establish the exact prop signatures that 05-02/05-03 will use:

| File | Stub Reason | Resolution Plan |
|------|-------------|-----------------|
| `src/components/guest/QuestionScreen.tsx` | A/B buttons, locked state, answer submission not yet built | Replaced entirely by 05-02 |
| `src/components/guest/RevealScreen.tsx` | In-place reveal feedback + distribution bar not yet built | Replaced entirely by 05-02 |
| `src/components/guest/WinnerScreen.tsx` | Full leaderboard + #1 featured card + confetti not yet built | Replaced entirely by 05-03 |

These stubs do not block the plan's goal (JOIN-04, JOIN-05 — join to lobby slice). The lobby and name gate are fully functional. The placeholder screens render correctly for their phases and will not cause errors in the running app.

---

## Deviations from Plan

### Pre-execution Deviation: Worktree Merge Required

- **Found during:** Setup (before Task 1)
- **Issue:** Worktree branch was at the Phase 1 commit (`fd91e66`); Phases 2-4 work (hooks, components, API routes) only existed in `main`. All `read_first` files (useGameSync.ts, constants.ts, shadcn components) were missing from the worktree.
- **Fix:** `git merge main` — brought in all Phase 2-4 artifacts before starting implementation. Standard worktree setup for parallel execution waves where a wave-1 plan builds on prior phases that landed on main.
- **Commit:** No separate commit — merge was pre-execution setup.

### Pre-execution Deviation: .env.local Copy Required

- **Found during:** Task 1 build verification
- **Issue:** `.env.local` is gitignored; worktree did not inherit it from main. Build failed on Phase 3/4 API routes requiring `SUPABASE_SERVICE_ROLE_KEY`.
- **Fix:** Copied `.env.local` from main working directory to worktree. This file is never committed (gitignored by design).
- **Commit:** Not committed (gitignored).

### Rule 2 — Auto-added NEXT_PUBLIC_GAME_ID to .env.example

- **Found during:** Task 1
- **Issue:** `NEXT_PUBLIC_GAME_ID` was used by `src/lib/host/constants.ts` and by the guest join flow but was not documented in `.env.example` alongside the new `NEXT_PUBLIC_APP_URL`.
- **Fix:** Added `NEXT_PUBLIC_GAME_ID=` to the public section of `.env.example` with a comment.
- **Files modified:** `.env.example`
- **Commit:** ab556f1

---

## Threat Surface Scan

No new network endpoints introduced. All API calls go to pre-existing routes (`/api/game/join`, `/api/game/state`) with established guards. No new DB schemas. No new server-side Supabase access patterns.

Plan threat model items T-05-01 and T-05-02 are mitigated:
- T-05-01 (XSS): All display names rendered as React text nodes — no `dangerouslySetInnerHTML` anywhere in guest components.
- T-05-02 (device token spoofing): `crypto.randomUUID()` used; server UUID_REGEX validation already enforced in `/api/game/join`.

---

## Self-Check

### Created Files
- [x] `src/lib/guest/identity.ts` — FOUND
- [x] `src/components/guest/SyncStatusBadge.tsx` — FOUND
- [x] `src/components/guest/LeaderboardPanel.tsx` — FOUND
- [x] `src/components/guest/NameGate.tsx` — FOUND
- [x] `src/components/guest/LobbyScreen.tsx` — FOUND
- [x] `src/components/guest/QuestionScreen.tsx` — FOUND
- [x] `src/components/guest/RevealScreen.tsx` — FOUND
- [x] `src/components/guest/WinnerScreen.tsx` — FOUND
- [x] `src/app/page.tsx` modified to GuestShell — FOUND

### Commits
- [x] ab556f1 — chore(05-01): install packages + env var
- [x] b601bbe — feat(05-01): shared primitives
- [x] 2b6225a — feat(05-01): GuestShell + NameGate + LobbyScreen

### Verifications
- [x] `npm run build` exits 0 (verified after each task)
- [x] `npm run lint` exits 0 (verified after Task 3)
- [x] `/` route appears in build output at 8.51 kB
- [x] `useGameSync` called exactly once in page.tsx
- [x] `crypto.randomUUID()` used in identity.ts (not nanoid)
- [x] `"device_token"` and `"player_id"` keys match useGameSync.ts

## Self-Check: PASSED
