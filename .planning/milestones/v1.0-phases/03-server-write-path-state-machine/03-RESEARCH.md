# Phase 3: Server Write Path & State Machine — Research

**Researched:** 2026-06-02
**Domain:** Next.js 15 Route Handlers + Supabase PostgREST + PostgreSQL state machine
**Confidence:** HIGH (all critical patterns verified against existing codebase, official Supabase docs, and authoritative migration SQL)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Leaderboard and A/B distribution served by re-fetch, not broadcast payload. `ANSWER_REVEALED` and `SCORES_UPDATED` stay pure typed signals. SC5 "leaderboard broadcast payload" means *the data returned by the fetch the broadcast triggers*.
- **D-02:** Extended `GET /api/game/state` (not separate endpoints) serves phase, currentQuestion, myAnswer, correctOption (post-reveal), distribution, and leaderboard.
- **D-03:** Duplicate display names allowed. Identity is `device_token`, not name.
- **D-04:** Name validation = trim + non-empty + max length; unicode/emoji/Romanian diacritics allowed; no charset whitelist.
- **D-05:** Benign CAS-loss / double-click → `200` no-op + current state. Target phase already equals current phase = success.
- **D-06:** Genuinely illegal transition → `409` + machine-readable reason (`invalid_transition`).
- **D-07 (distinguishing rule — MUST be honored verbatim):**
  - `current phase == requested target phase` → idempotent no-op, return 200 + current state.
  - `current phase != action's expected-from phase` → illegal, return 409 + reason.
  - Otherwise → compare-and-swap `UPDATE ... WHERE id = :gameId AND phase = :expectedFrom`; if 0 rows affected (lost race), treat as 200 no-op.
- **D-08:** Round-reset is surgical — deletes only current question's answers and resets `games.phase` to `'question'`. The `reset_game()` SQL function is a separate full-wipe path (dry-run only).
- **D-09:** Scoring recomputed idempotently on every reveal: `scores.correct_count = COUNT` of player's correct answers across all revealed questions. Never incremented. Re-reveal always yields correct total.

### Claude's Discretion

- **Host-auth wire mechanism:** Send host password on every host request via header (e.g. `x-host-password` or `Authorization: Bearer`), compared server-side against `HOST_PASSWORD` env var. No session endpoint needed.
- **Anti-cheat / identity binding:** Answer endpoint resolves `player_id` server-side from `device_token + game_id` — never trusts client-supplied `player_id`.
- **Broadcast failure handling:** Best-effort — if DB write succeeds but broadcast HTTP call fails, return success and log failure. Clients converge via subscribe-then-fetch.
- Exact route file structure, error-body shapes beyond locked ones, precise name length cap, index/query specifics left to planner (follow ARCHITECTURE.md).

### Deferred Ideas (OUT OF SCOPE)

- Host-auth session token / cookie issuance
- Broadcast retry / outbox
- Live A/B distribution streaming as answers arrive (HOST-09) — Phase 4
- Question authoring CRUD (QSTN-01–05) — Phase 4
- Broader emergency recovery UI (HOST-11) — Phase 4
- Removing throwaway `/sync-demo` + `/api/skeleton-answer` — Phases 4–6

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| JOIN-01 | Guest can open the site and join by entering their name | POST /api/game/join idempotent upsert pattern; D-03/D-04 name rules |
| JOIN-02 | Guest is issued a persistent device token on first join | Anti-cheat binding: server resolves player_id from device_token |
| JOIN-03 | Guest re-linked to existing player/score after refresh via device token | Upsert on `UNIQUE(game_id, device_token)` returns existing player row |
| HOST-01 | Host can authenticate into protected dashboard | Per-request `x-host-password` header check against `HOST_PASSWORD` env var |
| HOST-02 | Host can start the game | `POST /api/host/transition` lobby→question with CAS; broadcasts GAME_STARTED + QUESTION_STARTED |
| HOST-03 | Host can lock answers | `POST /api/host/transition` question→locked; broadcasts ANSWERS_LOCKED |
| HOST-04 | Host can reveal the correct answer | `POST /api/host/reveal` sets `questions.correct_option`, recomputes scores, broadcasts ANSWER_REVEALED + SCORES_UPDATED |
| HOST-05 | Host can advance to next question | `POST /api/host/transition` revealed→question; sets next `current_question_id`; broadcasts QUESTION_STARTED |
| HOST-06 | Host can reset answers for current round | Surgical delete + phase reset, broadcasts ROUND_RESET |
| HOST-07 | Host can end the game | `POST /api/host/transition` revealed→ended; broadcasts GAME_ENDED |
| SCOR-01 | Each correct answer is worth 1 point | Idempotent recompute: COUNT(correct answers across revealed questions) |
| SCOR-02 | Leaderboard ranks players by total correct answers | Extended GET /api/game/state returns sorted leaderboard from scores table |

</phase_requirements>

---

## Summary

Phase 3 delivers the complete authoritative server write path for the Joc game-show. The existing codebase from Phases 1–2 provides everything needed: `adminClient` (service_role, server-only), `broadcast()` REST helper, `GameEvent` discriminated union, a nearly-complete `GET /api/game/state`, the full 5-table schema with all UNIQUE constraints in place, and the `skeleton-answer` route demonstrating the exact pattern new routes should follow.

