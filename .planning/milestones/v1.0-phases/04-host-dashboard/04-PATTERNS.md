# Phase 4: Host Dashboard — Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 15 new/modified files
**Analogs found:** 13 / 15

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/host/page.tsx` | page (client component) | request-response + event-driven | `src/app/sync-demo/page.tsx` | role-match |
| `src/hooks/useHostAuth.ts` | hook | request-response | `src/app/sync-demo/page.tsx` (HostControls state pattern) | partial |
| `src/hooks/useHostQuestions.ts` | hook | CRUD | `src/app/sync-demo/page.tsx` (async fetch + loading state) | partial |
| `src/hooks/useHostAnswerNames.ts` | hook | request-response | `src/hooks/useGameSync.ts` (fetch + state) | partial |
| `src/app/api/host/questions/route.ts` | route handler | CRUD | `src/app/api/host/transition/route.ts` | exact |
| `src/app/api/host/questions/[id]/route.ts` | route handler | CRUD | `src/app/api/host/transition/route.ts` | exact |
| `src/app/api/host/questions/reorder/route.ts` | route handler | CRUD | `src/app/api/host/transition/route.ts` | exact |
| `src/app/api/host/answers/route.ts` | route handler | request-response | `src/app/api/host/reveal/route.ts` | exact |
| `src/components/host/ControlTab.tsx` | component | event-driven | `src/app/sync-demo/page.tsx` (HostControls) | role-match |
| `src/components/host/PhaseButton.tsx` | component | request-response | `src/app/sync-demo/page.tsx` (button pattern) | partial |
| `src/components/host/QuestionsTab.tsx` | component | CRUD | `src/app/sync-demo/page.tsx` | partial |
| `src/components/host/QuestionRow.tsx` | component | CRUD | `src/app/sync-demo/page.tsx` (inline editing) | partial |
| `src/components/host/StatsTab.tsx` | component | event-driven | `src/app/sync-demo/page.tsx` (SubscriberPane) | role-match |
| `src/components/host/DistributionBar.tsx` | component | event-driven | `src/app/sync-demo/page.tsx` | partial |
| `src/components/host/EmergencyPanel.tsx` | component | request-response | `src/app/sync-demo/page.tsx` (HostControls) | partial |

---

## Pattern Assignments

### All New API Route Handlers

**Analog:** `src/app/api/host/transition/route.ts`

**Imports pattern** (lines 1–5):
```typescript
import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { validateHostAuth } from "@/lib/auth/host";
```

**Auth guard pattern — always the FIRST statement** (lines 62–67):
```typescript
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!validateHostAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // DB access only reaches here
}
```

**UUID validation pattern** (lines 37–42) — copy verbatim into every new route:
```typescript
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}
```

**JSON parse + validation pattern** (lines 70–85):
```typescript
let body: unknown;
try {
  body = await req.json();
} catch {
  return NextResponse.json({ error: "invalid_json" }, { status: 400 });
}

const { gameId, ...rest } = body as Record<string, unknown>;

if (!isValidUuid(gameId)) {
  return NextResponse.json({ error: "gameId required" }, { status: 400 });
}
```

**adminClient query pattern** (lines 99–107) — read with `.single()`, check error:
```typescript
const { data: game, error: gameError } = await adminClient
  .from("games")
  .select("phase, current_question_id")
  .eq("id", gameId)
  .single();

if (gameError || !game) {
  return NextResponse.json({ error: "game_not_found" }, { status: 404 });
}
```

**UPDATE without `.single()` (CAS pattern)** (lines 159–175) — for mutations that must detect lost races:
```typescript
const { data: updated, error: updateError } = await adminClient
  .from("questions")
  .update(payload)
  .eq("id", id)
  .select("id");

if (updateError) {
  return NextResponse.json({ error: "update_failed", detail: updateError.message }, { status: 500 });
}
if (!updated || updated.length === 0) {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}
```

---

### `src/app/api/host/questions/route.ts` (GET + POST)

**Analog:** `src/app/api/host/transition/route.ts`

**GET handler — ordered list from base table** (not `questions_public` view — that strips `correct_option`):
```typescript
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!validateHostAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const gameId = req.nextUrl.searchParams.get("gameId");
  if (!isValidUuid(gameId)) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from("questions")               // base table — includes correct_option (NOT questions_public)
    .select("id, body, option_a, option_b, correct_option, display_order, created_at")
    .eq("game_id", gameId)
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ questions: data ?? [] });
}
```

**POST handler — set display_order to MAX+1** (pattern from transition route's `start` action, lines 131–145):
```typescript
// Get current MAX display_order for this game:
const { data: maxRow } = await adminClient
  .from("questions")
  .select("display_order")
  .eq("game_id", gameId)
  .order("display_order", { ascending: false })
  .limit(1)
  .maybeSingle();

