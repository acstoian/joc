---
phase: 04-host-dashboard
verified: 2026-06-03T20:00:00Z
status: human_needed
score: 17/17 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Password gate — deny wrong / grant correct / persist session"
    expected: "Wrong password shows 'Parola gresita. Incearca din nou.' with no dashboard; correct password shows three-tab shell; reload stays authenticated; tab close re-prompts"
    why_human: "sessionStorage behavior and realtime auth probe require a real browser session"
  - test: "Phase control buttons — enabled only when valid; in-flight lock and Broadcast re-enable"
    expected: "Only 'Porneste Jocul' active in lobby; tapping a valid button shows spinner and disables all buttons immediately; re-enable occurs when the phase badge changes (Broadcast), not on fetch return (~1s); double-tap advances by exactly one step"
    why_human: "Broadcast-confirmed re-enable timing and double-tap race require live Supabase Realtime"
  - test: "Cross-tab phase sync — second host tab reflects state changes within ~2s"
    expected: "Open /host in two browser tabs; trigger a phase change from tab A; tab B's phase badge and button states update within 2s without refresh"
    why_human: "Multi-client realtime behavior requires live Supabase Broadcast"
  - test: "A/B distribution bar — live updates as guest answers arrive"
    expected: "After host starts a question, guest submits an A or B answer from a second browser; the Control tab distribution bar and Stats tab distribution bar both update live (within ~2s, no refresh)"
    why_human: "Live distribution update requires a real guest joining and answering (HOST-09, SC3)"
  - test: "Live participant count — rises as guests join (HOST-08, SC3)"
    expected: "Participant count on both Control and Stats tabs increments within ~2s when a guest joins — no manual refresh"
    why_human: "Requires a real guest join via /api/game/join triggering a Broadcast event"
  - test: "Who-answered names collapsible — shows player names by option (HOST-10)"
    expected: "After a guest answers, expanding 'Vezi cine a raspuns' on the Stats tab shows the guest's display_name under the option they chose (A or B); empty columns show 'Niciun jucator'"
    why_human: "Requires a real guest answer; /api/host/answers live DB query; UI collapsible interaction"
  - test: "Leaderboard — populates after reveal (Stats tab)"
    expected: "After host locks and reveals, the leaderboard card on the Stats tab shows players ranked by score; top 3 are tinted gold; 'Niciun punctaj inca.' shown when empty"
    why_human: "Requires a full reveal cycle to populate state.leaderboard from the Broadcast event"
  - test: "Question CRUD — create/edit/delete/correct-mark/reorder persist across reload (QSTN-01..05, SC2)"
    expected: "Create a question; reload — it persists. Edit text; reload — edit persists. Reorder with ▲/▼; reload — new order persists. Mark A correct; reload — correct_option=A persists. Delete second question; reload — it is gone."
    why_human: "DB persistence through the new host CRUD API requires a live Supabase DB and page reload cycle"
  - test: "Active-question delete guard — 409 blocked with Romanian error (Pitfall 4, QSTN-03)"
    expected: "With a question active (game in 'question' phase), attempting to delete that question shows the toast 'Aceasta intrebare este activa in joc. Reseteaza runda inainte de a o sterge.' and does NOT delete"
    why_human: "Requires a live game with current_question_id set; UI toast behavior requires browser"
  - test: "Emergency panel — reset round, jump to question, force-end from any state (HOST-11, SC5)"
    expected: "(1) With answers submitted, Reset Round reverts to 'Intrebare' and clears distribution within ~2s. (2) From revealed phase, Jump to #2 makes question #2 active across tabs within ~2s. (3) From ANY phase (even mid-question), Force-End shows 'Incheiat' across all tabs within ~2s."
    why_human: "Realtime state mutation timing and cross-tab sync require live Supabase; each sub-action has a distinct phase requirement"
---

# Phase 4: Host Dashboard Verification Report

