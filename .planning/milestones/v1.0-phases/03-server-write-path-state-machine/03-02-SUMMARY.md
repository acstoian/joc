---
phase: 03-server-write-path-state-machine
plan: "02"
subsystem: api-guest-write
tags: [api, guest, join, answer, anti-cheat, dedup, phase-guard]
dependency_graph:
  requires:
    - "01-foundation-schema (players UNIQUE(game_id,device_token), answers UNIQUE(player_id,question_id))"
    - "src/lib/supabase/admin.ts (adminClient singleton)"
  provides:
    - "POST /api/game/join — idempotent player upsert (JOIN-01/02/03)"
    - "POST /api/game/answer — phase-guarded, dedup'd, identity-bound answer insert (SCOR-03/04)"
  affects:
    - "Phase 5 guest app (calls both routes)"
tech_stack:
  added: []
  patterns:
    - "onConflict upsert on UNIQUE(game_id,device_token) for idempotent join"
    - "Server-side player_id resolution from device_token (anti-cheat, Pattern 4)"
    - "Two-layer answer dedup: phase guard (403) + DB UNIQUE constraint (23505→409)"
    - "UUID-shape validation on all UUIDs before any DB call (ASVS V5)"
key_files:
  created:
    - src/app/api/game/join/route.ts
    - src/app/api/game/answer/route.ts
  modified: []
decisions:
  - "D-03: duplicate display names allowed — identity is device_token, not name"
  - "D-04: name validation is trim+non-empty+≤30 chars, unicode/emoji/diacritics accepted"
  - "Only 'question' phase opens answer submission — 'lobby' excluded (unlike skeleton OPEN_PHASES)"
  - "player_id resolved server-side from device_token; never read from request body (anti-cheat)"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-03"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 3 Plan 02: Guest Write Routes Summary

Guest write slice delivering idempotent player join (JOIN-01/02/03) and phase-guarded, anti-cheat-bound answer submission (SCOR-03/04) — two new serverless route handlers, build green, all acceptance checks passing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | POST /api/game/join — idempotent player upsert | 489887d | src/app/api/game/join/route.ts |
| 2 | POST /api/game/answer — phase-guard + dedup + anti-cheat | b3cda14 | src/app/api/game/answer/route.ts |

## What Was Built

### POST /api/game/join (`src/app/api/game/join/route.ts`)

Idempotent player registration via upsert on `UNIQUE(game_id, device_token)`. A guest calling this endpoint twice with the same `deviceToken` receives the same `playerId` both times (JOIN-02/03). Name validation trims whitespace, rejects empty/whitespace-only strings (400), rejects names > 30 characters (400), and explicitly allows unicode, emoji, and Romanian diacritics (ă â î ș ț) per D-04. Duplicate display names are allowed — two guests named "Andrei" are distinct players identified by their `device_token` (D-03). No broadcast is sent on join; participant count is presence-driven in Phase 4.

**Request:** `{ gameId: UUID, deviceToken: UUID, displayName: string }`
**Response:** `{ ok: true, playerId: string }`

### POST /api/game/answer (`src/app/api/game/answer/route.ts`)

Phase-guarded, identity-bound answer insert with two-layer deduplication:

- **Layer 1 — Phase guard (SCOR-04):** Reads `games.phase` server-side before any insert. Only `'question'` phase is open; any other phase returns 403 `answers_locked`. The skeleton's open-phases set that also included `'lobby'` is deliberately not used.
- **Anti-cheat identity resolution (T-03-04, Pattern 4):** The request body carries `deviceToken`, not a player identifier. The route looks up `player_id` server-side from `(game_id, device_token)` using the `players_device_token_idx` index. A guest cannot forge another player's identity because they never possess another player's `player_id`.
- **Layer 2 — DB dedup (SCOR-03):** Inserts into `answers`. The `UNIQUE(player_id, question_id)` constraint atomically rejects a second answer for the same question; `error.code === "23505"` → 409 `already_answered`. No second row is created.

**Request:** `{ gameId: UUID, deviceToken: UUID, choice: "A" | "B" }`
**Response:** 200 `{ ok: true }` / 403 `answers_locked` / 409 `already_answered` / 404 `player_not_found`

## Verification Results

### Automated

- `npm run build` — green; both routes appear in route table as `ƒ /api/game/answer` and `ƒ /api/game/join`
- TypeScript compiled successfully (strict mode)

### Acceptance Criteria Checks

| Check | Result |
|-------|--------|
| `grep -c "onConflict" join/route.ts` >= 1 | 2 (call site + options) |
| `grep -c "SERVICE_ROLE\|service_role" join/route.ts` = 0 | 0 |
| `grep -c "playerId" answer/route.ts` = 0 (no body-derived player id) | 0 |
| `grep -c "device_token" answer/route.ts` >= 1 | 4 |
| `grep -c "OPEN_PHASES" answer/route.ts` = 0 | 0 |
| `grep -c "SERVICE_ROLE\|service_role" answer/route.ts` = 0 | 0 |

## Deviations from Plan

None — plan executed exactly as written.

The `.env.local` was not present in the worktree (it lives in the main repo root). Copied it for build verification. This is expected worktree behavior and not a code deviation.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes beyond what the plan's threat model covers. Both routes operate within the existing threat register (T-03-04 through T-03-07 all mitigated as specified).

## Known Stubs

None — both routes are fully implemented with no placeholder data paths.

## Self-Check

- [x] `src/app/api/game/join/route.ts` — file exists, committed at 489887d
- [x] `src/app/api/game/answer/route.ts` — file exists, committed at b3cda14
- [x] Build green with both routes in output
- [x] All acceptance criteria grep checks pass

## Self-Check: PASSED