const nextOrder = maxRow ? maxRow.display_order + 1 : 1;

const { data: created, error: insertError } = await adminClient
  .from("questions")
  .insert({ game_id: gameId, body, option_a, option_b, correct_option: correct_option ?? null, display_order: nextOrder })
  .select()
  .single();
```

---

### `src/app/api/host/questions/[id]/route.ts` (PUT + DELETE)

**Analog:** `src/app/api/host/transition/route.ts`

**Dynamic segment params pattern** (Next.js 15 App Router):
```typescript
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!validateHostAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  // ...
}
```

**DELETE guard — prevent deleting the active question** (Pitfall 4 from RESEARCH.md):
```typescript
// Before delete: verify question is not currently active
const { data: game } = await adminClient
  .from("games")
  .select("current_question_id")
  .eq("id", gameId)       // gameId from query param or body
  .single();

if (game?.current_question_id === id) {
  return NextResponse.json(
    { error: "Aceasta intrebare este activa in joc. Reseteaza runda inainte de a o sterge." },
    { status: 409 }
  );
}
```

---

### `src/app/api/host/questions/reorder/route.ts` (PATCH)

**Analog:** `src/app/api/host/transition/route.ts`

**Concurrent updates with Promise.all** (RESEARCH.md RQ-2 recommendation):
```typescript
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  if (!validateHostAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { gameId, order } = body as { gameId: unknown; order: unknown };

  if (!isValidUuid(gameId) || !Array.isArray(order) || !order.every(isValidUuid)) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Concurrent updates — acceptable at ≤50 questions (RESEARCH.md RQ-2)
  await Promise.all(
    (order as string[]).map((questionId, index) =>
      adminClient
        .from("questions")
        .update({ display_order: index + 1 })
        .eq("id", questionId)
        .eq("game_id", gameId)
    )
  );

  return NextResponse.json({ ok: true });
}
```

---

### `src/app/api/host/answers/route.ts` (GET — HOST-10)

**Analog:** `src/app/api/host/reveal/route.ts`

**Import pattern** (lines 1–5 of reveal/route.ts):
```typescript
import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { validateHostAuth } from "@/lib/auth/host";
```

**JOIN pattern for answers → players** (RESEARCH.md Pattern 5):
```typescript
const { data, error } = await adminClient
  .from("answers")
  .select("choice, players!inner(display_name)")
  .eq("question_id", questionId);

const result = { A: [] as string[], B: [] as string[] };
for (const row of data ?? []) {
  const name = (row.players as { display_name: string }).display_name;
  if (row.choice === "A") result.A.push(name);
  else result.B.push(name);
}
return NextResponse.json(result);
```

---

### `src/app/host/page.tsx` (page — client component)

**Analog:** `src/app/sync-demo/page.tsx`

**"use client" + constants at top** (sync-demo lines 1–33):
```typescript
"use client";

import { useState, useEffect } from "react";
import { useGameSync } from "@/hooks/useGameSync";

const SEED_GAME_ID = "a0000000-0000-4000-8000-000000000001";
const GAME_ID = process.env.NEXT_PUBLIC_GAME_ID ?? SEED_GAME_ID;

// Sentinel UUID for host — passes UUID_REGEX, myAnswer will be null (RESEARCH.md RQ-3)
const HOST_SENTINEL_PLAYER_ID = "00000000-0000-4000-8000-000000000000";
```

**Page shell layout** (sync-demo lines 296–310):
```typescript
return (
  <main className="min-h-dvh bg-ink">
    {/* sticky header */}
    <header className="sticky top-0 z-10 flex h-12 items-center justify-between px-4 bg-ink border-b border-champagne/10">
      <h1 className="font-heading text-base font-bold text-champagne">Joc — Gazda</h1>
      {/* connection badge */}
    </header>
    {/* Tabs below header */}
  </main>
);
```

**useGameSync consumption** (sync-demo lines 43–44):
```typescript
const { state, status, participantCount } = useGameSync(GAME_ID, HOST_SENTINEL_PLAYER_ID);
```

---

### `src/hooks/useHostAuth.ts` (hook — sessionStorage gate)

**No exact analog in this repo.** Pattern is designed from RESEARCH.md RQ-4 and wedding-site admin pattern (D-01).

**Pattern to implement** (RESEARCH.md RQ-4):
```typescript
"use client";
import { useState } from "react";

