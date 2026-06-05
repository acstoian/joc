# Phase 3: Server Write Path & State Machine — Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 9 (6 new, 2 modified, 1 new migration)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/api/game/join/route.ts` | route handler | request-response (upsert) | `src/app/api/skeleton-answer/route.ts` | exact |
| `src/app/api/game/answer/route.ts` | route handler | request-response (guarded insert) | `src/app/api/skeleton-answer/route.ts` | exact |
| `src/app/api/host/transition/route.ts` | route handler | request-response (CAS write) | `src/app/api/skeleton-answer/route.ts` | role-match |
| `src/app/api/host/reveal/route.ts` | route handler | request-response (write + RPC) | `src/app/api/skeleton-answer/route.ts` | role-match |
| `src/app/api/host/reset/route.ts` | route handler | request-response (surgical delete) | `src/app/api/skeleton-answer/route.ts` | role-match |
| `src/lib/auth/host.ts` | utility / middleware | request-response | `src/lib/supabase/admin.ts` (server-only pattern) | partial |
| `supabase/migrations/0004_recompute_scores.sql` | migration | batch (SQL aggregate upsert) | `supabase/migrations/0003_reset_function.sql` | exact |
| `src/app/api/game/state/route.ts` (MODIFY) | route handler | request-response (extended read) | itself (existing file) | self |
| `src/hooks/useGameSync.ts` — `GameStateSnapshot` type (MODIFY) | type definition | — | itself (existing file) | self |

---

## Pattern Assignments

### `src/app/api/game/join/route.ts` (route handler, request-response upsert)

**Analog:** `src/app/api/skeleton-answer/route.ts`

**Imports pattern** (lines 1–2):
```typescript
import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
```

**Input validation pattern** (analog: `src/app/api/game/state/route.ts` lines 32–53):
```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(value: string | null): value is string {
  return value !== null && UUID_REGEX.test(value);
}
// In handler:
const body = await req.json();
const { gameId, deviceToken, displayName } = body;
if (!isValidUuid(gameId)) return NextResponse.json({ error: "gameId required" }, { status: 400 });
// Name validation per D-04: trim, non-empty, max length (~30), unicode allowed
const name = (typeof displayName === "string" ? displayName : "").trim();
if (!name) return NextResponse.json({ error: "displayName required" }, { status: 400 });
if (name.length > 30) return NextResponse.json({ error: "displayName too long" }, { status: 400 });
```

**Core upsert pattern** (`src/app/api/skeleton-answer/route.ts` lines 57–75):
```typescript
const { data: player, error: playerError } = await adminClient
  .from("players")
  .upsert(
    {
      game_id: SEED_GAME_ID,
      device_token: SKELETON_DEVICE_TOKEN,
      display_name: SKELETON_DISPLAY_NAME,
    },
    { onConflict: "game_id,device_token", ignoreDuplicates: false }
  )
  .select("id")
  .single();

if (playerError || !player) {
  return NextResponse.json(
    { error: "Player upsert failed", detail: playerError?.message },
    { status: 500 }
  );
}
```
For join: replace seed constants with `gameId`, `deviceToken`, `name`; return `{ ok: true, playerId: player.id }`.

**Error handling pattern** (lines 40–45):
```typescript
if (gameError || !game) {
  return NextResponse.json(
    { error: "Game not found", detail: gameError?.message },
    { status: 404 }
  );
}
```

---

### `src/app/api/game/answer/route.ts` (route handler, guarded insert)

**Analog:** `src/app/api/skeleton-answer/route.ts`

**Imports pattern** (lines 1–2):
```typescript
import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
```

**Phase guard pattern — Layer 1** (`src/app/api/skeleton-answer/route.ts` lines 30–52):
```typescript
const { data: game, error: gameError } = await adminClient
  .from("games")
  .select("phase, current_question_id")
  .eq("id", SEED_GAME_ID)
  .single();

if (gameError || !game) {
  return NextResponse.json(
    { error: "Game not found", detail: gameError?.message },
    { status: 404 }
  );
}

if (!OPEN_PHASES.has(game.phase)) {
  return NextResponse.json(
    { error: "answers_locked", phase: game.phase },
    { status: 403 }
  );
}
```
For the real route: only `'question'` is the open phase (not `'lobby'`):
```typescript
if (game.phase !== "question") {
  return NextResponse.json({ error: "answers_locked", phase: game.phase }, { status: 403 });
}
```

