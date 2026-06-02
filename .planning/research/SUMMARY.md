# Project Research Summary

**Project:** Joc — Live Wedding Game Show
**Domain:** Live realtime multiplayer audience game (A/B trivia), single-event, mobile-first, Vercel-hosted
**Researched:** 2026-06-01
**Confidence:** HIGH

## Executive Summary

Joc is a live, host-driven A/B trivia game show for a wedding: 100+ guests answer from their phones, a host drives flow from a protected dashboard, and a cinematic TV "Display Mode" projects the experience to the room. All four research dimensions (stack, features, architecture, pitfalls) converged strongly on the same core engineering decisions, which gives high confidence in the recommended approach.

The single most consequential decision: use **Supabase Realtime Broadcast — not Postgres Changes — for all game-state distribution.** Postgres Changes runs one RLS authorization query per subscriber per event, so one host click with 100 guests = 100 DB queries; Broadcast bypasses the DB at delivery (benchmarked ~6ms median at very high client counts). Because Vercel serverless functions cannot hold WebSockets, the write path is: server writes to Postgres → server POSTs to the Supabase Realtime Broadcast REST API → Supabase fans out to all connected clients. The `games` row (a `phase` + `current_question_id` state machine) is the canonical source of truth; every client (guest, host, TV) derives its UI from it and uses **subscribe-then-fetch** to recover authoritative state on reconnect.

The biggest risks are operational and live-event specific, not algorithmic: Supabase **free tier is unsafe** (≈200 concurrent connection cap + suspension on overage) so **Pro plan is effectively mandatory**; **iOS Safari silently drops WebSockets on screen-lock**, affecting a large share of guests at any moment, so reconnect handling (`worker: true`, `visibilitychange` re-subscribe, jittered backoff) is a first-class requirement; and a single host misclick can derail the whole event, so **emergency recovery controls + a mandatory production dry run** are requirements, not polish.

## Key Findings

### Recommended Stack

Modern, Vercel-native, component-driven. Honor the stated Next.js 15.x constraint (16.x exists and is a later one-command codemod — no architecture changes). See `STACK.md` for pinned versions.

**Core technologies:**
- **Next.js 15.3.x (App Router) + TypeScript** — Vercel-native, RSC where appropriate, Server Actions/API routes for the write path
- **Supabase (Postgres + Realtime Broadcast + Auth)** — one vendor for DB, realtime, and host auth; fewest moving parts
- **`@supabase/ssr` v0.10.x** — current SSR client (`@supabase/auth-helpers-nextjs` is deprecated); validate host with `auth.getUser()` server-side, never trust `getSession()` in server code
- **`motion` (formerly `framer-motion`)** — package renamed late 2024; same API, import from `motion/react`; client components only
- **Tailwind CSS v4 + shadcn/ui (v4-native)** — `@theme` CSS-first config, no `tailwind.config.js`; `tailwindcss-animate` deprecated
- **Zustand 5.x — only for client UI state** (animation phase, optimistic lock); never duplicate game state, the Realtime channel/DB is the source of truth

### Expected Features

From `FEATURES.md` (validated against Kahoot, Crowdpurr, AhaSlides, Slido, Mentimeter).

**Must have (table stakes):**
- Join with name + persistent device token (localStorage); lobby; QR to join
- Live question push; A/B answer select; server-side answer lock; post-answer waiting state
- Host controls: start, lock answers, reveal correct, next, end; live participant count; live answer distribution + who answered what
- Reveal of correct answer; flat 1-pt scoring; leaderboard; game-end/winner screen
- **Reconnect/resync** (hardest table-stakes feature — depends on device token; cannot be deferred)

**Should have (competitive / premium room feel):**
- Dedicated TV **Display Mode** route (the single biggest "room experience" differentiator)
- Animated live A/B distribution bars; FLIP-animated leaderboard rank changes
- Cinematic reveal animations, confetti, host-initiated cosmetic countdown

