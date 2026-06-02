---
phase: 01-foundation-schema
plan: "02"
subsystem: database
tags: [supabase, postgres, rls, sql, migrations, typescript, types]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Typed Supabase client modules (client/server/admin) and linked Supabase project (rlbnnzxlduwtfagvhwgr)"

provides:
  - "Five Postgres tables: games, questions, players, answers, scores — applied to cloud DB"
  - "UNIQUE (player_id, question_id) on answers — SCOR-03 duplicate-submission anti-cheat enforced at DB layer"
  - "UNIQUE (game_id, device_token) on players — idempotent join/reconnect"
  - "games.phase CHECK ('lobby','question','locked','revealed','ended') — SCOR-04 state machine substrate"
  - "RLS on all five tables; questions_public view hides correct_option from anon (D-12 / T-01-05)"
  - "reset_game(uuid) SQL function — clears answers+scores, resets game to lobby, keeps questions (D-10)"
  - "supabase/seed.sql — 1 game row + 5 A/B questions with correct_option set (D-11)"
  - "src/types/database.ts — generated from live cloud schema; all tables + questions_public view typed"

affects:
  - "01-03 (walking skeleton imports typed clients; verify blocks test live tables)"
  - "All phases 2-7 (typed Supabase queries against games/players/questions/answers/scores)"
  - "Phase 3 answer API (UNIQUE 23505 dedup path), phase transition API (games.phase guard)"
  - "Phase 4 host dashboard (reset_game function, questions_public view for pre-reveal display)"

# Tech tracking
tech-stack:
  added:
    - "Postgres schema: games, questions, players, answers, scores tables"
    - "Supabase CLI db push (cloud-linked migration delivery)"
    - "Supabase CLI gen types typescript --linked (live-schema type generation)"
  patterns:
    - "Circular FK resolved with deferred ALTER TABLE: games created first without current_question_id FK; questions created; then ALTER TABLE games ADD CONSTRAINT games_current_question_fk"
    - "Column-masking VIEW pattern: questions_public omits correct_option; anon denied on base table, granted on view"
    - "REVOKE EXECUTE on reset_game() from PUBLIC and anon — SECURITY DEFINER function not grantable to untrusted roles"
    - "Fixed-UUID seed rows with ON CONFLICT DO NOTHING for idempotent re-seeding"

key-files:
  created:
    - "supabase/migrations/0001_init_schema.sql — five tables + deferred FK + three indexes"
    - "supabase/migrations/0002_rls_policies.sql — RLS ENABLE + 20 explicit anon policies + questions_public view"
    - "supabase/migrations/0003_reset_function.sql — reset_game() SECURITY DEFINER function"
    - "supabase/seed.sql — 1 game + 5 sample A/B questions (fixed UUIDs, ON CONFLICT DO NOTHING)"
  modified:
    - "src/types/database.ts — replaced placeholder with live-generated Database type (answers/games/players/questions/scores + questions_public view)"

key-decisions:
  - "questions_public column-masking view chosen over security-definer RPC approach: simpler, REST-queryable by the anon key, no extra function overhead"
  - "anon_players_insert set to WITH CHECK(false): guest join goes through service_role API route (Phase 3) not anon direct INSERT — cleaner security boundary even though anon INSERT WITH CHECK(true) would also be acceptable"
  - "reset_game() resets started_at and ended_at to NULL in addition to phase/current_question_id — enables cleaner re-run state rather than carrying stale timestamps"
  - "Seed uses Romanian-language question bodies matching the wedding context — testable Phase 3 reveal path with correct_option set on all 5 questions"

patterns-established:
  - "Anon-role policy completeness: all four DML operations (SELECT/INSERT/UPDATE/DELETE) defined explicitly for anon on every table — even if USING(false) — per PITFALLS #11"
  - "Deferred circular FK: schema-level pattern for games↔questions bidirectional references without deferrable transactions"

requirements-completed: [SCOR-03, SCOR-04, RT-02]

