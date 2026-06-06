# Phase 1 — Artifacts This Phase Produces

> Authoritative list of every symbol/file/identifier Phase 1 creates. Downstream phases (2-7) consume these without re-deriving them. Source of truth for the schema is `.planning/research/ARCHITECTURE.md`.

## Database tables (cloud Supabase, via `supabase/migrations/0001_init_schema.sql`)

| Table | Key columns | Constraints |
|---|---|---|
| `games` | id (uuid pk), created_at, **phase** (text, CHECK in lobby/question/locked/revealed/ended, default 'lobby'), current_question_id (uuid fk -> questions, ON DELETE SET NULL), started_at, ended_at | phase CHECK; circular FK resolved via ALTER TABLE after questions created |
| `questions` | id (uuid pk), game_id (fk -> games, cascade), body, option_a, option_b, **correct_option** (text CHECK A/B, NULL until reveal), display_order (int), created_at | correct_option nullable (hidden pre-reveal) |
| `players` | id (uuid pk), game_id (fk -> games, cascade), display_name, device_token (uuid), joined_at | **UNIQUE (game_id, device_token)** — idempotent join/reconnect |
| `answers` | id (uuid pk), player_id (fk -> players, cascade), question_id (fk -> questions, cascade), choice (text CHECK A/B), submitted_at | **UNIQUE (player_id, question_id)** — SCOR-03 anti-cheat (23505 on dup) |
| `scores` | player_id (uuid pk, fk -> players, cascade), correct_count (int default 0), updated_at | optional cache (D-09); leaderboard-on-read is default |

## Database views / functions / indexes

- **View `public.questions_public`** — anon-readable projection of `questions` OMITTING `correct_option` (id, game_id, body, option_a, option_b, display_order). The anon read path; base `questions` anon SELECT is denied. (D-12)
- **Function `reset_game(p_game_id uuid)`** — clears answers, zeroes scores, sets games.phase='lobby' + current_question_id=NULL, KEEPS questions. SECURITY DEFINER, not granted to anon. (D-10)
- **Indexes:** `answers_question_id_idx` (answers.question_id), `scores_correct_count_idx` (scores.correct_count DESC), `players_device_token_idx` (players.device_token).
- **RLS:** enabled on all five tables; explicit anon SELECT/INSERT/UPDATE/DELETE policies (PITFALLS #11). anon: SELECT on games/players/scores + `questions_public`; INSERT on answers; everything else USING(false).

## Application modules / files

| Path | Provides |
|---|---|
| `src/lib/supabase/client.ts` | Typed browser client `createClient()` via `createBrowserClient<Database>` (anon key) |
| `src/lib/supabase/server.ts` | Server-only (`import "server-only"`) service-role client |
| `src/lib/supabase/admin.ts` | Server-only service-role admin client + `broadcast(topic, event, payload)` REST-broadcast helper (RT-02 surface for Phase 2/3) |
| `src/lib/utils.ts` | `cn()` (clsx + tailwind-merge) for shadcn |
| `src/types/database.ts` | Generated `Database` type from the live schema (D-14) |
| `src/app/globals.css` | Tailwind v4 `@import` + `@theme` soft-luxury tokens + `.glass` placeholder (D-16) |
| `src/app/layout.tsx`, `src/app/page.tsx` | Root layout + Walking Skeleton read page |
| `src/app/skeleton/ping/page.tsx` | Throwaway interaction harness (removed/replaced Phase 5) |
| `src/app/api/skeleton-answer/route.ts` | Throwaway write proof route (dedup + phase-guard substrate; replaced Phase 3/5) |
| `scripts/verify-rls.mjs` | Anon-key proof: correct_option not readable pre-reveal |
| `scripts/verify-dedup.mjs` | Service-role proof: duplicate INSERT raises 23505 |
| `supabase/config.toml` | Supabase CLI config (linked cloud project) |
| `supabase/migrations/0001_init_schema.sql`, `0002_rls_policies.sql`, `0003_reset_function.sql` | Schema, RLS, reset fn |
| `supabase/seed.sql` | One games row + sample A/B questions (D-11) |
| `.env.example` | Env-var contract |

## Theme tokens (in `src/app/globals.css` `@theme`)

Soft-luxury color tokens (names chosen during execution, e.g. `--color-champagne`, `--color-blush`, `--color-ink`, `--color-gold`, `--color-cream`) and font vars (`--font-heading`, `--font-body`); `.glass` glassmorphism placeholder utility. Full names recorded in the Plan 01 SUMMARY.

## Environment variables (contract in `.env.example`)

| Var | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | privileged DB writes + REST broadcast (NEVER NEXT_PUBLIC_) |
| `HOST_PASSWORD` | server-only | reserved for host auth (D-15; used Phase 3/4) |
| `SUPABASE_ACCESS_TOKEN` | CLI/local | non-interactive `supabase link`/`db push` |

## Route paths

- `/` — root (Walking Skeleton read)
- `/skeleton/ping` — interaction harness (Phase-1 only)
- `/api/skeleton-answer` — write proof route (Phase-1 only)

## npm scripts (in `package.json`)

`dev` (next dev --turbo), `build`, `start`, `lint` (eslint .), `db:push` (supabase db push), `db:gen-types` (supabase gen types typescript --linked > src/types/database.ts).
