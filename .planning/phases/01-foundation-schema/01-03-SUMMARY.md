---
phase: 01-foundation-schema
plan: 03
subsystem: api
tags: [supabase, nextjs, rls, typescript, vercel, walking-skeleton]

requires:
  - phase: 01-foundation-schema/01-01
    provides: Next.js + Supabase project scaffold, typed clients, env vars
  - phase: 01-foundation-schema/01-02
    provides: Full DB schema, RLS policies, questions_public view, seed data, typed database.ts

provides:
  - Root page (Server Component) reading seeded game phase + question count via typed anon client
  - POST /api/skeleton-answer — service-role write route with phase guard (SCOR-04 substrate) + 23505→409 dedup (SCOR-03)
  - /skeleton/ping — throwaway client page demonstrating 200→409 dedup live
  - scripts/verify-rls.mjs — automated proof that anon cannot read correct_option (ROADMAP SC3)
  - scripts/verify-dedup.mjs — automated proof that UNIQUE(player_id,question_id) raises 23505 (ROADMAP SC5)
  - Post-build confirmation: service_role key absent from .next/static/ (ROADMAP SC4)

affects: [phase-02-realtime, phase-03-write-path, phase-04-host, phase-05-guest, phase-06-display, phase-07-polish]

tech-stack:
  added: []
  patterns:
    - "Server Component anon-client read: createClient from @supabase/supabase-js directly in async Server Component"
    - "Route Handler service-role write: import adminClient from @/lib/supabase/admin (server-only module)"
    - "Phase guard substrate: read games.phase before INSERT, reject non-open phases → 403"
    - "Dedup pattern: catch error.code === '23505' on INSERT → return 409 {error:'already_answered'}"
    - "Parallel fetch in Server Component: Promise.all([gameQuery, countQuery])"
    - "Verification scripts as .mjs with inline .env.local parser (no dotenv dep)"

key-files:
  created:
    - src/app/page.tsx
    - src/app/skeleton/ping/page.tsx
    - src/app/api/skeleton-answer/route.ts
    - scripts/verify-rls.mjs
    - scripts/verify-dedup.mjs
  modified: []

key-decisions:
  - "device_token column is UUID type — skeleton constants use fixed UUID strings (c0000000-… / d0000000-…), not plain strings"
  - "service_role key appears only in .next/cache/webpack/server-production/0.pack (opaque webpack server cache, not a deployed artifact); .next/static/ (client chunks) is clean — SC4 satisfied"
  - "verify-rls Assertion 1 returns 0 rows rather than an error — Supabase returns empty result for USING(false) RLS, not a permission error; both are acceptable denial forms"
  - "Page uses createClient from @supabase/supabase-js directly (not @supabase/ssr createBrowserClient) because it is a Server Component that only reads — no cookie session needed"

patterns-established:
  - "Phase guard substrate (SCOR-04): every write route reads games.phase and rejects locked/ended phases before touching answers"
  - "Key isolation enforced at module boundary: admin.ts has import 'server-only' — build fails if accidentally imported in client component"
  - "Verification scripts use inline .env.local parsing so they work with node directly (no tsx, no dotenv dep)"
  - "Walking Skeleton: root page always shows live DB state — hardcoded values are forbidden"

requirements-completed: [RT-02, RT-05, SCOR-03, SCOR-04]

duration: ~45min
completed: 2026-06-02
---

# Phase 01 Plan 03: Walking Skeleton Summary

**End-to-end stack proof: typed anon read of live seeded game data on root page, service-role write route with phase guard + DB-level 23505 dedup, automated RLS and constraint verification scripts all passing against the cloud Supabase DB.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-02T00:00:00Z
- **Completed:** 2026-06-02T00:45:00Z
- **Tasks:** 2 of 3 (Task 3 is a human-gated checkpoint — see below)
- **Files modified/created:** 5

## Accomplishments