**Defer / anti-features (explicitly NOT v1):**
- Guest accounts, speed-weighted/streak scoring, timer auto-lock/auto-advance
- Non-binary question types, multi-game/tenant codes, spectator mode, chat, teams, i18n

### Architecture Approach

From `ARCHITECTURE.md`. Server is the single source of truth; clients are mostly subscribers. Three client surfaces share one realtime channel and one `useGameSync` hook.

**Major components:**
1. **Database (Supabase Postgres)** — `games` (state machine: phase + current_question_id), `players`, `questions`, `answers`, `scores`; hard constraints incl. `UNIQUE (player_id, question_id)`
2. **Server write path (Server Actions / API routes)** — join (idempotent upsert on device token), submit-answer (phase guard + dedup), host transitions (compare-and-swap); after each write, POST to Broadcast REST API
3. **`useGameSync` hook (shared client)** — subscribe to Broadcast channel, then fetch authoritative state; re-fetch on reconnect
4. **Guest app** — A/B tap UX, lock UI, reconnect
5. **Host dashboard** — drives all transitions; live counts/distribution; emergency recovery controls
6. **TV Display (`/display`)** — pure subscriber, cinematic fullscreen landscape; never depends on host dashboard being open

### Critical Pitfalls

Top items from `PITFALLS.md` (12 total):

1. **Postgres Changes fan-out** — never subscribe clients to Postgres Changes for game state; use Broadcast exclusively (server writes DB then publishes).
2. **Supabase free tier mid-event failure** — ≈200 connection cap + auto-suspend on overage; use **Pro plan ($25/mo, 500 conns, overage billing)**.
3. **iOS Safari screen-lock disconnects** — `worker: true` on the Realtime client + `visibilitychange` handler with immediate reconnect; affects a large share of guests continuously.
4. **Reconnect storms** — add jitter (`reconnectAfterMs` + `Math.random()*2000`); always state-fetch after reconnect (Broadcast is not replayed).
5. **Race conditions** — DB `UNIQUE (player_id, question_id)` with `ON CONFLICT DO NOTHING` for duplicate answers; compare-and-swap (`WHERE current_index = expected`) for host double-click.
6. **No recovery path** — emergency controls (reset round, jump to question, force-end) + a mandatory pre-event production dry run on a CPU-throttled real device.
7. **Service-role key exposure / RLS misconfig** — isolate the service-role key to server env only; design RLS so `questions.correct_option` is not client-readable before reveal (server broadcasts the reveal).

## Implications for Roadmap

Build order is dictated by the dependency graph: schema and the realtime sync primitive are load-bearing and come first; the host dashboard precedes the guest app (so the guest app can be tested against real phase transitions); TV display is a pure subscriber built late; polish/animation last.

### Phase 1: Foundation & Schema
**Rationale:** Schema + Supabase setup are load-bearing; every surface depends on them.
**Delivers:** Next.js+TS+Tailwind v4+shadcn scaffold; Supabase project (Pro plan); full DB schema with constraints (incl. `UNIQUE(player_id, question_id)`); RLS policies (hide `correct_option`); service-role key isolation; host auth.
**Addresses:** join/identity groundwork; anti-cheat at DB layer.
**Avoids:** free-tier failure, RLS/key exposure, race conditions.

### Phase 2: Realtime Core (Broadcast + useGameSync)
**Rationale:** Riskiest integration point; everything reactive sits on it. Spike it (two tabs) before building game logic.
**Delivers:** Broadcast channel design (one channel/client); server write→broadcast pattern; `useGameSync` subscribe-then-fetch hook; reconnect resilience (jitter, `worker:true`, visibilitychange).
**Uses:** Supabase Realtime Broadcast + REST broadcast API.
**Implements:** sync layer shared by all three surfaces.
**Avoids:** Postgres Changes fan-out, reconnect storms, iOS screen-lock drops.

### Phase 3: Server Write Path & Game State Machine
**Rationale:** Authoritative mutations must exist before meaningful UI testing.
**Delivers:** join (idempotent upsert), submit-answer (phase guard + dedup), host transitions (compare-and-swap), scoring (flat 1pt).
**Implements:** `games` phase machine; answers/scores writes.
**Avoids:** duplicate/late answers, host double-click desync.

