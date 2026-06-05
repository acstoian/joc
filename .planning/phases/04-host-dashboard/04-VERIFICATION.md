---
phase: 04-host-dashboard
verified: 2026-06-04T05:30:00Z
status: passed
human_verification: approved by user 2026-06-04 (return-to-lobby recovery + carryover UAT items confirmed)
score: 24/24 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 17/17
  gaps_closed:
    - "From the ended phase the host has a UI control that returns the game to lobby (GAP-04-01)"
    - "reset_game action on POST /api/host/transition calls the existing reset_game RPC"
    - "reset_game is idempotent (noop when already in lobby)"
    - "Guests/TV resync after game reset via existing GAME_ENDED event (no new GameEvent member)"
    - "Joc Nou / Reseteaza Jocul control is confirm-gated and distinct from round-only Reseteaza Runda"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Password gate — deny wrong / grant correct / persist session"
    expected: "Wrong password shows 'Parola gresita. Incearca din nou.' with no dashboard; correct password shows three-tab shell; reload stays authenticated; tab close re-prompts"
    why_human: "sessionStorage lifecycle and realtime auth probe require a real browser session (SC1)"
  - test: "Phase control buttons — enabled only when valid; in-flight lock and Broadcast re-enable"
    expected: "Only 'Porneste Jocul' active in lobby; tapping a valid button shows spinner + '...' and disables all buttons; re-enable occurs when phase badge changes (Broadcast, ~1s), not on fetch return; double-tap advances by exactly one step"
    why_human: "Broadcast-confirmed re-enable timing and double-tap race require live Supabase Realtime (SC4)"
  - test: "Cross-tab phase sync — second host tab reflects state changes within ~2s"
    expected: "Open /host in two browser tabs; trigger a phase change from tab A; tab B badge and button states update within 2s without refresh"
    why_human: "Multi-client realtime behavior requires live Supabase Broadcast"
  - test: "A/B distribution bar — live updates as guest answers arrive (HOST-09, SC3)"
    expected: "After host starts a question, guest submits an answer from a second browser; the Control tab and Stats tab distribution bars both update live within ~2s, no refresh"
    why_human: "Live distribution update requires a real guest joining and answering"
  - test: "Live participant count — rises as guests join (HOST-08, SC3)"
    expected: "Participant count on Control and Stats tabs increments within ~2s when a guest joins — no manual refresh"
    why_human: "Requires a real guest join via /api/game/join triggering a Broadcast event"
  - test: "Who-answered names collapsible — shows player names by option (HOST-10)"
    expected: "After a guest answers, expanding 'Vezi cine a raspuns' on the Stats tab shows the guest's display_name under the option they chose; empty columns show 'Niciun jucator'"
    why_human: "Requires a real guest answer; /api/host/answers live DB query; UI collapsible interaction"
  - test: "Leaderboard — populates after reveal, ranked by score (Stats tab)"
    expected: "After host locks and reveals, the leaderboard card shows players ranked by score; top 3 tinted gold; 'Niciun punctaj inca.' shown when empty"
    why_human: "Requires a full reveal cycle to populate state.leaderboard from the Broadcast event"
  - test: "Question CRUD — create/edit/delete/correct-mark/reorder persist across reload (QSTN-01..05, SC2)"
    expected: "Create question; reload — persists. Edit; reload — persists. Reorder with arrows; reload — order persists. Mark A correct; reload — correct_option=A persists. Delete; reload — gone."
    why_human: "DB persistence through host CRUD API requires live Supabase and page reload cycle"
  - test: "Active-question delete guard — 409 blocked with Romanian error (QSTN-03, Pitfall 4)"
    expected: "With a question active (game in 'question' phase), attempting to delete that question shows toast 'Aceasta intrebare este activa in joc. Reseteaza runda inainte de a o sterge.' and does NOT delete"
    why_human: "Requires a live game with current_question_id set; toast behavior requires browser"
  - test: "Emergency panel — reset round, jump to question, force-end from any state (HOST-11, SC5)"
    expected: "(1) Reset Round reverts to 'Intrebare' and clears distribution within ~2s. (2) Jump to question #2 makes it active across tabs within ~2s. (3) Force-End from ANY phase shows 'Incheiat' across all tabs within ~2s"
    why_human: "Realtime state mutation timing and cross-tab sync require live Supabase (HOST-11, SC5)"
  - test: "Return-to-lobby recovery from ended state — Joc Nou / Reseteaza Jocul (GAP-04-01, HOST-11, 04-06 Task 3)"
    expected: "From the ended phase: confirm dialog 'Resetezi tot jocul?' appears; after confirm, phase returns to 'In asteptare' (lobby) within ~2s across all tabs; 'Porneste Jocul' re-enables; a fresh game starts at question #1 with answers/scores cleared. Idempotency: clicking from lobby is a harmless no-op. Distinctness: 'Reseteaza Runda' still returns only to 'Intrebare' (not lobby)."
    why_human: "DB-level full wipe via reset_game RPC (answers + scores + lobby) and Broadcast resync cannot be verified statically; requires live Supabase + browser to confirm all side-effects (04-06 Plan Task 3, PENDING)"
