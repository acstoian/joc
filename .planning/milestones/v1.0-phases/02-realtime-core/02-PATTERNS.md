# Phase 2: Realtime Core - Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 6
**Analogs found:** 5 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/supabase/client.ts` | config/factory | request-response | `src/lib/supabase/client.ts` (self) | exact (modify) |
| `src/lib/realtime/events.ts` | utility/types | event-driven | `src/types/database.ts` (shared types file) | partial (same role: pure types) |
| `src/hooks/useGameSync.ts` | hook | event-driven + request-response | no existing hook analog | none |
| `src/app/api/game/state/route.ts` | route handler | request-response | `src/app/api/skeleton-answer/route.ts` | exact |
| `src/app/sync-demo/page.tsx` | page (throwaway harness) | event-driven | `src/app/skeleton/ping/page.tsx` | exact |
| `src/app/actions/demo-broadcast.ts` | server action | event-driven | `src/lib/supabase/admin.ts` (broadcast helper) | role-match |

---

## Pattern Assignments

### `src/lib/supabase/client.ts` (MODIFY — add realtime options)

**Analog:** Self — current content at `src/lib/supabase/client.ts`

**Current file (lines 1–17) — copy this structure, then add the `realtime` block:**
```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Target state — add `realtime` options as the third argument:**
```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Browser-side Supabase client (anon key).
 * Safe in "use client" components. RLS enforces access control.
 *
 * Realtime options (Phase 2):
 *  - worker: true       — offloads heartbeat to Web Worker; iOS Safari cannot
 *                         throttle it when the tab is backgrounded (Pitfall 12)
 *  - heartbeatIntervalMs: 15_000  — default is 25s, too close to iOS 30s kill
 *                                   threshold; 15s gives 2× safety margin
 *  - reconnectAfterMs   — jittered backoff spreads 100 simultaneous reconnects
 *                         over a 2s window, preventing a thundering herd (D-09)
 *
 * IMPORTANT: createBrowserClient is a module-level singleton. Options on the
 * first call are the only ones that take effect. Do NOT pass realtime options
 * anywhere else — they will be silently ignored (Pitfall 6).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        worker: true,
        heartbeatIntervalMs: 15_000,
        reconnectAfterMs: (tries: number) => {
          const base = [1_000, 2_000, 5_000, 10_000][Math.min(tries - 1, 3)];
          return base + Math.random() * 2_000;
        },
      },
    }
  );
}
```

---

### `src/lib/realtime/events.ts` (NEW — pure types)

**Analog:** `src/types/database.ts` — pure TypeScript types file, no runtime code, no imports.

**Pattern:** This is a pure types-only file. No `"use client"`, no imports, no runtime code. Export a single discriminated union. Phase 3 may add union members but must not reshape existing members (D-05/D-06).

```typescript
// src/lib/realtime/events.ts
// 8-member GAME_EVENT discriminated union (D-05).
// All payloads carry only type + minimal IDs. Consumers always re-fetch
// GET /api/game/state for authoritative data (D-06).
//
// NEVER add self-contained data payloads here — typed-signal + re-fetch is the
// locked contract. Phase 3 may extend with new union members only.

export type GameEvent =
  | { type: "GAME_STARTED";      gameId: string }
  | { type: "QUESTION_STARTED";  gameId: string; questionId: string }
  | { type: "ANSWERS_LOCKED";    gameId: string; questionId: string }
  | { type: "ANSWER_REVEALED";   gameId: string; questionId: string; correctOption: "A" | "B" }
  | { type: "SCORES_UPDATED";    gameId: string }
  | { type: "ROUND_RESET";       gameId: string; questionId: string }
  | { type: "GAME_ENDED";        gameId: string }
  | { type: "COUNTDOWN_STARTED"; gameId: string; seconds: number };
```

**Key note on `ANSWER_REVEALED`:** `correctOption: "A" | "B"` is the live host selection at reveal time (D-07). Phase 2 demo exercises this via a live A/B picker; the real host-writes-correct-option DB path is Phase 3/4.

---

### `src/hooks/useGameSync.ts` (NEW — headless hook)

**Analog:** No existing hook in the codebase. Pattern is fully specified in RESEARCH.md.

**Pattern source:** RESEARCH.md Pattern 2 (subscribe-then-fetch). Key structural rules to follow:

**Imports:**
```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GameEvent } from "@/lib/realtime/events";
```

