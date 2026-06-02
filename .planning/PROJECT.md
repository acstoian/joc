# Joc — Live Wedding Game Show

## What This Is

A polished, mobile-first live "A/B trivia" game show web app for a wedding event. Guests join from their phones with just a name, answer host-controlled questions by tapping **A** or **B**, and watch live results, reveals, and a leaderboard update in real time. A host drives the entire game flow from a protected dashboard, and a dedicated cinematic **Display Mode** route projects the action onto a TV/projector for the room. Built on Next.js + Supabase, deployed on Vercel.

## Core Value

**During a live wedding, the room stays in sync and the game feels instant and fun** — when the host advances or reveals, every phone and the TV update together within a second, with no refreshes and no lost players.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. Hypotheses until shipped. -->

**Guest Experience**
- [ ] Guest can open the site on mobile and join a game by entering their name
- [ ] Guest is re-linked to their identity/score after refresh or disconnect via a persistent device token (localStorage)
- [ ] Guest waits in a lobby and sees live state updates without refreshing
- [ ] Guest sees the current question with answer A and answer B
- [ ] Guest can select exactly one answer; submission locks their choice for the round
- [ ] Guest UI clearly shows their selected/locked answer
- [ ] Guest sees real-time question transitions, answer reveals, and leaderboard updates
- [ ] Guest sees the game-end / winner state

**Host / Admin Experience**
- [ ] Host authenticates into a protected dashboard (guests need no accounts)
- [ ] Host can start the game, move to the next question, lock answers, reveal the correct answer, and end the game
- [ ] Host can reset answers for the current round
- [ ] Host sees live participant count
- [ ] Host sees live answer distribution (A vs B) and who answered what
- [ ] Host can create, edit, delete questions and mark the correct answer
- [ ] Host can reorder questions

**TV / Display Mode**
- [ ] Dedicated Display Mode route optimized for TV/projector (landscape, large typography, readable from far away)
- [ ] Display shows current question, animated transitions, live answer percentages, reveal effects, leaderboard, and winner screen
- [ ] Display auto-syncs in real time with host actions
- [ ] Display supports a host-initiated cosmetic countdown for tension and cinematic fullscreen visuals

**Scoring & Fairness**
- [ ] Flat scoring: 1 point per correct answer; leaderboard ranks by total correct
- [ ] One answer per guest per question, enforced server-side (prevent duplicate/late answers)
- [ ] Answers cannot be changed once locked

**Quality / Non-functional**
- [ ] Real-time sync of current question, reveal, scores, and round transitions across all clients
- [ ] Supports 100+ simultaneous guests with low latency and smooth animations on low-end phones
- [ ] Mobile-first, highly responsive, optimized for Safari and Chrome on phones; easy fast tapping
- [ ] Soft-luxury wedding aesthetic: glassmorphism accents, animated gradients, subtle confetti, smooth transitions
- [ ] Reconnect handling for unstable mobile connections (resubscribe + state resync)

### Out of Scope

<!-- Explicit boundaries with reasoning. -->

- **Guest accounts / login** — Guests join with name + device token only; accounts add friction at a live event.
- **Speed-weighted or streak scoring** — Chose flat 1-point scoring for simplicity and clarity; revisit only if the game feels flat.
- **Timer-based auto-lock / auto-advance** — Flow is fully host-driven; timers are cosmetic only. Avoids rigid pacing and clock-sync complexity.
- **Question types beyond binary A/B** — Two-option questions only for v1; keeps UI and tap targets simple.
- **Multiple concurrent games / multi-tenant** — One wedding, one game at a time; no need for game lobbies or org accounts.
- **Native mobile apps** — Web-only, mobile-first; no app store distribution.
- **Internationalization framework** — Single event, single language; not building an i18n system.

## Context

- **Greenfield project on the `joc` branch.** Although this repo also contains an existing Romanian wedding website (`Cristina & Andrei`), this game is a **completely new, independent project** and should not reuse or depend on that codebase.
- Target usage is a single live event: a wedding reception with the couple's guests playing on their phones while a TV/projector shows the big-screen experience.
- The host is a trusted operator (e.g. MC or a tech-savvy guest) running the dashboard from a laptop or phone.
- Network conditions at venues are unreliable — mobile reconnect and state resync are first-class concerns, not edge cases.
- The aesthetic must blend "modern TV game show" energy with an "elegant wedding" feel: premium, animated, exciting but dead-simple to use.

## Constraints

- **Tech stack**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion — modern, Vercel-native, component-driven.
- **Realtime**: Supabase Realtime — single vendor for Postgres + realtime + host auth; simplest ops and best Vercel fit.
- **Database**: PostgreSQL via Supabase. Tables for games/sessions, players, questions, answers, scores.
- **Backend**: Serverless-friendly — Next.js API routes / Server Actions; no long-lived custom server.
- **Auth**: Simple host-only authentication; guests are anonymous (name + device token).
- **State management**: Lightweight — React Server Components where appropriate, Zustand only if needed; avoid heavy client state and unnecessary rerenders.
- **Hosting**: Vercel. All architectural decisions optimized for serverless/edge deployment.
- **Performance**: Must handle 100+ concurrent guests with sub-second perceived sync and smooth animation on low-end phones.
- **Philosophy**: Prioritize simplicity and reliability over over-engineering; the live experience must feel instantaneous and fun.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat as greenfield on `joc` branch, ignore existing wedding site code | User wants a completely new, independent project | — Pending |
| Supabase Realtime (over Pusher) | One vendor for DB + realtime + auth; fewest moving parts on Vercel | — Pending |
| Flat scoring: 1 point per correct answer | Simplicity and clarity over game-show point dynamics | — Pending |
| Fully host-driven round flow (manual lock + reveal) | Maximum host control; avoids timer/clock-sync complexity; timers become cosmetic | — Pending |
| Guest identity = name + persistent device token (localStorage) | Account-free joining with reliable reconnect on flaky mobile networks | — Pending |
| Binary A/B questions only for v1 | Keeps UI, tap targets, and schema simple | — Pending |
| Next.js 15 + TS + Tailwind + shadcn/ui + Framer Motion | Modern, Vercel-native, animation-friendly, component-driven | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-01 after initialization*