**Phase Goal:** A wedding host can open /host behind a password gate and operate a three-tab dashboard (Control · Intrebari · Statistici) to: drive the live game phase machine, author/edit/delete/reorder questions and mark correct answers, watch live participant count + A/B distribution + who-answered names + leaderboard, and recover via emergency controls (reset round / jump to question / force-end from any state).
**Verified:** 2026-06-03T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Visiting /host with no stored password shows a password gate, not the dashboard chrome | VERIFIED | `src/app/host/page.tsx:238` — `if (password === null) return <PasswordGate />`; gate renders "Dashboard Gazda" heading, password Input, "Intra" Button |
| 2 | Entering the correct password grants access and the dashboard renders three tabs: Control, Intrebari, Statistici | VERIFIED | `useHostAuth.login()` stores pw on any non-401 response; `DashboardShell` renders `TabsTrigger` values "control", "intrebari", "statistici" (page.tsx:194-211) |
| 3 | Entering the wrong password shows the inline Romanian error and does NOT render the dashboard | VERIFIED | `useHostAuth.ts:52-53` — status 401 → `setError("Parola gresita. Incearca din nou.")`; password remains null; gate stays rendered |
| 4 | The password persists for the session (reload keeps the host in) and clears on tab close | VERIFIED | `useHostAuth.ts:36-37` — `useState<string|null>(() => typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null)`; `logout()` calls `sessionStorage.removeItem()` |
| 5 | shadcn primitives exist in src/components/ui and the project still builds with custom @theme tokens intact | VERIFIED | All 10 UI files present: tabs.tsx, card.tsx, button.tsx, input.tsx, alert-dialog.tsx, badge.tsx, collapsible.tsx, separator.tsx, skeleton.tsx, sonner.tsx; build confirmed passing |
| 6 | Phase control buttons are enabled only when valid for the current phase | VERIFIED | `ControlTab.tsx:54-65` — `PHASE_ACTIONS` map (lobby→start, question→lock, locked→reveal, revealed→next+end, ended→{}); `isActionEnabled()` gates each `PhaseButton`; "end" only in "revealed" |
| 7 | Clicking a button disables ALL phase buttons while the request is in-flight; no double-tap double-advance | VERIFIED | `ControlTab.tsx:232-234` — `if (inFlight !== null) return` guard; `anyInFlight = inFlight !== null` disables all `PhaseButton`s |
| 8 | Buttons re-enable on Broadcast-confirmed phase change (not in fetch success handler); 5s fallback exists | VERIFIED | `ControlTab.tsx:205-218` — re-enable `useEffect` depends on `[state?.phase]`; success path does NOT call `setInFlight(null)` (line 281 comment confirms); separate 5s `setTimeout` in `useEffect([inFlight])` |
| 9 | 409/4xx/5xx response re-enables buttons immediately and shows a Romanian toast | VERIFIED | `ControlTab.tsx:266-290` — 409→"Starea jocului s-a schimbat...", 4xx→"Actiunea a esuat...", 5xx→"Eroare de server..."; each calls `setInFlight(null)` then returns |
| 10 | Host can create/edit/delete/reorder questions and mark correct answers — all persist (QSTN-01..05, SC2) | VERIFIED (static) | Three route files implement full CRUD; `useHostQuestions` calls `refetch()` on every mutation success; `QuestionRow` implements inline edit; `QuestionsTab` calls `reorder()` on ▲/▼; active-question 409 guard in DELETE; requires live browser to confirm DB persistence |
| 11 | All question routes reject unauthenticated requests with 401 | VERIFIED | Every handler in questions/route.ts, questions/[id]/route.ts, questions/reorder/route.ts, answers/route.ts starts with `if (!validateHostAuth(req)) return NextResponse.json({error:"unauthorized"},{status:401})` |
| 12 | Stats tab shows live participant count | VERIFIED (static) | `StatsTab.tsx:50-56` receives `participantCount` from shared `useGameSync` props; rendered as `text-3xl font-bold text-gold-bright` at line 77 |
| 13 | Stats tab shows live A/B distribution that updates as answers arrive | VERIFIED (static) | `StatsTab.tsx:60-63` — `aCount`/`bCount` prefer `state.distribution` (locked/revealed) then fall back to `names.A.length`/`names.B.length` (live during question phase); `DistributionBar` uses `motion/react` animated width |
| 14 | Host can see who answered A and who answered B (HOST-10) — names endpoint host-gated | VERIFIED | `answers/route.ts` — embedded join `answers.select("choice, players!inner(display_name)")` pivots to `{A:string[],B:string[]}`; `validateHostAuth` first statement; `StatsTab` renders collapsible with names |
| 15 | Stats tab shows leaderboard after reveals | VERIFIED (static) | `StatsTab.tsx:157-191` — `state.leaderboard.map()` renders rank+name+score; top 3 `bg-gold/10` tinted; "Niciun punctaj inca." empty state |
| 16 | Emergency panel provides reset round / jump to question / force-end from any state (HOST-11) | VERIFIED | `EmergencyPanel.tsx` — three controls wired to correct routes; AlertDialog confirmations on reset and force-end; `force_end` action added to `transition/route.ts` with `.neq("phase","ended")` CAS guard; `EmergencyPanel` rendered in `ControlTab.tsx:407` |
| 17 | force_end broadcasts existing GAME_ENDED event; no new GameEvent union member added | VERIFIED | `transition/route.ts:138-147` — broadcasts `{type:"GAME_ENDED",gameId}` using `satisfies GameEvent`; no new union member; existing event type reused |