**Return type surface (D-01):**
```typescript
export type SyncStatus = "connecting" | "connected" | "reconnecting" | "error";

export type GameStateSnapshot = {
  phase: "lobby" | "question" | "locked" | "revealed" | "ended";
  currentQuestionId: string | null;
  currentQuestion: { id: string; body: string; optionA: string; optionB: string } | null;
  myAnswer: "A" | "B" | null;       // null — Phase 3 populates
  correctOption: "A" | "B" | null;  // null — Phase 3 populates
};

// hook signature
export function useGameSync(
  gameId: string,
  playerId: string
): { state: GameStateSnapshot | null; status: SyncStatus; participantCount: number }
```

**Core pattern rules (all are pitfall-avoidance):**
- Channel created inside `useEffect`, not the render body
- `channelRef = useRef(null)` holds the channel across renders
- `fetchState()` called in `SUBSCRIBED` callback only (initial + every reconnect)
- `channel.track()` called once in `SUBSCRIBED` callback — NEVER in broadcast handler or render loop (Pitfall 3)
- `visibilitychange` handler calls `fetchState()` ONLY — does NOT call `channel.subscribe()` again (Pitfall 4)
- Cleanup: `supabase.removeChannel(channel)` fully tears down for React StrictMode double-mount (Pitfall 2)
- `useEffect` deps: `[gameId, playerId]` only — stable

**Presence pattern:**
```typescript
.on("presence", { event: "sync" }, () => {
  const state = channel.presenceState();
  setParticipantCount(Object.keys(state).length);
})
```

**Subscribe callback structure:**
```typescript
.subscribe(async (status) => {
  if (status === "SUBSCRIBED") {
    setStatus("connected");
    await fetchState();                         // subscribe-then-fetch
    await channel.track({ player_id: playerId, device_token: deviceToken }); // once only
  } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
    setStatus("reconnecting");                  // SDK auto-reconnects; re-fetch on next SUBSCRIBED
  } else if (status === "CLOSED") {
    setStatus("error");
  }
})
```

---

### `src/app/api/game/state/route.ts` (NEW — GET route handler)

**Analog:** `src/app/api/skeleton-answer/route.ts` (lines 1–109)

**Imports pattern** (from analog lines 1–3):
```typescript
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
```

**Additional import needed (not in analog):**
```typescript
import { NextRequest } from "next/server";
import type { GameStateSnapshot } from "@/hooks/useGameSync";
```

**Error response pattern** (from analog lines 40–45, 70–75):
```typescript
// 400 / 404 / 500 pattern — copy exactly
return NextResponse.json({ error: "gameId required" }, { status: 400 });
return NextResponse.json({ error: "game_not_found" }, { status: 404 });
return NextResponse.json({ error: "...", detail: err.message }, { status: 500 });
```

**DB query pattern** (from analog lines 36–45):
```typescript
const { data: game, error: gameError } = await adminClient
  .from("games")
  .select("phase, current_question_id")
  .eq("id", gameId)
  .single();
```

**Critical rule — query `questions_public`, NOT `questions`** (Pitfall 5):
```typescript
// CORRECT: questions_public view omits correct_option pre-reveal
const { data: q } = await adminClient
  .from("questions_public")
  .select("id, body, option_a, option_b")
  .eq("id", game.current_question_id)
  .single();

// WRONG — leaks correct_option to clients before reveal:
// adminClient.from("questions")...
```

**Answer fetch pattern** (Phase 2 stubs null; Phase 3 populates):
```typescript
// answers RLS is USING(false) for anon — must use adminClient here
const { data: answer } = await adminClient
  .from("answers")
  .select("choice")
  .eq("player_id", playerId)
  .eq("question_id", game.current_question_id)
  .maybeSingle();  // use maybeSingle() not single() — player may not have answered yet
```

**Route signature:**
```typescript
export async function GET(req: NextRequest): Promise<NextResponse> { ... }
```

---

### `src/app/sync-demo/page.tsx` (NEW — throwaway harness)

**Analog:** `src/app/skeleton/ping/page.tsx` (lines 1–96)

**File header pattern** (from analog lines 1–11):
```typescript
"use client";

/**
 * THROWAWAY PROOF HARNESS — Phase 2 only.
 * Removed / replaced when real game surfaces are built in Phases 4–6.
 *
 * Proves Phase 2 success criteria:
 *   SC1: two subscriber panes receive broadcast within 1s
 *   SC2: reconnect after 60s screen-lock (DevTools offline simulation)
 *   SC3/SC4: visibilitychange triggers re-fetch
 */
```

