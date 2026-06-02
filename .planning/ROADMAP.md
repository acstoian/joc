# Roadmap: Joc — Live Wedding Game Show

## Overview

Seven phases derived from the dependency graph established by architecture research. The schema and realtime sync primitive are load-bearing: nothing reactive works without them. An end-to-end walking skeleton (schema + Broadcast + a single state transition visible on two tabs) validates the riskiest integration before any game UI is built. From there, phases add capability in dependency order — server write path first, host dashboard second (because the host drives all state), guest app third (now testable against real transitions), TV display fourth (pure subscriber), then aesthetic polish and the mandatory pre-event dry run that closes the project.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Schema** - Next.js scaffold, Supabase Pro setup, full DB schema with constraints + RLS + key isolation
- [ ] **Phase 2: Realtime Core** - Broadcast channel, useGameSync hook, subscribe-then-fetch, full reconnect resilience
- [ ] **Phase 3: Server Write Path & State Machine** - All API routes (join, answer, host transitions, reveal + scoring), anti-cheat, compare-and-swap
- [ ] **Phase 4: Host Dashboard** - Auth gate, phase controls, question CRUD + reorder, live stats, emergency recovery
- [ ] **Phase 5: Guest App** - Join + lobby + QR, A/B tap UX, lock state, reveal + leaderboard + end views
- [ ] **Phase 6: TV Display Mode** - /display cinematic landscape route with all screens and host-initiated countdown
- [ ] **Phase 7: Polish & Pre-Event Hardening** - Wedding aesthetic, animation audit, performance validation, mandatory dry run

## Phase Details

### Phase 1: Foundation & Schema

**Goal**: A working Next.js + Supabase project exists with the complete, constraint-correct database schema and proper security boundaries in place — every subsequent phase builds on this without needing to revisit the schema or key isolation.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: RT-02, RT-05, SCOR-03, SCOR-04
**Success Criteria** (what must be TRUE):

  1. The Next.js app deploys to Vercel on the `joc` branch and returns a 200 from the root route
  2. Supabase project runs on Pro plan; all five tables (games, players, questions, answers, scores) exist with the correct columns, CHECK constraints, and UNIQUE constraints (including `UNIQUE(player_id, question_id)` and `UNIQUE(game_id, device_token)`)
  3. RLS is enabled on all tables; `questions.correct_option` is not readable by the anon role before reveal; all policies are tested with the anon key (not service role)
  4. `SUPABASE_SERVICE_ROLE_KEY` is present only in server-only files; a post-build `grep -r "service_role" .next/` returns no matches
  5. A duplicate answer INSERT (same player_id + question_id) is rejected at the DB layer with a 23505 unique violation**Plans**: 3 plans

**Wave 1**

  - [x] 01-01-PLAN.md — Repo reset + Next.js 15.3/Tailwind v4/shadcn scaffold, theme tokens, env contract, typed Supabase clients, CLI link

**Wave 2** *(blocked on Wave 1 completion)*

  - [x] 01-02-PLAN.md — Full SQL schema (5 tables + constraints + RLS answer-secrecy + reset fn + seed), cloud push, typed bindings

**Wave 3** *(blocked on Wave 2 completion)*

  - [~] 01-03-PLAN.md — Walking Skeleton: live read + real write (23505), verify-rls PASS, verify-dedup PASS, SC4 grep clean; SC1 Vercel deploy pending human Task 3 checkpoint

**UI hint**: no

### Phase 2: Realtime Core

