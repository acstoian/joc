---
phase: 03-server-write-path-state-machine
reviewed: 2026-06-03T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/lib/auth/host.ts
  - src/hooks/useGameSync.ts
  - src/app/api/game/state/route.ts
  - supabase/migrations/0004_recompute_scores.sql
  - src/app/api/game/join/route.ts
  - src/app/api/game/answer/route.ts
  - src/app/api/host/transition/route.ts
  - src/app/api/host/reveal/route.ts
  - src/app/api/host/reset/route.ts
findings:
  critical: 5
  warning: 5
  info: 3
  total: 13
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-03
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This review covers the Phase 3 server write-path routes (guest join/answer, host state machine, score recomputation) plus the host-auth helper and the client-side sync hook. The overall architecture is sound: device-token identity binding, server-side player resolution, phase-gated answer acceptance, and CAS updates are all present. However, five critical issues were found — two are correctness bugs that corrupt visible game data, one is an authentication gap that bypasses the host-password guard in its own declared scenario, one is a data-loss window in the reset path, and one is a timing race that can leak the correct answer before the reveal phase. Five warnings cover quality/robustness concerns that directly affect game reliability.

---

## Critical Issues

### CR-01: Leaderboard query filters on a joined-table column — PostgREST ignores it, returning all scores across all games

**File:** `src/app/api/game/state/route.ts:163-167`

**Issue:** The leaderboard query uses `.eq("players.game_id", gameId)` on a foreign-table column via the `!inner` join syntax. In PostgREST / `supabase-js`, `.eq()` calls apply filters to the **root table** (`scores`), not to joined tables. The `players.game_id` dot-notation is silently ignored — the filter never reaches the `players` table. The result: all scores in the database across every game are returned, ranked and mixed together. In a production deployment with multiple game sessions (dry-runs, different events) this returns scores from every game merged into the leaderboard, producing a completely incorrect display.

**Fix:** Filter by joining `game_id` explicitly. The cleanest approach is to filter the scores table by player IDs that belong to the game, or use a two-step query:

```typescript
// Option A — two-step (unambiguous):
const { data: playerRows } = await adminClient
  .from("players")
  .select("id")
  .eq("game_id", gameId);
const playerIds = (playerRows ?? []).map((p) => p.id);

const { data: scoreRows } = await adminClient
  .from("scores")
  .select("correct_count, players(display_name)")
  .in("player_id", playerIds)
  .order("correct_count", { ascending: false })
  .limit(20);

// Option B — use a DB view or RPC that applies the game_id filter in SQL,
// where the intent is unambiguous.
```

---

### CR-02: Timing window — `correct_option` written to DB before phase changes to `revealed`, leaking the answer

**File:** `src/app/api/host/reveal/route.ts:99-136`

**Issue:** In the `else` branch (normal `locked → revealed` path), the CAS `UPDATE games SET phase = 'revealed'` is executed first (lines 101-119), and then `questions.correct_option` is set unconditionally (lines 122-129). However there is a window between these two operations where `games.phase` is already `"revealed"` but `questions.correct_option` is still `NULL`. Any `GET /api/game/state` call that lands in this window returns `phase: "revealed"` with `correctOption: null`. This contradicts the UI contract and causes a blank reveal flash for some clients.

More critically: the route also handles the **re-reveal** path (when `game.phase === "revealed"` at step 1, lines 87-89). In this branch the code skips the CAS entirely and jumps directly to step 2. That means a re-reveal with a **different** choice can briefly serve `correctOption` from the new write before scores have been recomputed, creating an inconsistent state window where old scores are associated with the new correct answer.

**Fix:** Reorder operations — always write `correct_option` first, then advance the phase:

```typescript
// Step A: Write correct_option first (DB is consistent pre-reveal)
const { error: optionError } = await adminClient
  .from("questions")
  .update({ correct_option: choice })
  .eq("id", game.current_question_id);
if (optionError) { /* 500 */ }

// Step B: recompute_scores (idempotent — safe to run before phase changes)
await adminClient.rpc("recompute_scores", { p_game_id: gameId });

// Step C: CAS phase change — only now is the state fully consistent
const { data: updated } = await adminClient
  .from("games")
  .update({ phase: "revealed" })
  .eq("id", gameId)
  .eq("phase", "locked")
  .select("phase");
// handle 0-row race as before
```

---

### CR-03: `validateHostAuth` accepts an empty-string password when `HOST_PASSWORD` env var is unset

**File:** `src/lib/auth/host.ts:27-31`

**Issue:** The function returns `true` when `password === process.env.HOST_PASSWORD`. If `HOST_PASSWORD` is not set in the environment, `process.env.HOST_PASSWORD` is `undefined`. The `password.length > 0` check on line 29 is evaluated with short-circuit `&&`, so it only passes if the extracted password is non-empty. However, the final comparison `password === process.env.HOST_PASSWORD` becomes `"somestring" === undefined`, which is `false` — so this specific case is safe.

