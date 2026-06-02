# Phase 1: Foundation & Schema - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a working Next.js 15 + Supabase project for the Joc game, with the complete, constraint-correct database schema and security boundaries (RLS + key isolation) in place. Everything subsequent (realtime, write path, host, guest, TV, polish) builds on this without revisiting schema or key setup.

Requirements covered: **RT-02** (Broadcast-based realtime foundation), **RT-05** (100+ concurrent capacity / Pro plan), **SCOR-03** (one-answer DB constraint), **SCOR-04** (late-answer phase-guard support at the schema/state level).

In scope: repo reset to the new app, Next.js + TS + Tailwind v4 + shadcn init, Supabase cloud project, full SQL schema + constraints + RLS, generated DB types, seed script, reset routine, env var layout, base theme tokens, Vercel project setup for the `joc` branch.

Not in scope: realtime hook/sync (Phase 2), API write path (Phase 3), host/guest/TV UIs (Phases 4–6), cinematic polish (Phase 7).
</domain>

<decisions>
## Implementation Decisions

### Repo Layout & Deployment
- **D-01:** This is a brand-new, independent project living entirely on the **`joc` branch**, which will **never merge to `master`**. The old wedding-site code is not reused.
- **D-02:** **Replace at root.** During Phase 1 execution, remove the old wedding-site files **on the `joc` branch only** (root `package.json`, `src/app/` wedding sections, `prisma/`, wedding-specific config/assets) and scaffold the new Joc app at the **repo root**. `master`'s wedding site is untouched and recoverable.
- **D-03:** Deploy `joc` to a **new, separate Vercel project** with **Production Branch = `joc`** (isolated from any project serving `master`; separate domain + env vars).
- **D-04:** **No git commits** are made by the assistant during this project — all changes stay as uncommitted working-tree changes; the user manages git. (GSD `commit_docs` and `git.create_tag` are disabled.)

### Supabase Environment
- **D-05:** Develop against a **cloud Supabase project from the start** (free tier for dev). **No local Docker/Supabase CLI stack** for runtime. Upgrade the project to **Pro plan before the dry run / event** (free tier ~200 connection cap + suspension risk — see PITFALLS).
- **D-06:** Schema is defined/versioned with **Supabase CLI SQL migrations** (`supabase/migrations/*.sql`). The Supabase CLI is used for migrations + type generation even though the running DB is cloud (link the project). No ORM (no Prisma, no Drizzle).

### Database Schema & Data Model
- **D-07:** **Singleton-friendly `games` row model:** keep a real `games` row with `game_id` foreign keys on `players`, `questions`, `answers` (per ARCHITECTURE.md), but operate **one active game at a time**. No multi-game UI. The `games` row is the canonical state machine (`phase` + `current_question_id`).
- **D-08:** Anti-cheat at the DB layer: `UNIQUE (player_id, question_id)` on `answers` (SCOR-03); plus `UNIQUE (game_id, device_token)` on `players` for idempotent join/reconnect. (Phase guard for late answers is enforced in the API in Phase 3; schema supports the `phase` field it checks.)
- **D-09:** **Score storage = compute leaderboard on-read** from `answers` (count of correct) as the default, since flat 1-pt scoring makes a separate materialized table optional. *(Claude discretion — planner may add a `scores` table if a query-performance need is demonstrated; ARCHITECTURE.md lists a `scores` table as acceptable.)*
- **D-10:** Ship a **reset SQL function/script** from the start: clears `answers` (+ `scores` if present), sets `games.phase → 'lobby'` and `current_question_id → null`, **keeps `questions`**. Enables one-action dry-run → event re-run and underpins the Phase 4 host emergency-reset.
- **D-11:** Ship a **seed script** (in `supabase/` migrations/seed) inserting a few sample A/B questions + one `games` row so Phases 2–3 are testable end-to-end before the Phase 4 question-management UI exists.

### Security & Realtime Authorization
- **D-12:** **Public Supabase Broadcast channel** for game state (acceptable for a low-stakes wedding game; no private-channel RLS in v1). **Important:** `questions.correct_option` must NOT be leaked early — RLS hides it from direct client reads, and the **server only broadcasts the correct answer at reveal time** (host action). Phase 1 must set up RLS so anon role cannot read `correct_option` before reveal.
- **D-13:** **Env var split (standard, no build guard):** client = `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`; server-only = `SUPABASE_SERVICE_ROLE_KEY`, `HOST_PASSWORD` (never `NEXT_PUBLIC_`). Document all in `.env.example`. (No automated post-build grep guard — user opted out.)

