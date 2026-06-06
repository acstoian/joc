---
phase: "04-host-dashboard"
plan: "03"
subsystem: "host-dashboard"
tags: ["host", "questions", "crud", "api", "ui"]
dependency_graph:
  requires:
    - "04-01"
  provides:
    - "host-questions-crud-api"
    - "useHostQuestions-hook"
    - "questions-tab-inline-editor"
    - "host-auth-probe-endpoint"
  affects:
    - "04-02-PLAN"
    - "04-05-PLAN"
tech_stack:
  added: []
  patterns:
    - "validateHostAuth(req) as first statement of every handler — 401 before DB access (T-04-07)"
    - "adminClient.from('questions') base table only — never questions_public (Pitfall 3, T-04-09)"
    - "DELETE active-question guard: 409 Romanian error when games.current_question_id === id (Pitfall 4, T-04-08)"
    - "reorder via Promise.all of display_order=index+1 updates (Pitfall 8)"
    - "refetch-on-success after every mutation so UI reflects persisted DB state (SC2)"
    - "cancelled-guard ref on GET to avoid setState after unmount"
    - "RowMode state machine (view|editing|saving|error) for inline edit-in-list"
key_files:
  created:
    - "src/app/api/host/questions/route.ts"
    - "src/app/api/host/questions/[id]/route.ts"
    - "src/app/api/host/questions/reorder/route.ts"
    - "src/hooks/useHostQuestions.ts"
    - "src/components/host/QuestionRow.tsx"
  modified:
    - "src/components/host/QuestionsTab.tsx"
decisions:
  - "New-question draft is created with correct_option=null; host marks the correct option (A/B pill) after creation rather than during the draft, keeping the draft editor simple"
  - "QuestionRow correct-answer pills are disabled in draft mode (no id yet); enabled once the question is persisted"
  - "reorder computes the full swapped ordering client-side and PATCHes the entire id array — idempotent, last-writer-wins (acceptable for single host)"
metrics:
  duration: "~25 min (task 1 by executor; task 2 completed inline by orchestrator after executor stream truncation)"
  completed: "2026-06-03T15:20:00Z"
  tasks: 2
  files: 6
---

# Phase 4 Plan 3: Question Authoring Vertical Slice Summary

Closes the known Phase 4 gap (Phase 3 built no question routes). New host-auth-gated CRUD endpoints under `/api/host/questions` back the entire authoring surface and double as the auth probe for `useHostAuth`. The Questions tab is an inline edit-in-list editor: create, edit, delete (with active-question guard), reorder, and mark-correct all persist to the base `questions` table and survive reload.

## What Was Built

### Task 1: Question CRUD API routes (committed `f33e4f0`)
- `GET /api/host/questions?gameId=` → `{ questions: [...] }` ordered by `display_order` (fields incl. `correct_option`).
- `POST /api/host/questions` `{ gameId, body, option_a, option_b, correct_option? }` → `{ question }`, `display_order = MAX+1`.
- `PUT /api/host/questions/[id]` partial `{ body?, option_a?, option_b?, correct_option? }` → `{ question }` (404 if no rows). Next.js 15 `params: Promise<{id}>` awaited.
- `DELETE /api/host/questions/[id]?gameId=` → `{ ok: true }`, or **409** with `"Aceasta intrebare este activa in joc. Reseteaza runda inainte de a o sterge."` when `games.current_question_id === id`.
- `PATCH /api/host/questions/reorder` `{ gameId, order: UUID[] }` → `{ ok: true }` via `Promise.all` of `display_order = i+1`.
- Every handler begins with `validateHostAuth(req)` → 401, and uses `adminClient.from("questions")` (base table, never `questions_public`).

### Task 2: useHostQuestions hook + QuestionRow + QuestionsTab (committed `5fd43a9`)
- `src/hooks/useHostQuestions.ts` — `{ questions, loading, error, refetch, create, update, remove, reorder }`. All mutations use `hostFetch` with `x-host-password` and `refetch()` on success. Cancelled-guard on the GET. Errors (incl. the 409 message) surfaced via `error`.
- `src/components/host/QuestionRow.tsx` — glass `Card` row with a RowMode state machine. View: number badge, body, A/B labels, correct-answer toggle pills (`aria-pressed`, selected `bg-gold text-ink`, `min-h/min-w 44px`), ▲/▼ reorder (lucide ChevronUp/ChevronDown, disabled at ends), Pencil edit, Trash2 delete → `AlertDialog` ("Stergi aceasta intrebare?" / "Aceasta actiune nu poate fi anulata." / "Renunta" / "Da, sterge"). Editing: body/option_a/option_b `Input`s + "Salveaza" (gold) / "Renunta" (ghost).
- `src/components/host/QuestionsTab.tsx` — ordered `QuestionRow` list, "+ Adauga Intrebare" draft row (create on save), empty state ("Nu ai intrebari inca." + "Adauga prima intrebare"), `Skeleton` loaders. ▲/▼ compute the swapped full ordering and call `reorder`. 409 active-question delete + hook errors shown as sonner toasts.

## Deviations from Plan

**Execution path:** Task 1 was completed and committed by a sequential executor agent. The executor's stream truncated partway through Task 2 (after writing the `useHostQuestions` hook, before `QuestionRow`/`QuestionsTab`). The orchestrator completed Task 2 inline — finished the components, typechecked (`tsc --noEmit` clean), and committed. No functional deviation from the plan's Task 2 spec.

**Draft correct-option:** The plan said "marking the A/B toggle in any mode calls update with correct_option." For an unsaved draft there is no id to update, so the draft creates with `correct_option=null` and the host marks the correct option immediately after creation. All acceptance criteria (persist create/edit/delete/reorder/mark-correct across reload) are still met.

## Human Verification Needed

**Type:** checkpoint:human-verify (deferred to end-of-phase)

**What was built:** The Questions tab (inline create/edit/delete/reorder/mark-correct) backed by the new `/api/host/questions` CRUD endpoints.

**How to verify:**
1. With `HOST_PASSWORD` set and logged into `/host`, open the "Intrebari" tab.
2. Create a question (body + A + B), mark A correct, Save. Reload — question and correct=A persist (QSTN-01/04, SC2).
3. Edit the body, Save, reload — edit persists (QSTN-02).
4. Add a second question; use ▲/▼ to reorder; reload — new order persists (QSTN-05).
5. Delete the second question via the confirm dialog; reload — it is gone (QSTN-03).
6. Start the game (Control tab) so a question is active, return to Intrebari, try to delete the active question — expect the toast "Aceasta intrebare este activa in joc..." and no deletion (Pitfall 4).
7. `curl -s -X POST http://localhost:3000/api/host/questions -d '{}'` without `x-host-password` → HTTP 401.

## Known Stubs

None. All five routes and the full inline editor are implemented.

## Threat Surface Scan

- T-04-07 (EoP): `validateHostAuth(req)` is the first statement of every handler.
- T-04-08 (DoS): active-question DELETE guarded with 409 Romanian error.
- T-04-09 (Info disclosure): host routes use `adminClient.from("questions")` server-side only; public path keeps using `questions_public`.
- T-04-10 (Input validation): UUID checks on gameId + every reorder id; non-empty string checks on body/options → 400.

## Self-Check: PASSED

- `npx tsc --noEmit` clean.
- Files present: 3 route files (tracked), `useHostQuestions.ts`, `QuestionRow.tsx` (created), `QuestionsTab.tsx` (replaced placeholder).
- Commits: `f33e4f0` (routes), `5fd43a9` (hook + components).