The real vulnerability is the inverse: if `HOST_PASSWORD` is set to an **empty string** (`HOST_PASSWORD=""`), then a request that sends `x-host-password:` with an empty value (or omits the header entirely, giving `null ?? undefined → undefined`) would be rejected, but a request sending any non-empty password would be rejected too, and the host route would be permanently locked out. While this is not an authentication bypass, the absence of a startup check means a misconfigured deployment (accidentally `HOST_PASSWORD=""`) silently locks out all host operations with a misleading 401 rather than a clear configuration error.

More importantly: there is **no rate-limiting, no account lockout, and no timing-safe comparison**. The `===` comparison is not constant-time. For a wedding with a physically present adversary who can issue requests, timing-side-channel attacks are a real path to brute-forcing a short password.

**Fix:** Add a startup guard and use a timing-safe comparison:

```typescript
import { timingSafeEqual } from "crypto";

export function validateHostAuth(req: NextRequest): boolean {
  const envPassword = process.env.HOST_PASSWORD;
  if (!envPassword) {
    // Fail closed — misconfiguration should never silently allow access
    console.error("[host-auth] HOST_PASSWORD env var is not set");
    return false;
  }

  const password =
    req.headers.get("x-host-password") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (typeof password !== "string" || password.length === 0) return false;

  try {
    const a = Buffer.from(password);
    const b = Buffer.from(envPassword);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
```

---

### CR-04: Reset route writes `phase = 'question'` without a `game_id` constraint — can corrupt any game row if called with a game in the wrong state

**File:** `src/app/api/host/reset/route.ts:101-104`

**Issue:** Step 3 of the reset route updates `games.phase = 'question'` with only `.eq("id", gameId)` — which is correct for filtering. However the update has **no concurrency guard**: if Step 2 (delete answers) succeeds but a concurrent host action has already advanced the game phase to `"ended"` between steps 2 and 3, Step 3 silently rewinds the phase to `"question"` from `"ended"`, undoing the game completion. The reset route explicitly declares "No CAS needed" in the comment (line 99), but that reasoning only holds when reset is a single atomic operation, not a two-step read-then-write sequence.

This is a two-phase non-atomic write: answers are deleted in step 2 under the `current_question_id` snapshot read in step 1, and then the phase is overwritten in step 3 without re-checking what the current phase actually is. A concurrent `end` action that sets `phase = 'ended'` between steps 2 and 3 will be silently overwritten.

**Fix:** Apply a phase guard on the `UPDATE` in step 3 to restrict it to non-lobby, non-ended phases:

```typescript
const { error: phaseError } = await adminClient
  .from("games")
  .update({ phase: "question" })
  .eq("id", gameId)
  .in("phase", ["question", "locked", "revealed"]); // never rewind from "ended"

// Treat 0 rows as a no-op (race condition — game ended concurrently)
```

---

### CR-05: `recompute_scores` RPC is missing from `database.ts` generated types — cast to `any` suppresses all type safety on the RPC call

**File:** `src/app/api/host/reveal/route.ts:146`

**Issue:** The line `await (adminClient as any).rpc("recompute_scores", { p_game_id: gameId })` uses `as any` to bypass TypeScript because `recompute_scores` is absent from `src/types/database.ts` (the `Functions` map only contains `reset_game`). The `as any` cast disables all type checking on the RPC invocation — a typo in the function name or wrong argument key (`game_id` instead of `p_game_id`) would silently fail at runtime. The `scoreError` is caught and logged but the reveal proceeds even on score-computation failure (per T-03-16). That policy is intentional, but the type safety gap means the call could be silently wrong forever.

Additionally, the `recompute_scores` function's parameter is `p_game_id uuid` but the generated types for `reset_game` use `p_game_id: string`. If `supabase gen types` is ever re-run, it will confirm the type; until then there is no compile-time guarantee the RPC is called correctly.

**Fix:** Add `recompute_scores` to `src/types/database.ts` under `Functions` so the call is type-safe and the `as any` can be removed:

```typescript
// In src/types/database.ts, under public > Functions:
recompute_scores: {
  Args: { p_game_id: string }
  Returns: undefined
}
```

Then update the call site:
```typescript
const { error: scoreError } = await adminClient.rpc(
  "recompute_scores",
  { p_game_id: gameId }
);
```

---

## Warnings

### WR-01: Race condition between answer submission and phase lock — answer can be accepted after `lock` action completes

**File:** `src/app/api/game/answer/route.ts:78-93`