---

# Phase 4: Host Dashboard Verification Report

**Phase Goal:** The host can drive the entire game flow from a protected dashboard — creating and ordering questions before the event, then controlling every phase transition live — and can see live participant counts, answer distributions, and recover from mistakes using emergency controls.
**Verified:** 2026-06-04T05:30:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap-closure plan 04-06 (GAP-04-01 / HOST-11 return-to-lobby recovery)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Visiting /host with no stored password shows a password gate, not the dashboard chrome | VERIFIED | `page.tsx` — `if (password === null) return <PasswordGate />`; renders "Dashboard Gazda" heading, password Input, "Intra" Button |
| 2 | Entering the correct password grants access and the dashboard renders three tabs: Control, Intrebari, Statistici | VERIFIED | `useHostAuth.login()` stores pw on any non-401; `DashboardShell` renders TabsTriggers "control", "intrebari", "statistici" |
| 3 | Entering the wrong password shows inline Romanian error and does NOT render the dashboard | VERIFIED | `useHostAuth.ts:52-53` — status 401 → `setError("Parola gresita. Incearca din nou.")`; password remains null |
| 4 | The password persists for the session and clears on tab close (sessionStorage) | VERIFIED | `useHostAuth.ts` — post-mount useEffect reads sessionStorage behind `hydrated` flag; `logout()` calls `sessionStorage.removeItem()` |
| 5 | shadcn primitives exist in src/components/ui and the project builds with @theme tokens intact | VERIFIED | All 10 primitives present: tabs, card, button, input, alert-dialog, badge, collapsible, separator, skeleton, sonner; build passes (orchestrator confirmed) |
| 6 | Phase control buttons are enabled only when valid for the current phase | VERIFIED | `ControlTab.tsx` — PHASE_ACTIONS map (lobby→start, question→lock, locked→reveal, revealed→next+end, ended→{}); "end" ONLY in "revealed" |
| 7 | Clicking a button disables ALL phase buttons while the request is in-flight; no double-advance | VERIFIED | `ControlTab.tsx` — `if (inFlight !== null) return` guard; `anyInFlight = inFlight !== null` disables all PhaseButton instances |
| 8 | Buttons re-enable on Broadcast-confirmed phase change (not in fetch success handler); 5s fallback exists | VERIFIED | `useEffect([state?.phase])` re-enables; success path does NOT call setInFlight(null); separate `setTimeout(..., 5000)` in `useEffect([inFlight])` |
| 9 | 409/4xx/5xx response re-enables buttons immediately and shows a Romanian toast | VERIFIED | 409→"Starea jocului s-a schimbat...", 4xx→"Actiunea a esuat...", 5xx→"Eroare de server..."; each calls `setInFlight(null)` |
| 10 | Host can create/edit/delete/reorder questions and mark correct answers — all persist (QSTN-01..05) | VERIFIED | Three route files implement full CRUD; `useHostQuestions` calls `refetch()` on every mutation; QuestionRow inline edit; active-question 409 guard in DELETE |
| 11 | All question routes reject unauthenticated requests with 401 | VERIFIED | Every handler in questions/route.ts, questions/[id]/route.ts, questions/reorder/route.ts, answers/route.ts opens with validateHostAuth(req) → 401 |
| 12 | Stats tab shows live participant count (HOST-08) | VERIFIED | StatsTab renders `participantCount` from shared useGameSync props as `text-3xl font-bold text-gold-bright` |
| 13 | Stats tab shows live A/B distribution that updates as answers arrive (HOST-09) | VERIFIED | `aCount`/`bCount` prefer `state.distribution` then fall back to `names.A.length`/`names.B.length`; DistributionBar uses motion/react animated width (0.4s easeOut) |
| 14 | Host can see who answered A and who answered B (HOST-10) — names endpoint host-gated | VERIFIED | `/api/host/answers` — embedded join `"choice, players!inner(display_name)"` pivots to {A:string[],B:string[]}; validateHostAuth first statement; StatsTab renders "Vegeu cine a raspuns" collapsible |
| 15 | Stats tab shows leaderboard after reveals | VERIFIED | StatsTab renders `state.leaderboard.map()`; top 3 tinted bg-gold/10; "Niciun punctaj inca." empty state |
| 16 | Emergency panel provides reset round / jump to question / force-end from any state (HOST-11, normal controls) | VERIFIED | EmergencyPanel three controls wired to correct routes; AlertDialog on reset and force-end; force_end in transition route with `.neq("phase","ended")` CAS guard |
| 17 | force_end broadcasts existing GAME_ENDED event; no new GameEvent union member | VERIFIED | `transition/route.ts` — broadcasts `{type:"GAME_ENDED",gameId}` satisfies GameEvent; `grep -c "type: \""  src/lib/realtime/events.ts` = 8 (unchanged) |
| 18 | From the ended phase the host has a UI control that returns the game to lobby (GAP-04-01) | VERIFIED | `EmergencyPanel.tsx:272` — "Joc Nou / Reseteaza Jocul" destructive Button with AlertDialog, placed last in CollapsibleContent |
| 19 | After using the new control, the phase is 'lobby' and current_question_id is null | VERIFIED | `transition/route.ts:182-188` — calls `adminClient.rpc("reset_game", { p_game_id: gameId })`; migration 0003 RPC atomically sets phase='lobby', current_question_id=NULL, deletes all answers, zeroes scores; route returns `{ ok: true, phase: "lobby" }` |
| 20 | After returning to lobby, 'Porneste Jocul' becomes enabled and a fresh game can start | VERIFIED | PHASE_ACTIONS.lobby = `new Set(["start"])`; after reset_game RPC + GAME_ENDED broadcast clients re-fetch GET /api/game/state and see phase="lobby"; start action enabled |
| 21 | The reset-game control is confirm-gated and DISTINCT from round-only 'Reseteaza Runda' | VERIFIED | Dialog title "Resetezi tot jocul?" (vs. "Resetezi runda curenta?"); button "Joc Nou / Reseteaza Jocul" (vs. "Reseteaza Runda"); description explicitly states whole-game wipe |
| 22 | Calling the reset-game capability twice in a row is a harmless no-op (idempotent) | VERIFIED | `transition/route.ts:177-179` — `if (rgame.phase === "lobby") return NextResponse.json({ noop: true, phase: "lobby" }, { status: 200 })` short-circuit |
| 23 | Guests/TV resync after a game reset via an existing realtime event (no new GameEvent member) | VERIFIED | `transition/route.ts` reset_game branch broadcasts `{type:"GAME_ENDED",gameId}` satisfies GameEvent; events.ts GameEvent member count = 8 (unchanged); clients re-fetch and see phase:"lobby" |
| 24 | EmergencyPanel wires reset_game to POST /api/host/transition (not /api/host/reset) | VERIFIED | `EmergencyPanel.tsx:113-119` — `runAction("reset_game", "/api/host/transition", { gameId, action: "reset_game" }, ...)` |

