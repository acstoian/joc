---
phase: 04-host-dashboard
reviewed: 2026-06-04T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/app/api/host/transition/route.ts
  - src/components/host/EmergencyPanel.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 4: Code Review Report (gap-closure 04-06 / GAP-04-01 / HOST-11)

**Reviewed:** 2026-06-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

> Scope note: this REVIEW.md is the focused re-review of the 04-06 gap-closure changes
> (the `reset_game` action on `POST /api/host/transition` and the "Joc Nou / Reseteaza
> Jocul" control in `EmergencyPanel`). It supersedes the earlier full-phase REVIEW for
> these two files.

## Summary

Reviewed the gap-closure 04-06 changes (GAP-04-01 / HOST-11): the new `reset_game`
action on `POST /api/host/transition` and the confirm-gated "Joc Nou / Reseteaza Jocul"
control in `EmergencyPanel`.

**Security posture is sound.** Host-auth gating is correct: `validateHostAuth(req)` is
the first executable statement of the handler (route.ts:73), so the destructive
`reset_game` path is fully protected before any DB access. The action calls the existing
`SECURITY DEFINER reset_game(p_game_id)` RPC (migration 0003), which is `REVOKE`d from
`anon`/`PUBLIC` and only reachable via the service-role admin client. `gameId` is
UUID-validated before use (route.ts:87-89) and the RPC call is parameterized
(route.ts:182-184), so there is no injection surface. The UI gates the action behind an
`AlertDialog` confirm (T-04-20), and `runAction` guards against double-submit via the
`busy` lock (EmergencyPanel.tsx:76-77).

The concerns below are correctness/robustness around idempotency-under-concurrency and a
mismatch between what the control promises ("Joc Nou" / new game) and what the RPC
actually leaves behind. None are exploitable, hence no Critical findings — but the
concurrency rewind (WR-01) is a real data-loss-shaped behavior worth fixing before ship.

## Warnings

### WR-01: `reset_game` has no phase guard — a concurrent forward transition is silently rewound and wiped

**File:** `src/app/api/host/transition/route.ts:165-204`
**Issue:** The `reset_game` branch does a non-atomic read-then-RPC: it `SELECT`s `phase`,
short-circuits if `lobby`, then calls `reset_game(p_game_id)`. Unlike the sibling
`force_end` branch (which uses a CAS `.neq("phase","ended")` so concurrent writers
converge — route.ts:125-140), the `reset_game` RPC's final `UPDATE games SET phase='lobby'`
(migration 0003, lines 35-40) is **unconditional**. There is a TOCTOU window between the
read (route.ts:166-170) and the RPC call (route.ts:182-184). If the host (or a duplicate
request) issues `start` (lobby→question) at the same instant another `reset_game` fires,
the reset can land *after* the start — deleting every answer just submitted and rewinding
`phase` back to `lobby` with no error surfaced. The host sees a success toast for a
destructive operation that clobbered an in-progress round.

Two concurrent `reset_game` calls are benign (both converge to lobby), but `reset_game`
racing any forward transition is a silent data-loss path. The read at route.ts:166-170
provides idempotency only for the already-lobby case, not serialization.

**Fix:** Keep the destructive write atomic by guarding it at the RPC level. Make the RPC's
final `UPDATE` conditional and report whether it applied, so the route can detect a lost
race instead of blindly reporting success:

```sql
CREATE OR REPLACE FUNCTION reset_game(p_game_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE did_reset boolean;
BEGIN
  -- ... existing answer DELETE + score zeroing ...
  UPDATE games
     SET phase='lobby', current_question_id=NULL, started_at=NULL, ended_at=NULL
   WHERE id = p_game_id;          -- (optionally AND phase <> 'lobby')
  GET DIAGNOSTICS did_reset = ROW_COUNT;
  RETURN did_reset > 0;
END; $$;
```

Alternatively, treat `reset_game` as an explicit "stop the world" admin action and
disable the other host controls client-side while a reset is in flight (the `busy` lock
already exists locally but does not coordinate across the host page's other panels).

### WR-02: "Joc Nou" leaves all players in the DB — the control promises a fresh game it does not deliver

**File:** `src/app/api/host/transition/route.ts:155-204`, `supabase/migrations/0003_reset_function.sql:19-41`
**Issue:** The control copy and success toast claim a new game: button label
"Joc Nou / Reseteaza Jocul" (EmergencyPanel.tsx:272) and toast
"Jocul a fost resetat. Poti porni un joc nou." (EmergencyPanel.tsx:118). The route
docstring says it returns to "a fresh lobby" (route.ts:155-159). But `reset_game` only
(1) deletes answers, (2) zeroes `scores.correct_count`, and (3) resets the `games` row.
It **does not delete the `players` table rows** (migration 0003 has no `DELETE FROM
players`). After a "Joc Nou," every guest from the previous game remains a registered
player with a zeroed score, so the new lobby is pre-populated with stale players and the
leaderboard already lists everyone at 0. The behavior does not match the "Joc Nou" (new
game) promise.

**Fix:** Decide the intended semantic and align copy + behavior:
- If "re-run with the same wedding guests" is intended (likely for a single event),
  change the label/toast to "Reseteaza Jocul" only and drop the "Joc Nou" framing so the
  host is not surprised by persisted players.
- If a genuinely fresh game is intended, extend `reset_game` to also
  `DELETE FROM players WHERE game_id = p_game_id` (cascading to scores) and document the
  device-token implication for reconnecting guests.

### WR-03: 404 from a misconfigured `gameId` surfaces as a misleading "check your connection" toast

**File:** `src/app/api/host/transition/route.ts:166-174`, `src/components/host/EmergencyPanel.tsx:51-59`
**Issue:** The `reset_game` pre-read uses `.single()`, which errors when the row does not
exist, mapping to `404 game_not_found` (route.ts:172-174). The client's
`errorToastForStatus` lumps all non-409 4xx into "Actiunea a esuat. Verifica conexiunea
si incearca din nou." (EmergencyPanel.tsx:54-55) — a "check your connection" message for
what is actually a configuration error (e.g. wrong `NEXT_PUBLIC_GAME_ID`). During a live
event this gives the operator no actionable signal. (Note: the pre-read is also load-
bearing — the RPC itself silently no-ops on a bad id since its `UPDATE … WHERE id =
p_game_id` matches 0 rows without error — so the pre-read must stay.)

**Fix:** Keep the existence pre-read. Add a `status === 404` branch to
`errorToastForStatus` with a distinct, diagnosable message, e.g.
"Jocul nu a fost gasit — verifica configurarea." so a misconfigured `gameId` is
recognizable on-site.

## Info

### IN-01: Duplicated UUID-validation and idempotent-read/broadcast boilerplate across host routes

**File:** `src/app/api/host/transition/route.ts:37-42`, `src/app/api/host/reset/route.ts:35-40`
**Issue:** `UUID_REGEX` + `isValidUuid` are copy-pasted verbatim between
`transition/route.ts` and `reset/route.ts`, and the "read phase → short-circuit on
no-op → write → best-effort `GAME_ENDED` broadcast" shape is now repeated three times
inside `transition/route.ts` (`force_end`, `reset_game`, and the standard CAS path).
Acceptable today but drifting toward maintenance risk as host actions accumulate.
**Fix:** Extract `isValidUuid` to a shared module and consider a small
`endGameBroadcast(gameId)` helper for the repeated `GAME_ENDED` emit. Low priority.

### IN-02: `satisfies GameEvent as Record<string, unknown>` double-cast repeated seven times

**File:** `src/app/api/host/transition/route.ts:146, 197, 310, 315, 321, 327, 332`
**Issue:** Every `broadcast` call launders a typed payload through
`{ ... } satisfies GameEvent as Record<string, unknown>` because `broadcast`'s param is
`Record<string, unknown>`. It is type-safe but verbose and repeated.
**Fix:** Make `broadcast` generic / accept `GameEvent` directly so callers drop the
`as Record<string, unknown>`. Cosmetic.

### IN-03: `reset_game` success toast is identical for a real wipe and an already-lobby no-op

**File:** `src/components/host/EmergencyPanel.tsx:113-120`, `src/app/api/host/transition/route.ts:176-178`
**Issue:** When the game is already in `lobby`, the route returns `{ noop: true }` (200)
and the client shows the same "Jocul a fost resetat..." success toast as a real wipe.
This is correct idempotent UX, but the host gets positive confirmation of a destructive
reset even when nothing was deleted, which could also mask the WR-01 race (a reset that
landed as a no-op because the phase already moved).
**Fix:** Optional — read the `noop` flag from the response body and show a softer
"Jocul era deja in asteptare." message to distinguish the two outcomes.

---

_Reviewed: 2026-06-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
