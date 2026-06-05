# Phase 3: Server Write Path & State Machine - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers the **authoritative server write path and the game state machine**. Every mutation that changes game state becomes a tested, server-side API route using the `service_role` admin client — guest join, answer submission, all host phase transitions, and reveal-with-scoring. The `games.phase` column is the canonical state machine; transitions are guarded by deduplication, phase checks, and compare-and-swap. After this phase, the host and guest UIs (Phases 4–5) have real, authoritative data to drive.

**In scope (MVP vertical slice):**
- `POST /api/game/join` — idempotent upsert player by `(game_id, device_token)`; returns `player_id` (JOIN-01/02/03).
- `POST /api/game/answer` — guarded answer insert: phase guard (403 when not `'question'`), DB dedup (409 on 23505); no broadcast (SCOR-03/04, PLAY-02/03 server side).
- `POST /api/host/transition` — host-authenticated phase transitions across the full state machine (`lobby → question → locked → revealed → question → ended`) with compare-and-swap; broadcasts the corresponding `GameEvent` signal (HOST-02/03/05/07).
- `POST /api/host/reveal` — host sets `questions.correct_option` (chosen live, per D-07), recomputes scores, broadcasts `ANSWER_REVEALED` + `SCORES_UPDATED` (HOST-04, SCOR-01/02).
- Round reset for the current round (HOST-06).
- **Extend `GET /api/game/state`** to serve the phase-gated authoritative read shape including `correctOption` (post-reveal), A/B `distribution`, and `leaderboard` — replacing the Phase 2 stubs.
- Server-side host-password validation on every host route (HOST-01 server side, SC3).

**Out of scope (belongs to later phases):**
- Host dashboard UI, phase-control buttons, live count/distribution rendering → Phase 4 (HOST-08/09/10, QSTN-*).
- Host emergency recovery UI / jump-to-question / force-end UI → Phase 4 (HOST-11). *(HOST-06 round-reset mutation is in scope here; the broader emergency panel is Phase 4.)*
- Question authoring CRUD + reorder → Phase 4 (QSTN-01–05). Phase 3 relies on the Phase 1 seed questions.
- Guest/TV UI, lobby, QR, tap UX → Phases 5–6.
- Real-device concurrency / dry-run validation → Phase 7 (RT-08).

</domain>

<decisions>
## Implementation Decisions

### Leaderboard & Distribution Data Path
- **D-01:** Leaderboard and A/B distribution data are served by **re-fetch, not by broadcast payload**. `ANSWER_REVEALED` and `SCORES_UPDATED` stay **pure typed signals** (locked D-06 from Phase 2). Clients re-fetch authoritative data after the signal. SC5's phrase "leaderboard broadcast payload" is reconciled to mean *the data returned by the fetch the broadcast triggers* — the broadcast message itself carries only `type + ids`. **This resolves the SC5 ↔ D-06 conflict in favor of the locked D-06 contract.**
- **D-02:** The read side is delivered by **extending `GET /api/game/state`** (not separate endpoints). One resync call returns everything the clients need — `phase`, `currentQuestion`, `myAnswer`, plus newly populated `correctOption` (post-reveal only), `distribution`, and `leaderboard` — phase-gated. The `useGameSync` hook already calls this on every (re)connect, so no new client orchestration is needed. The Phase 2 stubs (`correctOption: null`) are replaced here.

### Guest Name Handling (Join)
- **D-03:** **Duplicate display names are allowed.** Identity is the `device_token`, not the name; two guests named "Andrei" are distinct players. Zero friction at the door — no "name taken" failure path.
- **D-04:** **Name validation = trim + non-empty + max length, unicode allowed.** Trim whitespace; reject empty/whitespace-only with 400; cap length (planner sets the exact cap, ~30 chars, to fit leaderboard/TV). **Allow emoji/unicode including Romanian diacritics** — do NOT restrict to ASCII/alphanumeric (would reject legitimate names for this audience).

### Host Transitions — Compare-and-Swap & Feedback
- **D-05:** **Benign CAS-loss / double-click → `200` no-op + current state.** A rapid second "advance", or any request whose target phase **already equals the current phase**, returns success with the actual current state (so the dashboard re-syncs to truth). No scary errors on stage from a fat-finger double-tap.
- **D-06:** **Genuinely illegal transition → `409` + machine-readable reason** (e.g. `invalid_transition`). An action whose expected-from phase doesn't match current phase **and** whose target ≠ current phase is rejected with a reason the dashboard can surface.
- **D-07 (distinguishing rule — record verbatim downstream):**
  - If `current phase == requested target phase` → **idempotent no-op, return 200 + current state**.
  - Else if `current phase != the action's expected-from phase` → **illegal, return 409 + reason**.
  - Else → perform the compare-and-swap `UPDATE ... WHERE id = :gameId AND phase = :expectedFrom`; if 0 rows affected (lost the race), treat as the 200 no-op case and return current state.
  - The `games.phase` CHECK constraint + this rule make the server the single source of transition legality.