# Metrics
duration: ~25min
completed: "2026-06-02"
---

# Phase 1 Plan 02: Database Schema, RLS, Reset Function, and Typed Bindings

**Five-table Postgres schema (games/players/questions/answers/scores) applied to the linked cloud Supabase project with complete RLS, questions_public column-masking view, reset_game() function, seed data, and TypeScript types generated from the live schema.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-02T00:00Z
- **Completed:** 2026-06-02T00:25Z
- **Tasks:** 3 (Task 1 SQL authoring, checkpoint push, Task 2 type gen) — all complete
- **Files created:** 5 (four SQL files + regenerated database.ts)
- **Files modified:** 1 (src/types/database.ts replaced)

## Accomplishments

### Task 1: Author SQL migrations (COMPLETE)

- `0001_init_schema.sql`: Five tables with all constraints per ARCHITECTURE.md. Circular FK (games.current_question_id → questions while questions.game_id → games) resolved by creating games first without the FK, then questions, then ALTER TABLE games ADD CONSTRAINT games_current_question_fk. UNIQUE (player_id, question_id) anti-cheat and UNIQUE (game_id, device_token) idempotent join both present. Three indexes created.
- `0002_rls_policies.sql`: RLS enabled on all 5 tables. 20 explicit anon policies (SELECT/INSERT/UPDATE/DELETE × 5 tables). `questions_public` view created omitting `correct_option`; anon SELECT granted on view, anon SELECT USING(false) on base questions table.
- `0003_reset_function.sql`: `reset_game(uuid)` SECURITY DEFINER — deletes answers by game, zeroes scores, resets games.phase to 'lobby' and current_question_id/started_at/ended_at to NULL, keeps questions. REVOKE EXECUTE from PUBLIC and anon.
- `supabase/seed.sql`: Fixed-UUID game row + 5 Romanian-language A/B questions with correct_option set for Phase 3 reveal testing. ON CONFLICT DO NOTHING for idempotency.

### Checkpoint: Push to cloud DB (COMPLETE)

- `npx supabase db push` applied 0001, 0002, 0003 to the linked project (rlbnnzxlduwtfagvhwgr) non-interactively via SUPABASE_ACCESS_TOKEN.
- `npx supabase db push --include-seed` applied seed.sql.
- All five tables confirmed via REST API (HTTP 200/206 on each). Seed data verified: 1 game row (phase=lobby), 5 questions.
- RLS verified: `questions_public` readable by anon (no correct_option), base questions returns [] for anon.

### Task 2: Generate typed bindings (COMPLETE)

- `npm run db:gen-types` regenerated `src/types/database.ts` from live schema.
- File is non-empty; contains `Database` type with all five tables (answers, games, players, questions, scores) and `questions_public` view.
- All three client modules (client.ts, server.ts, admin.ts) were already parameterized with `<Database>` from Plan 01 — no modifications needed.
- `npx tsc --noEmit` → zero errors.

## Task Commits

No commits per D-04 (user manages git). All changes left as uncommitted working-tree changes.

## Files Created/Modified

- `supabase/migrations/0001_init_schema.sql` — five tables, deferred FK, three indexes
- `supabase/migrations/0002_rls_policies.sql` — RLS + 20 anon policies + questions_public view
- `supabase/migrations/0003_reset_function.sql` — reset_game() SECURITY DEFINER
- `supabase/seed.sql` — 1 game + 5 A/B questions (fixed UUIDs, idempotent)
- `src/types/database.ts` — replaced placeholder with live-generated Database type

## Decisions Made