**Imports pattern** (from analog lines 13–14 + hook):
```typescript
import { useState } from "react";
import { useGameSync } from "@/hooks/useGameSync";
```

**State pattern** (from analog lines 16–20):
```typescript
const [loading, setLoading] = useState(false);
const [lastEvent, setLastEvent] = useState<string | null>(null);
```

**Layout pattern** (from analog lines 51–95 — glass card on ink bg):
```typescript
<main className="flex min-h-dvh items-center justify-center bg-ink p-4">
  <div className="glass w-full max-w-sm rounded-2xl px-8 py-10 text-center shadow-2xl">
    <h1 className="font-heading text-2xl font-bold tracking-tight text-champagne">
      ...
    </h1>
    <div className="thin-divider" aria-hidden="true" />
    ...
  </div>
</main>
```

**Button pattern** (from analog lines 66–70):
```typescript
<button
  onClick={handleClick}
  disabled={loading}
  aria-busy={loading}
  className="mt-8 w-full cursor-pointer rounded-xl bg-gold/20 px-6 py-3 text-sm font-semibold text-gold-bright transition-colors hover:bg-gold/30 disabled:cursor-not-allowed disabled:opacity-50"
>
  {loading ? "Se trimite…" : "..."}
</button>
```

**Result display pattern** (from analog lines 71–89):
```typescript
{result !== null && (
  <div className="glass-gold mt-6 rounded-xl px-5 py-4 text-left" role="status" aria-live="polite">
    <pre className="overflow-auto text-xs text-champagne-dim/80">
      {JSON.stringify(result, null, 2)}
    </pre>
  </div>
)}
```

**Demo-specific structure** — the page must render TWO `<SubscriberPane>` components (each wrapping `useGameSync`) plus a `<HostControls>` section with buttons for each of the 8 GAME_EVENTs. `SubscriberPane` is a local component in the same file (throwaway, no need for a separate file).

---

### `src/app/actions/demo-broadcast.ts` (NEW — server action, throwaway)

**Analog:** `src/lib/supabase/admin.ts` — server-only module with `broadcast()` helper

**File header pattern** (from analog lines 1–2):
```typescript
"use server";

import { broadcast } from "@/lib/supabase/admin";
import type { GameEvent } from "@/lib/realtime/events";
```

**Server action pattern:**
```typescript
export async function demoBroadcast(gameId: string, event: GameEvent): Promise<void> {
  await broadcast(`game:${gameId}`, "GAME_EVENT", event as Record<string, unknown>);
}
```

No error handling needed beyond letting the exception propagate — the demo will surface it in the UI.

---

## Shared Patterns

### Server-only module guard
**Source:** `src/lib/supabase/admin.ts` line 1
**Apply to:** `src/app/actions/demo-broadcast.ts` (use `"use server"` directive, which enforces the server boundary for Server Actions)
```typescript
"use server";
// For admin.ts-style modules (not Server Actions), the guard is:
import "server-only";
```

### adminClient import + error pattern
**Source:** `src/app/api/skeleton-answer/route.ts` lines 1–2, 40–45
**Apply to:** `src/app/api/game/state/route.ts`
```typescript
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

// Error: always include detail from Supabase error object
return NextResponse.json({ error: "...", detail: err?.message }, { status: 500 });
```

### Throwaway harness file header comment
**Source:** `src/app/skeleton/ping/page.tsx` lines 2–11 and `src/app/api/skeleton-answer/route.ts` lines 2–18
**Apply to:** `src/app/sync-demo/page.tsx`, `src/app/actions/demo-broadcast.ts`
All throwaway files must have a JSDoc block stating: THROWAWAY PROOF HARNESS — Phase N only, what it proves, and when it is removed.

### Glass card UI tokens
**Source:** `src/app/skeleton/ping/page.tsx` lines 51–95
**Apply to:** `src/app/sync-demo/page.tsx`
Use `bg-ink`, `glass`, `glass-gold`, `font-heading`, `text-champagne`, `text-champagne-dim`, `text-gold`, `text-gold-bright`, `thin-divider` — these are the established Phase 1 design tokens.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/hooks/useGameSync.ts` | hook | event-driven | No React hooks exist in the codebase yet; all Phase 1 client code is in page components. Full implementation pattern is in RESEARCH.md Pattern 2. |

---

## Metadata

**Analog search scope:** `src/lib/supabase/`, `src/app/api/`, `src/app/skeleton/`, `src/types/`
**Files scanned:** 4 analog files read in full
**Pattern extraction date:** 2026-06-02