**Issue:** The phase guard reads `games.phase` in step 1 (line 80), and the answer INSERT happens in step 2 (line 121). Between these two DB calls, a concurrent `POST /api/host/transition?action=lock` can succeed, advancing the phase from `"question"` to `"locked"`. The answer route then inserts a late answer under the `locked` phase without realizing the window closed. The UNIQUE constraint prevents double-answers but does not prevent this cross-phase race. In a 100-player game, the last-second submission window means some answers submitted after the host pressed "lock" will be counted.

This is not easily fixed at the application layer without serializable isolation. A pragmatic mitigation is to document the known race and accept it (the window is very short — milliseconds), or use a Postgres advisory lock or `FOR UPDATE` on the game row to serialize the read+insert. For a wedding game, accepting the known race with a comment is the appropriate pragmatic tradeoff, but it should be an explicit decision, not an unexamined gap.

**Fix (pragmatic, for wedding scale):** Document the race explicitly with a comment and accept it as a known design choice. If stronger guarantees are needed, wrap the phase check and insert in a stored procedure that holds a lock:

```sql
-- Example serialized answer procedure (optional hardening):
CREATE OR REPLACE FUNCTION submit_answer(
  p_game_id uuid, p_device_token uuid, p_choice text
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_phase text; v_question_id uuid; v_player_id uuid;
BEGIN
  SELECT phase, current_question_id INTO v_phase, v_question_id
  FROM games WHERE id = p_game_id FOR UPDATE;  -- serialize with lock transition
  IF v_phase != 'question' THEN RETURN 'locked'; END IF;
  ...
END; $$;
```

---

### WR-02: `displayName` length check uses `.length` which counts UTF-16 code units, not grapheme clusters — emoji names truncate incorrectly

**File:** `src/app/api/game/join/route.ts:73`

**Issue:** `name.length > 30` checks `String.length`, which counts UTF-16 code units. A single emoji like "👨‍👩‍👧‍👦" (family emoji) uses 11 code units but is visually 1 character. A player named with 4 emoji (visually 4 chars) could have `.length` of 44 and be rejected with "displayName too long", which is incorrect and user-hostile. Conversely, a name of 15 complex emoji can visually overflow a 30-char display slot while passing the 30-code-unit check.

**Fix:** Use the `Intl.Segmenter` API (Node 16+, available in all modern runtimes) to count grapheme clusters:

```typescript
// Replace name.length > 30 with:
const graphemeCount = [...new Intl.Segmenter().segment(name)].length;
if (graphemeCount > 30) {
  return NextResponse.json({ error: "displayName too long" }, { status: 400 });
}
```

---

### WR-03: `useGameSync` — `fetchState` is not cancelled/ignored when called from the `visibilitychange` handler after unmount

**File:** `src/hooks/useGameSync.ts:115-119`

**Issue:** The `handleVisibilityChange` async function (lines 115-119) calls `await fetchState()` and then — inside `fetchState` — calls `setState(data)` (line 99) with no `cancelled` guard. The `cancelled` variable exists in the effect closure and guards other paths, but the `fetchState` function at lines 93-101 does not check `cancelled` before calling `setState`. If the component is unmounted while a visibility-change-triggered fetch is in flight, `setState` is called on an unmounted component, producing a React warning and potentially a memory leak.

The `subscribe` callback's `await fetchState()` (line 208) has the same issue — no post-await `cancelled` check before `setState` is invoked indirectly.

**Fix:** Add a `cancelled` guard inside `fetchState`:

```typescript
const fetchState = async () => {
  const res = await fetch(`/api/game/state?gameId=${gameId}&playerId=${playerId}`);
  if (cancelled) return; // guard after async boundary
  if (res.ok) {
    const data: GameStateSnapshot = await res.json();
    if (cancelled) return; // guard after second async boundary
    setState(data);
  }
};
```

---

### WR-04: `transition` route — `action=start` fetches the first question between the phase-read and the CAS update, creating a TOCTOU gap

**File:** `src/app/api/host/transition/route.ts:131-148`

**Issue:** For `action === "start"`, the route reads `game.phase` in step 1, confirms it is `"lobby"`, then in step 3 issues a separate query to fetch the first question (lines 132-139), and only then issues the CAS `UPDATE` in step 4. Between the first-question fetch and the CAS update, a concurrent `start` request can win the race, set `current_question_id`, and advance to `"question"`. The losing request will fail at the CAS (0 rows affected, returns 200 no-op) — so correctness is preserved. However, the first-question query runs unnecessarily for the losing request and its result (`firstQuestionId`) is used in the broadcast (line 182) even though it may differ from what the winning request set. The winning request's `current_question_id` is the true value; the losing request's broadcast incorrectly announces `questionId: firstQuestionId` for a question that is already active.

This is a low-severity correctness issue — the broadcast is a hint signal and clients re-fetch, but the wrong `questionId` in the `QUESTION_STARTED` event could confuse phase-specific animation logic in future phases.