**Score:** 17/17 truths verified (static/code evidence); 10 items require live browser verification (see Human Verification section)

---

### Deferred Items

No items deferred to later phases — all Phase 4 must-haves are implemented in the codebase.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/host/constants.ts` | GAME_ID, HOST_SENTINEL_PLAYER_ID, SESSION_KEY, hostFetch | VERIFIED | All four exports present; no server-only imports; HOST_SENTINEL_PLAYER_ID = "00000000-0000-4000-8000-000000000000" |
| `src/hooks/useHostAuth.ts` | sessionStorage gate hook, login/logout | VERIFIED | "use client"; exports `useHostAuth`; login probes /api/host/questions; 401→error; non-401→store |
| `src/app/host/page.tsx` | Gate + tabbed dashboard shell | VERIFIED | PasswordGate / DashboardShell split; single `useGameSync` call; three TabsContent panels |
| `src/components/ui/tabs.tsx` | shadcn Tabs primitive | VERIFIED | File exists |
| `src/components/host/PhaseButton.tsx` | Phase button with enabled/disabled/in-flight states | VERIFIED | "use client"; `min-h-[56px]`; `aria-disabled`/`aria-busy`; Loader2 from lucide-react; motion from motion/react |
| `src/components/host/ControlTab.tsx` | Phase control surface | VERIFIED | PHASE_ACTIONS map; re-enable useEffect on [state?.phase]; 5s fallback; error toasts; EmergencyPanel rendered |
| `src/app/api/host/questions/route.ts` | GET list + POST create | VERIFIED | validateHostAuth first; adminClient.from("questions"); display_order MAX+1; no questions_public |
| `src/app/api/host/questions/[id]/route.ts` | PUT update + DELETE with active-question guard | VERIFIED | validateHostAuth first; PUT has .eq("game_id", gameId) (CR-01 fixed); DELETE checks current_question_id → 409 |
| `src/app/api/host/questions/reorder/route.ts` | PATCH bulk display_order | VERIFIED | validateHostAuth first; Promise.all; results.find(r=>r.error) error check (WR-01 fixed) |
| `src/hooks/useHostQuestions.ts` | CRUD hook | VERIFIED | "use client"; exports create/update/remove/reorder; all use hostFetch with x-host-password; refetch() on success |
| `src/components/host/QuestionRow.tsx` | Inline edit-in-list row | VERIFIED | RowMode state machine; aria-pressed on correct pills; min-h-[44px] on reorder buttons; AlertDialog delete confirm |
| `src/components/host/QuestionsTab.tsx` | Questions tab | VERIFIED | "Nu ai intrebari inca." empty state; Skeleton loading; reorder via ▲/▼ |
| `src/app/api/host/answers/route.ts` | GET per-option player names, host-gated | VERIFIED | validateHostAuth first; embedded join players!inner; pivots to {A,B}; error.message logged not returned (CR-03 fixed) |
| `src/hooks/useHostAnswerNames.ts` | On-demand names hook | VERIFIED | "use client"; fetches with x-host-password; skips when questionId null; refetch on questionId change; cancelled guard |
| `src/components/host/DistributionBar.tsx` | Animated A/B bar | VERIFIED | motion from "motion/react" (not framer-motion); role="meter"; aria-valuenow; animated width 0.4s easeOut |
| `src/components/host/StatsTab.tsx` | Live stats surface | VERIFIED | All four sections implemented; participantCount from props; distribution prefers state then names lengths; leaderboard from state.leaderboard |
| `src/components/host/EmergencyPanel.tsx` | Emergency controls collapsible | VERIFIED | Collapsible default-closed; AlertDialog on reset and force-end; correct route/action mappings; success/error toasts |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| src/app/host/page.tsx | src/hooks/useHostAuth.ts | useHostAuth() call | WIRED | `useHostAuth` imported and called at page root; gate decision on `password === null` |
| src/app/host/page.tsx | src/components/host/ControlTab.tsx | TabsContent rendering | WIRED | `<ControlTab {...tabProps} />` in TabsContent value="control" (line 215) |
| src/components/host/ControlTab.tsx | /api/host/transition | hostFetch POST | WIRED | Lines 254-258 and 259-263 call `hostFetch("/api/host/transition", password, {...})` with action |
| src/components/host/ControlTab.tsx | /api/host/reveal | hostFetch POST | WIRED | Lines 242-245 call `hostFetch("/api/host/reveal", password, {...})` with choice |
| src/components/host/ControlTab.tsx | state?.phase (re-enable) | useEffect dependency | WIRED | `useEffect(() => { if (inFlight !== null) setInFlight(null); }, [state?.phase])` at line 205-210 |
| src/app/api/host/questions/route.ts | adminClient.from("questions") | Supabase base table | WIRED | `.from("questions")` (not questions_public) at lines 38-42 |
| src/hooks/useHostQuestions.ts | /api/host/questions | hostFetch with x-host-password | WIRED | All five operations call hostFetch with correct URLs and password param |
| src/components/host/QuestionsTab.tsx | useHostQuestions | CRUD hook | WIRED | `const { questions, loading, error, create, update, remove, reorder } = useHostQuestions(gameId, password)` |
| src/app/api/host/answers/route.ts | adminClient answers→players join | select "players!inner(display_name)" | WIRED | Line 58: `.select("choice, players!inner(display_name)")` |
| src/hooks/useHostAnswerNames.ts | /api/host/answers | fetch with x-host-password | WIRED | `hostFetch(\`/api/host/answers?gameId=${gameId}&questionId=${questionId}\`, password)` |
| src/components/host/StatsTab.tsx | useGameSync participantCount + state.distribution | shared props from page | WIRED | Props destructured: `{ state, status, participantCount, password, gameId }` |
| src/components/host/EmergencyPanel.tsx | /api/host/reset | hostFetch POST {gameId} | WIRED | `runAction("reset", "/api/host/reset", { gameId }, ...)` |
| src/components/host/EmergencyPanel.tsx | /api/host/transition (force_end) | hostFetch POST | WIRED | `runAction("force_end", "/api/host/transition", { gameId, action: "force_end" }, ...)` |
| src/components/host/ControlTab.tsx | src/components/host/EmergencyPanel.tsx | collapsible section render | WIRED | `<EmergencyPanel gameId={gameId} password={password} questions={questions} />` at line 407 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| StatsTab | `participantCount` | `useGameSync` → Supabase Broadcast presence | Yes — live count from Broadcast channel | FLOWING (static verified; live requires browser) |
| StatsTab | `state.distribution` | `useGameSync` → GET /api/game/state → DB query | Yes — Phase 3 route queries answers table | FLOWING |
| StatsTab | `state.leaderboard` | `useGameSync` → Broadcast event after reveal | Yes — Phase 3 reveal route computes scores | FLOWING |
| StatsTab | `names` (useHostAnswerNames) | GET /api/host/answers → adminClient join | Yes — live DB query on answers+players tables | FLOWING |
| QuestionsTab | `questions` | useHostQuestions GET → /api/host/questions → adminClient | Yes — queries questions table by game_id ordered by display_order | FLOWING |
| ControlTab | `state.phase` (re-enable trigger) | `useGameSync` → Broadcast event | Yes — Broadcast events from Phase 3 transitions | FLOWING |

---

### Behavioral Spot-Checks

Step 7b skipped — all runnable checks require a live Supabase connection (no static server to query). Build passes confirmed by user (stated in verification task instructions: "build passes, tsc clean").

---

### Probe Execution

No probe scripts found under `scripts/*/tests/probe-*.sh`. Phase 3 had probes; Phase 4 has none declared. Step 7c: SKIPPED (no probe scripts for this phase).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| HOST-08 | 04-04-PLAN.md | Host sees live participant count | SATISFIED | StatsTab renders `participantCount` from useGameSync; ControlTab status strip also shows count |
| HOST-09 | 04-04-PLAN.md | Host sees live A/B answer distribution | SATISFIED | DistributionBar in both ControlTab (motion.div animated) and StatsTab; live via useHostAnswerNames lengths during question phase |
| HOST-10 | 04-04-PLAN.md | Host can see who answered what | SATISFIED | /api/host/answers endpoint; useHostAnswerNames hook; StatsTab "Vezi cine a raspuns" collapsible |
| HOST-11 | 04-02+04-05-PLAN.md | Emergency recovery controls | SATISFIED | Normal "end" from revealed in ControlTab; EmergencyPanel provides reset/jump/force_end; force_end action added to transition route |
| QSTN-01 | 04-03-PLAN.md | Host can create a question | SATISFIED | POST /api/host/questions; QuestionsTab "+ Adauga Intrebare"; QuestionRow draft mode |
| QSTN-02 | 04-03-PLAN.md | Host can edit a question | SATISFIED | PUT /api/host/questions/[id]; QuestionRow editing mode with Inputs + Salveaza |
| QSTN-03 | 04-03-PLAN.md | Host can delete a question | SATISFIED | DELETE /api/host/questions/[id]; AlertDialog confirmation; 409 active-question guard |
| QSTN-04 | 04-03-PLAN.md | Host can mark correct option (A or B) | SATISFIED | PUT with `correct_option`; QuestionRow A/B pills with aria-pressed; bg-gold text-ink selected state |
| QSTN-05 | 04-03-PLAN.md | Host can reorder questions | SATISFIED | PATCH /api/host/questions/reorder; QuestionsTab handleMove() swaps and calls reorder() |

All 9 requirements mapped to Phase 4 in REQUIREMENTS.md are implemented in the codebase. No orphaned requirements.

---

### Anti-Patterns Found

| File | Finding | Severity | Impact |
|------|---------|----------|--------|
| src/components/host/ControlTab.tsx:209 | `eslint-disable-next-line react-hooks/exhaustive-deps` suppresses stale closure warning on the re-enable useEffect — `inFlight` is not in the dependency array (CR-04 from REVIEW.md) | WARNING | In a multi-host race scenario, the stale closure can leave buttons locked until the 5s fallback fires. The 5s fallback mitigates the worst case. Single-host wedding use makes this unlikely to surface. |
| src/app/api/host/answers/route.ts:59 | `gameId` UUID-validated but not used in the DB query — query filters only on `question_id`, not `question.game_id` (CR-02 from REVIEW.md) | WARNING | In a single-game MVP, question UUIDs are globally unique so cross-game leakage is not practically exploitable. The REVIEW assessed this as low risk for the current deployment. |
| src/components/host/ControlTab.tsx:103-151 | Local private `DistributionBar` function duplicates `src/components/host/DistributionBar.tsx` (WR-04 from REVIEW.md) | INFO | Code duplication — styling changes must be made in two places. No functional impact. |

**Debt markers:** Zero TBD/FIXME/XXX markers found across all Phase 4 source files. No blocker on this gate.

**REVIEW.md critical issues status:**
- CR-01 (PUT missing game_id scope): **FIXED** — `[id]/route.ts:111` has `.eq("game_id", gameId)`
- CR-02 (answers route no game_id join): **STILL PRESENT** — gameId validated but not used in query (WARNING)
- CR-03 (error.message leaked to client): **FIXED** — all routes now log error.message server-side and return opaque error codes
- CR-04 (stale closure in re-enable useEffect): **STILL PRESENT** — eslint-disable + no inFlightRef pattern (WARNING)
- WR-01 (reorder silently ignores errors): **FIXED** — `reorder/route.ts:69-73` checks `results.find(r=>r.error)`

---

### Human Verification Required

All items below require a live browser with `HOST_PASSWORD` set in `.env.local`, `npm run dev` running, and a live Supabase connection. All five plans' `checkpoint:human-verify` tasks were in `human_verify_mode: end-of-phase` — collected here.

#### 1. Password Gate — Deny / Grant / Session Persistence

**Test:**
1. Ensure `.env.local` has `HOST_PASSWORD=<your-password>`. Restart `npm run dev`.
2. Visit http://localhost:3000/host — verify you see the "Dashboard Gazda" gate, NOT the tabs.
3. Enter a WRONG password, click "Intra" — expect inline red "Parola gresita. Incearca din nou." with no dashboard.
4. Enter the CORRECT password — expect the three-tab shell (Control · Intrebari · Statistici) with a connection status badge.
5. Reload the tab — you should stay logged in (password in sessionStorage). Close the tab and reopen — should see the gate again.

**Expected:** Gate → deny wrong → grant correct → persist reload → re-prompt after close
**Why human:** sessionStorage lifecycle and realtime auth probe require a real browser session (SC1)

---

#### 2. Phase Control Buttons — Enable/Disable + In-Flight Lock + Broadcast Re-enable

**Test:**
1. Log into /host. Confirm only "Porneste Jocul" is enabled (others opacity-40).
2. Tap "Porneste Jocul" — button should show spinner + "Porneste Jocul..." immediately; ALL five buttons disabled.
3. Observe the phase badge changing to "Intrebare" within ~1s (Broadcast arrives). At that point "Blocheaza Raspunsurile" becomes enabled.
4. Rapidly double-tap a valid button — game must advance by exactly one step.
5. Open /host in a second tab; trigger phase change from tab A — tab B badge + buttons update within ~2s.
6. Force a 409 (race two tabs simultaneously) — expect "Starea jocului s-a schimbat..." toast and correct phase reflected.
7. In locked phase, verify the A/B picker appears; select B; tap "Dezvaluie Raspunsul" — reveal records B as correct.

**Expected:** Phase-gated enables; in-flight spinner; Broadcast-confirmed re-enable ~1s; no double-advance; cross-tab sync ~2s
**Why human:** Broadcast timing and double-tap race require live Supabase Realtime (SC4)

---

#### 3. Question CRUD + Reorder + Correct-Mark Persistence

**Test:**
1. Log into /host, open "Intrebari" tab.
2. Create a question (body + A + B), mark A correct, save. Reload — question and correct=A persist.
3. Edit the body, save, reload — edit persists.
4. Add a second question; use ▲/▼ to reorder; reload — new order persists.
5. Delete the second question via the confirm dialog; reload — it is gone.
6. Start the game (Control tab) so a question becomes active. Return to Intrebari; try to delete the active question — expect toast "Aceasta intrebare este activa in joc. Reseteaza runda inainte de a o sterge." with no deletion.

**Expected:** All CRUD + reorder + correct-mark persist across reload; active-question delete blocked with 409
**Why human:** DB persistence requires live Supabase; UI interactions require browser (QSTN-01..05, SC2)

---

#### 4. Live Stats — Participant Count + A/B Distribution + Who Answered + Leaderboard

**Test:**
1. Log into /host, open "Statistici" tab. Note the participant count.
2. In a second browser/tab, join as a guest. Within ~2s host count increments — no refresh (HOST-08).
3. Host starts a question. Guest submits an A or B answer. Stats A/B distribution bar updates live (HOST-09).
4. Expand "Vezi cine a raspuns" — guest's display name appears under the option they chose (HOST-10).
5. Host locks + reveals. Leaderboard card populates with ranked players (D-04).

**Expected:** Count live ~2s; distribution live on answer; names in collapsible; leaderboard after reveal
**Why human:** All four behaviors require live Supabase Realtime + a real guest session (SC3)

---

#### 5. Emergency Recovery — Reset / Jump / Force-End Within ~2s

**Test:**
1. With ≥2 questions authored, log into /host → Control tab. Start game. Expand "Controale de urgenta".
2. Have a guest answer; click "Reseteaza Runda" → confirm. Within ~2s phase returns to "Intrebare" and A/B distribution clears. Verify in a second tab.
3. Advance to revealed. Enter "2" in the jump input; click "Sari la Intrebare". Within ~2s the active question becomes #2 across tabs.
4. From ANY phase (including mid-question), click "Incheie Fortat Jocul" → confirm. Within ~2s the phase badge shows "Incheiat" across all tabs — proving force_end works from a non-revealed state.

**Expected:** Each emergency action takes effect and broadcasts within ~2s; force-end works from any phase
**Why human:** Realtime broadcast timing and multi-tab sync require live Supabase (HOST-11, SC5)

---

### Gaps Summary

No blocking gaps. All 17 must-have truths are implemented in the codebase with verifiable code evidence. Two code-quality warnings from the REVIEW.md are acknowledged but do not block the phase goal:

1. **CR-02 (answers no game_id join)** — gameId is validated but not enforced in the DB query. In the single-game MVP this is not exploitable; the REVIEW assessed it as low practical risk. Follow-up recommended but not blocking.

2. **CR-04 (stale closure in re-enable useEffect)** — the `eslint-disable` suppression means `inFlight` can be stale in the re-enable closure. The 5-second fallback timeout prevents permanent button lock. In a single-host use case this is unlikely to surface. The inFlightRef pattern from REVIEW CR-04 is the correct long-term fix.

The phase status is `human_needed` because all 9 functional requirements (HOST-08 through HOST-11, QSTN-01 through QSTN-05) involve realtime behavior, DB persistence across page reload, or multi-client interactions that cannot be verified by static code analysis.

---

_Verified: 2026-06-03T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
