# Walking Skeleton — Joc (Live Wedding Game Show)

**Phase:** 1
**Generated:** 2026-06-01

## Capability Proven End-to-End

A visitor opening the deployed `joc` Vercel app sees the live seeded game state (phase + question count) read from the cloud Supabase database through a typed anon client, and can record a test answer that is written to the database and rejected on duplicate (23505) — proving Next.js -> typed Supabase client -> cloud Postgres -> RLS -> Vercel works as one stack.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15.3.x (App Router) + TypeScript 5.9 (strict) | Project constraint (STACK.md/PROJECT.md). RSC + Route Handlers + Server Actions fit Vercel serverless. Next 16 exists but 15.3 is honored per the explicit constraint; codemod-upgradable later. |
| Styling | Tailwind CSS v4 (`@theme` CSS-first, no config file) + shadcn/ui (v4-native) | STACK.md. Soft-luxury base tokens defined now (D-16); full polish deferred to Phase 7. |
| Data layer | Supabase Postgres via `@supabase/supabase-js` + `@supabase/ssr`; NO ORM (no Prisma/Drizzle) | D-06. Supabase-js gives typed queries via generated types (D-14); Prisma would not understand RLS. |
| Schema management | Supabase CLI SQL migrations (`supabase/migrations/*.sql`) against a LINKED cloud project | D-05/D-06. Cloud-from-the-start (free tier dev, Pro before event); no local Docker stack. |
| Realtime (future) | Supabase Realtime **Broadcast** only — server writes DB then POSTs to the REST broadcast API; clients subscribe. NO Postgres Changes for game state. | ARCHITECTURE.md + PITFALLS #1. The `admin.ts` broadcast helper surface is created in Phase 1; consumed in Phase 2/3. |
| Auth | Shared `HOST_PASSWORD` env var, validated server-side, session client-side. No user table, no Supabase Auth. | D-15. Phase 1 only reserves the env var + establishes the server-validation boundary. |
| Key isolation | anon key = client only (`NEXT_PUBLIC_*`); service_role key + HOST_PASSWORD = server only (`import "server-only"` modules, never `NEXT_PUBLIC_`). | D-13 + PITFALLS #9. Verified by post-build `grep -r service_role .next/`. |
| Deployment target | NEW, separate Vercel project, Production Branch = `joc`, isolated domain + env vars | D-03. `joc` never merges to `master`. |
| Directory layout | `src/app/` (routes + `api/` route handlers), `src/lib/supabase/{client,server,admin}.ts`, `src/lib/utils.ts`, `src/types/database.ts`, `supabase/migrations/`, `supabase/seed.sql`, `scripts/` | ARCHITECTURE.md §"Recommended Project Structure" + §"Shared". |
| Git | Assistant makes NO commits; all changes stay as working-tree changes; user manages git. | D-04. |

## Stack Touched in Phase 1

- [x] Project scaffold (Next.js 15.3, TS strict, Tailwind v4, shadcn, ESLint flat config, Supabase CLI) — Plan 01
- [x] Routing — real root route `/`, skeleton interaction `/skeleton/ping`, route handler `/api/skeleton-answer` — Plans 01/03
- [x] Database — full 5-table schema applied to cloud; one real READ (root page reads `games` + `questions_public`) AND one real WRITE (`/api/skeleton-answer` inserts into `answers`) — Plans 02/03
- [x] UI — interactive button on `/skeleton/ping` wired to the write API — Plan 03
- [x] Deployment — deployed to the `joc` Vercel project returning 200 from root — Plan 03

## Out of Scope (Deferred to Later Slices)

- Realtime Broadcast subscriptions / `useGameSync` hook (Phase 2)
- Real guest join / answer / reconnect API routes and the host transition + reveal + scoring write path (Phase 3) — the Phase 1 `/api/skeleton-answer` route is a throwaway proof harness, replaced in Phase 3/5
- Host dashboard, auth gate, question CRUD, live stats, emergency recovery (Phase 4)
- Guest app UI: lobby, QR, A/B tap UX, lock/reveal/leaderboard/end views (Phase 5)
- TV `/display` cinematic mode (Phase 6)
- Animation, confetti, FLIP leaderboard, soft-luxury polish, dry run (Phase 7)
- Materialized leaderboard query strategy beyond on-read counting (D-09; `scores` table exists as the optional cache but leaderboard-on-read stays the default)
- Private Broadcast channels + channel RLS (deferred; public channel for v1 per D-12)
- Supabase Pro upgrade (free tier acceptable for dev; Pro is a pre-dry-run gate in Phase 7, D-05)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2 — Realtime Core:** `useGameSync` subscribe-then-fetch hook over the Broadcast channel; reconnect resilience (`worker:true`, jittered backoff, visibilitychange). Two-tab sync proof.
- **Phase 3 — Server Write Path & State Machine:** real `/api/game/join` (idempotent upsert), `/api/game/answer` (phase guard + dedup), `/api/host/transition` (compare-and-swap), `/api/host/reveal` (scoring + broadcast); the `lobby->question->locked->revealed->ended` state machine.
- **Phase 4 — Host Dashboard:** password gate, phase controls, question CRUD + reorder, live participant count + A/B distribution, emergency recovery.
- **Phase 5 — Guest App:** join + lobby + QR, A/B tap UX, lock + reveal + leaderboard + winner views; reconnect UX. Replaces the skeleton ping harness.
- **Phase 6 — TV Display Mode:** `/display` cinematic landscape route, pure subscriber.
- **Phase 7 — Polish & Pre-Event Hardening:** soft-luxury aesthetic, animation audit, performance validation, mandatory production dry run (and Supabase Pro upgrade gate).
