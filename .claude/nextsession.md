# Next Session Handoff
_Last updated: 2026-03-06 | Session 2_

## Read First
Load `context-snapshot.md` for full detail before doing anything.

## Project Snapshot
Romanian wedding site for **Cristina & Andrei**, 26 Sept 2026. Next.js 16 / React 19 / Tailwind v4 / Prisma + PostgreSQL (Neon).
`npm run dev` — dev server at localhost:3000. `/admin` — admin panel (password: `wedding2026`).
Deployed on Vercel — push to `master` branch auto-redeploys.

## Immediate Next Action
No active task — all user requests completed. Wait for new instructions.
If resuming, verify dev server is running (`npm run dev`) and check `http://localhost:3000` via Playwright MCP.

## Priority Queue
1. No outstanding tasks. Project is in a clean, deployed state.
2. If user wants changes: edit → `git add -A && git commit -m "..." && git push` → Vercel auto-deploys.

## Key Context
- **Git branch**: `master` (not main) — Vercel deploys from master
- **Database**: Neon PostgreSQL, already migrated — tables exist, ready to receive RSVPs
- **Images**: All in `public/images/` — corner-left.jpg used for both corners (right one uses `scaleX(-1)`)
- **RSVP form**: Supports 1–4 guests; extra guests stored comma-separated in `plusOneName`/`plusOneMenu`
- **Prisma regeneration**: If EPERM error, stop dev server first then `npx prisma generate`
- **GitHub PAT**: User should regenerate at github.com (was shared in chat session)