**Goal**: A shared `useGameSync` hook subscribes to the Broadcast channel and recovers authoritative state on reconnect — the sync primitive all three client surfaces (guest, host, TV) will use, proven resilient to mobile disconnects before any game UI is layered on top.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: RT-01, RT-03, RT-04, RT-06
**Success Criteria** (what must be TRUE):

  1. Opening two browser tabs connected to the same `game:{gameId}` channel: a Broadcast event fired from a server action appears in both tabs within 1 second, with no manual refresh
  2. Locking a phone screen for 60 seconds then unlocking causes the guest tab to automatically reconnect and display the current authoritative game state without a manual refresh
  3. The Supabase client is initialized with `worker: true`, jittered `reconnectAfterMs`, and a 15-second heartbeat interval; on reconnect the hook re-fetches `GET /api/game/state` before processing new Broadcast events
  4. A `visibilitychange` handler fires an immediate reconnect + state-fetch when the tab becomes visible after being backgrounded on iOS Safari
  5. No `.on('postgres_changes', ...)` subscription exists in any client-side component for game state tables

**Plans**: 3 plans

**Wave 1**

  - [x] 02-01-PLAN.md — Contracts: GAME_EVENT union + realtime client opts (worker/heartbeat/jitter) + GET /api/game/state resync endpoint

**Wave 2** *(blocked on Wave 1)*

  - [x] 02-02-PLAN.md — Headless useGameSync hook: subscribe-then-fetch + presence + visibilitychange reconnect resilience

**Wave 3** *(blocked on Wave 2)*

  - [x] 02-03-PLAN.md — Throwaway /sync-demo harness (server action + 2 subscriber panes) proving all 5 success criteria

**UI hint**: no

### Phase 3: Server Write Path & State Machine

**Goal**: Every authoritative mutation — guest join, answer submission, all host phase transitions, reveal with scoring — exists as a tested API route; the game state machine transitions correctly with deduplication and compare-and-swap guards in place, so the host and guest UIs have real data to drive.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: JOIN-01, JOIN-02, JOIN-03, HOST-01, HOST-02, HOST-03, HOST-04, HOST-05, HOST-06, HOST-07, SCOR-01, SCOR-02
**Success Criteria** (what must be TRUE):

  1. A guest POSTing to `/api/game/join` with a device token gets back a player_id; the same device token on a second POST returns the same player_id (idempotent upsert)
  2. A guest answer submitted when `games.phase = 'locked'` is rejected with 403; a second answer for the same question is rejected with 409 (unique constraint); neither creates a DB row
  3. The host password is validated server-side on every host API call — a forged request without valid credentials is rejected
  4. The full phase state machine runs end-to-end: `lobby → question → locked → revealed → question → ended`; each transition broadcasts a `game_state` event to the channel; clicking host-advance twice in rapid succession advances by exactly 1 step (compare-and-swap)
  5. After a reveal, the `scores` table reflects exactly 1 point per player who answered correctly; the leaderboard broadcast payload ranks players by `correct_count` descending

**Plans**: TBD
**UI hint**: no

### Phase 4: Host Dashboard

**Goal**: The host can drive the entire game flow from a protected dashboard — creating and ordering questions before the event, then controlling every phase transition live — and can see live participant counts, answer distributions, and recover from mistakes using emergency controls.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: HOST-08, HOST-09, HOST-10, HOST-11, QSTN-01, QSTN-02, QSTN-03, QSTN-04, QSTN-05
**Success Criteria** (what must be TRUE):

  1. The host dashboard route is behind a password gate; entering the wrong password denies access; the correct password grants access and persists for the session
  2. The host can create, edit, delete, reorder questions, and mark the correct answer (A or B) before or during the game — changes persist across page refreshes
  3. The dashboard shows a live participant count that updates as guests join (within 2 seconds, no manual refresh) and a live A/B answer distribution showing who answered what for the current question
  4. The phase control buttons (Start, Lock Answers, Reveal, Next Question, End Game) are enabled only when valid for the current phase; clicking a button while a request is in-flight disables it until the Broadcast confirms the new state
  5. The emergency recovery panel allows the host to reset the current round (clear answers + return to 'question' phase), jump to any question by number, or force-end the game from any state — each action takes effect and broadcasts within 2 seconds

**Plans**: TBD
**UI hint**: yes

### Phase 5: Guest App