const SESSION_KEY = "host_password";

export function useHostAuth() {
  const [password, setPassword] = useState<string | null>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null
  );
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function login(pw: string) {
    setChecking(true);
    setError(null);
    // Use GET /api/host/questions as auth probe (200/404 = accepted, 401 = wrong password)
    const res = await fetch(`/api/host/questions?gameId=${GAME_ID}`, {
      headers: { "x-host-password": pw },
    });
    if (res.status === 401) {
      setError("Parola gresita. Incearca din nou.");
    } else {
      sessionStorage.setItem(SESSION_KEY, pw);
      setPassword(pw);
    }
    setChecking(false);
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setPassword(null);
  }

  return { password, error, checking, login, logout };
}
```

---

### `src/hooks/useHostQuestions.ts` (hook — CRUD state)

**Analog:** `src/app/sync-demo/page.tsx` (HostControls async fetch + loading pattern, lines 101–117)

**Async fetch + loading state pattern** (sync-demo lines 106–117):
```typescript
const [loading, setLoading] = useState<string | null>(null);
const [error, setError] = useState<string | null>(null);

async function fire(event: GameEvent) {
  setLoading(event.type);
  setError(null);
  try {
    await demoBroadcast(gameId, event);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Broadcast failed");
  } finally {
    setLoading(null);
  }
}
```

**Applied to question CRUD — host fetch helper** (RESEARCH.md Pattern 2):
```typescript
// Centralises x-host-password header attachment on every call
async function hostFetch(url: string, password: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-host-password": password,
      ...(options.headers ?? {}),
    },
  });
}
```

---

### `src/hooks/useHostAnswerNames.ts` (hook — HOST-10 name lists)

**Analog:** `src/hooks/useGameSync.ts` (fetch + cancelled guard pattern, lines 92–108)

**Cancelled guard pattern** (useGameSync lines 93–108):
```typescript
let cancelled = false;

const fetchState = async () => {
  const res = await fetch(`/api/game/state?gameId=${gameId}&playerId=${playerId}`);
  if (cancelled) return;
  if (res.ok) {
    const data = await res.json();
    if (cancelled) return;
    setState(data);
  }
};

return () => { cancelled = true; /* cleanup */ };
```

**Applied to answer names hook:**
```typescript
"use client";
import { useState, useEffect, useCallback } from "react";

export function useHostAnswerNames(
  gameId: string,
  questionId: string | null,
  password: string
) {
  const [names, setNames] = useState<{ A: string[]; B: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!questionId) return;
    setLoading(true);
    const res = await fetch(
      `/api/host/answers?gameId=${gameId}&questionId=${questionId}`,
      { headers: { "x-host-password": password } }
    );
    if (res.ok) setNames(await res.json());
    setLoading(false);
  }, [gameId, questionId, password]);

  return { names, loading, refetch };
}
```

---

### `src/components/host/ControlTab.tsx` (component — live event-driven)

**Analog:** `src/app/sync-demo/page.tsx` (HostControls component, lines 100–282)

**In-flight action state** (sync-demo lines 101–104):
```typescript
const [loading, setLoading] = useState<string | null>(null);
```

**Phase → valid actions map** (RESEARCH.md Pattern 3):
```typescript
const PHASE_ACTIONS: Record<string, Set<string>> = {
  lobby:    new Set(["start"]),
  question: new Set(["lock", "end"]),
  locked:   new Set(["reveal"]),
  revealed: new Set(["next", "end"]),
  ended:    new Set(),
};

function isActionEnabled(action: string, phase: string | null | undefined): boolean {
  if (!phase) return false;
  return PHASE_ACTIONS[phase]?.has(action) ?? false;
}
```

**Re-enable on Broadcast confirm (not on API response)** (RESEARCH.md RQ-6):
```typescript
useEffect(() => {
  if (inFlight !== null) {
    setInFlight(null);
  }
}, [state?.phase]);

