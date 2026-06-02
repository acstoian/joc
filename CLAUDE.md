# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Romanian wedding website for "Cristina & Andrei" (26 September 2026). Full-stack app with a public guest-facing site and a password-protected admin panel. All UI text is in Romanian.

## Commands

```bash
npm run dev         # Start dev server
npm run build       # Production build
npm run lint        # ESLint via next lint
npm run db:migrate  # Run Prisma migrations (prisma migrate dev)
npm run db:seed     # Seed DB with sample data (runs prisma/seed.ts via tsx)
npm run db:studio   # Open Prisma Studio GUI
```

No test framework is configured.

## Tech Stack

- **Next.js 16** with App Router (`src/app/`)
- **React 19**, **TypeScript 5.9** (strict mode)
- **Tailwind CSS v4** — uses `@import "tailwindcss"` + `@theme` block (not the v3 `@tailwind` directives)
- **Prisma 6** with **SQLite** (`prisma/dev.db`)
- Path alias: `@/*` → `./src/*`

## Architecture

### Public Site

Single-page scrolling layout at `/`. The page component (`src/app/page.tsx`) assembles sections in order: HeroSection → Countdown → Timeline → VenueMap → Gallery → RsvpForm. All sections are in `src/components/`.

Server components: HeroSection, Timeline, VenueMap, Gallery, FloralDivider.
Client components (`"use client"`): Countdown, RsvpForm.

### Admin Panel (`/admin`)

Client-side password auth via `sessionStorage` — no JWT/cookies. The password is checked against `ADMIN_PASSWORD` env var through `/api/admin/auth`.

Three pages:

- `/admin` — Dashboard with RSVP statistics
- `/admin/guests` — Guest CRUD table with filtering and CSV export
- `/admin/tables` — Table/seating management with guest assignment

### API Routes (`src/app/api/`)

- `/api/guests` — GET (list, filter by `?status=`), PUT (update), DELETE (`?id=`)
- `/api/rsvp` — POST (public RSVP submission)
- `/api/tables` — GET (list with guests), POST (create), PUT (update), DELETE (`?id=`)
- `/api/admin/auth` — POST (password validation)

### Database

Two models in `prisma/schema.prisma`: **Guest** (name, email, attending status, plus-one, dietary, message, optional table FK) and **Table** (name, capacity, guests relation). Prisma client singleton at `src/lib/db.ts`.

## Style Conventions

- Custom color tokens defined in `src/app/globals.css` `@theme` block: `burgundy`, `burnt-orange`, `gold`, `cream`, `sage` (and variants). Use as Tailwind classes: `bg-burgundy`, `text-gold`, etc.
- Custom fonts: `font-heading` (Playfair Display), `font-body` (Lato) — loaded via Google Fonts `<link>` in root layout.
- No UI component library — all components are hand-built with Tailwind.
- No state management or form libraries — plain `useState`/`useEffect` and controlled inputs.
- HTML lang is `"ro"`, dates use `toLocaleDateString("ro-RO")`.

## Working Principles

### 1. Plan by Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy

- Use subagents liberally to keep the main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop

- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project context

### 4. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Prefer the simplest solution that correctly solves the problem
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.

## Session Continuity

**At session start:** Read in order: `.claude/context-snapshot.md` (if exists) → `.claude/nextsession.md` → `.claude/decisions.md` → `.claude/sessionlog.md`. Then briefly tell the user the current project state and what will be worked on first.

**At ~70% context:** Automatically run `/done` without waiting to be asked. This writes a comprehensive `context-snapshot.md` capturing all session detail, updates all session docs, then instructs the user to start a new session. The new session loads context-snapshot.md and resumes with zero information loss.

**Commands:**

- `/done` — update all session docs (sessionlog + nextsession + decisions)
- `/update-session` — update sessionlog.md only
- `/update-next` — update nextsession.md only
- `/update-decisions` — update decisions.md only

<!-- GSD:project-start source:PROJECT.md -->

## Project

**Joc — Live Wedding Game Show**

A polished, mobile-first live "A/B trivia" game show web app for a wedding event. Guests join from their phones with just a name, answer host-controlled questions by tapping **A** or **B**, and watch live results, reveals, and a leaderboard update in real time. A host drives the entire game flow from a protected dashboard, and a dedicated cinematic **Display Mode** route projects the action onto a TV/projector for the room. Built on Next.js + Supabase, deployed on Vercel.

**Core Value:** **During a live wedding, the room stays in sync and the game feels instant and fun** — when the host advances or reveals, every phone and the TV update together within a second, with no refreshes and no lost players.

