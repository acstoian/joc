# Next Session — Joc

## Start here
1. Read `.claude/context-snapshot.md` (full current state) and `.planning/STATE.md` (GSD source of truth).
2. **Phase 1 is complete and deployed** (https://joc-woad.vercel.app/). Nothing from Phase 1 is outstanding.

## First task: kick off Phase 2 — Realtime
Run: **`/gsd-plan-phase 2`**  (optionally `/gsd-discuss-phase 2` first to gather scope).

Phase 2 builds the Supabase **Broadcast** room-sync core — the heartbeat of the whole app
(host action → every phone + the TV update together within ~1s). Per project memory, the rich
`.planning/research/` likely makes a per-phase RESEARCH step redundant.

## Reminders
- You are in the canonical repo `C:\Work\Joc` (GitHub `acstoian/joc`, branch `main`). **Commit normally** here.
- The `admin.ts` `broadcast()` helper already exists — Phase 2 consumes it, doesn't rebuild it.
- Use Supabase **Broadcast**, not Postgres Changes (locked decision).
- Frontend work: project preference is to run the `ui-ux-pro-max` skill.
