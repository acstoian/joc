# Session Log — Wedding Website (Cristina & Andrei)

<!-- Most recent session at the top -->

## Session 2 — 2026-03-06
_Context reset at ~70% — full details in context-snapshot.md_

### Accomplished
- Unblocked image generation: user upgraded to paid Google AI, switched to Imagen 4 (`imagen-4.0-generate-001`)
- Generated 10 wedding images + 3 layout-specific corner botanical images
- Full website redesign: compact single-page invitation card style, white background, corner floral decorations
- Removed StickyNav, CoupleCards, Gallery, FloralDivider from page
- Added symmetric corner images (left + mirrored right via `scaleX(-1)`)
- Filled all placeholder content: real names, real venues, real addresses
- RSVP form: Normal/Vegetarian menus, Alergii checkbox+textarea, Copii checkbox+counter, 4 guest support
- Prisma schema: added menuPreference, plusOneMenu, allergies, kidsCount fields + migration
- Admin panel: added Meniu, Alergii, Copii columns + CSV export
- Switched database from SQLite to PostgreSQL (Neon hosted)
- Deployed to Vercel via GitHub (`acstoian/wedding`, branch: master)
- UI polish: removed "2026" label, fixed venue card alignment, removed duplicate divider

### Blocked / In Progress
- Prisma client EPERM on regenerate (dev server holds DLL) — minor, workaround: stop dev server first
- GitHub PAT exposed in chat — user should regenerate

### Files Changed
- `src/app/page.tsx` — complete rewrite
- `src/app/globals.css` — forest-green colors, warmer cream
- `src/components/HeroSection.tsx` — compact layout, no "2026" label
- `src/components/Countdown.tsx` — no box containers
- `src/components/WhenSection.tsx` — real names, two dividers around Nașii
- `src/components/WhereSection.tsx` — real venues, alignment fix
- `src/components/RsvpForm.tsx` — complete rewrite (4 guests, new fields)
- `src/components/FloralDivider.tsx` — image instead of SVG
- `src/app/api/rsvp/route.ts` — new fields
- `src/app/admin/guests/page.tsx` — new columns
- `prisma/schema.prisma` — PostgreSQL, 4 new fields
- `prisma/migrations/` — fresh PostgreSQL migration
- `.env` / `.env.local` — Neon DATABASE_URL
- `scripts/generate-images.ts` — Imagen 4
- `scripts/gen-layout-images.ts` — new file
- `public/images/` — all generated images

---

## Session 1 — 2026-03-06

### Accomplished
- Full codebase exploration: Next.js 16, React 19, Tailwind v4, Prisma/SQLite
- Added working principles, task management, and core principles to CLAUDE.md
- Created .vscode/extensions.json (11 extensions) and .vscode/settings.json
- Installed Playwright MCP server (project-scoped via `claude mcp add`)
- Installed Gemini CLI v0.32.1 globally (`@google/gemini-cli`)
- Created scripts/generate-images.ts for Imagen 3 image generation
- Installed @google/genai SDK, set up .env.local with AI Studio API key
- Attempted image generation — blocked (see below)
- Planned full website redesign to match save-the-date aesthetic (plan approved)
- Created session continuity system: sessionlog.md, nextsession.md, decisions.md, /done command

### Blocked / In Progress
- **Image generation**: Imagen 3 model `imagen-3.0-generate-001` returned 404 on free AI Studio API key. Switched to Gemini CLI (user authenticated via OAuth). CLI image-save method not yet confirmed working.
- **Website redesign**: Plan approved and detailed, but not yet implemented — waiting on images first
- **Name fix**: Code says "Cristina" everywhere, should be "Cristina" — not yet fixed

### Files Changed This Session
- `CLAUDE.md` — added Working Principles, Task Management, Core Principles sections
- `.vscode/extensions.json` — created (11 recommended extensions)
- `.vscode/settings.json` — created (format on save, Tailwind regex, Prisma formatter)
- `scripts/generate-images.ts` — created (Imagen 3 image generator script)
- `.env.local` — created (GOOGLE_AI_API_KEY, DATABASE_URL, ADMIN_PASSWORD)
- `package.json` — added @google/genai dependency, generate:images script
- `.claude/commands/` — created (done, update-session, update-next, update-decisions)
- `.claude/sessionlog.md` — created (this file)
- `.claude/nextsession.md` — created
- `.claude/decisions.md` — created
