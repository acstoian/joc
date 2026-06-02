# Context Snapshot — Joc (Live Wedding Game Show)

> Written 2026-06-02 at the end of the session that completed Phase 1 and relocated the project.
> This file is the first thing a new session reads. It reflects the CURRENT repo (`C:\Work\Joc`).

## What this project is

**Joc — Live Wedding Game Show.** A mobile-first live A/B trivia web app for a wedding.
Guests join on their phones (name only), answer host-controlled questions by tapping A/B,
and watch live results/leaderboard. A host drives the flow from a protected dashboard; a
cinematic Display Mode projects to a TV. Stack: **Next.js 15.3 (App Router) + TypeScript +
Tailwind v4 + shadcn + Supabase (Postgres + Realtime Broadcast) + Vercel.**

The full project context, decisions, roadmap, and research live in `.planning/`
(PROJECT.md, ROADMAP.md, STATE.md, research/STACK.md, research/ARCHITECTURE.md, research/PITFALLS.md).
**Read `.planning/STATE.md` for the authoritative current position** — it is the GSD source of truth.

## Where things stand

- **Phase 1 (Foundation & Schema): COMPLETE ✅** — all 5 success criteria met and verified in production.
- **Live deployment:** https://joc-woad.vercel.app/ (root 200, live Supabase read, POST dedup 200→409).
- **Next up: Phase 2 — Realtime** (Supabase Broadcast room-sync). Start it with `/gsd-plan-phase 2`
  (or `/gsd-discuss-phase 2` first). Note: rich `.planning/research/` already exists — per project
  memory, per-phase RESEARCH is usually redundant for Joc.

## Critical facts for resuming

- **Repo:** this directory `C:\Work\Joc` → GitHub `github.com/acstoian/joc`, branch **`main`**.
  This is the canonical project. (It was split out of an earlier wedding-site repo; that old repo
  and its `master` branch are unrelated and must not be touched.)
- **Commits ARE allowed here.** (The earlier "D-04 / no commits" rule only applied while we were
  working inside the shared wedding repo to protect it. In this standalone repo, commit normally.)
- **Supabase project:** ref `rlbnnzxlduwtfagvhwgr` ("acstoian's Project", West EU/Ireland),
  URL `https://rlbnnzxlduwtfagvhwgr.supabase.co`. CLI is linked (`supabase/config.toml`,
  `supabase/.temp/project-ref`). Schema, RLS, `reset_game()`, and seed are applied to the cloud DB
  (1 game phase=lobby id `a0000000-0000-4000-8000-000000000001`, 5 questions).
- **Secrets:** in `.env.local` (gitignored, present locally) — NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ACCESS_TOKEN. `HOST_PASSWORD`
  is reserved-but-empty (host auth lands Phase 3/4). The same 4 are set in Vercel (Production+Preview).
- **node_modules installed; `npm run build` passes; `npm run dev` works.** `db:gen-types` regenerates
  `src/types/database.ts` from the live schema after any migration.
- **Key client modules:** `src/lib/supabase/client.ts` (anon browser), `server.ts` + `admin.ts`
  (both `import "server-only"`; admin.ts has the REST `broadcast()` helper — the RT-02 surface Phase 2 consumes).
- **Throwaway skeleton to remove later:** `src/app/skeleton/ping/page.tsx` and
  `src/app/api/skeleton-answer/route.ts` are Phase-1 proof harnesses; the real guest write-path
  replaces them in Phase 5 (the route's phase-guard + 23505→409 pattern carries forward to Phase 3).

## Architectural guardrails (from ROADMAP/PROJECT — do not violate)

- **Supabase Realtime BROADCAST, never Postgres Changes** for game fan-out (per-subscriber RLS query cost).
- **Service-role key is server-only**; anon key for all client-side access.
- Host dashboard is built before the guest app (Phase 4 before Phase 5).
- Supabase Pro plan required before any real deployment / the dry run (free tier OK for dev now).

## Vercel notes (so a future deploy doesn't repeat this session's debugging)

- Framework Preset MUST be **Next.js** (auto-detect once failed → it had defaulted to "Other" and 404'd).
- Keep `package-lock.json` in sync (Vercel runs `npm ci`, which hard-fails on drift).
- Deployment Protection ("Require Log In") is OFF for Production (guests must reach it without a Vercel login).
- The root page is `export const dynamic = "force-dynamic"` on purpose (live per request; build must not depend on DB/env).