**Score:** 24/24 truths verified (static/code evidence); 11 items require live browser verification (see Human Verification section)

---

### Deferred Items

No items deferred to later phases — all Phase 4 must-haves are implemented in the codebase.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/host/constants.ts` | GAME_ID, HOST_SENTINEL_PLAYER_ID, SESSION_KEY, hostFetch | VERIFIED | All four exports; no server-only imports; HOST_SENTINEL_PLAYER_ID = "00000000-0000-4000-8000-000000000000" |
| `src/hooks/useHostAuth.ts` | sessionStorage gate hook | VERIFIED | "use client"; hydrated flag prevents SSR mismatch; login probes /api/host/questions; 401 → error |
| `src/app/host/page.tsx` | Gate + tabbed dashboard shell | VERIFIED | Single useGameSync call in DashboardShell; three TabsContent panels; password null → PasswordGate |
| `src/components/ui/{tabs,card,button,input,alert-dialog,badge,collapsible,separator,skeleton,sonner}.tsx` | 10 shadcn primitives | VERIFIED | All 10 files present |
| `src/components/host/PhaseButton.tsx` | Phase button with states | VERIFIED | min-h-[56px]; aria-disabled/aria-busy; Loader2; motion from motion/react |
| `src/components/host/ControlTab.tsx` | Phase control surface | VERIFIED | PHASE_ACTIONS map; re-enable useEffect([state?.phase]); 5s fallback; EmergencyPanel rendered |
| `src/app/api/host/questions/route.ts` | GET list + POST create | VERIFIED | validateHostAuth first; from("questions") base table; display_order MAX+1 |
| `src/app/api/host/questions/[id]/route.ts` | PUT + DELETE with active-question guard | VERIFIED | validateHostAuth first; PUT scoped with .eq("game_id"); DELETE checks current_question_id → 409 |
| `src/app/api/host/questions/reorder/route.ts` | PATCH bulk display_order | VERIFIED | validateHostAuth first; Promise.all; results.find(r=>r.error) error check |
| `src/hooks/useHostQuestions.ts` | CRUD hook | VERIFIED | "use client"; all five operations use hostFetch with x-host-password; refetch() on success |
| `src/components/host/QuestionRow.tsx` | Inline edit-in-list row | VERIFIED | aria-pressed on correct pills; min-h-[44px] on action buttons; AlertDialog delete confirm |
| `src/components/host/QuestionsTab.tsx` | Questions tab | VERIFIED | "Nu ai intrebari inca." empty state; Skeleton loading; reorder via handleMove() |
| `src/app/api/host/answers/route.ts` | GET per-option player names | VERIFIED | validateHostAuth first; embedded join players!inner; pivots to {A,B} |
| `src/hooks/useHostAnswerNames.ts` | On-demand names hook | VERIFIED | "use client"; hostFetch with x-host-password; skips when questionId null; refetch on questionId change |
| `src/components/host/DistributionBar.tsx` | Animated A/B bar | VERIFIED | motion from "motion/react"; role="meter"; aria-valuenow; animated width 0.4s easeOut |
| `src/components/host/StatsTab.tsx` | Live stats surface | VERIFIED | participantCount from props; distribution prefers state then names lengths; leaderboard; all empty states |
| `src/components/host/EmergencyPanel.tsx` | Emergency controls collapsible (4 controls) | VERIFIED | Collapsible default-closed; 4 AlertDialog controls (reset/jump/force-end/new-game); reset_game wired to transition route; distinct from round-only reset |
| `src/app/api/host/transition/route.ts` (reset_game) | reset_game action: any-phase return-to-lobby | VERIFIED | In Action union and VALID_ACTIONS; branched before TRANSITIONS map; reads game; noop from lobby; calls adminClient.rpc("reset_game"); broadcasts GAME_ENDED; returns {ok:true,phase:"lobby"} |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| src/app/host/page.tsx | src/hooks/useHostAuth.ts | useHostAuth() | WIRED | Imported and called at page root; gate on password === null |
| src/app/host/page.tsx | src/components/host/ControlTab.tsx | TabsContent render | WIRED | `<ControlTab {...tabProps} />` in TabsContent value="control" |
| src/components/host/ControlTab.tsx | /api/host/transition | hostFetch POST | WIRED | start/lock/next/end all call hostFetch("/api/host/transition", ...) |
| src/components/host/ControlTab.tsx | /api/host/reveal | hostFetch POST | WIRED | reveal calls hostFetch("/api/host/reveal", ...) with {gameId, choice} |
| src/components/host/ControlTab.tsx | state?.phase (re-enable) | useEffect dependency | WIRED | `useEffect(() => { if (inFlight !== null) setInFlight(null); }, [state?.phase])` |
| src/app/api/host/questions/route.ts | adminClient.from("questions") | base table | WIRED | from("questions") (not questions_public) — correct_option accessible |
| src/hooks/useHostQuestions.ts | /api/host/questions | hostFetch x-host-password | WIRED | All five operations call hostFetch with password; refetch() on success |
| src/components/host/QuestionsTab.tsx | useHostQuestions | CRUD hook | WIRED | Destructures create/update/remove/reorder from useHostQuestions(gameId, password) |
| src/app/api/host/answers/route.ts | answers→players join | select "players!inner(display_name)" | WIRED | `.select("choice, players!inner(display_name)").eq("question_id", questionId)` |
| src/hooks/useHostAnswerNames.ts | /api/host/answers | hostFetch x-host-password | WIRED | `hostFetch(\`/api/host/answers?gameId=${gameId}&questionId=${questionId}\`, password)` |
| src/components/host/StatsTab.tsx | useGameSync participantCount + state | shared props from page | WIRED | Props {state, status, participantCount, password, gameId} passed from DashboardShell |
| src/components/host/EmergencyPanel.tsx | /api/host/reset | hostFetch POST | WIRED | `runAction("reset", "/api/host/reset", { gameId }, ...)` |
| src/components/host/EmergencyPanel.tsx | /api/host/transition (force_end) | hostFetch POST | WIRED | `runAction("force_end", "/api/host/transition", { gameId, action: "force_end" }, ...)` |
| src/components/host/EmergencyPanel.tsx | /api/host/transition (reset_game) | hostFetch POST | WIRED | `runAction("reset_game", "/api/host/transition", { gameId, action: "reset_game" }, ...)` |
| src/components/host/ControlTab.tsx | src/components/host/EmergencyPanel.tsx | render in section C | WIRED | `<EmergencyPanel gameId={gameId} password={password} questions={questions} />` at bottom of ControlTab |
| src/app/api/host/transition/route.ts | reset_game RPC | adminClient.rpc("reset_game") | WIRED | `adminClient.rpc("reset_game", { p_game_id: gameId })` — calls migration 0003 SECURITY DEFINER function |
| src/app/api/host/transition/route.ts | game:{gameId} channel | broadcast GAME_ENDED for resync | WIRED | `broadcast(\`game:${gameId}\`, "GAME_EVENT", { type: "GAME_ENDED", gameId })` in reset_game branch |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| StatsTab | `participantCount` | useGameSync → Supabase Broadcast presence | Yes | FLOWING (static; live requires browser) |
| StatsTab | `state.distribution` | useGameSync → GET /api/game/state → DB | Yes — queries answers table | FLOWING |
| StatsTab | `state.leaderboard` | useGameSync → Broadcast after reveal | Yes — Phase 3 reveal computes scores | FLOWING |
| StatsTab | `names` (useHostAnswerNames) | GET /api/host/answers → adminClient join | Yes — live DB query answers+players | FLOWING |
| QuestionsTab | `questions` | useHostQuestions GET → adminClient | Yes — queries questions by game_id ordered by display_order | FLOWING |
| ControlTab | `state.phase` (re-enable trigger) | useGameSync → Broadcast | Yes — Broadcast events from Phase 3 transitions | FLOWING |
| EmergencyPanel reset_game | RPC result | adminClient.rpc("reset_game") → DB | Yes — migration 0003 SQL function (full wipe) | FLOWING (static; side-effects require live DB) |

---

### Behavioral Spot-Checks

Skipped — all runnable checks require a live Supabase connection. Build and typecheck pass (orchestrator confirmed: `npx tsc --noEmit` and `npm run build` both exit 0).

---

### Probe Execution

No probe scripts found under `scripts/*/tests/probe-*.sh` for Phase 4. Skipped.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| HOST-08 | 04-04-PLAN.md | Host sees live participant count | SATISFIED | StatsTab and ControlTab both render `participantCount` from shared useGameSync props |
| HOST-09 | 04-04-PLAN.md | Host sees live A/B answer distribution | SATISFIED | DistributionBar (motion/react animated) in ControlTab and StatsTab; counts from state.distribution or names lengths |
| HOST-10 | 04-04-PLAN.md | Host can see who answered what | SATISFIED | /api/host/answers (host-auth-gated); useHostAnswerNames; StatsTab "Vezi cine a raspuns" collapsible |
| HOST-11 | 04-02+04-05+04-06-PLAN.md | Emergency recovery controls | SATISFIED | EmergencyPanel: reset round, jump, force-end, AND new-game/return-to-lobby (GAP-04-01 closed); all confirm-gated |
| QSTN-01 | 04-03-PLAN.md | Host can create a question | SATISFIED | POST /api/host/questions; QuestionsTab "+ Adauga Intrebare"; QuestionRow draft mode |
| QSTN-02 | 04-03-PLAN.md | Host can edit a question | SATISFIED | PUT /api/host/questions/[id]; QuestionRow editing mode with Input fields + Salveaza |
| QSTN-03 | 04-03-PLAN.md | Host can delete a question | SATISFIED | DELETE /api/host/questions/[id]; AlertDialog confirmation; 409 active-question guard |
| QSTN-04 | 04-03-PLAN.md | Host can mark correct option (A or B) | SATISFIED | PUT with correct_option; QuestionRow A/B pills with aria-pressed; selected pill bg-gold text-ink |
| QSTN-05 | 04-03-PLAN.md | Host can reorder questions | SATISFIED | PATCH /api/host/questions/reorder; QuestionsTab handleMove() calls reorder() |

All 9 requirements mapped to Phase 4 in REQUIREMENTS.md are implemented. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/components/host/ControlTab.tsx | 157 | `eslint-disable-next-line react-hooks/exhaustive-deps` — stale closure on re-enable useEffect; `inFlight` not in dependency array | WARNING | Stale closure can leave buttons locked until 5s fallback fires in a race. 5s fallback mitigates worst case. Single-host wedding use makes this unlikely. |
| src/app/api/host/answers/route.ts | 59 | `gameId` UUID-validated but not used in the DB query filter — query filters only on `question_id` | WARNING | In a single-game MVP, question UUIDs are globally unique; cross-game leakage not practically exploitable. Low risk for current deployment. |

**Debt markers:** Zero TBD/FIXME/XXX markers found across all Phase 4 source files. No blocker on this gate.

---

### Human Verification Required

All items require a live browser with `HOST_PASSWORD` set in `.env.local`, `npm run dev` running, and a live Supabase connection.

Items 1–10 were deferred from plans 04-01 through 04-05 (`human_verify_mode: end-of-phase`). The UAT (04-HUMAN-UAT.md) ran 5/5 tests passing; some live-browser checks (HOST-08 full presence count, all live-stats cadence) still require the Phase 5 guest app. Item 11 is the new Task 3 from plan 04-06, explicitly recorded as PENDING end-of-phase human verify.

#### 1. Password Gate — Deny / Grant / Session Persistence

**Test:**
1. Ensure `.env.local` has `HOST_PASSWORD=<your-password>`. Restart `npm run dev`.
2. Visit http://localhost:3000/host — verify "Dashboard Gazda" gate, NOT the tabs.
3. Enter wrong password → inline red "Parola gresita. Incearca din nou." with no dashboard.
4. Enter correct password → three-tab shell (Control, Intrebari, Statistici) with connection badge.
5. Reload — stay logged in. Close tab, reopen — gate shown again.

**Expected:** Gate → deny wrong → grant correct → persist reload → re-prompt after close
**Why human:** sessionStorage lifecycle and auth probe require a real browser session (SC1)

---

#### 2. Phase Control Buttons — Enable/Disable + In-Flight Lock + Broadcast Re-enable

**Test:**
1. Log into /host. Confirm only "Porneste Jocul" is enabled.
2. Tap "Porneste Jocul" — spinner + "..." immediately; ALL buttons disabled.
3. Phase badge changes to "Intrebare" within ~1s (Broadcast) — "Blocheaza Raspunsurile" becomes enabled.
4. Rapidly double-tap a valid button — game advances by exactly one step.
5. Open /host in a second tab; trigger phase change from tab A — tab B updates within ~2s.
6. Force a 409 — expect "Starea jocului s-a schimbat..." toast.

**Expected:** Phase-gated enables; in-flight spinner; Broadcast re-enable ~1s; no double-advance; cross-tab sync
**Why human:** Broadcast timing and double-tap race require live Supabase Realtime (SC4)

---

#### 3. Question CRUD + Reorder + Correct-Mark Persistence

**Test:**
1. Open "Intrebari" tab. Create question (body + A + B), mark A correct, save. Reload — persists (QSTN-01/04).
2. Edit body, save, reload — persists (QSTN-02).
3. Add second question; use arrows to reorder; reload — new order persists (QSTN-05).
4. Delete second question via confirm dialog; reload — gone (QSTN-03).
5. Start game so a question is active. Try to delete active question — expect toast "Aceasta intrebare este activa in joc. Reseteaza runda inainte de a o sterge." with no deletion.

**Expected:** All CRUD + reorder + correct-mark persist; active-question delete blocked
**Why human:** DB persistence requires live Supabase; UI interactions require browser (QSTN-01..05, SC2)

---

#### 4. Live Stats — Participant Count + Distribution + Who Answered + Leaderboard

**Test:**
1. Open "Statistici" tab. Note participant count.
2. In a second browser, join as a guest. Within ~2s count increments — no refresh (HOST-08).
3. Host starts a question. Guest submits an answer. Distribution bar updates live (HOST-09).
4. Expand "Vezi cine a raspuns" — guest's name under their option (HOST-10).
5. Host locks + reveals. Leaderboard populates ranked by score.

**Expected:** Count live ~2s; distribution live; names in collapsible; leaderboard after reveal
**Why human:** Requires live Supabase Realtime + real guest session (SC3)

---

#### 5. Emergency Recovery — Reset / Jump / Force-End Within ~2s

**Test:**
1. With 2+ questions authored, start game. Expand "Controale de urgenta".
2. Guest answers; click "Reseteaza Runda" → confirm. Within ~2s phase = "Intrebare", distribution clears.
3. Advance to revealed; enter "2" in jump; click "Sari la Intrebare". Within ~2s active question = #2 across tabs.
4. From ANY phase (mid-question), click "Incheie Fortat Jocul" → confirm. Within ~2s phase = "Incheiat" across all tabs.

**Expected:** Each emergency action takes effect + broadcasts within ~2s; force-end from any phase
**Why human:** Realtime broadcast timing and multi-tab sync require live Supabase (HOST-11, SC5)

---

#### 6. Return-to-Lobby Recovery from Ended State (GAP-04-01, 04-06 Plan Task 3)

**Prereqs:** HOST_PASSWORD in .env.local, at least 2 questions authored, migration 0003_reset_function.sql applied (already — Phase 3).

**Test:**
1. Log into /host → Control tab. Start game. Have a guest answer; complete a reveal so there is a non-zero score.
2. Reach ended phase: advance to revealed → "Incheie Jocul", OR use "Incheie Fortat Jocul". Phase badge = "Incheiat". Confirm "Porneste Jocul" is greyed out (stuck state).
3. Expand "Controale de urgenta". Click "Joc Nou / Reseteaza Jocul" → dialog "Resetezi tot jocul?" appears → click "Da, reseteaza jocul".
4. Within ~2s across all open tabs: phase badge = "In asteptare"; distribution shows "Niciun raspuns inca."; "Porneste Jocul" ENABLED.
5. Click "Porneste Jocul" → fresh game starts at question #1 with answers/scores cleared (leaderboard empty). Confirms second game runs with no manual DB edit.
6. Idempotency check: from lobby, click "Joc Nou / Reseteaza Jocul" → confirm → no error toast; phase stays "In asteptare".
7. Distinctness check: start a game, answer, use "Reseteaza Runda" → confirm it returns to "Intrebare" (NOT lobby).

**Expected:** Ended game recoverable to lobby within ~2s; fresh game starts with cleared answers/scores; idempotent no-op from lobby; "Reseteaza Runda" remains round-only
**Why human:** DB-level full wipe via reset_game RPC and Broadcast resync require live Supabase + browser to confirm all side-effects (04-06 Plan Task 3, status PENDING)

---

### Gaps Summary

No blocking gaps. All 24 must-have truths are implemented in the codebase with verifiable code evidence.

GAP-04-01 is closed in the codebase: `reset_game` action on `POST /api/host/transition` (lines 165-204 of transition/route.ts) and "Joc Nou / Reseteaza Jocul" in EmergencyPanel (lines 262-296) are both present, wired, and structurally correct. The single remaining item is live-browser verification of the DB side-effects (human item 6).

Two code-quality warnings acknowledged (not blocking):

1. **CR-02 (answers no game_id join)** — gameId validated but not used in the query filter. Single-game MVP, globally unique question UUIDs; not exploitable in practice. Recommended fix for Phase 5+.
2. **CR-04 (stale closure in re-enable useEffect)** — eslint-disable suppresses the warning; 5s fallback prevents permanent button lock. The inFlightRef pattern is the correct long-term fix but does not affect the single-host wedding use case.

---

_Verified: 2026-06-04T05:30:00Z_
_Verifier: Claude (gsd-verifier)_