### Constraints

- **Tech stack**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion — modern, Vercel-native, component-driven.
- **Realtime**: Supabase Realtime — single vendor for Postgres + realtime + host auth; simplest ops and best Vercel fit.
- **Database**: PostgreSQL via Supabase. Tables for games/sessions, players, questions, answers, scores.
- **Backend**: Serverless-friendly — Next.js API routes / Server Actions; no long-lived custom server.
- **Auth**: Simple host-only authentication; guests are anonymous (name + device token).
- **State management**: Lightweight — React Server Components where appropriate, Zustand only if needed; avoid heavy client state and unnecessary rerenders.
- **Hosting**: Vercel. All architectural decisions optimized for serverless/edge deployment.
- **Performance**: Must handle 100+ concurrent guests with sub-second perceived sync and smooth animation on low-end phones.
- **Philosophy**: Prioritize simplicity and reliability over over-engineering; the live experience must feel instantaneous and fun.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Version Reality Check

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.3.x (latest 15.x) | Framework, routing, API routes, Server Actions | Project-constrained. App Router + React Server Components reduce client JS. Serverless/edge friendly on Vercel. Moving to 16 is low-friction via codemod when ready. |
| React | 19.x (bundled with Next 15) | UI rendering | Next.js 15 ships with React 19. Concurrent features, improved hydration. |
| TypeScript | 5.9.x | Type safety | Strict mode. Next.js provides first-class TS support via `next.config.ts`. |
| Tailwind CSS | 4.3.x | Styling | CSS-first config (`@theme` block, no `tailwind.config.js`). 5x faster builds. 70% smaller CSS output than v3. Single `@import "tailwindcss"` line. shadcn/ui now ships v4-native components. |
| shadcn/ui | latest (CLI-managed) | Component primitives | Not a versioned package — components are copied into your repo. As of 2025, all components are updated for Tailwind v4 + React 19. `tailwindcss-animate` deprecated; uses native CSS animations now. Install: `npx shadcn@latest init -t next`. |
| Motion (formerly framer-motion) | 12.40.x | Animations | Renamed from framer-motion. Import from `motion/react`. No breaking changes vs framer-motion API. Hardware-accelerated, React 19 compatible. Install: `npm install motion`, NOT `framer-motion`. |
| Supabase JS | 2.106.x | DB client, Realtime, Auth | Single vendor for Postgres + Realtime WebSockets + host auth. Eliminates need for separate realtime infrastructure. |
| @supabase/ssr | 0.10.x | SSR auth cookie management | Required for correct auth session handling in Next.js App Router. Provides `createServerClient` and `createBrowserClient`. Handles JWT refresh via HTTP-only cookies through Next.js middleware. |
| Zustand | 5.0.x | Client-side game state | Lightweight, no reducers, no providers (unless SSR-shared state needed). Use only for client game state that does not live in Supabase (e.g., local animation phase, UI transitions). Avoid for state that Supabase Realtime already owns. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | 2.106.x | Core Supabase client | Always — wraps DB, Realtime, Auth |
| `@supabase/ssr` | 0.10.x | Cookie-based session management for SSR | Always with Next.js App Router when using Supabase Auth |
| `motion` | 12.40.x | Animations (question transitions, reveals, confetti) | All UI animation in client components |
| `zustand` | 5.0.x | Client game-state store | Local UI state: which phase the guest sees, animation triggers, optimistic answer lock |
| `nanoid` | 5.x | Device token generation | Generating the persistent guest device token stored in localStorage |
| `clsx` + `tailwind-merge` | latest | Conditional class merging | Required by shadcn/ui pattern; `cn()` utility |
| `next-themes` | 0.4.x | Dark/light theme | If Display Mode needs a dark-only full-screen theme isolated from the guest UI |
| `canvas-confetti` | 1.9.x | Confetti burst on winner reveal | Lightweight, no React dependency, call imperatively in a client component |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Turbopack | Dev server (via `next dev --turbo`) | Stable in Next.js 15. Up to 96% faster HMR. Enable in `package.json`: `"dev": "next dev --turbo"` |
| Prisma | NOT recommended here | Supabase provides the ORM layer via `supabase-js`. Do not add Prisma on top — it creates a dual ORM confusion and Prisma doesn't understand RLS policies. |
| Supabase CLI | Local dev, migrations, type gen | `npx supabase init`, `supabase db push`, `supabase gen types typescript` for typed DB queries |
| ESLint | Linting | Note: `next lint` is deprecated as of Next.js 15.5. Use `eslint` directly. Generate `eslint.config.mjs`. |
| Prettier | Formatting | No change needed |

