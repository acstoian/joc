---
phase: 04-host-dashboard
reviewed: 2026-06-03T18:27:55Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/app/api/host/answers/route.ts
  - src/app/api/host/questions/route.ts
  - src/app/api/host/questions/[id]/route.ts
  - src/app/api/host/questions/reorder/route.ts
  - src/app/api/host/transition/route.ts
  - src/app/host/page.tsx
  - src/app/layout.tsx
  - src/components/host/ControlTab.tsx
  - src/components/host/DistributionBar.tsx
  - src/components/host/EmergencyPanel.tsx
  - src/components/host/PhaseButton.tsx
  - src/components/host/QuestionRow.tsx
  - src/components/host/QuestionsTab.tsx
  - src/components/host/StatsTab.tsx
  - src/hooks/useHostAnswerNames.ts
  - src/hooks/useHostAuth.ts
  - src/hooks/useHostQuestions.ts
  - src/lib/host/constants.ts
findings:
  critical: 4
  warning: 5
  info: 3
  total: 12
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-03T18:27:55Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 4 delivers the host dashboard — password gate, phase control buttons, question CRUD, and live stats. The auth gating pattern and in-flight button discipline are correctly implemented. However, four critical defects were found: two data-integrity gaps in the API layer (cross-game PUT with no ownership check; answers endpoint leaks names across question boundaries within the same game), one security concern with the `error.message` detail leaking from admin DB client to clients, and one correctness bug in the in-flight re-enable logic that unconditionally fires on mount. Additionally, the reorder endpoint silently swallows DB errors, and the `EmergencyPanel` jump action has a server-side phase constraint that the UI does not communicate clearly.

---

## Critical Issues

### CR-01: `PUT /api/host/questions/[id]` — No cross-game ownership check

**File:** `src/app/api/host/questions/[id]/route.ts:99-116`

**Issue:** The PUT handler validates the `id` UUID from the URL but performs the UPDATE filtering only on `.eq("id", id)`. There is no `.eq("game_id", ...)` clause. Any host who knows a UUID of a question from a different game can overwrite that question's body/options/correct_option. The DELETE handler at line 163 correctly applies `.eq("game_id", gameId)`, but PUT does not. The spec (RQ-2, "cross-game edit guard") explicitly required this check.

**Fix:**
```typescript
// PUT handler — add game_id scope to the UPDATE
// Require gameId in the request body (mirror DELETE's pattern for gameId)
// Then apply both conditions:
const { data: updated, error: updateError } = await adminClient
  .from("questions")
  .update(updatePayload)
  .eq("id", id)
  .eq("game_id", gameId)   // <-- add this
  .select("id, body, option_a, option_b, correct_option, display_order, created_at");
```
The request body must also supply `gameId` (UUID-validated), or alternatively read it as a query param (consistent with DELETE). The 404 path still handles the case where the id simply does not exist for this game.

---

### CR-02: `GET /api/host/answers` — No `gameId` filter on the DB query

**File:** `src/app/api/host/answers/route.ts:56-59`

**Issue:** The endpoint accepts both `gameId` and `questionId` as query params and UUID-validates both. However, the Supabase query filters **only** on `question_id`:
```typescript
.eq("question_id", questionId)
```
`gameId` is validated but never used in the query. A question UUID is globally unique (UUID v4), so for the single-game MVP this is not exploitable in practice. But the threat is real in principle: a host supplying a `questionId` that belongs to a different game's session will receive answer names for that question with no server-side rejection. The `gameId` parameter should be joined through to verify ownership.

**Fix:**
```typescript
// Join through questions to verify the question belongs to this game:
const { data, error } = await adminClient
  .from("answers")
  .select("choice, players!inner(display_name), questions!inner(game_id)")
  .eq("question_id", questionId)
  .eq("questions.game_id", gameId);   // cross-game guard
```
Alternatively, do a prior ownership check:
```typescript
const { data: q } = await adminClient
  .from("questions")
  .select("id")
  .eq("id", questionId)
  .eq("game_id", gameId)
  .maybeSingle();
if (!q) return NextResponse.json({ error: "question_not_found" }, { status: 404 });
```