- Root page (`/`) is a Server Component that parallelizes two anon-client reads (`games` + `questions_public`) and renders live seeded data in a soft-luxury glassmorphism card — zero hardcoded values.
- `/api/skeleton-answer` Route Handler (service-role only) implements the full SCOR-03/SCOR-04 substrate: reads `games.phase`, rejects non-open phases → 403, upserts a skeleton player, inserts an answer, and catches `error.code === '23505'` → 409. Call it twice: first returns 200, second returns 409.
- `/skeleton/ping` throwaway client page demonstrates the dedup live in a browser — one button, shows JSON result (200 then 409).
- `scripts/verify-rls.mjs` passes: anon reads 0 rows from base `questions` (USING(false) RLS) and 5 rows from `questions_public` with no `correct_option` key present.
- `scripts/verify-dedup.mjs` passes: second INSERT of same (player_id, question_id) raises SQLSTATE 23505; cleanup deletes test rows.
- `npm run build` clean (exit 0): all 4 routes compiled — `/`, `/_not-found`, `/api/skeleton-answer` (Dynamic), `/skeleton/ping` (Static). `npx tsc --noEmit` clean (zero output).

## Task Verification Evidence

### Task 1 — grep checks
```
grep -E "from\(['\"](games|questions_public)['\"]\)" src/app/page.tsx
  → .from("games")
  → .from("questions_public")

grep -c "23505" src/app/api/skeleton-answer/route.ts  → 3
grep -c "phase" src/app/api/skeleton-answer/route.ts  → 7
```

### Task 1 — build
```
npm run build (after clearing stale .next cache)
  ✓ Compiled successfully in 1000ms
  Route (app)                          Size   First Load JS
  ┌ ○ /                               139 B        101 kB
  ├ ○ /_not-found                     977 B        102 kB
  ├ ƒ /api/skeleton-answer            139 B        101 kB
  └ ○ /skeleton/ping                 1.11 kB       102 kB
  Exit: 0

npx tsc --noEmit → (no output — clean)
```

### Task 2 — verify-rls.mjs
```
verify-rls.mjs — testing with ANON key

Assertion 1: anon SELECT correct_option FROM questions
  PASS  Anon read of questions returns 0 rows (denied by USING(false))

Assertion 2: anon SELECT * FROM questions_public (view)
  PASS  questions_public returned 5 rows, none have correct_option key
        columns present: id, game_id, body, option_a, option_b, display_order, created_at

── Result: 2 passed, 0 failed ──
PASSED — anon role cannot read correct_option (D-12 / ROADMAP SC3)
```

### Task 2 — verify-dedup.mjs
```
verify-dedup.mjs — testing with SERVICE-ROLE key

Step 1: Upsert throwaway test player
  PASS  Test player upserted/found — id=c8e8273d-8b2e-4bbe-bbe6-b8a2a88c302e

Step 2: First INSERT answer (expect success)
  PASS  First INSERT succeeded — answer id=d66aaebb-e2be-464b-a1fa-4c040ee8572a

Step 3: Second INSERT same (player_id, question_id) — expect 23505
  PASS  Duplicate INSERT rejected with SQLSTATE 23505 (duplicate key value violates unique constraint "answers_play…)

Cleanup: removing test rows
  OK    Deleted test answer d66aaebb-e2be-464b-a1fa-4c040ee8572a
  OK    Deleted test player c8e8273d-8b2e-4bbe-bbe6-b8a2a88c302e

── Result: 3 passed, 0 failed ──
PASSED — UNIQUE(player_id, question_id) enforced with 23505 (SCOR-03 / ROADMAP SC5)
```

### Task 2 — post-build service_role grep
```
Command: grep -rl "service_role" .next/static/ && echo "FAIL_IN_CLIENT_STATIC" || echo "PASS_NOT_IN_CLIENT_STATIC"
Result:  PASS_NOT_IN_CLIENT_STATIC

Command: grep -rl "service_role" .next/ (full scan)
Result:  .next/cache/webpack/server-production/0.pack  ← webpack binary server cache only
         (not a deployed artifact; not in .next/static/ or .next/server/)
```

The service_role key is present only in the webpack opaque server-production cache file. It is absent from all client-delivered artifacts (`.next/static/`) and from the server route handlers as compiled (`.next/server/`). **ROADMAP SC4 satisfied.**

## Files Created

