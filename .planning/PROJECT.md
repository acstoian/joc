# Joc — Live Wedding Game Show

## What This Is

A polished, mobile-first live "A/B trivia" game show web app for a wedding event. Guests join from their phones with just a name, answer host-controlled questions by tapping **A** or **B**, and watch live results, reveals, and a leaderboard update in real time. A host drives the entire game flow from a protected dashboard, and a dedicated cinematic **Display Mode** route (`/display`) projects the action onto a TV/projector for the room. Built on Next.js 15 + Supabase Realtime Broadcast, deployed on Vercel.

**v1.0 shipped 2026-06-06. Live event: 26 September 2026.**

## Core Value

**During a live wedding, the room stays in sync and the game feels instant and fun** — when the host advances or reveals, every phone and the TV update together within a second, with no refreshes and no lost players.

_Core value confirmed as correct by shipping. The sub-second sync, zero-lost-players, and no-refresh goals all passed the production dry run._

## Requirements

### Validated

_Shipped and confirmed valuable._

- ✓ Guest can open the site on mobile and join a game by entering their name — v1.0
- ✓ Guest is re-linked to their identity/score after refresh or disconnect via a persistent device token — v1.0
- ✓ Guest waits in a lobby and sees live state updates without refreshing — v1.0
- ✓ Guest sees the current question with answer A and B pushed live — v1.0
- ✓ Guest can select an answer; choice is optimistically locked but re-selectable until host locks — v1.0 _(PLAY-03 relaxed from "cannot be changed" — guests reconsidering is natural UX)_
- ✓ Guest UI clearly shows selected/locked answer and waiting state — v1.0
- ✓ Guest sees real-time question transitions, answer reveals, and leaderboard updates — v1.0
- ✓ Guest sees the game-end / winner state — v1.0
- ✓ Host authenticates into a protected dashboard (guests need no accounts) — v1.0
- ✓ Host can start the game, lock answers, reveal correct answer, advance, end game — v1.0
- ✓ Host can reset answers for the current round and has emergency recovery controls — v1.0
- ✓ Host sees live participant count and live A/B answer distribution — v1.0
- ✓ Host can create, edit, delete, reorder questions and mark the correct answer — v1.0
- ✓ Dedicated Display Mode route (`/display`) — landscape, large typography, TV-optimized — v1.0
- ✓ Display shows question, animated transitions, live answer percentages, reveal effects, leaderboard, winner screen — v1.0
- ✓ Display auto-syncs in real time with host actions — v1.0
- ✓ Flat scoring: 1 point per correct answer; leaderboard ranks by total correct — v1.0
- ✓ One answer per guest per question enforced server-side (UPSERT with phase guard) — v1.0
- ✓ Real-time sync of all game events across all clients (Supabase Broadcast) — v1.0
- ✓ Supports 100+ simultaneous guests on Supabase Pro with sub-second perceived sync — v1.0
- ✓ Mobile-first, smooth animations on low-end phones (Safari/Chrome) — v1.0
- ✓ Soft-luxury wedding aesthetic (glassmorphism, animated gradients, confetti, smooth transitions) — v1.0
- ✓ Reconnect handling for unstable mobile connections (worker + jitter + visibilitychange) — v1.0
- ✓ Pre-event production dry run validated — 13/13 checks passed on real devices incl. iPhone/Safari — v1.0

### Active

_No active requirements. v1.0 is complete. Start fresh with /gsd-new-milestone for v2._

### Out of Scope

| Feature | Reason |
|---------|--------|
| Guest accounts / login | Guests join with name + device token only; accounts add friction at a live event |
| Speed-weighted or streak scoring | Flat 1-point scoring is simple, fair, and inclusive on slow wedding wifi |
| Timer-based auto-lock / auto-advance | Flow is fully host-driven; timers add clock-sync complexity for no gain |
| Question types beyond binary A/B | Two-option questions keep UI, tap targets, and schema simple for v1 |
| Multiple concurrent games / multi-tenant | One wedding, one game; no need for lobbies or org accounts |
| Native mobile apps | Web-only, mobile-first; no app store distribution |
| Internationalization framework | Single event, single language; not building an i18n system |

