# Context Snapshot
_Captured: 2026-03-06 — Session 2 — at ~70% context_

## Where We Are Right Now
The wedding website is fully built, deployed to Vercel, and connected to a Neon PostgreSQL database. All placeholder content has been filled in, the RSVP form supports 1–4 guests, and the UI has been polished (alignment fixes, removed "2026" label). The GitHub repo `acstoian/wedding` is up to date.

## What Was Just Being Worked On
Final UI polish: removed "2026" text below date line in HeroSection, fixed venue card top-alignment in WhereSection (switched `items-end` → `items-start` + `mt-auto` on button). Both committed and pushed to GitHub.

## Completed This Session

### Image Generation
- User upgraded Google AI to paid plan, provided new key `AIzaSyCM20oWA8Mx2s1cUavsWSDVMtjF2uOJ5wM`
- Switched model from `imagen-3.0-generate-001` to `imagen-4.0-generate-001`
- Generated 10 wedding images via `scripts/generate-images.ts` into `public/images/`
- Created `scripts/gen-layout-images.ts` for layout-specific images (corner botanicals)
- Generated: `corner-left.jpg`, `corner-top-right.jpg`, `corner-bottom-right.jpg`

### Full Website Redesign
- `src/app/page.tsx` — complete rewrite: removed StickyNav, CoupleCards, Gallery, FloralDivider; added 3 absolutely-positioned corner images (left, right mirrored, bottom-right); sections: HeroSection → WhenSection → WhereSection → RsvpForm → footer
- Top-right corner uses `corner-left.jpg` with `style={{ transform: "scaleX(-1)" }}` for symmetry
- `src/components/HeroSection.tsx` — compact layout, script names, date row with gold divider lines, Countdown below
- `src/components/Countdown.tsx` — removed box containers, plain large numbers with italic label
- `src/components/WhenSection.tsx` — real names (Ilie/Elisabeta Siclovan, Nicolae/Iuliana Stoian, Matei/Ioana Liberis), two thin-dividers flanking Nașii block
- `src/components/WhereSection.tsx` — real venues (Parohia Romano Católică „Sf. Anton" + Zooma Paradisul Verde), Google Maps modal, `items-start` grid + `mt-auto` on buttons
- `src/components/FloralDivider.tsx` — replaced SVG with floral image
- `src/app/globals.css` — added `--color-forest-green: #2D4A22`, `--color-forest-green-light: #4A6741`, warmed cream to `#FEFBF3`

### RSVP Form
- `src/components/RsvpForm.tsx` — menu options Normal/Vegetarian only; Alergii checkbox + textarea; Copii checkbox + +/− counter; expanded to 4 guests using extras array (additional guests 2–4 rendered dynamically); names/menus joined with ", " into `plusOneName`/`plusOneMenu`
- `prisma/schema.prisma` — added `menuPreference`, `plusOneMenu`, `allergies`, `kidsCount` fields
- `src/app/api/rsvp/route.ts` — updated to accept and save all new fields
- `src/app/admin/guests/page.tsx` — added Meniu, Alergii (orange highlight), Copii columns + CSV export

### Database Migration
- Switched from SQLite to PostgreSQL (Neon)
- `prisma/schema.prisma` — `provider = "postgresql"`
- `.env` and `.env.local` — `DATABASE_URL` set to Neon connection string
- Old SQLite migrations deleted, new `20260306165004_init` migration created and applied

### Deployment
- Pushed entire codebase to `https://github.com/acstoian/wedding.git` (branch: master)
- Vercel deployment set up with env vars: `DATABASE_URL`, `ADMIN_PASSWORD`
- Auto-deploy on push to master is active

### UI Fixes
- Removed duplicate thin-divider between WhenSection and WhereSection (removed top divider from WhereSection)
- Removed "2026" `<p>` tag below date row in HeroSection
- Fixed venue card alignment: `items-end` → `items-start`, added `mt-auto` to buttons

## In-Progress Work (resume here first)
Nothing actively in progress. All user requests were completed and pushed.

## Open Issues / Blockers
- **Prisma client regeneration**: After switching to PostgreSQL, `npx prisma generate` fails with EPERM because dev server holds the DLL. User needs to stop dev server, run `npx prisma generate`, then restart. Low priority — migration ran fine, app works.
- **GitHub PAT exposed**: User shared a GitHub PAT in chat (value redacted from repo `[REDACTED — ROTATE THIS TOKEN]`). Should regenerate it at github.com → Settings → Developer settings → Personal access tokens.
- **Neon connection string exposed**: Also shared in chat. Low risk (it's in Vercel env vars too) but worth rotating if concerned.

## Key Findings & Research
- Vercel auto-detects Next.js with zero config — no `vercel.json` needed
- Prisma reads from `.env` (not `.env.local`) for CLI commands like `migrate dev`
- Switching Prisma from SQLite to PostgreSQL requires deleting `prisma/migrations/` folder first (migration_lock.toml conflict)
- `items-end` on CSS grid aligns bottoms but misaligns tops when cards have different heights — solution is `items-start` + `mt-auto` on the last element in the flex column
- CSS `transform: scaleX(-1)` on Next.js `<Image>` via `style` prop mirrors images perfectly

## Active Code Patterns
- Corner images: absolutely positioned, `pointer-events-none select-none`, responsive width classes (`w-28 sm:w-40 md:w-56 lg:w-72`)
- Right corner mirroring: `style={{ transform: "scaleX(-1)" }}` on same image as left corner
- Extra guests in RSVP: `extras` array of `{name, menu}`, sliced to `extraCount = count - 1`, joined to string on submit
- Thin dividers: `<div className="thin-divider" />` defined in globals.css

## File Map — What Changed
- `src/app/page.tsx` — complete rewrite (corner images, removed nav/gallery)
- `src/app/globals.css` — added forest-green colors, warmed cream
- `src/components/HeroSection.tsx` — compact layout, removed 2026 label
- `src/components/Countdown.tsx` — removed box containers
- `src/components/WhenSection.tsx` — real names, two thin-dividers around Nașii
- `src/components/WhereSection.tsx` — real venues, alignment fix, removed top divider
- `src/components/RsvpForm.tsx` — complete rewrite (4 guests, new fields)
- `src/components/FloralDivider.tsx` — replaced SVG with image
- `src/app/api/rsvp/route.ts` — accepts new RSVP fields
- `src/app/admin/guests/page.tsx` — new columns for menu/allergies/kids
- `prisma/schema.prisma` — PostgreSQL, 4 new Guest fields
- `prisma/migrations/` — deleted old SQLite, new `20260306165004_init`
- `.env` — PostgreSQL DATABASE_URL
- `.env.local` — PostgreSQL DATABASE_URL + Google AI key
- `scripts/generate-images.ts` — Imagen 4 model
- `scripts/gen-layout-images.ts` — new (corner botanical images)
- `public/images/` — all generated images added

## Critical Context (do not lose this)
- **Git branch is `master`** (not `main`) — Vercel is configured to deploy from master
- **Neon DB**: `ep-green-hill-agg8cq49-pooler.c-2.eu-central-1.aws.neon.tech` — already migrated, tables exist
- **Admin password**: `wedding2026` — stored as `ADMIN_PASSWORD` env var
- **Google AI key**: `AIzaSyCM20oWA8Mx2s1cUavsWSDVMtjF2uOJ5wM` — paid tier, Imagen 4 capable
- **Deployment workflow**: `git add -A && git commit -m "..." && git push` → Vercel auto-redeploys
- **No test framework** configured — verify changes visually via Playwright MCP (`http://localhost:3000`)
- **`.env` and `.env.local` are gitignored** — credentials never go to GitHub

## Immediate Next Action
No active task. Wait for new user instructions. If user returns with a new request, read this file first then proceed directly.