- `questions_public` column-masking view chosen over security-definer RPC: simpler REST-queryable approach; anon key can directly hit `/rest/v1/questions_public` without a function call.
- `anon_players_insert` set to `WITH CHECK(false)`: guest join goes through the service_role API route in Phase 3, not direct anon INSERT. Cleaner security boundary.
- `reset_game()` also NULLs `started_at` and `ended_at`: cleaner state for dry-run → re-run cycles (timestamps from a prior run don't carry over).
- Seed uses Romanian-language question bodies matching the wedding theme for more realistic Phase 3 testing.

## Deviations from Plan

None — plan executed exactly as written. All verify blocks passed. Push succeeded non-interactively (no DB password prompt — SUPABASE_ACCESS_TOKEN was sufficient). TypeScript compiled with zero errors immediately after type generation.

## Issues Encountered

- The automated verify grep for `phase.*CHECK.*lobby.*question.*locked.*revealed.*ended` returned empty because the CHECK constraint is split across two lines in the SQL file. Content was manually verified to be correct (lines 15-16 of 0001_init_schema.sql). No fix needed.

## Known Stubs

None — all SQL files are complete and applied to the live DB. `src/types/database.ts` is fully generated (not a placeholder).

## Threat Flags

No new threat surface beyond the plan's threat model:
- T-01-05 (correct_option disclosure): mitigated — anon SELECT on base questions USING(false); questions_public view has no correct_option column; verified with anon key REST call returning [] on base table.
- T-01-06 (duplicate answers): mitigated — UNIQUE (player_id, question_id) applied to live DB.
- T-01-07 (duplicate player reconnect): mitigated — UNIQUE (game_id, device_token) applied.
- T-01-08 (anon host-only writes): mitigated — all anon write policies for host-only operations set to USING(false)/WITH CHECK(false); reset_game() REVOKE EXECUTE from anon.
- T-01-09 (incomplete RLS): mitigated — 20 explicit anon policies covering all 4 DML × 5 tables (PITFALLS #11).

## Next Phase Readiness

- All five tables exist in the live cloud DB with correct constraints, indexes, and RLS.
- `src/types/database.ts` generated and compiling — typed queries available for Phase 2+ development.
- Seed data present for immediate testability in Plan 01-03 walking skeleton.
- `reset_game()` function callable via service_role for dry-run reset.
- SCOR-03 (duplicate answer dedup), SCOR-04 (phase guard substrate), RT-02 (Broadcast schema) fully locked in at the DB layer.

## Uncommitted Changes — User Must Commit (D-04)

Per decision D-04, the assistant makes no git commits. All changes below are in the working tree on the `joc` branch.

**Suggested commit message:**
```
feat(01-02): apply Postgres schema, RLS, reset function, and seed to cloud DB

- Add supabase/migrations/0001_init_schema.sql: five tables with constraints and indexes
- Add supabase/migrations/0002_rls_policies.sql: RLS on all tables + questions_public view
- Add supabase/migrations/0003_reset_function.sql: reset_game() SECURITY DEFINER
- Add supabase/seed.sql: 1 game + 5 A/B questions (idempotent fixed UUIDs)
- Regenerate src/types/database.ts from live schema (replaces Plan-01 placeholder)
```

**Files changed:**
- Created: `supabase/migrations/0001_init_schema.sql`
- Created: `supabase/migrations/0002_rls_policies.sql`
- Created: `supabase/migrations/0003_reset_function.sql`
- Created: `supabase/seed.sql`
- Modified: `src/types/database.ts` (placeholder → live-generated types)

## Self-Check

- `supabase/migrations/0001_init_schema.sql` exists: FOUND
- `supabase/migrations/0002_rls_policies.sql` exists: FOUND
- `supabase/migrations/0003_reset_function.sql` exists: FOUND
- `supabase/seed.sql` exists: FOUND
- `src/types/database.ts` non-empty: FOUND (TYPES_NONEMPTY)
- Five tables in DB: games HTTP 200, questions HTTP 206, players HTTP 200, answers HTTP 200, scores HTTP 200
- Seed: 1 game row, 5 questions verified via REST
- RLS: anon denied on base questions, allowed on questions_public view verified
- `npx tsc --noEmit`: zero errors

**Self-Check: PASSED**

---
*Phase: 01-foundation-schema*
*Plan: 02*
*Completed: 2026-06-02*