### TypeScript & DX
- **D-14:** **Generate DB types** via `supabase gen types typescript` into a committed types file; wrap a typed Supabase client. Regenerate after every migration. Strong typing throughout.

### Host Authentication
- **D-15:** **Shared host password** via `HOST_PASSWORD` env var, validated **server-side**, session held client-side. No user table, no Supabase Auth. (Actual auth flow implemented in Phase 3/4; Phase 1 only reserves the env var + establishes the server-validation pattern.)

### Design System
- **D-16:** **Base theme tokens now, full polish in Phase 7.** Phase 1: `shadcn` init + minimal soft-luxury theme scaffold (color tokens, font vars, glassmorphism utility placeholders) so later phases build on-brand. Heavy animation/confetti/cinematic work deferred to Phase 7.

### Frontend Skill Mandate (applies to all UI phases, recorded here as a standing rule)
- **D-17:** **Whenever any phase touches UI/frontend, the executor MUST use the installed skills: `ui-ux-pro-max`, `shadcn`, and `vercel-react-best-practices`.** Phase 1 is mostly backend/schema so this barely applies here, but it is **locked for Phases 4–7** (host dashboard, guest app, TV display, polish). Mirrors the project PostToolUse hook that reminds on frontend file edits.

### Claude's Discretion
- Score storage table vs computed-on-read (D-09) — default computed; add table only if needed.
- Exact column types, indexes, and naming within the schema (follow ARCHITECTURE.md).
- npm as the package manager (matches repo); ESLint/Prettier/tsconfig strictness left to planner with sensible strict defaults.
- Folder structure within the new app (follow STACK.md / Next.js App Router conventions).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — project definition, core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — v1 requirements; Phase 1 covers RT-02, RT-05, SCOR-03, SCOR-04
- `.planning/ROADMAP.md` §"Phase 1: Foundation & Schema" — goal + success criteria

### Architecture & Stack (most important for this phase)
- `.planning/research/ARCHITECTURE.md` — DB schema (games/players/questions/answers/scores), constraints, RLS, Broadcast mechanism, build order — **the schema authority**
- `.planning/research/STACK.md` — pinned versions and setup (Next.js 15.3, @supabase/ssr, Tailwind v4 + shadcn, motion, zustand), Supabase client integration
- `.planning/research/PITFALLS.md` — Pro-plan requirement, public-channel/RLS considerations, key-isolation, race-condition prevention
- `.planning/research/SUMMARY.md` — cross-cutting conclusions and per-phase implications

No external ADRs/specs beyond the `.planning/` set — requirements fully captured above and in research.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **None reused.** The repo's existing code is the OLD wedding website (Next.js + Prisma/SQLite). Per D-01/D-02 it is being removed on this branch, not reused. Do not import from or depend on `src/`, `prisma/`, or the old `package.json`.

### Established Patterns
- The old site used Tailwind v4 `@theme` CSS-first config and shadcn-less hand-built components; the new app will use Tailwind v4 + shadcn/ui. The `@theme` CSS-first approach is consistent and fine to carry as a convention.
- Old host auth used `sessionStorage` + an `ADMIN_PASSWORD` env var — the new shared-password approach (D-15) is the same shape, renamed to `HOST_PASSWORD`.

### Integration Points
- New code connects to Supabase cloud via the typed client (anon key client-side, service-role server-side). Vercel project env vars feed these. No connection to old wedding-site code.
</code_context>

<specifics>
## Specific Ideas

- The whole project must remain self-contained on the `joc` branch and deployable as its own Vercel project — the user explicitly confirmed this branch will never reach `master`.
- User explicitly wants local development + local testing, and zero assistant-made git commits.
- User explicitly requires the three installed frontend skills (ui-ux-pro-max, shadcn, vercel-react-best-practices) to ALWAYS be used on UI/frontend work.
</specifics>

<deferred>
## Deferred Ideas

- **Private Broadcast channels + RLS authorization** — considered, deferred (chose public channel for v1). Revisit if answer-sniffing becomes a concern.
- **Materialized `scores` table** — possible later optimization if leaderboard-on-read becomes slow.
- **Automated build-time key-isolation guard** (grep service_role in `.next/`) — user opted out for now; could add later.
- **Supabase Auth / magic-link host login** — deferred in favor of shared password.
- v2 features (speed/streak scoring, join code, auto-lock timer, non-binary questions) remain in REQUIREMENTS.md v2.

None of these expand Phase 1 scope — discussion stayed within the foundation domain.
</deferred>

---

*Phase: 1-Foundation & Schema*
*Context gathered: 2026-06-01*