## Context

**v1.0 shipped:** 2026-06-06 — 7 phases, 27 plans, 123 commits, 4 days.
**Codebase:** 8,084 lines TypeScript across 62 files.
**Tech stack:** Next.js 15.3.9 · TypeScript 5.9 · Tailwind CSS v4 · shadcn/ui · motion@12 · Supabase (Broadcast Realtime + Postgres) · Vercel.
**Live event:** 26 September 2026 — one wedding, one game.

Network conditions at venues are unreliable — mobile reconnect and state resync are first-class concerns. The production dry run on real devices (Vercel + Supabase Pro) passed all 13 checks including iPhone Safari screen-lock 60s reconnect.

## Constraints

- **Tech stack**: Next.js 15.3.9 (pinned) + TypeScript + Tailwind CSS v4 + shadcn/ui + motion (not framer-motion)
- **Realtime**: Supabase Realtime Broadcast — single vendor for Postgres + realtime; no Postgres Changes for game state
- **Database**: PostgreSQL via Supabase Pro (5 tables: games, players, questions, answers, scores)
- **Backend**: Serverless — Next.js API routes; no long-lived custom server
- **Auth**: Host-only via `HOST_PASSWORD` env var + `timingSafeEqual`; guests are anonymous (name + device token)
- **Hosting**: Vercel. All architectural decisions optimized for serverless/edge deployment
- **Performance**: 100+ concurrent guests with sub-second sync and smooth animation on low-end phones

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase Realtime Broadcast (not Postgres Changes) | Zero per-subscriber RLS queries on game events; scales to 100+ without N×DB cost per host action | ✓ Good — dry run confirmed sub-second sync |
| Service-role key in `admin.ts` with `server-only` guard | Key never reaches client bundle; verified by post-build grep in Phase 1 | ✓ Good — SC4 clean throughout |
| Host-driven round flow (no auto-timers) | Maximum host control; avoids clock-sync complexity; timers are cosmetic | ✓ Good — host controlled the pace flawlessly |
| Guest identity = name + device token (localStorage) | Account-free joining with reliable reconnect on flaky mobile connections | ✓ Good — PLAY-03 seeding worked seamlessly |
| Flat 1-point scoring | Simplicity and clarity; no speed penalties on slow wifi | ✓ Good — leaderboard was easy to follow |
| UPSERT (not INSERT) for answers with ON CONFLICT | Allows answer changes before host lock; WR-01 race handler preserves fairness | ✓ Good — resolved post-dry-run UX bug |
| Binary A/B questions only for v1 | Keeps UI, tap targets, and schema simple | ✓ Good — UI felt natural and fast |
| Next.js 15.3.9 exact pin (not ^15) | ^15.3.0 resolved to 15.5.19 which crashes with WasmHash TypeError on Node v24 | ✓ Good — no version drift |
| `motion` package (not `framer-motion`) | Canonical name, React 19 compatible, hardware-accelerated | ✓ Good — 60fps on 4x CPU throttle |
| `useReducedMotion() !== false` guard | Hook returns `null` on SSR render; `null` is falsy so `if (shouldReduce)` bypasses for reduced-motion users | ✓ Good — fixed WCAG violation in code review |
| compositor-only animation properties (opacity + y/scale) | Triggers no layout recalculations; holds 60fps even on low-end phones | ✓ Good — audit confirmed no layout-triggering animations |
| Supabase Pro plan mandatory before deployment | Free tier connection limits unsafe for 100+ concurrent guests | ✓ Good — dry run on Pro confirmed capacity |

## Evolution

**After v1.0 milestone close:** This document reflects the shipped state. No active requirements. Next milestone requires `/gsd-new-milestone` to define v2 scope.

---
*Last updated: 2026-06-06 after v1.0 milestone*
