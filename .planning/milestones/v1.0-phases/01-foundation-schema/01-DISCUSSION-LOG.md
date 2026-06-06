# Phase 1: Foundation & Schema - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 1-Foundation & Schema
**Areas discussed:** Repo layout & deployment, Supabase environment, Host auth, Game model, Seed data, Migration tooling, DB types, Reset support, Realtime channel authorization, Env vars & key isolation, Design system timing, Frontend skill mandate

---

## Repo Layout & Deployment

User asked (freeform): "I will deploy this to a new project in Vercel as well, so keep everything in this branch. This branch will never reach master. Is that feasible?" — confirmed feasible.

| Option | Description | Selected |
|--------|-------------|----------|
| Replace at root | Remove old wedding files on joc only; build new app at repo root | ✓ |
| New app in a subfolder | Put Joc app in /joc-app; point Vercel root there | |
| Fresh root, keep old files | Scaffold at root, manually resolve collisions | |

**User's choice:** Replace at root; everything stays on `joc`; deploy joc to a new separate Vercel project; branch never merges to master.
**Notes:** Old wedding site remains safe on master. No assistant git commits for the project.

---

## Supabase Environment

| Option | Description | Selected |
|--------|-------------|----------|
| Cloud project from the start | Develop against cloud Supabase (free→Pro); no Docker | ✓ |
| Local Supabase stack (CLI + Docker) | Fully offline dev | |
| Both (local dev, cloud for event) | Two configs | |

**User's choice:** Cloud project from the start.
**Notes:** Upgrade to Pro before dry run/event (free tier ~200 conn cap).

---

## Host Auth

| Option | Description | Selected |
|--------|-------------|----------|
| Shared password (env var) | Server-validated HOST_PASSWORD, client session | ✓ |
| Supabase Auth (magic link) | Single host account via email | |

**User's choice:** Shared password (env var).

---

## Game Model

| Option | Description | Selected |
|--------|-------------|----------|
| Singleton-friendly games row | Real games row + game_id FKs, one active game | ✓ |
| Hard singleton (no game_id) | Single config row, no FKs | |

**User's choice:** Singleton-friendly games row.

---

## Seed Data

| Option | Description | Selected |
|--------|-------------|----------|
| Seed script with sample questions | Repeatable seed of A/B questions + game row | ✓ |
| Manual SQL inserts | Hand inserts in SQL editor | |

**User's choice:** Seed script.

---

## Migration Tooling

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase CLI SQL migrations | SQL files in supabase/migrations/ | ✓ |
| Drizzle ORM | TS schema + migrations | |
| Prisma | Familiar but awkward with RLS/realtime | |

**User's choice:** Supabase CLI SQL migrations.

---

## DB → TypeScript Types

| Option | Description | Selected |
|--------|-------------|----------|
| Generated from schema | supabase gen types typescript | ✓ |
| Hand-written types | Manual interfaces | |

**User's choice:** Generated from schema.

---

## Reset / Re-run Support

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — reset SQL function/script | Clear answers+scores, phase→lobby, keep questions | ✓ |
| No — add later | Defer to Phase 4 | |

**User's choice:** Yes — reset SQL function/script from the start.

---

## Realtime Channel Authorization

| Option | Description | Selected |
|--------|-------------|----------|
| Private channels + RLS | RLS-authorized subscribe via realtime.messages | |
| Public channel | Anyone with channel name can subscribe | ✓ |

**User's choice:** Public channel.
**Notes:** correct_option still protected by RLS on direct reads + server only broadcasts the answer at reveal time.

---

## Env Vars & Key Isolation

| Option | Description | Selected |
|--------|-------------|----------|
| Strict split + build guard | Public/server split + post-build grep guard | |
| Standard split, no guard | Same split, no automated guard | ✓ |

**User's choice:** Standard split, no guard.

---

## Design System / Theme Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Base tokens now, full polish in Phase 7 | shadcn init + minimal theme scaffold now | ✓ |
| Defer all aesthetics to Phase 7 | Plain defaults until later | |
| Full theme now | Complete design system in Phase 1 | |

**User's choice:** Base tokens now, full polish in Phase 7.

---

## Frontend Skill Mandate

User stated (freeform): "I have uipromax and two other skills installed, make sure to ALWAYS use them when working on the UI and frontend."

**Captured as:** D-17 — executor MUST use `ui-ux-pro-max`, `shadcn`, and `vercel-react-best-practices` on all UI/frontend work (locked for Phases 4–7).

---

## Claude's Discretion

- Score storage: computed-on-read default; add `scores` table only if needed.
- Column types/indexes/naming within ARCHITECTURE.md guidance.
- npm package manager; ESLint/Prettier/tsconfig strict defaults.
- App folder structure per Next.js App Router + STACK.md.

## Deferred Ideas

- Private Broadcast channels + RLS (chose public for v1).
- Materialized scores table (optimization).
- Automated build-time key-isolation grep guard (opted out).
- Supabase Auth / magic-link host login.
- v2 features: speed/streak scoring, join code, auto-lock timer, non-binary questions.
