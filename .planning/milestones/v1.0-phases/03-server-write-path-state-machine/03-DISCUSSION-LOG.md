# Phase 3: Server Write Path & State Machine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-02
**Phase:** 03-server-write-path-state-machine
**Areas discussed:** Leaderboard/distribution data path, Guest name handling, Host double-click & invalid-transition feedback, Round-reset semantics

---

## Leaderboard / Distribution Data Path

| Option | Description | Selected |
|--------|-------------|----------|
| Re-fetch via endpoint (honor D-06) | Events stay pure signals; clients re-fetch authoritative data. SC5's "payload" = the fetch's data. | ✓ |
| Embed data in broadcast payload | Put ranked leaderboard + distribution in the broadcast message (literal SC5); scoped exception to D-06; staleness risk. | |
| You decide | — | |

**User's choice:** Re-fetch via endpoint (honor D-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Extend GET /api/game/state | One resync call returns everything, phase-gated; hook already calls it. | ✓ |
| Dedicated endpoints | Separate /leaderboard and /distribution routes; more client orchestration. | |
| You decide | — | |

**User's choice:** Extend GET /api/game/state
**Notes:** Resolves the SC5 ("leaderboard broadcast payload") vs locked D-06 ("events are signals, re-fetch") conflict in favor of D-06.

---

## Guest Name Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Allow duplicates | Identity is the device token, not the name; zero friction. | ✓ |
| Force unique names | Reject taken names; cleaner leaderboard but adds a door-side failure path. | |

**User's choice:** Allow duplicates

| Option | Description | Selected |
|--------|-------------|----------|
| Trim + non-empty + max length | Trim, reject empty (400), cap length, allow emoji/unicode. | ✓ |
| Strict (alphanumeric only) | Letters/numbers/spaces only — rejects diacritics; risky for Romanian names. | |
| You decide | — | |

**User's choice:** Trim + non-empty + max length
**Notes:** Unicode/diacritics must be accepted (Romanian names); planner sets exact length cap.

---

## Host Double-Click & Invalid-Transition Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Idempotent no-op + current state (200) | Losing CAS / double-tap returns success + current state; no scary errors on stage. | ✓ |
| Conflict error (409) | Always 409 on non-applying request; UI must swallow benign double-clicks. | |

**User's choice:** Idempotent no-op + current state (200)

| Option | Description | Selected |
|--------|-------------|----------|
| Reject with 409 + reason | Genuinely illegal transition → 409 + machine-readable reason. | ✓ |
| Same no-op treatment | Treat every non-applying request as a no-op; hides real host mistakes. | |

**User's choice:** Reject with 409 + reason
**Notes:** Distinguishing rule recorded in CONTEXT D-07 — phase==target → 200 no-op; phase != expected-from && != target → 409.

---

## Round-Reset Semantics (HOST-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Only current question's answers + back to 'question' | Surgical re-run of one round; full wipe stays the separate reset_game(). | ✓ |
| All answers + scores (full reset) | Conflates HOST-06 with reset_game() / Phase 4 force-reset. | |

**User's choice:** Only current question's answers + back to 'question'

| Option | Description | Selected |
|--------|-------------|----------|
| Recompute from answers (idempotent) | Reveal sets correct_count = COUNT of correct answers across revealed questions; reset-safe, no rollback. | ✓ |
| Increment + rollback on reset | Reveal adds +1; reset must subtract; stateful and error-prone. | |

**User's choice:** Recompute from answers (idempotent)
**Notes:** Idempotent recompute is what makes round-reset safe and satisfies SC5 exactly.

---

## Claude's Discretion

User chose "That's enough — write context" when offered three further areas; recommended defaults recorded in CONTEXT.md:
- **Host-auth wire mechanism** — shared password sent on every host request via header, compared server-side against `HOST_PASSWORD`; no token/session endpoint.
- **Answer anti-cheat / identity binding** — resolve `player_id` server-side from `device_token` (+ `game_id`); don't trust client-supplied `player_id`.
- **Broadcast-after-write failure handling** — best-effort: write succeeds → return success even if `broadcast()` fails; log it; clients converge via subscribe-then-fetch.
- Route file structure, exact error-body shapes, name length cap, and index/query specifics left to planner.

## Deferred Ideas

- Host-auth session token / cookie issuance (defaulted to per-request header).
- Broadcast retry / outbox (defaulted to best-effort + log).
- Live A/B distribution streaming as answers arrive (HOST-09) → Phase 4.
- Question authoring CRUD + reorder (QSTN-01–05) → Phase 4.
- Broader emergency recovery UI (jump-to-question / force-end, HOST-11) → Phase 4.
- Removing throwaway `/sync-demo` + `/api/skeleton-answer` → cleanup in Phases 4–6.