// 5-second fallback in case broadcast never arrives
useEffect(() => {
  if (inFlight === null) return;
  const t = setTimeout(() => setInFlight(null), 5000);
  return () => clearTimeout(t);
}, [inFlight]);
```

---

### `src/components/host/PhaseButton.tsx` (component — single action button)

**Analog:** `src/app/sync-demo/page.tsx` button pattern (lines 119–121, 162–171)

**Button class pattern** (sync-demo lines 119–121):
```typescript
const btnClass =
  "cursor-pointer rounded-xl bg-gold/20 px-4 py-3 text-xs font-semibold text-gold-bright " +
  "transition-colors hover:bg-gold/30 disabled:cursor-not-allowed disabled:opacity-50 " +
  "text-left min-h-[44px]";
```

**aria-busy for in-flight state** (sync-demo lines 163–170):
```typescript
<button
  type="button"
  disabled={loading !== null}
  aria-busy={loading === actionName}
  aria-disabled={!isEnabled}
  className={btnClass}
>
  {loading === actionName ? "..." : label}
</button>
```

---

### `src/components/host/StatsTab.tsx` (component — live stats)

**Analog:** `src/app/sync-demo/page.tsx` (SubscriberPane component, lines 43–92)

**useGameSync consumption + status colors** (sync-demo lines 44–54):
```typescript
const { state, status, participantCount } = useGameSync(gameId, HOST_SENTINEL_PLAYER_ID);

const statusColor =
  status === "connected"
    ? "text-emerald-400"
    : status === "reconnecting"
      ? "text-gold"
      : status === "error"
        ? "text-red-400"
        : "text-champagne-dim";
```

**Participant count display** (sync-demo lines 71–74):
```typescript
<span className="text-3xl font-bold text-gold-bright">{participantCount}</span>
<span className="text-xs text-champagne-dim/60">jucatori conectati</span>
```

**Glass card container** (sync-demo lines 56–58):
```typescript
<div className="glass flex-1 rounded-2xl px-5 py-5 shadow-xl">
```

---

### `src/components/host/DistributionBar.tsx` (component — animated A/B bar)

**Analog:** `src/app/sync-demo/page.tsx` layout patterns; animation from `motion/react`

**motion.div width animation pattern** (from RESEARCH.md §Animation + UI-SPEC §9):
```typescript
import { motion } from "motion/react";

// widthA = percentage (0–100)
<div className="relative h-2 rounded-full bg-ink-muted overflow-hidden" role="meter" aria-valuenow={total} aria-valuemin={0} aria-valuemax={total}>
  <motion.div
    className="absolute left-0 top-0 h-full bg-gold rounded-full"
    animate={{ width: `${widthA}%` }}
    transition={{ duration: 0.4, ease: "easeOut" }}
  />
</div>
```

---

### `src/components/host/QuestionsTab.tsx` + `QuestionRow.tsx`

**Analog:** `src/app/sync-demo/page.tsx` (general client component layout)

**A/B correct-answer toggle pattern** (sync-demo lines 136–158 — aria-pressed):
```typescript
<button
  type="button"
  onClick={() => setCorrectOption("A")}
  className={`min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
    correctOption === "A"
      ? "bg-gold text-ink"
      : "bg-gold/20 text-gold-bright hover:bg-gold/30"
  }`}
  aria-pressed={correctOption === "A"}
>
  A