---

### CR-03: Admin DB `error.message` leaked to client in multiple routes

**File:** `src/app/api/host/questions/route.ts:45`, `src/app/api/host/questions/route.ts:123`, `src/app/api/host/questions/[id]/route.ts:107`, `src/app/api/host/answers/route.ts:63`

**Issue:** Every error response in the new host question and answers routes includes `detail: error.message` (or `detail: insertError?.message`) from the Supabase admin client. These Postgres-level error messages can contain table names, column names, constraint names, and query fragments. While the endpoints are host-only, including raw DB internals in API responses is an information disclosure risk and a bad practice (ASVS V7.4).

Example at `questions/route.ts:45`:
```typescript
return NextResponse.json({ error: error.message }, { status: 500 });
```
And at `answers/route.ts:63`:
```typescript
{ error: "answers_fetch_failed", detail: error.message },
```

**Fix:** Log the detail server-side; return only a stable opaque error code to the client:
```typescript
console.error("[host/questions GET]", error.message);
return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
```
The `transition/route.ts` from Phase 3 follows the same leaky pattern — that is out of scope for this review but should be addressed consistently.

---

### CR-04: `ControlTab` in-flight re-enable fires unconditionally on initial mount

**File:** `src/components/host/ControlTab.tsx:205-210`

**Issue:** The `useEffect` that clears `inFlight` on phase change runs on the initial render even when `inFlight === null`:
```typescript
useEffect(() => {
  if (inFlight !== null) {
    setInFlight(null);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [state?.phase]);
```
This is suppressed with an `eslint-disable` comment and has a shallow bug: because `inFlight` is not in the dependency array, a stale closure is captured. If `state?.phase` changes but `inFlight` has been cleared already by the error path (line 268 or 288), nothing bad happens. But if `state?.phase` changes **before** the API call returns (concurrent user on another device triggers a state change), the `inFlight` captured in the closure is the value at the time the `useEffect` was re-registered — which could be `null` (wrong) or the old action (correct). The real problem is that `inFlight` is stale in this closure.

The canonical fix (from RQ-6 / RESEARCH.md) uses a functional update or a `useRef` for `inFlight`:
```typescript
const inFlightRef = useRef<string | null>(null);

// Keep ref in sync:
useEffect(() => { inFlightRef.current = inFlight; }, [inFlight]);

// Re-enable on phase change:
useEffect(() => {
  if (inFlightRef.current !== null) {
    setInFlight(null);
  }
}, [state?.phase]);  // no eslint-disable needed
```
This is a correctness issue: in a multi-device scenario (race at the wedding), this stale closure can leave buttons permanently locked until the 5-second fallback fires, degrading SC4.

---

## Warnings

### WR-01: `reorder` PATCH — DB errors silently ignored

**File:** `src/app/api/host/questions/reorder/route.ts:57-65`

**Issue:** The `Promise.all` over individual UPDATE calls is not awaited for individual errors. The resolved value of each `adminClient.from("questions").update(...)` call is discarded — the `await Promise.all(...)` result is never checked:
```typescript
await Promise.all(
  (order as string[]).map((questionId, index) =>
    adminClient.from("questions").update(...)
  )
);

return NextResponse.json({ ok: true });   // always 200, even if all UPDATEs fail
```
If Supabase returns an error for any update (e.g., connection issue, constraint violation), the endpoint returns `{ ok: true }` with HTTP 200. The client will then refetch and see the old order — a silent failure that will confuse the host.

**Fix:**
```typescript
const results = await Promise.all(
  (order as string[]).map((questionId, index) =>
    adminClient
      .from("questions")
      .update({ display_order: index + 1 })
      .eq("id", questionId)
      .eq("game_id", gameId)
  )
);

const failed = results.filter(r => r.error);
if (failed.length > 0) {
  console.error("[reorder] partial failure:", failed[0].error?.message);
  return NextResponse.json({ error: "reorder_partial_failure" }, { status: 500 });
}

return NextResponse.json({ ok: true });
```

---

### WR-02: `EmergencyPanel` jump action — server-side phase constraint not communicated in UI

