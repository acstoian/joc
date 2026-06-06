# Requirements: Joc — Live Wedding Game Show

**Defined:** 2026-06-01
**Core Value:** During a live wedding, the room stays in sync and the game feels instant and fun — host actions update every phone and the TV together within ~1s, no refreshes, no lost players.

## v1 Requirements

Requirements for the live-event release. Each maps to a roadmap phase.

### Join & Identity

- [x] **JOIN-01**: Guest can open the site on a phone and join by entering their name
- [x] **JOIN-02**: Guest is issued a persistent device token (localStorage) on first join
- [x] **JOIN-03**: Guest is re-linked to their existing player/score after refresh or disconnect via the device token
- [x] **JOIN-04**: Guest waits in a lobby that shows live state until the host starts
- [x] **JOIN-05**: Lobby shows a join QR code / link for easy guest onboarding

### Gameplay (Guest)

- [x] **PLAY-01**: Guest sees the current question with answer A and answer B pushed live (no refresh)
- [x] **PLAY-02**: Guest can select exactly one answer (A or B)
- [x] **PLAY-03**: Submitting locks the guest's answer optimistically; guest may change their selection until the host locks the round _(NOTE: requirement relaxed during Phase 5/7 — original spec said "cannot be changed"; changed to allow re-selection before host lock, matching real-world UX expectations)_
- [x] **PLAY-04**: Guest UI clearly shows their selected/locked answer and a waiting state
- [x] **PLAY-05**: Guest sees the correct-answer reveal live when the host reveals
- [x] **PLAY-06**: Guest sees the leaderboard update live between rounds
- [x] **PLAY-07**: Guest sees the game-end / winner state live

### Host Controls

- [x] **HOST-01**: Host can authenticate into a protected dashboard (guests need no account)
- [x] **HOST-02**: Host can start the game
- [x] **HOST-03**: Host can lock answers for the current question
- [x] **HOST-04**: Host can reveal the correct answer for the current question
- [x] **HOST-05**: Host can advance to the next question
- [x] **HOST-06**: Host can reset answers for the current round
- [x] **HOST-07**: Host can end the game
- [x] **HOST-08**: Host sees the live participant count
- [x] **HOST-09**: Host sees the live A/B answer distribution as answers arrive
- [x] **HOST-10**: Host can see who answered what for the current question
- [x] **HOST-11**: Host has emergency recovery controls (reset round / jump to question / force-end) to recover a stuck game live

### Question Management

- [x] **QSTN-01**: Host can create a question with text, answer A, and answer B
- [x] **QSTN-02**: Host can edit a question
- [x] **QSTN-03**: Host can delete a question
- [x] **QSTN-04**: Host can mark which option (A or B) is correct
- [x] **QSTN-05**: Host can reorder questions

### TV / Display Mode

- [x] **DISP-01**: Dedicated Display Mode route optimized for TV/projector (landscape, large typography, readable from afar)
- [x] **DISP-02**: Display auto-syncs in real time with host actions, independent of the host dashboard being open
- [x] **DISP-03**: Display shows the current question with animated transitions
- [x] **DISP-04**: Display shows live A/B answer percentages
- [x] **DISP-05**: Display shows the correct-answer reveal with reveal effects
- [x] **DISP-06**: Display shows the leaderboard
- [x] **DISP-07**: Display shows the winner screen at game end
- [x] **DISP-08**: ~~Display supports a host-initiated cosmetic countdown for tension~~ — descoped (manually triggered countdown had no purpose at a live wedding)

### Scoring & Fairness

- [x] **SCOR-01**: Each correct answer is worth 1 point (flat scoring)
- [x] **SCOR-02**: Leaderboard ranks players by total correct answers
- [x] **SCOR-03**: One answer per guest per question is enforced server-side (DB unique constraint) _(implemented as UPSERT with ON CONFLICT(player_id, question_id) — enforces uniqueness while allowing answer changes before lock)_
- [x] **SCOR-04**: Late answers (after host lock) are rejected server-side (phase guard)

### Realtime & Resilience (Non-functional)

- [x] **RT-01**: Current question, reveal, scores, and round transitions sync live across all clients (guest, host, TV)
- [x] **RT-02**: Game state is distributed via Supabase Broadcast (server writes DB then publishes); clients do not subscribe to Postgres Changes for game state
- [x] **RT-03**: Clients recover authoritative state via subscribe-then-fetch on (re)connect
- [x] **RT-04**: Reconnect handles unstable mobile connections (jittered backoff, `worker:true`, visibilitychange re-subscribe for iOS screen-lock)
- [x] **RT-05**: System supports 100+ simultaneous guests with sub-second perceived sync _(validated on Supabase Pro plan; production dry run confirmed on real devices)_
- [x] **RT-06**: UI is mobile-first and responsive, with smooth animations on low-end phones (Safari/Chrome)
- [x] **RT-07**: Soft-luxury wedding aesthetic — glassmorphism accents, animated gradients, subtle confetti, smooth transitions
- [x] **RT-08**: A pre-event production dry run validates concurrency, reconnect, and host flow on a real device _(all 13 checks passed on Vercel + Supabase Pro with 5+ real devices including iPhone/Safari)_