</button>
```

**Inline row mode state machine** (RESEARCH.md Pattern 4):
```typescript
type RowMode = "view" | "editing" | "saving" | "error";
const [mode, setMode] = useState<RowMode>("view");
```

---

### `src/components/host/EmergencyPanel.tsx`

**Analog:** `src/app/sync-demo/page.tsx` (HostControls destructive action pattern, lines 106–117)

**Error + loading feedback pattern** (sync-demo lines 262–279):
```typescript
{(lastFired !== null || error !== null) && (
  <div className="glass-gold mt-4 rounded-xl px-4 py-3" role="status" aria-live="polite">
    {error !== null && (
      <p className="text-xs font-semibold text-red-400">Error: {error}</p>
    )}
  </div>
)}
```

---

## Shared Patterns

### x-host-password Header (All Client-Side Host API Calls)
**Source:** `src/lib/auth/host.ts` lines 44–46; `src/app/api/host/transition/route.ts` lines 62–67
**Apply to:** All `fetch()` calls from `src/hooks/use*.ts` and `src/components/host/*.tsx`
```typescript
// Every host API call must include this header
headers: {
  "Content-Type": "application/json",
  "x-host-password": password,   // from sessionStorage via useHostAuth
}
```

### validateHostAuth Guard (All New API Routes)
**Source:** `src/lib/auth/host.ts` (full file, 61 lines)
**Apply to:** `src/app/api/host/questions/**`, `src/app/api/host/answers/route.ts`
```typescript
// ALWAYS the first statement — before any DB access
if (!validateHostAuth(req)) {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
```

### adminClient (Server-Only — Never in Client Components)
**Source:** `src/lib/supabase/admin.ts` lines 1–2 (`import "server-only"`)
**Apply to:** All API routes under `src/app/api/host/`
**Warning:** Build error if imported in any file under `src/app/host/` or `src/components/`. All client code uses `fetch()` only.

### Glass Card Surface
**Source:** `src/app/globals.css` lines 56–60; `src/app/sync-demo/page.tsx` lines 56, 123
**Apply to:** All `src/components/host/*.tsx` card containers
```typescript
className="glass rounded-2xl px-5 py-5 shadow-xl"
// highlight panels:
className="glass-gold rounded-xl px-4 py-3"
```

### Touch Target Minimum
**Source:** `src/app/sync-demo/page.tsx` lines 119–121 (`min-h-[44px]`)
**Apply to:** All interactive elements in `src/components/host/*.tsx` — buttons, toggles, reorder arrows
```typescript
className="min-h-[44px] min-w-[44px]"
```

### Color Tokens
**Source:** `src/app/globals.css` lines 3–36 (`@theme` block)
**Apply to:** All new files — never use raw hex values
- `text-gold-bright` — participant count, active buttons, accents
- `text-champagne` — primary body text
- `text-champagne-dim/60` — captions, labels
- `bg-ink` — page background
- `.glass` / `.glass-gold` — card surfaces
- `text-red-400` — destructive actions, error states

### Romanian Copy
**Source:** CLAUDE.md conventions; UI-SPEC §7
**Apply to:** All user-visible strings in `src/app/host/` and `src/components/host/`
All button labels, toasts, empty states, and AlertDialog copy must be in Romanian per UI-SPEC §7 copywriting contract.

### `"use client"` Directive
**Source:** `src/app/sync-demo/page.tsx` line 1; `src/hooks/useGameSync.ts` line 1
**Apply to:** `src/app/host/page.tsx`, all `src/hooks/useHost*.ts`, all `src/components/host/*.tsx`
All files in these directories are client components.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/hooks/useHostAuth.ts` | hook | request-response | No sessionStorage auth hook exists in this repo; pattern designed from RESEARCH.md RQ-4 + D-01 |
| `src/components/ui/*` (shadcn) | component primitives | — | Installed via `npx shadcn@latest add` CLI — not authored; CLI copies them |

---

## Metadata

**Analog search scope:** `src/app/api/host/`, `src/hooks/`, `src/app/sync-demo/`, `src/lib/`, `src/app/globals.css`
**Files read:** 9 source files
**Pattern extraction date:** 2026-06-03

### Critical Pitfalls to Carry into Plans

1. **`correct_option` in Questions tab:** Host question routes MUST query `adminClient.from("questions")` (base table), never `questions_public` view — the view omits `correct_option` per RLS.
2. **`useGameSync` playerId:** Pass `HOST_SENTINEL_PLAYER_ID = "00000000-0000-4000-8000-000000000000"` — empty string or non-UUID string causes 400 from `GET /api/game/state`.
3. **Phase button re-enable:** Re-enable in `useEffect([state?.phase])`, not in the `fetch` success handler. Add 5-second `setTimeout` fallback.
4. **Delete active question guard:** Check `games.current_question_id` in `DELETE /api/host/questions/[id]`; return 409 if matched.
5. **adminClient server-only:** Never import `@/lib/supabase/admin` in client components — `import "server-only"` causes build error.
6. **shadcn CSS injection:** After `npx shadcn@latest add`, verify `globals.css` still starts with `@import "tailwindcss"` and the `@theme` block is intact.