**File:** `src/components/host/EmergencyPanel.tsx:109-126`

**Issue:** The "Sari la Intrebarea #N" jump action calls `POST /api/host/transition` with `action: "next"`, which has `expectedFrom: "revealed"` in the TRANSITIONS map. If the host is not in the `revealed` phase, the server returns 409 and the UI shows the generic "Starea jocului s-a schimbat" toast. This is confusing because the host may not know they need to be in the `revealed` phase to use the jump feature.

The `EmergencyPanel` component is labeled "Controale de urgenta" and should be usable from any state — but the underlying route does not support `next` from non-revealed phases.

**Fix:** Either (a) disable the Jump button when `state.phase` is not `"revealed"` and show a tooltip ("Dezvaluie raspunsul inainte de a sari."), or (b) add a `force_next` action to the transition route (analogous to `force_end`) that accepts any phase. Option (a) is simpler and correct for the current phase. The `EmergencyPanel` should accept `currentPhase` as a prop:
```typescript
// EmergencyPanel
const canJump = currentPhase === "revealed";
<Button disabled={anyBusy || count === 0 || !canJump} ...>
  Sari la Intrebare
</Button>
{!canJump && count > 0 && (
  <p className="text-xs text-champagne-dim/50">
    Dezvaluie raspunsul curent inainte de a sari.
  </p>
)}
```

---

### WR-03: `useHostAnswerNames` — stale `cancelledRef` pattern can miss error state reset

**File:** `src/hooks/useHostAnswerNames.ts:37-68`

**Issue:** The `cancelledRef` in `useHostAnswerNames` is set to `false` at the start of the `useEffect` cleanup setup (line 62), but `refetch` is called as a `useCallback` that captures `cancelledRef` by closure. If `refetch` is called manually (e.g., when the user opens the collapsible via `handleToggleNames` → `refetch()`), and the component unmounts between the `setLoading(true)` call and the `finally` block, `setLoading(false)` is correctly skipped. However, if the component remounts quickly (tab switching), a new `cancelledRef.current = false` at line 62 will race with the pending `finally`. In that scenario `setLoading(false)` IS called (because `cancelledRef.current` was reset to `false`) but `setNames` is correctly guarded (the check at line 51 was already passed). The result is `loading: false` but `names: null` (stale) — an inconsistency.

More practically: the `refetch` callback includes `cancelledRef` only indirectly (by reference); the ref object identity is stable. The real issue is that the cleanup `return () => { cancelledRef.current = true; }` in the `useEffect` at line 64 only fires when the effect re-runs (i.e., when `refetch` identity changes) — not when the user manually calls `refetch()` by opening the collapsible. This means a manual `refetch()` initiated while a previous one was still in-flight will not cancel the prior one.

**Fix:** Use an AbortController per fetch call, or use a counter-based approach:
```typescript
const fetchCountRef = useRef(0);

const refetch = useCallback(async () => {
  if (!questionId) { setNames(null); return; }
  const token = ++fetchCountRef.current;
  setLoading(true);
  try {
    const res = await hostFetch(...);
    if (fetchCountRef.current !== token) return;  // superseded
    if (res.ok) {
      const data = await res.json() as AnswerNames;
      if (fetchCountRef.current === token) setNames({ A: data.A ?? [], B: data.B ?? [] });
    }
  } catch { /* best-effort */ }
  finally {
    if (fetchCountRef.current === token) setLoading(false);
  }
}, [gameId, questionId, password]);
```

---

### WR-04: `ControlTab` — local `DistributionBar` component shadows the standalone `DistributionBar` from `src/components/host/DistributionBar.tsx`

**File:** `src/components/host/ControlTab.tsx:103-151`

**Issue:** `ControlTab.tsx` defines a private `DistributionBar` function (lines 103–151) that accepts `{ distribution: { A: number; B: number } | null }`. The standalone `src/components/host/DistributionBar.tsx` component accepts `{ a, b, height? }`. These are two different implementations of the same visual element. The `StatsTab` imports the correct standalone component; `ControlTab` uses its own private copy. This is code duplication and means styling/animation changes must be made in two places.