## Installation

# Core framework

# Supabase

# Animation (use motion, NOT framer-motion)

# State

# Utilities

# shadcn/ui init (interactive, copies components into repo)

# Dev dependencies

# Supabase CLI (for local dev + DB type generation)

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Supabase Realtime (Broadcast) | Pusher / Ably / Socket.io | Only if Supabase free tier concurrency limits are hit in production (unlikely at one wedding with <200 guests). Pusher adds a second vendor with separate billing. |
| Supabase Realtime (Broadcast) | Supabase Postgres Changes | Postgres Changes runs an RLS auth query per subscriber per event (100 guests = 100 DB queries per game event). Broadcast does not. For a game, always use Broadcast. |
| Supabase Auth (email/password for host) | NextAuth / Auth.js | NextAuth makes sense if you have multiple OAuth providers or complex session strategies. For one host email + password, Supabase Auth with `@supabase/ssr` is zero-config. |
| motion (`motion/react`) | framer-motion | `framer-motion` is the legacy package name. Both are maintained but motion is the canonical name going forward. New projects should install `motion`. |
| Tailwind v4 | Tailwind v3 | Tailwind v3 is still supported by shadcn/ui but v4 is the default for new shadcn/ui projects. v4 has CSS-native theming, no config file, and better perf. No reason to start on v3. |
| Zustand | Jotai / Recoil / Redux | Zustand is simpler for a game that needs only a handful of UI atoms. Jotai is equivalent; choose Zustand because examples for Next.js App Router + Supabase patterns are more common. |
| Zustand | React Context | Context rerenders all consumers on every state change. For a game with frequent Realtime updates, Context is a performance hazard. |
| `canvas-confetti` | `react-confetti` | react-confetti renders a canvas element as a React component which causes unnecessary React tree overhead. canvas-confetti is imperative and more performant. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `framer-motion` (package) | Deprecated package name. Both work but `framer-motion` is the legacy alias. Starting a new project on the legacy name is unnecessary tech debt. | `motion` (package), import from `motion/react` |
| `@supabase/auth-helpers-nextjs` | Officially deprecated. Superseded by `@supabase/ssr`. Will not receive updates. | `@supabase/ssr` |
| Supabase Postgres Changes for game events | Runs RLS auth query per subscriber per event. 100 guests watching one game event = 100 DB queries per host action. Creates unnecessary load and latency. | Supabase Realtime Broadcast channel |
| Prisma | Adds a second ORM that does not understand Supabase RLS. `supabase-js` provides type-safe queries via generated types. Double-migration management is painful. | `supabase-js` + Supabase CLI type generation (`supabase gen types`) |
| React Context for game state | Every state update triggers re-render of all context consumers. Supabase Realtime events are frequent (every host action). | Zustand with selective subscriptions |
| `socket.io` | Requires a persistent Node.js server — incompatible with Vercel's serverless model without a paid add-on or separate server. | Supabase Realtime (WebSocket managed by Supabase infra) |
| `next lint` command | Deprecated as of Next.js 15.5, removed in Next.js 16. | Call `eslint` directly, with `eslint.config.mjs` |
| `tailwindcss-animate` | Deprecated as of March 2025 in shadcn/ui. Replaced by native CSS animation utilities. | Native Tailwind v4 animation classes |
| `sessionStorage` for host auth (wedding-site pattern) | Works but is not production-grade; cleared on tab close, no server-side enforcement. | Supabase Auth session (cookie-based via `@supabase/ssr`) |

## Supabase Realtime: Integration Pattern for Next.js App Router

### Channel Architecture for This Game

### Host Broadcasting (Server Action or Route Handler)

### Reconnect Handling

## Host Authentication Pattern

### Middleware for Route Protection

## Guest Identity Pattern

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `next@15.3.x` | `react@19.x`, `react-dom@19.x` | Next.js 15 ships React 19 as default in App Router |
| `@supabase/supabase-js@2.106.x` | Next.js 15/16, React 18/19 | Node.js 20+ required (Node 18 EOL Apr 2025; dropped in supabase-js 2.79.0) |
| `@supabase/ssr@0.10.x` | Next.js App Router | Works with async cookies() API in Next.js 15 |
| `motion@12.40.x` | React 19 | Fully compatible; no breaking changes vs framer-motion API |
| `tailwindcss@4.3.x` | Next.js 15.3+ (15.3 ships Tailwind v4 by default via `create-next-app`) | Do NOT use `tailwind.config.js` — use `@theme` block in `globals.css` |
| `shadcn/ui` (latest CLI) | Tailwind v4, React 19 | Components shipped for v4 since early 2025 |
| `zustand@5.0.x` | React 19 | Compatible; no SSR store initialization issues if stores are created inside client components |