**Goal**: A guest can join the game on their phone by entering their name, wait in a live lobby, answer questions with a single tap, see their answer lock and the reveal, follow the leaderboard, and reach the winner screen — with the entire journey surviving network drops without losing their identity or score.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: JOIN-04, JOIN-05, PLAY-01, PLAY-02, PLAY-03, PLAY-04, PLAY-05, PLAY-06, PLAY-07
**Success Criteria** (what must be TRUE):

  1. A guest opens the site on a phone, enters their name, and sees a lobby screen showing a live "X players joined" count and a QR code / shareable link for others to join — all without creating an account
  2. When the host starts the game, the guest's screen transitions to the current question (with A and B options) within 1 second, with no page refresh
  3. Tapping A or B locks the choice immediately (button disabled, selection highlighted); a second tap on the same or other option has no effect; the locked state persists through a page refresh
  4. When the host reveals, the guest's screen shows whether they were correct or incorrect and the final A/B distribution, live — within 1 second of the host action
  5. A guest who refreshes or reconnects mid-game is re-linked to their existing player record and score via the device token and sees the current game state (correct phase, their locked answer if already submitted)

**Plans**: TBD
**UI hint**: yes

### Phase 6: TV Display Mode

**Goal**: A dedicated `/display` route delivers a cinematic, landscape-optimized big-screen experience that auto-syncs with host actions independently — showing each phase of the game with large typography, animated transitions, live answer bars, reveal effects, a leaderboard, and a winner screen.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: DISP-01, DISP-02, DISP-03, DISP-04, DISP-05, DISP-06, DISP-07, DISP-08
**Success Criteria** (what must be TRUE):

  1. Opening `/display` on a laptop connected to a TV/projector shows a full-screen landscape layout with large, readable typography; the route functions independently even if the host dashboard is not open
  2. Every host action (start, lock, reveal, next, end) updates the display within 1 second with no manual refresh; the display shows a persistent connection status indicator (green dot = live, amber pulsing = reconnecting)
  3. The question screen shows animated entry transitions; the locked phase shows live A/B percentage bars updating as answers arrive; the reveal screen highlights the correct option with a reveal effect
  4. The leaderboard screen shows ranked players after each reveal; the winner screen appears at game end with cinematic presentation
  5. When the host triggers a cosmetic countdown, the display shows a countdown overlay (e.g. 3-2-1) with visual tension before the next phase begins

**Plans**: TBD
**UI hint**: yes

### Phase 7: Polish & Pre-Event Hardening

**Goal**: The game looks and feels like a premium wedding event experience — soft-luxury aesthetic throughout, smooth animations that hold 60fps on low-end phones — and the production deployment has been verified end-to-end with a mandatory dry run before the event.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: RT-07, RT-08
**Success Criteria** (what must be TRUE):

  1. All three surfaces (guest, host, TV) carry the soft-luxury wedding aesthetic: glassmorphism accents, animated gradients, subtle confetti on correct answers/winner screen, smooth phase transitions
  2. A Chrome DevTools 4x CPU throttle test on the guest A/B tap screen holds consistent 60fps; no layout-triggering animations (`width`, `height`, `top`, `left`) are present in animated components; the leaderboard FLIP animation runs once per reveal, not on every score tick
  3. A full end-to-end game (join → play → reveal × N → winner) runs on production (Vercel + Supabase Pro, not localhost) with at least 5 real devices simultaneously, including an iPhone on Safari — the mandatory dry run passes with no stuck states, no sync gaps, and the host's emergency controls are verified

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Schema | 0/3 | Planned | - |
| 2. Realtime Core | 3/3 | Complete | 2026-06-02 |
| 3. Server Write Path & State Machine | 0/TBD | Not started | - |
| 4. Host Dashboard | 0/TBD | Not started | - |
| 5. Guest App | 0/TBD | Not started | - |
| 6. TV Display Mode | 0/TBD | Not started | - |
| 7. Polish & Pre-Event Hardening | 0/TBD | Not started | - |
