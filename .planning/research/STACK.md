# Stack Research

**Domain:** Real-time multiplayer game-show web app (phone guests + host dashboard + TV display)
**Researched:** 2026-06-01
**Confidence:** HIGH (all critical versions verified against official sources and npm)

---

## Version Reality Check

PROJECT.md lists "Next.js 15" as a constraint. As of June 2026, the current stable Next.js is **16.2.6** (released May 2026, Turbopack default, stable Adapter API). Starting on Next.js 15.3.x is defensible for a greenfield project if the team wants a slightly more settled surface — but note that Next.js 16 is stable, not canary. The recommendation below uses **Next.js 15.3.x** to honor the project constraint, with a clear upgrade note.

---

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

---

## Installation

```bash
# Core framework
npm install next@latest react@latest react-dom@latest

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Animation (use motion, NOT framer-motion)
npm install motion

# State
npm install zustand

# Utilities
npm install clsx tailwind-merge nanoid canvas-confetti

# shadcn/ui init (interactive, copies components into repo)
npx shadcn@latest init -t next

# Dev dependencies
npm install -D typescript @types/node @types/react @types/react-dom tailwindcss

# Supabase CLI (for local dev + DB type generation)
npm install -D supabase
```

---

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

---

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

---

## Supabase Realtime: Integration Pattern for Next.js App Router

Realtime subscriptions are client-side WebSocket connections — they belong in `"use client"` components. They cannot live in Server Components.

### Channel Architecture for This Game

Use **one channel per game session**, identified by `game_id`. Use Broadcast (not Postgres Changes) for all game events.

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

```typescript
// In a "use client" component (guest phone, TV display, host dashboard)
"use client";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef } from "react";

type GameEvent =
  | { type: "QUESTION_STARTED"; questionId: string; questionText: string; optionA: string; optionB: string }
  | { type: "ANSWERS_LOCKED" }
  | { type: "ANSWER_REVEALED"; correctAnswer: "A" | "B" }
  | { type: "ROUND_ENDED"; scores: Record<string, number> }
  | { type: "GAME_ENDED"; winnerId: string };

export function useGameChannel(gameId: string, onEvent: (event: GameEvent) => void) {
  const supabase = createClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`game:${gameId}`)
      .on("broadcast", { event: "GAME_EVENT" }, ({ payload }) => {
        onEvent(payload as GameEvent);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("Realtime connected");
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // supabase-js v2 automatically reconnects; no manual retry needed
          // but you can force re-subscribe if desired
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);
}
```

### Host Broadcasting (Server Action or Route Handler)

The host sends events via a Next.js Route Handler or Server Action that calls the Supabase REST Broadcast API. Do NOT subscribe the host to a channel just to broadcast — use the HTTP broadcast endpoint for host actions:

```typescript
// app/api/host/broadcast/route.ts (Route Handler)
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  // Verify host session
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gameId, event } = await req.json();

  // Broadcast via Supabase REST API (HTTP, no WebSocket needed server-side)
  const { error: broadcastError } = await supabase
    .channel(`game:${gameId}`)
    .send({ type: "broadcast", event: "GAME_EVENT", payload: event });

  if (broadcastError) {
    return NextResponse.json({ error: broadcastError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

### Reconnect Handling

Supabase JS v2 reconnects automatically on WebSocket drop. Guest clients should re-sync state on reconnect by fetching current game state from the DB (not relying solely on Realtime events). Pattern: on `SUBSCRIBED` status, fetch current `game` row and hydrate local state.

---

## Host Authentication Pattern

Use Supabase Auth with **email + password**. The host is one trusted operator — create one Supabase Auth user in the dashboard or via seed script. Never expose host credentials to guests.

### Middleware for Route Protection

```typescript
// middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: use getClaims(), not getSession() — validates JWT signature
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith("/host")) {
    return NextResponse.redirect(new URL("/host/login", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/host/:path*"],
};
```

**Key point:** Supabase docs now recommend `supabase.auth.getClaims()` over `supabase.auth.getSession()` in server code (getClaims validates the JWT signature; getSession trusts the stored cookie without validation). Use `getUser()` which internally validates.

---

## Guest Identity Pattern

Guests have no Supabase Auth account. Their identity is:
1. A human-readable name (entered on join screen)
2. A persistent `deviceToken` (nanoid-generated UUID stored in `localStorage`)

On join, the guest POSTs `{ name, deviceToken }` to `/api/join`. The server upserts a `players` row keyed on `deviceToken`, returning the player's `id`. On reconnect, the same flow re-links them to their score row.

This means guests hit a public API route — no auth token, no Supabase Auth user. The guest API routes must validate that the game is active before accepting joins.

---

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

---

## Stack Patterns by Variant

**For the guest phone view (`/` or `/join`):**
- React Server Component for the outer shell + metadata
- Client Component for the game state (channel subscription, answer tap)
- Zustand for local UI state (which question phase, animation state)
- `motion/react` for tap feedback, question transitions, reveal animations

**For the host dashboard (`/host`):**
- Protected by middleware (Supabase Auth session required)
- Mostly client components (live participant count, A/B bar charts, action buttons)
- Supabase Realtime optional for host (can poll or use Supabase Realtime Presence to count connected guests)
- Server Actions for game state mutations (start, lock, reveal, next) — these broadcast via HTTP Broadcast API

**For the TV Display Mode (`/display`):**
- Full-screen client component, landscape-optimized
- Same `useGameChannel` hook as guest — subscribes to Broadcast events
- No auth required (Display Mode is public)
- Heavy use of `motion/react` for cinematic transitions (AnimatePresence, layout animations)

**For database writes (answers, scores):**
- Route Handlers (not Server Actions) for guest answer submission — guests have no Supabase Auth session, so Server Actions relying on auth cookies won't work cleanly
- Server Actions work fine for host (authenticated session present)

---

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

---

*Stack research for: Real-time multiplayer wedding game-show (Next.js + Supabase + Vercel)*
*Researched: 2026-06-01*