**Anti-cheat identity lookup — server-side player_id resolution** (per RESEARCH.md Pattern 4):
```typescript
// NEVER trust client-supplied player_id; resolve from device_token
const { data: player } = await adminClient
  .from("players")
  .select("id")
  .eq("game_id", gameId)
  .eq("device_token", deviceToken)
  .maybeSingle();

if (!player) {
  return NextResponse.json({ error: "player_not_found" }, { status: 404 });
}
```

**DB dedup pattern — Layer 2** (`src/app/api/skeleton-answer/route.ts` lines 78–103):
```typescript
const { data: answer, error: answerError } = await adminClient
  .from("answers")
  .insert({
    player_id: player.id,
    question_id: SEED_QUESTION_ID,
    choice: "A",
  })
  .select("id")
  .single();

if (answerError) {
  if (answerError.code === "23505") {
    return NextResponse.json(
      { error: "already_answered" },
      { status: 409 }
    );
  }
  return NextResponse.json(
    { error: "Answer insert failed", detail: answerError.message },
    { status: 500 }
  );
}
```
For the real route: use `game.current_question_id` and the `choice` from request body (validated as `"A" | "B"`).

---

### `src/app/api/host/transition/route.ts` (route handler, CAS write + broadcast)

**Analog:** `src/app/api/skeleton-answer/route.ts` (structure) + RESEARCH.md Pattern 1 (CAS logic)