| File | Role |
|------|------|
| `src/app/page.tsx` | Server Component — anon read of games + questions_public → glassmorphism card |
| `src/app/skeleton/ping/page.tsx` | Client Component throwaway harness — button POSTs to /api/skeleton-answer, shows 200/409 |
| `src/app/api/skeleton-answer/route.ts` | Route Handler — service-role phase guard + player upsert + answer insert + 23505→409 |
| `scripts/verify-rls.mjs` | Node script — anon-key proof that correct_option is hidden (ROADMAP SC3) |
| `scripts/verify-dedup.mjs` | Node script — service-role proof that UNIQUE raises 23505 (ROADMAP SC5) |

## Decisions Made

- **device_token is UUID**: The `players.device_token` column is `UUID NOT NULL` in the schema. All skeleton/test constants use fixed UUID strings (`c0000000-…`, `d0000000-…`).
- **SC4 grep scope**: The raw `grep -r service_role .next/` hits the webpack binary cache file. The correct security check is against `.next/static/` (client-delivered chunks) — that is clean. This distinction is documented here for clarity; the constraint is satisfied.
- **Assertion 1 returns 0 rows not an error**: Supabase's PostgREST returns an empty array (not a permission error) when RLS `USING(false)` denies all rows. Both are valid denial forms; the script handles both.
- **Page uses `@supabase/supabase-js` createClient directly**: The root page is a Server Component that only reads — no cookie session needed. Using `createBrowserClient` from `@supabase/ssr` would be incorrect here. The correct pattern for authenticated server sessions is `@/lib/supabase/server.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] device_token skeleton constants used plain strings instead of UUIDs**
- **Found during:** Task 2 (verify-dedup.mjs first run)
- **Issue:** `players.device_token` is `UUID NOT NULL` — the string `"skeleton-device-token-phase1-proof"` caused `invalid input syntax for type uuid` from Postgres
- **Fix:** Changed both `SKELETON_DEVICE_TOKEN` in `route.ts` and `TEST_DEVICE_TOKEN` in `verify-dedup.mjs` to fixed UUID constants (`c0000000-0000-4000-8000-000000000001` and `d0000000-0000-4000-8000-000000000099`)
- **Files modified:** `src/app/api/skeleton-answer/route.ts`, `scripts/verify-dedup.mjs`
- **Verification:** `node scripts/verify-dedup.mjs` exits 0 with 3 passing assertions

**2. [Rule 3 - Blocking] Stale .next build cache caused webpack WasmHash crash**
- **Found during:** Task 1 verification (`npm run build`)
- **Issue:** `TypeError: Cannot read properties of undefined (reading 'length')` at `WasmHash._updateWithBuffer` — stale cache from prior build state
- **Fix:** `rm -rf .next` then re-ran build — succeeded immediately (exit 0)
- **Files modified:** None (cache-only)
- **Verification:** Build exit 0, all 4 routes compiled cleanly

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both required for correctness. No scope creep.

## Issues Encountered

- Build output flooded stderr with webpack bundle internals; used file redirection (`> out.txt 2> err.txt`) to isolate the actual build result (exit code + stdout route table).

## Task 3 — COMPLETE: Deployed to Vercel (joc repo)

**Status:** DONE. Live production URL: **https://joc-woad.vercel.app/**

Deployment moved to a dedicated GitHub repo `github.com/acstoian/joc` (not the wedding repo's `joc` branch) at the user's request, with Vercel importing that repo (Production Branch = `main`). Verified in production:
- `curl https://joc-woad.vercel.app/` → **HTTP 200**
- Root page shows live data: **Faza: lobby — Întrebări: 5 încărcate** (real anon read via `questions_public`)
- `POST /api/skeleton-answer` → **200** first call, **409 `{"error":"already_answered"}`** on repeat (SCOR-03 dedup / 23505 live in prod)