### Phase 4: Host Dashboard
**Rationale:** Host drives all state; build before guest app so guest flow is testable against real transitions.
**Delivers:** start/lock/reveal/next/end controls, live participant count, live A/B distribution + who answered what, question CRUD + reorder + mark-correct, emergency recovery (reset round / jump / force-end).
**Addresses:** all host table-stakes features.

### Phase 5: Guest App
**Rationale:** Now testable end-to-end against host transitions.
**Delivers:** join + lobby, A/B tap UX, locked-answer UI, waiting state, reveal view, reconnect UX.
**Addresses:** guest table-stakes; reconnect resilience surfaced to users.

### Phase 6: TV Display Mode
**Rationale:** Pure subscriber; trivially testable once other surfaces work; independent of host dashboard.
**Delivers:** `/display` cinematic landscape route — current question, live distribution, reveal, leaderboard, winner screen, host-initiated countdown.
**Addresses:** biggest "room experience" differentiator.

### Phase 7: Polish & Pre-Event Hardening
**Rationale:** Aesthetic and reliability pass once functionality is proven.
**Delivers:** motion reveal animations, confetti, FLIP leaderboard, animated distribution bars, soft-luxury wedding theme; animation audit on 4× CPU-throttled device; cold-start warm-up; **mandatory production dry run**.
**Avoids:** low-end-phone jank, cold starts, live-event surprises.

### Phase Ordering Rationale
- Schema → sync → write path → UI mirrors the discovered dependency chain; reconnect/anti-cheat are designed in from Phase 1–2, not retrofitted.
- Host dashboard before guest app lets the guest experience be validated against real, authoritative state transitions.
- TV display and most polish are deferrable because they are read-only subscribers over an already-proven sync layer.

### Research Flags
Phases likely needing deeper research during planning:
- **Phase 2:** Broadcast channel topology (single vs per-player), exact reconnect/visibilitychange behavior on iOS — verify with a spike.
- **Phase 1:** RLS policy to hide `questions.correct_option` until reveal; confirm Supabase plan/connection limits + new key format at kickoff.

Phases with standard patterns (lighter research):
- **Phase 4/5 UI**, **Phase 7 polish** — well-trodden Next.js + shadcn + motion patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against official docs/npm, not training data |
| Features | HIGH | Cross-checked vs Kahoot/Crowdpurr/AhaSlides/Slido |
| Architecture | HIGH | Supabase official benchmarks/docs confirm Broadcast vs Postgres Changes + REST broadcast |
| Pitfalls | HIGH | Supabase + Vercel official docs; iOS Safari behavior is MEDIUM (community-confirmed) |

**Overall confidence:** HIGH

### Gaps to Address
- **Supabase plan & connection limits** — verify current free/Pro caps and the new `sb_publishable_/sb_secret_` key format during project setup; budget for Pro.
- **iOS Safari screen-lock reconnect** — `worker:true` helps but the 60s lock case isn't officially confirmed; verify on a real device during the dry run.
- **Burst load** (100 guests answering within ~5s) — load-test during dry run rather than assume PgBouncer pool is fine.
- **RLS for `correct_option`** — finalize the policy in Phase 1 so the answer can't be sniffed before reveal.

## Sources

### Primary (HIGH confidence)
- Supabase official docs — Realtime Broadcast vs Postgres Changes, broadcast REST API, limits/benchmarks, `@supabase/ssr`
- Vercel official docs — no WebSocket servers in serverless functions
- Next.js release notes; motion.dev upgrade guide; Tailwind v4 + shadcn/ui changelog; npm version checks

### Secondary (MEDIUM confidence)
- Crowdpurr / Kahoot / AhaSlides feature & UX documentation; WebSocket reconnection guides
- Community reports on iOS Safari WebSocket screen-lock behavior

---
*Research completed: 2026-06-01*
*Ready for roadmap: yes*
