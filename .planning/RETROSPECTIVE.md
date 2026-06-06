# Retrospective — Joc: Live Wedding Game Show

## Milestone: v1.0 — Live Wedding Game Show MVP

**Shipped:** 2026-06-06
**Phases:** 7 | **Plans:** 27

### What Was Built

- **Phase 1**: Next.js 15.3 + Supabase Pro scaffold with full 5-table schema, RLS policies, key isolation, typed clients
- **Phase 2**: `useGameSync` Broadcast hook — the core sync primitive; subscribe-then-fetch, presence, visibilitychange reconnect proven via throwaway harness
- **Phase 3**: Complete server write path — guest join, answer submission, all host transitions (CAS), reveal with `recompute_scores` RPC
- **Phase 4**: Host dashboard — auth gate, phase controls, question CRUD + reorder, distribution stats, emergency recovery
- **Phase 5**: Guest app — lobby + QR, A/B tap with optimistic lock + re-selection, reveal feedback, winner screen
- **Phase 6**: TV Display Mode — cinematic `/display` with AnimatePresence, staggered leaderboard, countdown overlay
- **Phase 7**: Soft-luxury aesthetic polish + production dry run (13/13 checks passed)

### What Worked

- **Wave-based parallel execution** — Phase 7 Waves 1/2/3 ran some plans in parallel worktrees; no merge conflicts because waves touched disjoint file sets
- **Subscribe-then-fetch pattern** — solving "what state am I in after reconnect?" before building any UI was the right order; no rework needed
- **Host-first order (Phase 4 before Phase 5)** — guest app was testable against real authoritative state transitions from day 1
- **Code review gate at Phase 7** — caught a BLOCKER (null assertion on `current_question_id`), 3 MAJORs (confetti deps, leaderboard keys, reduced-motion guard), and 2 INFO issues that would have been hard to debug at the wedding
- **Production dry run as hard gate** — uncovered the answer lock-in UX bug (answer couldn't be changed after first tap) in a real-device test; fixed before event
- **Exact version pin for Next.js** — `next@15.3.9` pinned exactly; `^15.3.0` would have resolved to a broken version on Node v24

### What Was Inefficient

- **REQUIREMENTS.md fell out of sync** — requirement checkboxes and traceability table were never updated as phases completed; required a mass-fix at milestone close (15 checkboxes stale). Should update REQUIREMENTS.md as part of each plan's commit.
- **Phase 05/06 VERIFICATION.md `human_needed` status** — both verifier agents wrote `human_needed` but no follow-up step closed the loop. Production dry run covered all scenarios but the docs stayed open.
- **State.md "stopped_at" sometimes stale** — after context resets, the STATE.md resume file/position wasn't always updated atomically with execution.
- **PLAY-03 seeding took two iterations** — the first fix (adding `[state.myAnswer, localAnswer]` deps) had a subtle race; the second fix (ref snapshot) was correct. Could have used the ref pattern from the start if the pitfall was documented earlier.

### Patterns Established

- **`useReducedMotion() !== false` guard** — `null` on SSR render means any falsy check allows animation to fire for reduced-motion users; always use `!== false`
- **Ref snapshot for "seed-once" effects** — when an effect should fire only when state changes from null to non-null (not on every render), use `localAnswerRef.current` snapshot instead of including the local state in deps
- **Collision-resistant leaderboard keys** — `${entry.name}-${entry.score}-${index}` avoids duplicate-key collapse on tied players with same name
- **`canvas-confetti` dynamic import with ref guard** — `import("canvas-confetti").then(...)` + `useRef(false)` guard ensures exactly-once firing even when deps change
- **`-webkit-text-fill-color` for gradient text** — better than `color: transparent`; leaves text-shadow and caret-color working; `color: fallback` before the gradient for unsupported browsers

### Key Lessons

1. **Keep REQUIREMENTS.md in sync as you go** — mark requirements complete in the plan's commit message or SUMMARY; don't batch at milestone close
2. **The ref snapshot pattern is the right tool for "fire-once-when-X-arrives" effects** — document it early so it's not rediscovered
3. **Code review at the final phase pays off** — found 1 BLOCKER + 3 MAJORs that the self-verification passes missed
4. **Production dry run is not optional for a live event** — the UX bug found during dry run (answer lock-in) would have been embarrassing at the wedding
5. **Exact version pins on frameworks with active churn** — `^` ranges can resolve to broken versions; pin exactly for critical deps

### Cost Observations

- Sessions: ~8 (across 4-day development)
- Model: Claude Sonnet 4.6 throughout (sub-agents used for executor, code reviewer, verifier)
- Notable: Wave-based parallel execution with worktrees reduced wall-clock time significantly; sub-agents kept orchestrator context lean

---

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 7 |
| Plans | 27 |
| Days | 4 |
| LOC (TS) | 8,084 |
| Commits | 123 |
| Code review findings | 7 (1 BLOCKER, 3 MAJOR, 3 INFO) |
| Dry run pass rate | 13/13 |