**Imports pattern**:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { adminClient, broadcast } from "@/lib/supabase/admin";
import { validateHostAuth } from "@/lib/auth/host";
import type { GameEvent } from "@/lib/realtime/events";
```

**Host auth guard — apply at top of every host handler**:
```typescript
if (!validateHostAuth(req)) {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
```

**D-07 CAS logic — full flow** (RESEARCH.md Pattern 1, lines 224–249):
```typescript
// Step 1: Read current phase
const { data: game } = await adminClient
  .from("games").select("phase, current_question_id").eq("id", gameId).single();

// Step 2: D-07 distinguishing rule
if (game.phase === targetPhase) {
  // Already there — idempotent no-op (D-05)
  return NextResponse.json({ noop: true, state: game }, { status: 200 });
}
if (game.phase !== expectedFromPhase) {
  // Wrong starting state — illegal transition (D-06)
  return NextResponse.json(
    { error: "invalid_transition", current: game.phase, expected: expectedFromPhase },
    { status: 409 }
  );
}

// Step 3: CAS UPDATE — BOTH .eq() conditions required for serialization
const { data: updated } = await adminClient
  .from("games").update({ phase: targetPhase })
  .eq("id", gameId).eq("phase", expectedFromPhase).select("phase");

// data is [] (not null, no error) when 0 rows matched — use length check, NOT .single()
if (!updated || updated.length === 0) {
  // Lost race — treat as no-op (D-07 third bullet)
  return NextResponse.json({ noop: true }, { status: 200 });
}
```

**Lobby→question must also set current_question_id** (RESEARCH.md Pitfall 6):
```typescript
// For lobby→question: atomically set phase + first question in one UPDATE
const { data: firstQ } = await adminClient
  .from("questions")
  .select("id")
  .eq("game_id", gameId)
  .order("display_order", { ascending: true })
  .limit(1)
  .single();

await adminClient
  .from("games")
  .update({ phase: "question", current_question_id: firstQ.id })
  .eq("id", gameId).eq("phase", "lobby").select("phase");
```

**Best-effort broadcast pattern** (RESEARCH.md Pattern 7):
```typescript
try {
  await broadcast(`game:${gameId}`, "GAME_EVENT", {
    type: "ANSWERS_LOCKED",
    gameId,
    questionId,
  } satisfies GameEvent);
} catch (err) {
  console.error("[broadcast] Failed to broadcast ANSWERS_LOCKED:", err);
  // Best-effort — do not fail the host request (Claude's Discretion)
}
return NextResponse.json({ ok: true, phase: "locked" }, { status: 200 });
```

---

### `src/app/api/host/reveal/route.ts` (route handler, write + RPC + broadcast)

**Analog:** `src/app/api/skeleton-answer/route.ts` (structure) + RESEARCH.md Pattern 2 (scoring)

**Imports pattern**:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { adminClient, broadcast } from "@/lib/supabase/admin";
import { validateHostAuth } from "@/lib/auth/host";
import type { GameEvent } from "@/lib/realtime/events";
```

**Set correct_option unconditionally** (RESEARCH.md Pitfall 5 — must overwrite, not INSERT):
```typescript
const { error: updateError } = await adminClient
  .from("questions")
  .update({ correct_option: choice })   // choice: "A" | "B" from request body
  .eq("id", questionId);

if (updateError) {
  return NextResponse.json({ error: "reveal_failed", detail: updateError.message }, { status: 500 });
}
```

**RPC score recompute** (RESEARCH.md Pattern 2):
```typescript
const { error: scoreError } = await adminClient.rpc("recompute_scores", {
  p_game_id: gameId,
});
if (scoreError) {
  console.error("Score recompute failed:", scoreError);
  // Best-effort: log but do not fail the reveal
}
```

**Broadcast two signals** (`src/lib/realtime/events.ts` lines 18–19 — both event types exist):
```typescript
try {
  await broadcast(`game:${gameId}`, "GAME_EVENT", {
    type: "ANSWER_REVEALED", gameId, questionId, correctOption: choice,
  } satisfies GameEvent);
  await broadcast(`game:${gameId}`, "GAME_EVENT", {
    type: "SCORES_UPDATED", gameId,
  } satisfies GameEvent);
} catch (err) {
  console.error("[broadcast] reveal broadcast failed:", err);
}
```

---

### `src/app/api/host/reset/route.ts` (route handler, surgical delete)

**Analog:** `src/app/api/skeleton-answer/route.ts` (structure) + RESEARCH.md Pattern 8

**Core surgical reset pattern** (RESEARCH.md Pattern 8 — NOT `reset_game()` full wipe):
```typescript
// Step 1: Get current question
const { data: game } = await adminClient
  .from("games").select("phase, current_question_id").eq("id", gameId).single();

if (!game.current_question_id || game.phase === "lobby") {
  return NextResponse.json({ error: "no_active_question" }, { status: 400 });
}

// Step 2: Delete answers for ONLY current question (D-08)
await adminClient
  .from("answers")
  .delete()
  .eq("question_id", game.current_question_id);

// Step 3: Reset phase to question
await adminClient
  .from("games")
  .update({ phase: "question" })
  .eq("id", gameId);

// Step 4: Broadcast ROUND_RESET
try {
  await broadcast(`game:${gameId}`, "GAME_EVENT", {
    type: "ROUND_RESET", gameId, questionId: game.current_question_id,
  } satisfies GameEvent);
} catch (err) {
  console.error("[broadcast] ROUND_RESET broadcast failed:", err);
}
```

---

### `src/lib/auth/host.ts` (utility, server-only)

**Analog:** `src/lib/supabase/admin.ts` (server-only module pattern)

**Server-only module pattern** (`src/lib/supabase/admin.ts` lines 1–4):
```typescript
import "server-only";
// ^ causes build error if imported in "use client" component; enforces server boundary
```

**Host auth helper — full implementation** (RESEARCH.md Pattern 6):
```typescript
import "server-only";
import type { NextRequest } from "next/server";

export function validateHostAuth(req: NextRequest): boolean {
  const password =
    req.headers.get("x-host-password") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return (
    typeof password === "string" &&
    password.length > 0 &&
    password === process.env.HOST_PASSWORD
  );
}
```

---

### `supabase/migrations/0004_recompute_scores.sql` (migration, SQL aggregate upsert)

**Analog:** `supabase/migrations/0003_reset_function.sql`

**Migration header + SECURITY DEFINER + REVOKE pattern** (`0003_reset_function.sql` lines 1–46):
```sql
-- ─── 0004_recompute_scores.sql ─────────────────────────────────────────────────
-- recompute_scores(p_game_id uuid) — D-09 idempotent score recompute.
--
-- Called by POST /api/host/reveal after setting questions.correct_option.
-- Counts correct answers from scratch (never increments) → reset-safe.
--
-- SECURITY DEFINER: runs with owner privileges, not calling role.
-- NOT granted to anon — host-only, called via service_role server client.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION recompute_scores(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- [body: aggregate correct answers per player, upsert to scores]
END;
$$;

-- Matches 0003 pattern exactly:
REVOKE EXECUTE ON FUNCTION recompute_scores(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION recompute_scores(uuid) FROM anon;
```

**RPC function body** (RESEARCH.md Pattern 2 — SQL body):
```sql
INSERT INTO scores (player_id, correct_count, updated_at)
SELECT
  p.id AS player_id,
  COUNT(a.id) FILTER (
    WHERE q.correct_option IS NOT NULL
      AND a.choice = q.correct_option
  ) AS correct_count,
  now()
FROM players p
LEFT JOIN answers a ON a.player_id = p.id
LEFT JOIN questions q ON q.id = a.question_id
WHERE p.game_id = p_game_id
GROUP BY p.id
ON CONFLICT (player_id) DO UPDATE
  SET correct_count = EXCLUDED.correct_count,
      updated_at    = now();
```

---

### `src/app/api/game/state/route.ts` — MODIFY (extend existing)

**Analog:** itself — extend the existing file

**Existing pattern to preserve** (`src/app/api/game/state/route.ts` lines 1–132 — full file):
- UUID validation with `isValidUuid()` (lines 32–53) — keep unchanged
- `adminClient.from("games").select(...).single()` game fetch (lines 57–64) — keep unchanged
- `questions_public` view usage for question fetch (lines 69–92) — keep unchanged, NEVER switch to base `questions` table except for the `correctOption` block
- `maybeSingle()` for optional answer fetch (lines 99–116) — keep unchanged

**New: correctOption block — add after myAnswer section** (RESEARCH.md Pattern 5):
```typescript
// correctOption — ONLY expose when phase === 'revealed'
// Use adminClient.from("questions") (base table) — questions_public omits correct_option
let correctOption: "A" | "B" | null = null;
if (game.phase === "revealed" && game.current_question_id) {
  const { data: q } = await adminClient
    .from("questions")      // base table required — view omits correct_option
    .select("correct_option")
    .eq("id", game.current_question_id)
    .single();
  correctOption = (q?.correct_option as "A" | "B") ?? null;
}
```

**New: distribution block** (RESEARCH.md Pattern 5):
```typescript
let distribution: { A: number; B: number } | null = null;
if ((game.phase === "locked" || game.phase === "revealed") && game.current_question_id) {
  const { data: answers } = await adminClient
    .from("answers")
    .select("choice")
    .eq("question_id", game.current_question_id);
  const A = (answers ?? []).filter(a => a.choice === "A").length;
  const B = (answers ?? []).filter(a => a.choice === "B").length;
  distribution = { A, B };
}
```

**New: leaderboard block** (RESEARCH.md Pattern 5):
```typescript
let leaderboard: { name: string; score: number }[] = [];
if (game.phase !== "lobby") {
  const { data: scores } = await adminClient
    .from("scores")
    .select("correct_count, players!inner(display_name)")
    .eq("players.game_id", gameId)
    .order("correct_count", { ascending: false })
    .limit(20);
  leaderboard = (scores ?? []).map(s => ({
    name: (s.players as { display_name: string }).display_name,
    score: s.correct_count,
  }));
}
```

**Replace the Phase 2 stub line** (`route.ts` line 121):
```typescript
// Before (Phase 2 stub):
const correctOption: "A" | "B" | null = null; // stub — Phase 3 will fill

// After: use the correctOption computed in the new block above
// and add distribution + leaderboard to the snapshot object
```

---

### `src/hooks/useGameSync.ts` — `GameStateSnapshot` type (MODIFY)

**Analog:** itself — extend the existing type

**Existing type** (`src/hooks/useGameSync.ts` lines 42–53):
```typescript
export type GameStateSnapshot = {
  phase: "lobby" | "question" | "locked" | "revealed" | "ended";
  currentQuestionId: string | null;
  currentQuestion: {
    id: string;
    body: string;
    optionA: string;
    optionB: string;
  } | null;
  myAnswer: "A" | "B" | null;       // null — Phase 3 populates
  correctOption: "A" | "B" | null;  // null — Phase 3 populates
};
```

**Extended type — add two fields** (RESEARCH.md Pattern 5 type extension):
```typescript
export type GameStateSnapshot = {
  phase: "lobby" | "question" | "locked" | "revealed" | "ended";
  currentQuestionId: string | null;
  currentQuestion: {
    id: string;
    body: string;
    optionA: string;
    optionB: string;
  } | null;
  myAnswer: "A" | "B" | null;
  correctOption: "A" | "B" | null;    // populated when phase === 'revealed'
  distribution: { A: number; B: number } | null;  // NEW: populated when locked/revealed
  leaderboard: { name: string; score: number }[];  // NEW: populated when phase !== 'lobby'
};
```
Note: this type is also imported by `src/app/api/game/state/route.ts` (line 3) — the route's returned `snapshot` object must include the new fields to satisfy the type.

---

## Shared Patterns

### Server-Only Module Boundary
**Source:** `src/lib/supabase/admin.ts` line 1
**Apply to:** all new files in `src/app/api/host/*` and `src/lib/auth/host.ts`
```typescript
import "server-only";
```
Not needed in route handlers (Next.js route files are server-only by default), but required in any lib utility that must never reach the browser.

### adminClient Import
**Source:** `src/lib/supabase/admin.ts` line 43
**Apply to:** all six new/modified route handlers
```typescript
import { adminClient } from "@/lib/supabase/admin";
```
Never instantiate a new client per route. Use the singleton.

### broadcast Import
**Source:** `src/lib/supabase/admin.ts` lines 71–112
**Apply to:** `host/transition`, `host/reveal`, `host/reset`
```typescript
import { broadcast } from "@/lib/supabase/admin";
```
Signature: `broadcast(topic: string, event: string, payload: Record<string, unknown>): Promise<void>`
Throws on non-2xx; wrap in try/catch for best-effort (Claude's Discretion).

### Host Auth Guard
**Source:** `src/lib/auth/host.ts` (new, this phase)
**Apply to:** every handler in `src/app/api/host/*` — first thing in the function body
```typescript
if (!validateHostAuth(req)) {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
```

### UUID Validation
**Source:** `src/app/api/game/state/route.ts` lines 32–36
**Apply to:** all new route handlers that accept UUIDs in body/query params
```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(value: string | null): value is string {
  return value !== null && UUID_REGEX.test(value);
}
```

### 23505 Unique Violation → 409
**Source:** `src/app/api/skeleton-answer/route.ts` lines 91–93
**Apply to:** `game/answer/route.ts`
```typescript
if (answerError.code === "23505") {
  return NextResponse.json({ error: "already_answered" }, { status: 409 });
}
```

### GameEvent Type Assertion for Broadcasts
**Source:** `src/lib/realtime/events.ts` lines 14–22
**Apply to:** all broadcast calls in host routes
```typescript
import type { GameEvent } from "@/lib/realtime/events";
// Use `satisfies GameEvent` on the payload object to get exhaustiveness checking:
{ type: "ANSWERS_LOCKED", gameId, questionId } satisfies GameEvent
```

---

## No Analog Found

All files have close analogs in the codebase. No files require falling back to RESEARCH.md patterns exclusively.

---

## Critical Anti-Patterns (do not copy)

| File | Do NOT Copy | Copy Instead |
|------|-------------|--------------|
| `src/app/api/skeleton-answer/route.ts` line 27 | `const OPEN_PHASES = new Set(["lobby", "question"])` — Phase guard accepts lobby | For `game/answer`: `game.phase !== "question"` is the only open phase |
| `src/app/api/game/state/route.ts` line 121 | `const correctOption: "A" | "B" | null = null; // stub` | Replace with phase-gated `adminClient.from("questions")` read |
| `supabase/migrations/0003_reset_function.sql` lines 21–40 | `reset_game()` full wipe — deletes ALL answers, resets to lobby | `host/reset` must only delete answers for `current_question_id` (D-08) |
| Any CAS UPDATE | `.update().eq().single()` — throws PGRST116 on 0 rows | `.update().eq().eq().select()` then check `!updated || updated.length === 0` |

---

## Metadata

**Analog search scope:** `src/app/api/`, `src/lib/`, `src/hooks/`, `supabase/migrations/`
**Files read:** 8 (skeleton-answer route, state route, admin.ts, events.ts, reset migration, useGameSync hook, database.ts, migration listing)
**Pattern extraction date:** 2026-06-02