Resolved deploy blockers along the way:
1. `package-lock.json` was out of sync with `package.json` → Vercel `npm ci` failed → regenerated the lock.
2. Root page statically prerendered a build-time Supabase fetch → added `export const dynamic = "force-dynamic"` + env guard so the build never depends on DB/env.
3. Vercel **Framework Preset was "Other"** → set to **Next.js** and redeployed (the decisive fix — "Other" never wired up the Next.js runtime/routing).
4. Vercel **Deployment Protection (Require Log In)** turned OFF for Production (was returning 401 SSO gate).
5. All 4 env vars set for Production/Preview.

### Original checkpoint context (for history)
Task 3 originally required the user to manually create a Vercel project. The assistant cannot self-provision Vercel projects.

### Steps Required

1. In the **Vercel dashboard**, create a **NEW project** (separate from any project serving `master`). Import this repo and set **Production Branch = `joc`** (D-03). Assign an isolated domain.

2. Add the following **env vars** in the Vercel project settings (service-role key and HOST_PASSWORD as plain server env vars — do NOT use `NEXT_PUBLIC_` prefix for these two):
   - `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` — your Supabase service role key (**server-only, no NEXT_PUBLIC_**)
   - `HOST_PASSWORD` — host dashboard password (**server-only, no NEXT_PUBLIC_**)

3. Trigger a deploy of the `joc` branch (push the uncommitted changes first, or trigger from the Vercel dashboard).

4. Verify: `curl -I https://<your-joc-deployment>/` returns `HTTP/2 200`, and the deployed root page shows the live seeded game phase + question count.

### Resume Signal
Type **"deployed"** with the deployment URL once `curl -I https://<url>/` returns 200 and the page shows live data, or paste the Vercel build/deploy error to debug.

## Uncommitted Changes — User Must Commit (D-04)

Per D-04, no git commits are made by the assistant. The following working-tree changes are ready to commit:

```
M  src/app/page.tsx                          (Walking Skeleton read page)
A  src/app/skeleton/ping/page.tsx            (throwaway ping harness)
A  src/app/api/skeleton-answer/route.ts      (Walking Skeleton write route)
A  scripts/verify-rls.mjs                    (RLS secrecy proof script)
A  scripts/verify-dedup.mjs                  (dedup constraint proof script)
```

Suggested commit message:
```
feat(01-03): walking skeleton — anon read page, service-role write route, RLS/dedup proofs

- src/app/page.tsx: Server Component reading live game phase + question count via typed anon client
- src/app/api/skeleton-answer/route.ts: phase guard + player upsert + answer insert + 23505→409
- src/app/skeleton/ping/page.tsx: throwaway client harness demonstrating 200→409 dedup
- scripts/verify-rls.mjs: proves anon cannot read correct_option (ROADMAP SC3)
- scripts/verify-dedup.mjs: proves UNIQUE(player_id,question_id) raises 23505 (ROADMAP SC5)
```

## ROADMAP Phase 1 Success Criteria Status

| Criterion | Status | Evidence |
|-----------|--------|----------|
| SC1: App deploys to Vercel, returns 200 | DONE | https://joc-woad.vercel.app/ → HTTP 200 with live data (Faza: lobby — 5 încărcate) |
| SC2: Five tables with correct columns/constraints | DONE (Plan 02) | Schema + types verified in 01-02 |
| SC3: RLS enabled; correct_option not anon-readable, tested with anon key | DONE | verify-rls.mjs: 2/2 PASS |
| SC4: service_role key server-side only; post-build grep clean | DONE | .next/static/ has 0 matches |
| SC5: Duplicate answer INSERT rejected with 23505 | DONE | verify-dedup.mjs: 3/3 PASS |

## Next Phase Readiness

- Phase 2 (Realtime) can start: typed clients, schema, and server-side broadcast helper are all in place.
- The `/api/skeleton-answer` route is the Phase 3 write-path substrate — its phase guard and 23505 pattern will be extended, not replaced.
- SC1 (Vercel deploy) is now DONE — https://joc-woad.vercel.app/ live. All five Phase 1 success criteria met.
- NOTE: project relocated to dedicated repo `github.com/acstoian/joc`; Vercel deploys from there (Production Branch `main`). The wedding repo's `joc` branch is abandoned and left untouched.

---
*Phase: 01-foundation-schema*
*Completed: 2026-06-02*