**Fix:** Replace the private `DistributionBar` in `ControlTab.tsx` with the imported standalone component:
```typescript
import { DistributionBar } from "@/components/host/DistributionBar";

// In the JSX — replace:
<DistributionBar distribution={state?.distribution ?? null} />
// With:
{state?.distribution ? (
  <DistributionBar a={state.distribution.A} b={state.distribution.B} />
) : (
  <p className="text-xs text-champagne-dim/60">Niciun raspuns inca.</p>
)}
```

---

### WR-05: `useHostQuestions.update` — `gameId` not included in the `update` dependency array

**File:** `src/hooks/useHostQuestions.ts:136-165`

**Issue:** The `update` callback has `[password, refetch]` in its dependency array (line 164) but is missing `gameId`. In a single-game MVP this is inconsequential because `gameId` never changes after mount, but in strict TypeScript/ESLint-exhaustive-deps it would be flagged. More importantly, if `gameId` changed (e.g., the host navigates to a different game), `update` would still close over the old `gameId` — but since `update` builds the URL as `/api/host/questions/${id}` (no gameId in the PUT path), the missing `gameId` is actually harmless for PUT requests. However, this is a latent inconsistency with `create`, `remove`, and `reorder` which all include `gameId`.

**Fix:**
```typescript
}, [gameId, password, refetch]);   // add gameId
```

---

## Info

### IN-01: `useHostAuth` — password stored in `sessionStorage` before reading response body

**File:** `src/hooks/useHostAuth.ts:55-56`

**Issue:** On a successful auth probe, the password is persisted to `sessionStorage` and `setPassword(pw)` is called immediately on any non-401 status code — including 500 (server error) and 405 (method not allowed). While the design deliberately treats all non-401 as "accepted" (because the questions endpoint might not yet exist), a transient 500 during auth probe would grant dashboard access. This is documented in the hook (`any other status (200, 404, 405) = accepted`) but is worth noting: in the final deployed state, the probe endpoint (`/api/host/questions`) will reliably return either 401 (wrong password) or 200 (correct password), making this a non-issue in practice. The `"use client"` directive and file are both correct.

**Suggestion:** If robustness is desired, treat 5xx as a network error rather than an auth success:
```typescript
if (res.status === 401) {
  setError("Parola gresita. Incearca din nou.");
} else if (res.status >= 500) {
  setError("Eroare de server. Incearca din nou.");
} else {
  sessionStorage.setItem(SESSION_KEY, pw);
  setPassword(pw);
}
```

---

### IN-02: `QuestionRow` — correct-option pills not aria-disabled when `isDraft`

**File:** `src/components/host/QuestionRow.tsx:258-276`

**Issue:** The correct-option A/B buttons have `disabled={isDraft}` (line 262, 268) which correctly prevents interaction in draft mode. However, both buttons also display `aria-pressed` based on `question.correct_option` which for a draft will always be `null`. A screen reader will announce both as "not pressed" without context that they are unavailable because the question hasn't been saved yet. The `aria-disabled` attribute is not set.

**Suggestion:** Add `aria-disabled={isDraft}` alongside `disabled={isDraft}` for screen reader parity.

---

### IN-03: `DistributionBar` standalone — `aria-valuemax` always equals `aria-valuenow`

**File:** `src/components/host/DistributionBar.tsx:27-30`

**Issue:** The `role="meter"` element has `aria-valuenow={total}` and `aria-valuemax={total}`. These being equal means a screen reader would always announce "100% full" regardless of the actual answer count. The meter semantics are: valuenow = current value, valuemin = 0, valuemax = expected/possible maximum. Since we don't know the total possible answers (participant count), the best option is to either (a) pass `participantCount` as an optional max prop and use it when available, or (b) drop the meter role and use `aria-label` only.

**Suggestion:**
```typescript
// Option (b) — simpler, correct:
<div
  role="img"
  aria-label={`Raspunsuri: A ${a}, B ${b}, total ${a + b}`}
  className="relative w-full overflow-hidden rounded-full bg-ink-muted/50"
  style={{ height }}
>
```

---

_Reviewed: 2026-06-03T18:27:55Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
