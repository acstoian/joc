# Phase 2: Realtime Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-02
**Phase:** 2-Realtime Core
**Areas discussed:** Hook surface & demo harness, GET /api/game/state payload depth, Presence scope, Broadcast event envelope, Event semantics, Presence identity, GAME_EVENT union membership, Demo route shape, Reconnect verification, Live reveal handling

---

## Hook Surface & Demo Harness

| Option | Description | Selected |
|--------|-------------|----------|
| Headless hook + throwaway demo | Hook returns {state, status}; ship only a throwaway 2-tab demo route. Real UI later. | ✓ |
| Headless hook + reusable indicator | Also ship a reusable "Reconnecting…" component now. | |

**User's choice:** Headless hook + throwaway demo
**Notes:** Keeps Phase 2 a pure primitive; production UI deferred to Phase 5/6.

---

## GET /api/game/state Payload Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal games row | Return just { phase, currentQuestionId }; Phase 3 enriches. | |
| Fuller shape with stubs | Return games + current question + player-answer shape, stubbed/null where Phase 3 fills. | ✓ |

**User's choice:** Fuller shape with stubs
**Notes:** Defines the endpoint contract now; Phase 3 populates join/answer-dependent fields.

---

## Presence (Participant Count) Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Defer presence entirely | Phase 2 = subscribe-then-fetch + reconnect only; presence in Phase 4. | |
| Wire presence into hook now | Include track()/presenceState() in the shared hook now. | ✓ |

**User's choice:** Wire presence into hook now
**Notes:** Establishes count + plumbing early; must respect track()-flooding pitfall at 100+ players.

---

## Broadcast Event Envelope Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal typed envelope + re-fetch | Typed envelope + single STATE_CHANGED nudge; Phase 3 adds types. | |
| Full GAME_EVENT union now | Define the complete discriminated union now. | ✓ |

**User's choice:** Full GAME_EVENT union now
**Notes:** Coheres with "define the full contract once so Phases 3–6 just consume it."

---

## Event Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Typed signal + always re-fetch | Events carry {type, gameId, minimal ids}; type drives transition; clients always re-fetch authoritative state. | ✓ |
| Self-contained payloads | Events carry full data; render directly without re-fetch. | |
| Hybrid: payload + re-fetch on miss | Full payloads + seq gap detection. | |

**User's choice:** Typed signal + always re-fetch
**Notes:** Honors the locked subscribe-then-fetch rule; one source of truth; immune to missed/out-of-order events.

---

## Presence Identity (Phase 2)

| Option | Description | Selected |
|--------|-------------|----------|
| Device-token stub + expose count | track() with localStorage device-token key + placeholder name; expose participantCount; Phase 3 swaps in real name. | ✓ |
| Connection-only count | Random per-connection key, count only, no identity. | |
| Full identity now | Build the device-token join handshake in Phase 2. | |

**User's choice:** Device-token stub + expose count
**Notes:** Real display_name identity wired in Phase 3 (JOIN-02/03).

---

## GAME_EVENT Union Membership

| Option | Description | Selected |
|--------|-------------|----------|
| Full 8-member lifecycle union | GAME_STARTED, QUESTION_STARTED, ANSWERS_LOCKED, ANSWER_REVEALED, SCORES_UPDATED, ROUND_RESET, GAME_ENDED, COUNTDOWN_STARTED. | ✓ |
| Minimal lifecycle (5) | Drop SCORES_UPDATED/ROUND_RESET/COUNTDOWN. | |
| I'll propose, you edit | Claude proposes, user edits in CONTEXT.md. | |

**User's choice:** Full 8-member union (free-text: "1. but the game will have 100+ players. and i want the host to select the answer live, for each question")
**Notes:** Added two product notes — (a) 100+ concurrent players (RT-05) the primitive must hold at; (b) host selects the correct answer live per question at reveal time (not at authoring). Both captured in CONTEXT (D-07, D-09, specifics).

---

## Demo Route Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Full sync-demo harness | /sync-demo: host buttons fire each GAME_EVENT via server action; two panes show status, count, last event, re-fetched state. | ✓ |
| Minimal one-button demo | Single STATE_CHANGED button + raw event log. | |
| Extend existing skeleton | Build on /skeleton/ping + /api/skeleton-answer. | |

**User's choice:** Full sync-demo harness
**Notes:** Exercises the whole contract end-to-end; throwaway, removed in later phases.

---

## Reconnect Verification Method

| Option | Description | Selected |
|--------|-------------|----------|
| Simulated now, real device in Phase 7 | DevTools offline + tab backgrounding for Phase 2; real-device proof in Phase 7 dry run. | ✓ |
| Require real iOS device now | Real iPhone 60s-lock proof gates Phase 2. | |
| Both: simulated + manual smoke | Simulated check + one-off real-device smoke now. | |

**User's choice:** Simulated now, real device in Phase 7 (free-text: "1, but it needs to be for iOS and Android, not just iOS")
**Notes:** Real-device pass (Phase 7) must cover BOTH iOS Safari and Android Chrome; visibilitychange/worker treated as cross-platform.

---

## Live Reveal Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Reflect in event contract + demo only | ANSWER_REVEALED modeled as live host action carrying chosen A/B; demo reveal control picks A/B; real write in Phase 3/4. | ✓ |
| Just note it for Phase 3/4 | Record product decision only; no event/demo modeling in Phase 2. | |

**User's choice:** Reflect in event contract + demo only
**Notes:** Keeps Phase 2 scope = sync primitive; records cross-phase product decision that correct answer is chosen live at reveal.

---

## Claude's Discretion

- Exact `useGameSync` return-type shape and file location (`src/hooks/useGameSync.ts`).
- Event-union TypeScript types location (e.g. `src/lib/realtime/events.ts`).
- How realtime client options (`worker`, `heartbeatIntervalMs`, `reconnectAfterMs`) are injected.
- `/sync-demo` route path naming and throwaway styling.
- Connection-status enum naming and precise `state` object surface.

## Deferred Ideas

- Reusable "Reconnecting…" UI component → Phase 5/6.
- Real player identity in presence (`display_name`) → Phase 3 (JOIN-02/03).
- Real host-picks-correct write + UI → Phase 3 (HOST-04) / Phase 4 (QSTN-04).
- Per-event self-contained payloads → revisit only on measured latency need.
- Real-device 60s screen-lock proof (iOS + Android) → Phase 7 (RT-08).
- True 100+ concurrent load test → Phase 7 (RT-05/RT-08).