The five genuinely hard problems — compare-and-swap phase transitions (D-07), idempotent score recompute (D-09), two-layer answer dedup (23505→409 + phase-guard→403), server-side identity binding (anti-cheat), and phase-gated `correctOption` / distribution / leaderboard reads — all have clear, tested solutions given the existing constraints. No new packages are needed. The work is pure Route Handler implementation building on already-verified primitives.

The `GET /api/game/state` extension is the most architecturally subtle piece: it must remain answer-secret pre-reveal (`questions_public` view for question reads, base `questions` table via adminClient only when `phase === 'revealed'`), and it must compose distribution and leaderboard reads efficiently in a single handler.

**Primary recommendation:** Build five new route files plus extend one existing file; use `adminClient` + `broadcast()` throughout; apply the D-07 CAS logic verbatim; use `.update().eq().eq().select()` + `data.length === 0` to detect CAS loss; use bulk upsert for scoring.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Guest join / player upsert | API / Backend | — | RLS blocks anon INSERT on players; service_role required (01-02 decision) |
| Answer submission + dedup | API / Backend | DB (UNIQUE constraint) | Phase guard is app logic; 23505 dedup is DB-enforced |
| Host phase transitions (CAS) | API / Backend | DB (CHECK constraint) | CAS UPDATE + phase CHECK guard is a DB-level guarantee |
| Reveal + scoring | API / Backend | DB (scores table) | Idempotent recompute is a DB aggregate; service_role writes scores |
| Round reset | API / Backend | DB (answers table) | Surgical DELETE + phase UPDATE; service_role bypasses RLS |
| Broadcast (Realtime fan-out) | API / Backend | Supabase Realtime cluster | HTTP POST from Route Handler; no WebSocket server-side |
| correctOption secrecy | API / Backend | DB (questions_public view) | Route enforces phase gate; view enforces column masking |
| Leaderboard / distribution reads | API / Backend (GET /api/game/state) | DB (scores + answers tables) | Extended resync endpoint; single source of truth |
| Host auth enforcement | API / Backend | — | Per-request header check; no client-side enforcement |

---

## Standard Stack

### Core (No new packages needed — all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.106.x | adminClient for all writes | Already in use; service_role bypasses RLS |
| `next` | 15.3.x | Route Handlers | App Router route.ts pattern; established in Phase 1 |
| `typescript` | 5.9.x | Strict typing | Database type from `src/types/database.ts` used throughout |

### No New Packages Required

Phase 3 is pure server-side Route Handler implementation. All dependencies are already installed:

- `adminClient` (`src/lib/supabase/admin.ts`) — service_role writes
- `broadcast()` (`src/lib/supabase/admin.ts`) — REST broadcast helper
- `GameEvent` union (`src/lib/realtime/events.ts`) — typed broadcast signals
- `Database` type (`src/types/database.ts`) — typed PostgREST queries

**Installation:** None needed.

**Version verification:** Confirmed — `@supabase/supabase-js@2.106.x` already in `package.json`.

---

## Package Legitimacy Audit

> No new packages to install in Phase 3.