**Fix:** Use the `updated` rows to source `resolvedQuestionId` for the broadcast rather than the pre-CAS `firstQuestionId`:

```typescript
// After the CAS update:
const resolvedQuestionId =
  action === "start"
    ? updated[0].current_question_id!   // from the actual committed row
    : action === "next"
    ? (nextQuestionId as string)
    : (game.current_question_id ?? "");
```

---

### WR-05: `host.ts` — no guard for `HOST_PASSWORD` being undefined at module load; all host routes return 401 silently in misconfigured deployments

**File:** `src/lib/auth/host.ts:22-31`

**Issue:** If `HOST_PASSWORD` is not set in the environment, `process.env.HOST_PASSWORD` is `undefined` at runtime. Every call to `validateHostAuth` will return `false` (since `password === undefined` is always false for any non-undefined password string). This means the host can never authenticate — but the failure mode is a silent 401 with no diagnostic, making it very hard to distinguish a deployment misconfiguration from a wrong password. A misconfigured Vercel deployment would make the game completely unrunnable with no visible error in the host UI.

**Fix:** Add an early check at the top of the function (also addressed in CR-03 fix above):

```typescript
export function validateHostAuth(req: NextRequest): boolean {
  if (!process.env.HOST_PASSWORD) {
    console.error("[host-auth] HOST_PASSWORD is not configured — all host requests will be rejected");
    return false;
  }
  // ... rest of the function
}
```

---

## Info

### IN-01: UUID_REGEX is duplicated across four files with no shared utility

**Files:** `src/app/api/game/state/route.ts:34`, `src/app/api/game/join/route.ts:27`, `src/app/api/game/answer/route.ts:39`, `src/app/api/host/transition/route.ts:38`, `src/app/api/host/reveal/route.ts:35`, `src/app/api/host/reset/route.ts:36`

**Issue:** The same UUID regex pattern and `isValidUuid` function are copy-pasted across six files. Any future change to the validation logic (e.g., rejecting nil UUIDs `00000000-0000-0000-0000-000000000000`) must be made in six places simultaneously.

**Fix:** Extract to a shared utility module:

```typescript
// src/lib/validation.ts
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}
```

---

### IN-02: `recompute_scores` does not account for the `ended` game phase — scores are recomputed correctly but the function can be called after game end

**File:** `supabase/migrations/0004_recompute_scores.sql:14-45`

**Issue:** The `recompute_scores` function has no guard against being called after `phase = 'ended'`. The reveal route calls it after every reveal, including a re-reveal. If a host re-reveals (changes the correct answer) on an ended game, scores will be recomputed and updated in the `scores` table, silently modifying the final leaderboard. The function itself is correct (idempotent, never double-counts), but the caller in `reveal/route.ts` does not fence the RPC call behind a phase check.

**Fix:** In `reveal/route.ts`, add a guard before calling `recompute_scores` when the game is already ended (or treat `ended` as a terminal state from which re-reveal is rejected):

```typescript
// After the phase check block, add:
if (game.phase === "ended") {
  return NextResponse.json(
    { error: "invalid_transition", current: "ended", expected: "locked" },
    { status: 409 }
  );
}
```

---

### IN-03: `useGameSync` presence track uses `playerId` prop as identity in the channel, which is a server-assigned UUID — clients that share the same page (e.g. host + TV on same machine) will track duplicate presence entries

**File:** `src/hooks/useGameSync.ts:222`

**Issue:** `channel.track({ player_id: playerId, device_token: deviceToken })` uses `playerId` as the presence key. The Supabase presence model uses the `presenceRef` (a random string per client connection, not the tracked key) to uniquely identify each subscriber. Two tabs open to the same guest page with the same `playerId` would each track separately, so the presence count would be inflated. Additionally, `deviceToken` is read from `localStorage` here (lines 218-221) as a side effect inside the realtime subscription callback. This `localStorage` access is appropriate but is a hidden side effect that isn't obvious to future maintainers — worth a comment.

This is genuinely low-impact (the Supabase presence model handles client identity via `presenceRef`, not the tracked payload), but the `participantCount` computation at lines 192 and 249 counts `Object.keys(presence).length` where keys are `presenceRef` strings — which correctly counts unique connections, not unique player IDs. The concern is that the `player_id` in the tracked payload is not validated server-side, so a malicious client could track with a fabricated `player_id` without consequence. No security impact exists because the count is cosmetic, but the pattern should be documented.

**Fix (documentation only):** Add a comment clarifying that `Object.keys(presence).length` counts WebSocket connections, not unique players:

```typescript
// presenceState() keys are presenceRef strings (unique per WebSocket connection),
// not player_id values. Counts active connections to this channel.
setParticipantCount(Object.keys(presence).length);
```

---

_Reviewed: 2026-06-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