## Stack Patterns by Variant

- React Server Component for the outer shell + metadata
- Client Component for the game state (channel subscription, answer tap)
- Zustand for local UI state (which question phase, animation state)
- `motion/react` for tap feedback, question transitions, reveal animations
- Protected by middleware (Supabase Auth session required)
- Mostly client components (live participant count, A/B bar charts, action buttons)
- Supabase Realtime optional for host (can poll or use Supabase Realtime Presence to count connected guests)
- Server Actions for game state mutations (start, lock, reveal, next) — these broadcast via HTTP Broadcast API
- Full-screen client component, landscape-optimized
- Same `useGameChannel` hook as guest — subscribes to Broadcast events
- No auth required (Display Mode is public)
- Heavy use of `motion/react` for cinematic transitions (AnimatePresence, layout animations)
- Route Handlers (not Server Actions) for guest answer submission — guests have no Supabase Auth session, so Server Actions relying on auth cookies won't work cleanly
- Server Actions work fine for host (authenticated session present)

## Sources

- Next.js 15 official blog (stable, Oct 2024): https://nextjs.org/blog/next-15
- Next.js 15.5 release (Aug 2025): https://nextjs.org/blog/next-15-5 — confirms `next lint` deprecation, Turbopack builds beta
- Supabase JS npm: confirmed v2.106.2 (latest as of June 2026) — WebSearch verification
- @supabase/ssr npm: confirmed v0.10.x (latest 0.10.3) — WebSearch verification
- Supabase Realtime Broadcast docs: https://supabase.com/docs/guides/realtime/broadcast — confirms HTTP + WebSocket broadcast, replay, private channels
- Supabase Auth Next.js SSR docs: https://supabase.com/docs/guides/auth/server-side/nextjs — createServerClient/createBrowserClient pattern, getClaims() recommendation
- Supabase Realtime Benchmarks: https://supabase.com/docs/guides/realtime/benchmarks — Broadcast scales without per-subscriber DB queries; Postgres Changes runs RLS per subscriber
- Motion (framer-motion): https://motion.dev/docs/react-upgrade-guide — confirmed package rename, v12 current (12.40.x), import from `motion/react`
- shadcn/ui Tailwind v4 docs: https://ui.shadcn.com/docs/tailwind-v4 — confirmed v4 support, tailwindcss-animate deprecated March 2025
- Tailwind CSS v4 blog: https://tailwindcss.com/blog/tailwindcss-v4 — v4.0 stable Jan 2025, v4.3.x current
- Zustand npm: confirmed v5.0.14 (latest) — WebSearch verification

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| shadcn | Manages shadcn components and projects — adding, searching, fixing, debugging, styling, and composing UI. Provides project context, component docs, and usage examples. Applies when working with shadcn/ui, component registries, presets, --preset codes, or any project with a components.json file. Also triggers for "shadcn init", "create an app with --preset", or "switch to --preset". | `.agents/skills/shadcn/SKILL.md` |
| ui-ux-pro-max | "UI/UX design intelligence for web and mobile. Includes 50+ styles, 161 color palettes, 57 font pairings, 161 product types, 99 UX guidelines, and 25 chart types across 10 stacks (React, Next.js, Vue, Svelte, SwiftUI, React Native, Flutter, Tailwind, shadcn/ui, and HTML/CSS). Actions: plan, build, create, design, implement, review, fix, improve, optimize, enhance, refactor, and check UI/UX code. Projects: website, landing page, dashboard, admin panel, e-commerce, SaaS, portfolio, blog, and mobile app. Elements: button, modal, navbar, sidebar, card, table, form, and chart. Styles: glassmorphism, claymorphism, minimalism, brutalism, neumorphism, bento grid, dark mode, responsive, skeuomorphism, and flat design. Topics: color systems, accessibility, animation, layout, typography, font pairing, spacing, interaction states, shadow, and gradient. Integrations: shadcn/ui MCP for component search and examples." | `.agents/skills/ui-ux-pro-max/SKILL.md` |
| vercel-react-best-practices | React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when writing, reviewing, or refactoring React/Next.js code to ensure optimal performance patterns. Triggers on tasks involving React components, Next.js pages, data fetching, bundle optimization, or performance improvements. | `.agents/skills/vercel-react-best-practices/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
