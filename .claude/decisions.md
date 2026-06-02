# Decisions Register

<!-- Append new decisions at the bottom of each session block. Never remove old ones. -->

---

## 2026-03-06 — Session 1

### D001 — Website design aligned to save-the-date card
**Decided:** Redesign the website to match the physical save-the-date card aesthetic.
**Why:** User shared save-the-date showing warm ivory background, soft gold bokeh, white hydrangeas with forest green + gold-veined leaves. Current site is burgundy-dominant — a very different feel.
**Impact:** `globals.css` color tokens, `HeroSection`, `FloralDivider`, `StickyNav`, all card components.

### D002 — Use Gemini CLI for image generation (not AI Studio API key)
**Decided:** Use `gemini` CLI (OAuth / Google account) instead of the AI Studio REST API key.
**Why:** `imagen-3.0-generate-001` returned 404 via the free-tier AI Studio API key. Gemini CLI authenticated with the user's Google account has broader model access.
**Impact:** `scripts/generate-images.ts` may be partially replaced by direct CLI invocations.

### D003 — VS Code configuration committed to repo
**Decided:** `.vscode/extensions.json` and `.vscode/settings.json` added and committed.
**Why:** Ensures consistent tooling across machines — Tailwind IntelliSense, Prisma formatter, ESLint, format-on-save all preconfigured.
**Impact:** `.vscode/` folder in repo.

### D004 — Session continuity system
**Decided:** Create `sessionlog.md`, `nextsession.md`, `decisions.md` with `/done` command to update all at once.
**Why:** Project spans many sessions. Without structured handoff, each new Claude instance starts cold and wastes time re-exploring.
**Impact:** `.claude/` folder, `commands/`, `memory/MEMORY.md`, `CLAUDE.md`.

### D005 — Auto-run /done at 70% context
**Decided:** Claude should automatically run `/done` when context reaches ~70%, without being asked.
**Why:** Ensures session state is always captured before context compression discards it.
**Impact:** Rule in `CLAUDE.md` and `memory/MEMORY.md`.

---

## 2026-03-06 — Session 2

### D006 — Switch database from SQLite to PostgreSQL (Neon)
**Decided:** Migrate from local SQLite (`prisma/dev.db`) to hosted PostgreSQL on Neon free tier.
**Why:** SQLite is a local file — won't work on Vercel's ephemeral serverless environment. Neon provides free hosted PostgreSQL with persistent storage.
**Impact:** `prisma/schema.prisma` provider changed, `.env`/`.env.local` DATABASE_URL updated, old migrations deleted and recreated.

### D007 — Deploy to Vercel with GitHub auto-deploy
**Decided:** Use Vercel for hosting, connected to `acstoian/wedding` GitHub repo (master branch).
**Why:** Zero-config Next.js detection, free tier, automatic redeploy on push. Simplest path for a non-technical user to update the site.
**Impact:** Deployment workflow is just `git push`.

### D008 — Use mirrored corner image instead of generating separate right-corner image
**Decided:** Reuse `corner-left.jpg` for the top-right corner with `style={{ transform: "scaleX(-1)" }}`.
**Why:** Generated `corner-top-right.jpg` (gold agate swirl) looked bad. Mirroring the left corner gives perfect symmetry with zero additional generation.
**Impact:** `src/app/page.tsx` — right corner Image component uses `style` prop.

### D009 — RSVP supports up to 4 guests, stored comma-separated
**Decided:** Expand RSVP from 2 to 4 guests. Additional guests 2–4 stored as comma-separated strings in existing `plusOneName`/`plusOneMenu` DB fields.
**Why:** No DB migration needed. `plusOneName` is a String field — can hold "Name2, Name3, Name4". Admin panel already displays the field.
**Impact:** `src/components/RsvpForm.tsx` uses `extras` array, sliced on submit.