### Round Reset (HOST-06)
- **D-08:** **Round-reset is surgical, not a full wipe.** It deletes **only the current question's answers** (`current_question_id`) and sets `games.phase` back to `'question'`, so the room re-answers just that round. The existing `reset_game()` SQL function (full clear → lobby) remains the **separate** dry-run / Phase 4 force-reset path — HOST-06 must not conflate with it.
- **D-09:** **Scoring is recomputed idempotently from `answers` on every reveal — never incremented.** On reveal, set each player's `scores.correct_count = COUNT` of that player's correct answers across all **revealed** questions (a question is "revealed" once its `correct_option` is set). Re-revealing, or reset-then-re-reveal, always yields the correct total with **no rollback logic**. This is what makes D-08 reset-safe and satisfies SC5 ("exactly 1 point per player who answered correctly") exactly.

### Claude's Discretion
*The user declined to discuss the following three areas; these are recommended defaults — planner/executor may refine but should honor the intent.*

- **Host-auth wire mechanism (recommended default):** Send the shared host password on **every** host request via a header (e.g. `Authorization: Bearer <HOST_PASSWORD>` or `x-host-password`), compared server-side against `HOST_PASSWORD`. No token-issuing/session endpoint needed — simplest mechanism that satisfies "validated server-side on every host API call" (SC3, D-15). The client holds the password in session memory (Phase 4 wires the gate UI).
- **Answer anti-cheat / identity binding (recommended default — important):** The answer endpoint should **resolve `player_id` server-side from the submitted `device_token` (+ `game_id`)** rather than trusting a client-supplied `player_id`, so a guest cannot submit answers as another player. Combined with the `UNIQUE(player_id, question_id)` constraint this is the phase's "anti-cheat".
- **Broadcast-after-write failure handling (recommended default):** **Best-effort broadcast** — if the DB write succeeds but the follow-up `broadcast()` HTTP call fails, still return success and log the failure. Postgres is the source of truth and clients converge via subscribe-then-fetch on the next reconnect / next event (D-06). Do not fail the host request solely because the broadcast call errored.
- Exact route file structure, error-body shapes/codes beyond those locked above, the precise length cap for names, and index/query specifics are left to the planner (follow ARCHITECTURE.md).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Write path, state machine & scoring (most important for this phase)
- `.planning/research/ARCHITECTURE.md` §"Server-Side Write Path" — the authoritative route table (`/api/game/join`, `/api/game/answer`, `/api/host/transition`, `/api/host/reveal`, `/api/game/state`), the two-layer answer dedup (23505→409, phase guard→403), and the server-broadcast pattern.
- `.planning/research/ARCHITECTURE.md` §"State Model" — the `lobby → question → locked → revealed → question → ended` machine, transition list, and the client `GameState` shape that `GET /api/game/state` must satisfy.
- `.planning/research/PITFALLS.md` — race-condition prevention (compare-and-swap, dedup), key isolation, public-channel/answer-secrecy considerations.
- `.planning/research/STACK.md` — pinned `@supabase/supabase-js` versions and the REST Broadcast call shape.

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 3: Server Write Path & State Machine" — goal + the 5 success criteria (the prescriptive locked mechanics; note SC5 reconciliation in D-01).
- `.planning/REQUIREMENTS.md` — JOIN-01/02/03, HOST-01–07, SCOR-01/02 (this phase); SCOR-03/04 (DB constraints from Phase 1 that this phase's API enforces).

### Locked cross-phase contracts (consume, honor, do not reshape)
- `src/lib/realtime/events.ts` — the locked `GameEvent` discriminated union (D-05/D-06 from Phase 2). Phase 3 may **add** members/optional fields but MUST NOT rename/remove/retype existing ones.
- `.planning/phases/02-realtime-core/02-CONTEXT.md` — D-03 (the `GET /api/game/state` boundary Phase 3 now fills), D-06 (typed-signal + re-fetch), D-07 (host picks correct A/B **live** at reveal, per question).
- `.planning/phases/01-foundation-schema/01-CONTEXT.md` — D-08 (`UNIQUE(player_id,question_id)`, `UNIQUE(game_id,device_token)`), D-12 (`correct_option` secrecy / `questions_public` view), D-13 (`HOST_PASSWORD` server-only), D-15 (shared-password host auth).

### Existing Phase 1/2 assets (reuse, don't rebuild)
- `src/lib/supabase/admin.ts` — server-only `adminClient` (service_role) + `broadcast(topic, event, payload)` REST helper. All Phase 3 writes and broadcasts go through these.
- `src/app/api/game/state/route.ts` — the existing resync endpoint to **extend** (currently stubs `correctOption: null`; reads `questions_public` to keep `correct_option` secret pre-reveal).
- `src/app/api/skeleton-answer/route.ts` — Route Handler pattern (`adminClient` + `NextResponse` + error-code shape) to model the new write routes on.
- `supabase/migrations/0001_init_schema.sql` — the 5-table schema (note: a real `scores` table exists → write to it per D-09); `0003_reset_function.sql` — the separate `reset_game()` full-wipe function (distinct from HOST-06 per D-08).
- `src/types/database.ts` — generated `Database` type for typed queries.

No external ADRs/specs beyond the `.planning/` set.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`adminClient` + `broadcast()`** (`src/lib/supabase/admin.ts`): every Phase 3 mutation writes via `adminClient` (bypasses RLS) then fires the matching `GameEvent` signal via `broadcast(\`game:${gameId}\`, "GAME_EVENT", { type, ... })`.
- **`GET /api/game/state`** (`src/app/api/game/state/route.ts`): already validates UUIDs, reads `questions_public` (never base `questions`), returns the player's own answer. Phase 3 **extends** it to populate `correctOption` (post-reveal), `distribution`, and `leaderboard`. Keep the answer-secrecy rule: only expose `correct_option` once `phase === 'revealed'`.
- **`questions_public` view**: anon-safe question read that omits `correct_option` — the reveal write path must read the base `questions` table (via `adminClient`) to set/read `correct_option`.

### Established Patterns
- **Throwaway → real surfaces**: Phase 2's `/sync-demo` harness and `/api/skeleton-answer` are throwaway; Phase 3 introduces the *real* `/api/game/*` and `/api/host/*` routes (skeleton route can be removed once superseded).
- **Key isolation**: writes are server-only (service_role via `import "server-only"`); never expose service key to client. Host password lives only in `HOST_PASSWORD` (server env).
- **Anti-cheat at the DB layer**: `UNIQUE(player_id, question_id)` (23505→409) and `UNIQUE(game_id, device_token)` (idempotent join) are already enforced in `0001_init_schema.sql`; the API surfaces them as proper status codes.

### Integration Points
- The write routes are what Phase 4 (host dashboard) and Phase 5 (guest app) call. The extended `GET /api/game/state` is what `useGameSync` re-fetches on every (re)connect and after each signal.
- `participantCount` (presence, Phase 2) plus the new server distribution/leaderboard data are the seams Phase 4's live count + distribution rendering reuse.

</code_context>

<specifics>
## Specific Ideas

- "Host picks the correct answer live, per question" — the reveal endpoint writes `questions.correct_option` at reveal time from the host's live choice (carried from Phase 2 D-07); it is NOT set at authoring time.
- Romanian guest names with diacritics (ă, â, î, ș, ț) and emoji must be accepted — name validation is trim/length only, not a charset whitelist (D-04).
- The host is a trusted operator running on stage — transition feedback should never throw a scary error for an innocent double-tap (D-05), but a genuinely wrong control press should be visibly rejected (D-06).
- Leaderboard correctness under live recovery is paramount — reset + re-reveal must never double-count, achieved via idempotent recompute (D-09), not increment+rollback.

</specifics>

<deferred>
## Deferred Ideas

- **Host-auth session token / cookie issuance** — considered, defaulted to per-request password header (Claude's Discretion). Revisit only if a richer host session is needed.
- **Broadcast retry / outbox** — current default is best-effort + log (Claude's Discretion); a retry queue is unnecessary given subscribe-then-fetch convergence.
- **Live A/B distribution streaming as answers arrive (HOST-09)** — Phase 4. Phase 3 only computes distribution at the read/reveal boundary.
- **Question authoring CRUD + reorder (QSTN-01–05)** — Phase 4. Phase 3 uses Phase 1 seed questions.
- **Broader emergency recovery (jump-to-question / force-end UI, HOST-11)** — Phase 4. Only the HOST-06 round-reset mutation is in Phase 3.
- **Removing the throwaway `/sync-demo` + `/api/skeleton-answer`** — cleanup as real surfaces land (Phases 4–6).

None of these expand Phase 3 scope — discussion stayed within the write-path/state-machine domain.

</deferred>

---

*Phase: 03-server-write-path-state-machine*
*Context gathered: 2026-06-02*