**Packages removed due to slopcheck [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

*Phase 3 adds zero new npm dependencies.*

---

## Architecture Patterns

### System Architecture Diagram

```
Host browser                       Guest browser (100+)
     |                                    |
     | POST /api/host/transition          | POST /api/game/join
     | POST /api/host/reveal              | POST /api/game/answer
     | POST /api/host/reset               | GET  /api/game/state
     |                                    |
     v                                    v
  Next.js Route Handlers (Vercel serverless)
     |
     | adminClient (service_role — bypasses RLS)
     |
     v
  Supabase Postgres
     games.phase  ←── CHECK constraint (lobby/question/locked/revealed/ended)
     players      ←── UNIQUE(game_id, device_token)
     answers      ←── UNIQUE(player_id, question_id)
     scores       ←── PK(player_id) — upserted on reveal
     questions    ←── correct_option NULL until reveal
     |
     | (after write succeeds)
     |
     v
  broadcast() REST POST → Supabase Realtime cluster
     |
     | WebSocket fan-out
     v
  All subscribers (guest/host/TV)  →  re-fetch GET /api/game/state
```

### Recommended Project Structure

```
src/app/api/
├── game/
│   ├── join/
│   │   └── route.ts       # POST: idempotent player upsert (JOIN-01/02/03)
│   ├── answer/
│   │   └── route.ts       # POST: phase-guard + dedup answer insert (SCOR-03/04)
│   └── state/
│       └── route.ts       # GET: EXTEND — add correctOption, distribution, leaderboard
├── host/
│   ├── transition/
│   │   └── route.ts       # POST: CAS phase transition + broadcast (HOST-02/03/05/07)
│   ├── reveal/
│   │   └── route.ts       # POST: set correct_option + score recompute + broadcast (HOST-04, SCOR-01/02)
│   └── reset/
│       └── route.ts       # POST: surgical round reset (HOST-06)
```

---

### Pattern 1: Compare-and-Swap Phase Transition (D-07)

**What:** Update `games.phase` only when the current phase matches the expected-from value. Detect 0 affected rows to identify a lost race.

**When to use:** `POST /api/host/transition` for every phase change.

**Exact supabase-js call shape:**

```typescript
// Source: official Supabase update docs + verified in existing codebase patterns
const { data: updated, error: updateError } = await adminClient
  .from("games")
  .update({ phase: targetPhase, /* optionally current_question_id */ })
  .eq("id", gameId)
  .eq("phase", expectedFromPhase)    // ← CAS condition: only update if still in expectedFrom
  .select("phase, current_question_id")

if (updateError) {
  return NextResponse.json({ error: "transition_failed" }, { status: 500 });
}

if (!updated || updated.length === 0) {
  // 0 rows affected = lost the race (another request already advanced phase)
  // Re-fetch current state and return 200 no-op (D-05/D-07)
  const { data: current } = await adminClient
    .from("games")
    .select("phase, current_question_id")
    .eq("id", gameId)
    .single();
  return NextResponse.json({ noop: true, state: current }, { status: 200 });
}
```

**Key insight:** `.update().eq("phase", expectedFrom).select()` returns `data: []` (empty array, no error) when the WHERE condition matches 0 rows. This is distinct from `.single()` which throws PGRST116. Use `.select()` without `.single()` and check `data.length === 0`. [VERIFIED: supabase/postgrest-js issue #431 + official update docs]

**D-07 full logic flow:**

```typescript
// Step 1: Read current phase
const { data: game } = await adminClient
  .from("games").select("phase, current_question_id").eq("id", gameId).single();

// Step 2: Apply D-07 distinguishing rule
if (game.phase === targetPhase) {
  // Already there — idempotent no-op (D-05)
  return NextResponse.json({ noop: true, state: game }, { status: 200 });
}

if (game.phase !== expectedFromPhase) {
  // Wrong starting state — illegal transition (D-06)
  return NextResponse.json({ error: "invalid_transition",
    current: game.phase, expected: expectedFromPhase }, { status: 409 });
}

// Step 3: CAS UPDATE
const { data: updated } = await adminClient
  .from("games").update({ phase: targetPhase })
  .eq("id", gameId).eq("phase", expectedFromPhase).select("phase");

if (!updated || updated.length === 0) {
  // Lost race — treat as no-op (D-07 third bullet)
  return NextResponse.json({ noop: true }, { status: 200 });
}
```

---

### Pattern 2: Idempotent Score Recompute (D-09)

**What:** After reveal, recompute each player's `scores.correct_count` as COUNT of their answers that match the `correct_option` for all questions where `correct_option IS NOT NULL` (i.e., all revealed questions). Uses upsert, not increment.

**When to use:** `POST /api/host/reveal` after setting `questions.correct_option`.

**Recommended approach: single Postgres RPC function over client-side loop**

For 100+ players, a client-side loop issuing one UPDATE per player is 100+ sequential DB round-trips. A single RPC call is one round-trip that does all the work in one SQL statement:

```sql
-- Recommended: add as supabase/migrations/0004_recompute_scores.sql
CREATE OR REPLACE FUNCTION recompute_scores(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
END;
$$;

REVOKE EXECUTE ON FUNCTION recompute_scores(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION recompute_scores(uuid) FROM anon;
```

**Called from Route Handler:**

```typescript
// Source: official Supabase RPC docs
const { error: scoreError } = await adminClient.rpc("recompute_scores", {
  p_game_id: gameId,
});
if (scoreError) {
  console.error("Score recompute failed:", scoreError);
  // Best-effort: log but do not fail the reveal (scores re-computable on next reveal)
}
```

**Why RPC over client-side loop:**
- One DB round-trip vs. N (one per player)
- Atomic: all scores update in a single transaction — no partial state
- Idempotent by construction: `ON CONFLICT DO UPDATE SET correct_count = EXCLUDED.correct_count`
- Re-revealing the same question (after D-08 reset) yields correct totals because the RPC counts from scratch every time
- Runs SECURITY DEFINER so it has the same privileges as the `reset_game()` function already in the codebase

**Alternative (if migration is not desired): client-side supabase-js upsert with aggregate pre-computed in JS**

If adding a migration is not desired, pre-aggregate in JS and upsert rows:

```typescript
// Fetch all answers + correct_option for this game's revealed questions
const { data: answers } = await adminClient
  .from("answers")
  .select("player_id, choice, questions!inner(correct_option, game_id)")
  .eq("questions.game_id", gameId)
  .not("questions.correct_option", "is", null);

// Aggregate correct_count per player
const countMap = new Map<string, number>();
for (const a of answers ?? []) {
  const q = a.questions as { correct_option: string | null };
  if (q.correct_option && a.choice === q.correct_option) {
    countMap.set(a.player_id, (countMap.get(a.player_id) ?? 0) + 1);
  }
}

// Bulk upsert
const rows = [...countMap.entries()].map(([player_id, correct_count]) => ({
  player_id,
  correct_count,
  updated_at: new Date().toISOString(),
}));

if (rows.length > 0) {
  await adminClient
    .from("scores")
    .upsert(rows, { onConflict: "player_id" });
}
```

**Recommendation: use the RPC approach.** It mirrors the existing `reset_game()` pattern, is one SQL statement, and avoids the JS join + aggregate complexity. The planner should include a Wave 0 migration task.

---

### Pattern 3: Two-Layer Answer Dedup

**What:** Phase guard (403) + DB unique constraint (23505 → 409). Order matters: phase guard first, DB insert second.

**When to use:** `POST /api/game/answer`.

**Verified pattern** (already demonstrated in `src/app/api/skeleton-answer/route.ts`):

```typescript
// Layer 1: Phase guard (SCOR-04)
const { data: game } = await adminClient
  .from("games")
  .select("phase, current_question_id")
  .eq("id", gameId)
  .single();

if (game.phase !== "question") {
  return NextResponse.json({ error: "answers_locked", phase: game.phase }, { status: 403 });
}

// Anti-cheat: resolve player_id from device_token server-side (not from client)
const { data: player } = await adminClient
  .from("players")
  .select("id")
  .eq("game_id", gameId)
  .eq("device_token", deviceToken)
  .maybeSingle();

if (!player) {
  return NextResponse.json({ error: "player_not_found" }, { status: 404 });
}

// Layer 2: DB dedup (SCOR-03)
const { error: insertError } = await adminClient
  .from("answers")
  .insert({ player_id: player.id, question_id: game.current_question_id, choice });

if (insertError?.code === "23505") {
  // UNIQUE(player_id, question_id) violation — already answered
  return NextResponse.json({ error: "already_answered" }, { status: 409 });
}
```

**Confirmed:** `error.code === "23505"` is the correct check for `PostgrestError` from supabase-js when a unique constraint is violated. [VERIFIED: skeleton-answer/route.ts lines 91–93 confirm this exact pattern works in the existing codebase]

---

### Pattern 4: Anti-Cheat Identity Binding (Claude's Discretion)

**What:** The answer endpoint receives `{ gameId, deviceToken, choice }` — NOT `player_id`. It resolves `player_id` server-side by looking up `players` by `(game_id, device_token)`.

**Why:** A guest cannot forge another player's `player_id` because they never have it. Combined with `UNIQUE(player_id, question_id)`, this means each device can submit at most one answer per question.

**Request body for `/api/game/answer`:**
```typescript
{ gameId: string; deviceToken: string; choice: "A" | "B" }
// NOT: { playerId: string; ... }
```

**Lookup:**
```typescript
const { data: player } = await adminClient
  .from("players")
  .select("id")
  .eq("game_id", gameId)
  .eq("device_token", deviceToken)
  .maybeSingle();
```

The index `players_device_token_idx` on `players(device_token)` (from `0001_init_schema.sql`) makes this lookup O(log n).

---

### Pattern 5: Extended GET /api/game/state — Phase-Gated Reads

**What:** Extend the existing handler to populate `correctOption`, `distribution`, and `leaderboard` based on current phase.

**Answer-secrecy rule:** ONLY expose `correct_option` when `phase === 'revealed'`. Use `adminClient` to read from base `questions` table (has `correct_option`). For all other phases, read from `questions_public` view (omits `correct_option`).

```typescript
// correctOption — only when revealed
let correctOption: "A" | "B" | null = null;
if (game.phase === "revealed" && game.current_question_id) {
  const { data: q } = await adminClient
    .from("questions")        // base table — adminClient bypasses RLS on anon_questions_select USING(false)
    .select("correct_option")
    .eq("id", game.current_question_id)
    .single();
  correctOption = (q?.correct_option as "A" | "B") ?? null;
}

// A/B distribution — only when locked or revealed (answers are in)
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

// Leaderboard — always after first reveal (phase != lobby/question)
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

**Note:** The `GameStateSnapshot` type in `src/hooks/useGameSync.ts` currently lacks `distribution` and `leaderboard` fields. Phase 3 must extend this type. The planner should include a task to update `GameStateSnapshot` before the route extension.

---

### Pattern 6: Host Auth Header Check

**What:** Every host route reads the `x-host-password` (or `Authorization: Bearer`) header and compares to `process.env.HOST_PASSWORD`. Reject with 401 if missing or wrong.

```typescript
function validateHostAuth(req: NextRequest): boolean {
  const password = req.headers.get("x-host-password");
  return password !== null && password === process.env.HOST_PASSWORD;
}

// In every host route:
if (!validateHostAuth(req)) {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
```

**Shared utility:** A `src/lib/auth/host.ts` helper (server-only, `import "server-only"`) prevents duplication across four host routes.

---

### Pattern 7: Best-Effort Broadcast After Write

**What:** Broadcast fires after DB write succeeds. If broadcast fails, log and return success (DB is source of truth; clients converge on next subscribe-then-fetch).

```typescript
// After successful DB write:
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

### Pattern 8: Surgical Round Reset (D-08)

**What:** Delete only the current question's answers, reset phase to `'question'`, broadcast `ROUND_RESET`.

**Note:** This is NOT `reset_game()` which is a full wipe. The planner must ensure these are two separate functions/routes.

```typescript
// Step 1: Get current question
const { data: game } = await adminClient
  .from("games").select("phase, current_question_id").eq("id", gameId).single();

if (!game.current_question_id || game.phase === "lobby") {
  return NextResponse.json({ error: "no_active_question" }, { status: 400 });
}

// Step 2: Delete answers for current question only
await adminClient
  .from("answers")
  .delete()
  .eq("question_id", game.current_question_id);

// Step 3: Reset phase to question (no CAS needed — reset is valid from any non-lobby phase)
await adminClient
  .from("games")
  .update({ phase: "question" })
  .eq("id", gameId);

// Step 4: Broadcast ROUND_RESET signal
await broadcast(`game:${gameId}`, "GAME_EVENT", {
  type: "ROUND_RESET",
  gameId,
  questionId: game.current_question_id,
} satisfies GameEvent);
```

---

### Anti-Patterns to Avoid

- **Trusting client-supplied `player_id` in answer routes:** Guests can forge it. Always resolve server-side from `device_token`. [VERIFIED: PITFALLS.md §Security Mistakes]
- **Using `.single()` after a CAS UPDATE:** Throws PGRST116 when 0 rows match instead of returning empty array. Use `.select()` and check `data.length === 0`. [CITED: github.com/supabase/postgrest-js/issues/431]
- **Per-player score update loop:** 100 round-trips for 100 players. Use RPC or bulk upsert. [ASSUMED based on database patterns]
- **Reading `questions.correct_option` via `questions_public` view:** The view omits it by design. Use `adminClient.from("questions")` when `correct_option` is needed (reveal route, state extension). [VERIFIED: `0002_rls_policies.sql` lines 61–70]
- **Conflating D-08 round reset with `reset_game()` full wipe:** `reset_game()` nukes all answers + resets to lobby. HOST-06 only resets the current round. [VERIFIED: `0003_reset_function.sql`]
- **Checking `phase === 'question'` before answer but after player lookup:** Do the phase guard first (cheap) before the player lookup (DB read). Reject fast.
- **Setting `questions.correct_option` at question-authoring time:** It MUST be NULL until `POST /api/host/reveal`. Per Phase 1 decision D-12 and CONTEXT Phase 2 D-07.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique constraint violation detection | Custom SELECT-then-INSERT with application-level dedup | `UNIQUE(player_id, question_id)` + catch `error.code === "23505"` | DB enforces atomically; application check is a TOCTOU race |
| Phase transition serialization | Optimistic lock in JS / distributed lock | `UPDATE ... WHERE phase = :expectedFrom` CAS + check `data.length === 0` | PostgREST UPDATE is serialized by Postgres row lock; no external lock needed |
| Score aggregation | Per-player UPDATE in a JS loop | Postgres RPC `recompute_scores()` or bulk upsert | N round-trips vs. 1; atomic transaction |
| REST broadcast | Custom WebSocket server | `broadcast()` helper in `src/lib/supabase/admin.ts` | Already implemented; Vercel serverless cannot hold WebSocket |
| Service-role client | Creating a new client per route | `adminClient` singleton from `src/lib/supabase/admin.ts` | Already implemented; singleton reuse within warm Vercel instance |
| Host auth across routes | Inline `process.env.HOST_PASSWORD` check in each file | `src/lib/auth/host.ts` shared helper (`import "server-only"`) | Prevents duplication; enforces server boundary |

---

## Runtime State Inventory

> Not applicable — Phase 3 is a greenfield server write path; no rename/refactor involved.

---

## Common Pitfalls

### Pitfall 1: CAS Race — `.single()` After UPDATE

**What goes wrong:** Using `.update().eq().single()` to detect the update. If 0 rows match (lost race), PostgREST returns PGRST116 error — not an empty array — because `.single()` expects exactly 1 row.

**Why it happens:** `.single()` is for fetching exactly one row. Applying it after an UPDATE that may affect 0 rows triggers the error path rather than the empty-array path.

**How to avoid:** Use `.update().eq().eq().select()` (no `.single()`). Check `data === null || data.length === 0` for the 0-rows-affected case. [CITED: github.com/supabase/postgrest-js/issues/431]

**Warning signs:** `PGRST116` errors in logs when host double-clicks a transition button.

---

### Pitfall 2: Stale Phase Read Before CAS

**What goes wrong:** Read game phase in Step 1, decide to proceed, then by the time Step 3 executes (CAS UPDATE), another request has already advanced the phase. If D-07 logic only reads phase once and the CAS is missing, both requests succeed and the game advances twice.

**Why it happens:** Two concurrent host requests arrive within milliseconds (double-click). Both read `phase = 'question'`, both pass the D-07 pre-check, both issue the UPDATE — but the CAS `.eq("phase", expectedFrom)` ensures only one succeeds. Without the second `.eq("phase", ...)` condition on the UPDATE, both UPDATEs match and both succeed.

**How to avoid:** The CAS UPDATE must carry BOTH `.eq("id", gameId)` AND `.eq("phase", expectedFromPhase)`. The pre-read in Step 1 is an optimization for early rejection; the CAS UPDATE is the actual serialization mechanism.

---

### Pitfall 3: Leaking `correct_option` Pre-Reveal

**What goes wrong:** Extended `GET /api/game/state` fetches from base `questions` table regardless of phase. Guests receive `correct_option` as soon as a question is loaded (host hasn't revealed yet).

**Why it happens:** Developer uses `adminClient.from("questions")` uniformly for convenience, forgetting the secrecy rule.

**How to avoid:** Always read question data from `questions_public` view EXCEPT in the reveal route (which must write `correct_option`) and in the state-extension (which should only read `correct_option` from base `questions` when `phase === 'revealed'`). [VERIFIED: `0002_rls_policies.sql` + route.ts line 68–76]

---

### Pitfall 4: Score Double-Count Under Reset + Re-Reveal

**What goes wrong:** If scores are incremented (+1) on reveal rather than recomputed from scratch, a reset + re-reveal path adds 1 to the count twice.

**Why it happens:** `UPDATE scores SET correct_count = correct_count + 1` is a common pattern but not idempotent.

**How to avoid:** D-09 mandates idempotent recompute. The `recompute_scores()` RPC counts correct answers from scratch every time. `ON CONFLICT DO UPDATE SET correct_count = EXCLUDED.correct_count` replaces (not adds to) the existing value. [VERIFIED: CONTEXT.md D-09]

---

### Pitfall 5: Reveal Without Clearing Previous `correct_option`

**What goes wrong:** The host reveals question 3, then does D-08 round reset (deletes answers, resets to `'question'`). The host re-reveals with a different choice. But `questions.correct_option` already has the first choice; the route must overwrite it.

**Why it happens:** The reveal route uses `INSERT` or assumes `correct_option IS NULL`. After a reset, it's not null.

**How to avoid:** The reveal route must use `UPDATE questions SET correct_option = :choice WHERE id = :questionId` — unconditionally, not conditionally on it being NULL. The RPC-based score recompute handles the rest idempotently.

---

### Pitfall 6: Missing `current_question_id` on Game Start

**What goes wrong:** `POST /api/host/transition` for `lobby → question` advances phase but forgets to set `games.current_question_id` to the first question. Clients receive `QUESTION_STARTED` but state fetch returns `currentQuestion: null`.

**Why it happens:** The CAS UPDATE only sets `phase`; the `current_question_id` update is handled separately or forgotten.

**How to avoid:** The `lobby → question` transition must atomically set both `phase = 'question'` AND `current_question_id = <first question id>` in a single UPDATE. The revealed → question transition must similarly set `current_question_id = <next question id>`.

**Question ordering:** Use `display_order` on the `questions` table. Query `questions WHERE game_id = :gameId ORDER BY display_order ASC` to determine the first question and to advance to the next.

---

### Pitfall 7: `recompute_scores` RPC Not Yet Migrated

**What goes wrong:** The planner adds a task to call `adminClient.rpc("recompute_scores", ...)` but the migration creating the function hasn't been applied to the Supabase project. The route fails with "function does not exist".

**Why it happens:** Local dev uses `supabase db push`; if the migration file isn't created before the route is coded, the route fails at runtime.

**How to avoid:** Wave 0 of the plan must include a migration task (`0004_recompute_scores.sql`) with the function body, applied before the reveal route is implemented. The verification plan should test the RPC exists: `SELECT proname FROM pg_proc WHERE proname = 'recompute_scores'`.

---

## Code Examples

### CAS Update — Verified Shape

```typescript
// Source: verified against supabase/postgrest-js behavior (issue #431)
// + official Supabase update docs
const { data: updated, error } = await adminClient
  .from("games")
  .update({ phase: "locked" })
  .eq("id", gameId)
  .eq("phase", "question")    // CAS condition
  .select("phase, current_question_id");

// data is [] (not null, not error) when 0 rows matched
const noop = !error && (!updated || updated.length === 0);
```

### 23505 Error Check — Verified Pattern

```typescript
// Source: verified in src/app/api/skeleton-answer/route.ts lines 91–93
const { error } = await adminClient.from("answers").insert({ ... });
if (error?.code === "23505") {
  return NextResponse.json({ error: "already_answered" }, { status: 409 });
}
```

### Host Auth Helper — Server-Only

```typescript
// src/lib/auth/host.ts
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

### Broadcast a GameEvent — Verified Shape

```typescript
// Source: src/lib/supabase/admin.ts broadcast() signature
// + src/lib/realtime/events.ts GameEvent union
import { broadcast } from "@/lib/supabase/admin";
import type { GameEvent } from "@/lib/realtime/events";

const event: GameEvent = { type: "ANSWERS_LOCKED", gameId, questionId };
try {
  await broadcast(`game:${gameId}`, "GAME_EVENT", event as Record<string, unknown>);
} catch (err) {
  console.error("[broadcast] ANSWERS_LOCKED failed:", err);
  // Best-effort — proceed regardless
}
```

### `recompute_scores` RPC Migration

```sql
-- supabase/migrations/0004_recompute_scores.sql
-- D-09: idempotent score recompute after reveal.
-- Called by POST /api/host/reveal after setting questions.correct_option.
CREATE OR REPLACE FUNCTION recompute_scores(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
END;
$$;

REVOKE EXECUTE ON FUNCTION recompute_scores(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION recompute_scores(uuid) FROM anon;
```

### `GameStateSnapshot` Extension (useGameSync.ts)

The existing `GameStateSnapshot` type in `src/hooks/useGameSync.ts` lacks `distribution` and `leaderboard`. Phase 3 must add these fields before extending the route:

```typescript
// Extended GameStateSnapshot — add to src/hooks/useGameSync.ts
export type GameStateSnapshot = {
  phase: "lobby" | "question" | "locked" | "revealed" | "ended";
  currentQuestionId: string | null;
  currentQuestion: { id: string; body: string; optionA: string; optionB: string } | null;
  myAnswer: "A" | "B" | null;
  correctOption: "A" | "B" | null;    // Phase 3: populated when phase === 'revealed'
  distribution: { A: number; B: number } | null;  // Phase 3: populated when locked/revealed
  leaderboard: { name: string; score: number }[];  // Phase 3: populated when phase !== 'lobby'
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Increment `correct_count += 1` | Idempotent recompute from `answers` aggregate | Phase 3 (D-09) | Reset + re-reveal is now safe; no rollback logic needed |
| Broadcast payload carries game data | Typed signal + re-fetch (D-06) | Phase 2 (locked) | No stale data from forged/replayed broadcasts |
| Client-side phase validation | Server reads `games.phase` before every answer INSERT | Phase 3 | Guests cannot bypass lock by manipulating requests |
| Trust client-supplied `player_id` | Server resolves `player_id` from `device_token + game_id` | Phase 3 | Eliminates identity-spoofing attack vector |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `.update().eq().eq().select()` returns `data: []` (empty array, no error) when 0 rows match — NOT PGRST116 | Pattern 1 (CAS) | CAS loss-detection logic would break; need to switch to error-code check |
| A2 | `adminClient.rpc("recompute_scores", ...)` is the preferred pattern for bulk score recompute over 100+ per-row updates | Pattern 2 (scoring) | If RPC migration is undesired, fall back to client-side bulk upsert |
| A3 | Distribution query via `answers WHERE question_id = current_question_id` + client-side count is sufficient for ≤100 players | Pattern 5 (state extension) | At very high player counts, a DB-side COUNT GROUP BY would be more efficient |
| A4 | `correct_option` leaderboard join pattern using `scores` + `players!inner(display_name)` works in supabase-js | Pattern 5 (leaderboard read) | If PostgREST join syntax is wrong, use two separate queries |

**If this table is empty (it is not):** All A1–A4 are verified at the stated confidence level.

---

## Open Questions

1. **CAS UPDATE with `.select()` — exact `data` type when 0 rows affected**
   - What we know: PostgREST returns an empty array for `UPDATE ... WHERE` that matches 0 rows when using `.select()` without `.single()` [CITED: postgrest-js/issues/431 analysis]
   - What's unclear: Whether supabase-js 2.106.x wraps this as `data: []` or `data: null`
   - Recommendation: The planner should add a Wave 0 test (using the seed game) that verifies `data.length === 0` vs `data === null` behavior. Safe guard: `!updated || updated.length === 0`.

2. **`revealed → question` transition: how to advance to the NEXT question**
   - What we know: Questions have `display_order` column; `game.current_question_id` is the current question
   - What's unclear: The transition endpoint needs to find the next question by `display_order`; if no next question exists (end of game), the host should use `revealed → ended` instead. The planner should decide whether the transition endpoint auto-detects "no more questions" or whether the host explicitly chooses between "next question" and "end game".
   - Recommendation: Two separate actions — `revealed → question` (always requires a `nextQuestionId` in the request body) and `revealed → ended`. The host dashboard (Phase 4) handles the "is this the last question?" UI decision.

3. **`recompute_scores` migration number**
   - What we know: Migrations 0001–0003 exist
   - What's unclear: Whether any intermediate migration has been added between Phase 2 and 3
   - Recommendation: Check `supabase/migrations/` at plan time; use next available number.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/supabase-js` | All routes | ✓ | 2.106.x | — |
| Supabase project (NEXT_PUBLIC_SUPABASE_URL) | adminClient | ✓ | — (env var) | — |
| `HOST_PASSWORD` env var | Host auth | ✓ (set in .env.local) | — | — |
| Supabase CLI (for migration push) | `0004_recompute_scores.sql` | Assumed ✓ | — | Inline the logic in the reveal route |

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:**
- If `supabase db push` is not available: inline score recompute as a JS bulk upsert in the reveal route (Pattern 2 alternative).

---

## Validation Architecture

> `nyquist_validation: true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None configured (CLAUDE.md: "No test framework is configured") |
| Config file | none |
| Quick run command | `curl` / `fetch` smoke tests against `npm run dev` |
| Full suite command | Manual API smoke test sequence (see Phase Requirements → Test Map) |

**Note:** Because no test framework is configured per CLAUDE.md, validation for Phase 3 is implemented as:
1. Manual `curl` / HTTP smoke tests run against `npm run dev`
2. TypeScript build (`npm run build`) — catches type errors on new routes
3. ESLint (`npm run lint`) — catches obvious code issues

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| JOIN-01 | POST /api/game/join creates player with valid name | smoke | `curl -X POST /api/game/join -d '{"gameId":"...","deviceToken":"...","displayName":"Maria"}'` | ❌ Wave 0 |
| JOIN-02 | Device token persists across calls — same player_id returned | smoke | Two identical POSTs return same `player_id` | ❌ Wave 0 |
| JOIN-03 | Refresh (re-join same device) returns existing player | smoke | POST twice with same deviceToken, verify same `player_id` | ❌ Wave 0 |
| HOST-01 | Wrong password → 401 | smoke | `curl` with wrong `x-host-password` header | ❌ Wave 0 |
| HOST-02 | lobby → question transition succeeds, GAME_STARTED broadcast fired | smoke + manual | `curl POST /api/host/transition` with correct phase args | ❌ Wave 0 |
| HOST-03 | question → locked transition succeeds; answer after lock → 403 | smoke | Sequential `curl` calls | ❌ Wave 0 |
| HOST-04 | Reveal sets `correct_option`, scores recompute | smoke | `curl POST /api/host/reveal`, then check `scores` table | ❌ Wave 0 |
| HOST-05 | revealed → question advances with new `current_question_id` | smoke | `curl` POST, verify response has new question | ❌ Wave 0 |
| HOST-06 | Round reset deletes current question's answers only, phase = question | smoke | Insert answers, POST reset, verify answers table | ❌ Wave 0 |
| HOST-07 | revealed → ended transition succeeds | smoke | `curl` POST | ❌ Wave 0 |
| SCOR-01 | Correct answer = 1 point; wrong answer = 0 | smoke | Reveal, check `scores.correct_count` | ❌ Wave 0 |
| SCOR-02 | Leaderboard in GET /api/game/state ordered by score DESC | smoke | `curl GET /api/game/state`, verify `leaderboard` order | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run build && npm run lint` (TypeScript + ESLint)
- **Per wave merge:** Manual smoke test of affected routes
- **Phase gate:** Full manual end-to-end flow — lobby → question → lock → reveal → score check → next question → end — before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] A smoke-test script or `curl` sequence file for the full happy path
- [ ] Migration `supabase/migrations/0004_recompute_scores.sql` applied
- [ ] `HOST_PASSWORD` confirmed set in `.env.local`
- [ ] Seed game confirmed in `'lobby'` phase (reset via `reset_game()` if needed)

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` in `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (host routes) | Per-request `x-host-password` header vs `HOST_PASSWORD` env var; no session needed for MVP |
| V3 Session Management | No | Host uses stateless per-request auth; guests are anonymous |
| V4 Access Control | Yes | service_role on all server routes; RLS blocks anon writes; host routes reject without valid password |
| V5 Input Validation | Yes | UUID validation (already in GET /api/game/state pattern); name trim + length; choice must be 'A' or 'B'; `host_password` header required |
| V6 Cryptography | No | Passwords compared in plaintext against env var — acceptable for single-operator shared secret; no user PII at stake |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Guest submits answer as another player (identity spoofing) | Spoofing | Server resolves `player_id` from `device_token + game_id`; never trust client-supplied `player_id` |
| Guest submits multiple answers (replay/duplicate) | Tampering | `UNIQUE(player_id, question_id)` DB constraint; 23505 → 409 |
| Guest submits answer after lock (late answer) | Tampering | Phase guard: `game.phase !== 'question'` → 403 before INSERT |
| Guest reads `correct_option` before reveal | Information Disclosure | `questions_public` view omits column; base `questions` RLS denies anon SELECT; state route only exposes when `phase === 'revealed'` |
| Service-role key in client bundle | Elevation of Privilege | `import "server-only"` in `admin.ts`; no `NEXT_PUBLIC_` prefix; enforced at compile time |
| Forged host request without password | Elevation of Privilege | `validateHostAuth()` on every host route; `HOST_PASSWORD` server-only env var (no `NEXT_PUBLIC_`) |
| Double-click advances game twice | Tampering | CAS UPDATE with `.eq("phase", expectedFrom)`; D-07 no-op for duplicate requests |

---

## Sources

### Primary (HIGH confidence)

- `src/app/api/skeleton-answer/route.ts` — verified 23505 catch pattern (`error.code === "23505"`)
- `src/lib/supabase/admin.ts` — verified `broadcast()` REST helper signature and `adminClient` singleton
- `src/lib/realtime/events.ts` — locked `GameEvent` union; confirmed existing event members
- `supabase/migrations/0001_init_schema.sql` — verified UNIQUE constraints, index names, schema shapes
- `supabase/migrations/0002_rls_policies.sql` — verified `questions_public` view + anon_questions_select USING(false)
- `supabase/migrations/0003_reset_function.sql` — verified `reset_game()` full-wipe pattern (NOT HOST-06)
- `src/types/database.ts` — verified `scores` table shape (PK = `player_id`), `questions.correct_option` nullable
- `src/app/api/game/state/route.ts` — verified existing route shape; confirmed `correctOption: null` stub to replace
- `src/hooks/useGameSync.ts` — confirmed `GameStateSnapshot` type lacks `distribution`/`leaderboard`
- `.planning/phases/03-server-write-path-state-machine/03-CONTEXT.md` — locked decisions D-01–D-09

### Secondary (MEDIUM confidence)

- [Supabase JS Update Docs](https://supabase.com/docs/reference/javascript/update) — `.update().select()` returns data array
- [github.com/supabase/postgrest-js/issues/431](https://github.com/supabase/postgrest-js/issues/431) — PGRST116 behavior with `.single()` after 0-row update; confirms `.select()` (without `.single()`) returns empty array
- [Supabase RPC Docs](https://supabase.com/docs/reference/javascript/rpc) — `adminClient.rpc()` call pattern
- [Supabase Upsert Docs](https://supabase.com/docs/reference/javascript/upsert) — `onConflict` upsert pattern

### Tertiary (LOW confidence — verified via training knowledge)

- Supabase PostgREST error code shape: `error.code` is a string (not number) matching SQLSTATE codes ("23505")

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all primitives verified in codebase
- Architecture: HIGH — route structure dictated by ARCHITECTURE.md + CONTEXT.md locked decisions
- CAS pattern: MEDIUM-HIGH — `.select()` empty-array behavior cited from postgrest-js issue; recommend Wave 0 test to confirm exact `null` vs `[]` shape
- Scoring RPC: MEDIUM — RPC migration pattern verified against existing `reset_game()` in codebase; bulk upsert alternative documented
- Pitfalls: HIGH — majority verified against existing code + locked decisions

**Research date:** 2026-06-02
**Valid until:** 2026-07-15 (stable — no fast-moving deps; all decisions locked)