## v2 Requirements

Deferred to future release. Tracked, not in current roadmap.

### Enhancements

- **V2-01**: Speed-weighted or streak-bonus scoring
- **V2-02**: Host-issued join code / gate against random joiners
- **V2-03**: Per-question timer that auto-locks answers
- **V2-04**: Question types beyond binary A/B (e.g. 4-option, image questions)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Guest accounts / login | Name + device token only; accounts add friction at a live event |
| Speed-weighted / streak scoring | Flat 1-pt chosen for simplicity and inclusiveness on slow wifi |
| Timer-based auto-lock / auto-advance | Flow is fully host-driven; timers are cosmetic only |
| Non-binary question types | A/B only keeps UI, tap targets, and schema simple for v1 |
| Multiple concurrent / multi-tenant games | One wedding, one game; no lobbies or org accounts |
| Native mobile apps | Web-only, mobile-first; no app store distribution |
| Internationalization framework | Single event, single language |
| Pusher (alternative realtime) | Supabase Realtime chosen as single vendor for DB+realtime+auth |
| Reuse of existing wedding-site code | This is a completely new, independent project on the `joc` branch |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RT-02 | Phase 1 — Foundation & Schema | Complete |
| RT-05 | Phase 1 — Foundation & Schema | Complete |
| SCOR-03 | Phase 1 — Foundation & Schema | Complete |
| SCOR-04 | Phase 1 — Foundation & Schema | Complete |
| RT-01 | Phase 2 — Realtime Core | Complete |
| RT-03 | Phase 2 — Realtime Core | Complete |
| RT-04 | Phase 2 — Realtime Core | Complete |
| RT-06 | Phase 2 — Realtime Core | Complete |
| JOIN-01 | Phase 3 — Server Write Path & State Machine | Complete |
| JOIN-02 | Phase 3 — Server Write Path & State Machine | Complete |
| JOIN-03 | Phase 3 — Server Write Path & State Machine | Complete |
| HOST-01 | Phase 3 — Server Write Path & State Machine | Complete |
| HOST-02 | Phase 3 — Server Write Path & State Machine | Complete |
| HOST-03 | Phase 3 — Server Write Path & State Machine | Complete |
| HOST-04 | Phase 3 — Server Write Path & State Machine | Complete |
| HOST-05 | Phase 3 — Server Write Path & State Machine | Complete |
| HOST-06 | Phase 3 — Server Write Path & State Machine | Complete |
| HOST-07 | Phase 3 — Server Write Path & State Machine | Complete |
| SCOR-01 | Phase 3 — Server Write Path & State Machine | Complete |
| SCOR-02 | Phase 3 — Server Write Path & State Machine | Complete |
| HOST-08 | Phase 4 — Host Dashboard | Complete |
| HOST-09 | Phase 4 — Host Dashboard | Complete |
| HOST-10 | Phase 4 — Host Dashboard | Complete |
| HOST-11 | Phase 4 — Host Dashboard | Complete |
| QSTN-01 | Phase 4 — Host Dashboard | Complete |
| QSTN-02 | Phase 4 — Host Dashboard | Complete |
| QSTN-03 | Phase 4 — Host Dashboard | Complete |
| QSTN-04 | Phase 4 — Host Dashboard | Complete |
| QSTN-05 | Phase 4 — Host Dashboard | Complete |
| JOIN-04 | Phase 5 — Guest App | Complete |
| JOIN-05 | Phase 5 — Guest App | Complete |
| PLAY-01 | Phase 5 — Guest App | Complete |
| PLAY-02 | Phase 5 — Guest App | Complete |
| PLAY-03 | Phase 5 — Guest App | Complete (relaxed — answer changeable before host lock) |
| PLAY-04 | Phase 5 — Guest App | Complete |
| PLAY-05 | Phase 5 — Guest App | Complete |
| PLAY-06 | Phase 5 — Guest App | Complete |
| PLAY-07 | Phase 5 — Guest App | Complete |
| DISP-01 | Phase 6 — TV Display Mode | Complete |
| DISP-02 | Phase 6 — TV Display Mode | Complete |
| DISP-03 | Phase 6 — TV Display Mode | Complete |
| DISP-04 | Phase 6 — TV Display Mode | Complete |
| DISP-05 | Phase 6 — TV Display Mode | Complete |
| DISP-06 | Phase 6 — TV Display Mode | Complete |
| DISP-07 | Phase 6 — TV Display Mode | Complete |
| DISP-08 | Phase 6 — TV Display Mode | Descoped |
| RT-07 | Phase 7 — Polish & Pre-Event Hardening | Complete |
| RT-08 | Phase 7 — Polish & Pre-Event Hardening | Complete |

**Coverage:**

- v1 requirements: 47 shipped + 1 descoped (DISP-08)
- All requirements mapped to phases and delivered
- Requirement modified: PLAY-03 relaxed to allow answer changes before host lock

---
*Requirements defined: 2026-06-01*
*Last updated: 2026-06-06 — all v1 requirements marked complete at milestone close*
