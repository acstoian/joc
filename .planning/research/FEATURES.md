# Feature Research

**Domain:** Live audience A/B trivia game-show web app (single wedding event)
**Researched:** 2026-06-01
**Confidence:** HIGH — derived from direct analysis of Kahoot, Crowdpurr, AhaSlides, QuizWitz, and real-time architecture references; cross-verified across multiple sources

---

## Feature Landscape

### Table Stakes (Event Flops Without These)

Features guests and the host assume exist. Missing any of these breaks the live event.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Name-only join** | Guests expect zero friction — no account, no password, no app install | LOW | URL or QR code -> enter name -> joined. Name is the identity. |
| **Device token persistence** | Mobile network drops at venues are a given, not an edge case | MEDIUM | Generate UUID on first join; store in `localStorage`; re-associate on reconnect. Required before any other guest state. |
| **Lobby / waiting screen** | Guests need confirmation they are in the game while host sets up | LOW | Live participant count ticking up. Guests see "Waiting for host to start…". Host sees names populating. |
| **Live participant count (host + display)** | Host must know how many are in before starting; creates pre-game tension on TV | LOW | Supabase Realtime presence or channel subscription count. |
| **Question push (host -> all clients)** | Core loop: host advances, every phone and TV updates simultaneously | MEDIUM | Broadcast via Supabase Realtime channel. Guest UI transitions from lobby/waiting to active question. |
| **Binary A/B answer selection + lock** | The core interaction — one tap, no changing your mind | LOW | Single-tap button for A or B. Server validates: one answer per (player, question), immutable once stored. Show visual locked state immediately. |
| **"Waiting for host" post-answer state** | Guest who answered early must not be bored by a blank screen | LOW | After submitting, show selected answer locked + animated idle (spinner, pulse) + "Waiting for reveal…" |
| **Host answer-lock action** | Host manually closes answering — key to host-driven flow | LOW | Dashboard button "Lock Answers". Broadcasts `round_locked` event. Prevents late submissions server-side. |
| **Host correct-answer reveal** | The dramatic moment every question builds toward | MEDIUM | Host taps "Reveal". Broadcasts correct answer. Guest phones flip: green (correct) or red (wrong). Display shows correct letter + bar chart final state. |
| **Score update post-reveal** | Flat 1pt scoring must be reflected immediately after reveal | LOW | Server increments score for guests who answered correctly. Broadcast updated scores. |
| **Inter-round leaderboard** | Guests demand to know their standing after each question | MEDIUM | Top-N list with rank, name, score. Shown on guest phone + TV display. Must update in real time after each reveal. |
| **Host "next question" advance** | Host controls pacing — no auto-advance | LOW | Dashboard button. Clears round state, pushes next question to all clients. |
| **Game-end / winner screen** | The climax of the entire evening | MEDIUM | Final leaderboard. Top 3 podium. Confetti. Host triggers; persists until host dismisses or resets. |
| **Host dashboard authentication** | Only the host (MC/operator) drives the game | LOW | Simple password check against env var, session stored in `sessionStorage` (already proven pattern in wedding site). |
| **Question management (CRUD + reorder)** | Host needs to pre-load questions before the event | MEDIUM | Create/edit/delete questions with A text, B text, correct-answer flag. Drag-to-reorder. Must be possible before game start. |
| **Host reset for current round** | Host makes a mistake (wrong correct answer set) and needs a recovery path | LOW | "Reset round" clears all answers for current question, resets to open state. Only available before reveal. |
| **Reconnect + state resync** | Mobile connections at venues drop; a dropped guest must re-enter without losing progress | HIGH | On rejoin with device token: look up existing player record, restore current game state (question, score, whether this player already answered). Re-subscribe to Realtime channel. Critical: depends on device token being stored first. |

---

### Differentiators (Premium Feel, Wedding Appropriate)

Features not expected as baseline but which elevate the experience from "functional quiz" to "cinematic game show moment."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Cinematic TV / Display Mode** | Dedicated full-screen, landscape-optimized route that the host opens on the projector — large typography readable from 10m away | MEDIUM | Separate route `/display`. No interactive controls. Auto-syncs via same Realtime channel. Everything scaled for TV. |
| **Live A/B distribution bars** | Real-time animated bar chart showing % of room on A vs B as answers come in — creates social anticipation | MEDIUM | Host dashboard shows exact counts + who answered what. TV display shows live-updating percentage bars (no names). Requires answer lock to have happened before final percentages freeze. |
| **Reveal animation (correct answer flash)** | The moment of truth feels game-show-quality, not a boring static update | MEDIUM | On reveal event: TV flashes correct answer in green with a ~0.5s delay stagger, bars collapse to show final split, wrong-answer bar dims. Guest phones flash green/red. Uses Framer Motion. |
| **Cosmetic countdown on TV** | Host can trigger a "3-2-1…" countdown on the display for dramatic tension before reveal | LOW | Purely cosmetic — does NOT auto-lock or auto-advance. Host taps "Start countdown", display animates 3-2-1, host still manually reveals. |
| **Confetti / celebration on winner screen** | Wedding-appropriate visual peak at the game end | LOW | Canvas confetti (e.g. `canvas-confetti`) triggered on winner screen. Colors match wedding palette. |
| **Animated leaderboard rank changes** | Watching someone jump from 8th to 3rd creates a reaction in the room | MEDIUM | Animate rank deltas between questions (FLIP animation via Framer Motion). "New #1!" callout on TV display. Depends on having previous-round scores stored client-side for delta computation. |
| **Answer distribution + who-answered-what (host only)** | Host can narrate "everyone on B — let's see…" which adds MC energy | MEDIUM | Host dashboard table: each player row with their answer choice. Visible only to host, never to guests or TV. |
| **QR code join screen on TV display** | During lobby phase, TV shows QR code guests scan to join — no URL to type | LOW | Generate QR client-side from game join URL. Display only during lobby phase. Swap to question view when game starts. |
| **"You got it!" / "Nice try" micro-copy on guest phones** | Instant emotional feedback beyond green/red coloring | LOW | Post-reveal: brief animated text overlay on guest phone based on correctness. Fades after 2s. |
| **Guest answer count progress (host)** | "47 of 63 answered" shown to host in real time, helps them decide when to lock | LOW | Simple counter from Supabase Realtime. Shown on host dashboard current-question card. |
| **Winner spotlight (top 3 podium)** | Game-end screen shows 1st/2nd/3rd on a visual podium, not just a list | MEDIUM | Purely visual overlay on TV display. Name + score. 1st place is center/tallest. Triggered by host "End Game" action. |

---

### Anti-Features (Deliberately NOT Building for v1)

Features that seem desirable but are wrong for this use case — explicitly excluded to prevent scope creep.

| Anti-Feature | Why Requested | Why Problematic for This Context | What to Do Instead |
|---|---|---|---|
| **Guest accounts / login** | "Real" authentication feels safer | Login = friction at a live event. 50 guests fumbling with passwords during the cocktail hour kills the vibe. | Name + device token. Zero-friction join is a feature, not a gap. |
| **Speed-weighted scoring** | Kahoot does it; feels more competitive | Creates clock-sync complexity (server must timestamp every answer precisely), punishes guests on slow venue wifi, feels unfair in a social setting. Flat scoring is more inclusive. | Flat 1pt per correct answer. If it feels flat after the event, revisit for a hypothetical v2. |
| **Timer auto-lock / auto-advance** | "More like Kahoot" | Host-driven flow is deliberately chosen. Auto-timers require accurate clock sync across 100+ mobile clients. Venue wifi is unreliable. Timers become decorative only. | Cosmetic countdown on TV is available if host wants theatrical tension. Manual lock is always host-controlled. |
| **Multiple question types (MC, text, image, slider)** | More variety = more fun | Binary A/B keeps tap targets huge on mobile (critical for older guests), schema simple, and reveal logic trivial. Each new type multiplies UI surface area and answer-evaluation complexity. | A/B only for v1. Perfect for "Would you rather" and wedding trivia formats. |
| **Multiple concurrent games / multi-tenant / game codes** | "What if we want to run it again?" | One wedding, one game. Game-code infrastructure (lobby selection, game rooms, org accounts) adds substantial complexity for zero benefit this night. | Single active game in DB. Reset = archive old game, create new one. |
| **Native mobile apps** | "A dedicated app would be more reliable" | App store submission takes days. Guests won't install an app for one event. PWA-quality mobile web is sufficient and faster to deliver. | Mobile-first responsive web. Smooth tap targets. No install required. |
| **Internationalization (i18n) framework** | "What if someone doesn't speak Romanian?" | Single event, single language. Building an i18n system adds boilerplate and complexity with zero payoff here. All copy is hardcoded in Romanian. | Hardcode all strings in Romanian. |
| **Spectator / audience-only mode** | "Some guests just want to watch" | Every guest at a wedding is a potential player. A spectator split creates confusion about who is and isn't participating and fragments the experience. | All joined players are players. Guests who don't want to compete can simply not answer — they don't appear on leaderboard if score is 0. |
| **Chat / Q&A during game** | Audience interaction beyond answering | Kahoot and Slido have this; it's right for corporate events, wrong for a game show. Chat messages fragment attention from the TV display. It is also an active moderation burden during a live event with no dedicated moderator. | No chat. Social interaction is verbal — the MC narrates and the room reacts live. |
| **Post-game analytics / reports** | "Export who won and what they answered" | v1 priority is the live experience. Post-game export is low-value for a wedding and can be assembled from the DB manually if needed. | Defer. Admin can query Supabase Studio after the event if needed. |
| **Team / group mode** | Kahoot has it; fun for classrooms | Complicates join flow (which team?), scoring (team vs individual), and display (team leaderboard vs individual). One-night event does not need it. | Individual play only. |

---

## Feature Dependencies

```
Device Token (localStorage)
    └──required by──> Reconnect + State Resync
    └──required by──> Answer Lock (server validates: one answer per player)

Name Join
    └──required by──> Lobby / Waiting Screen
    └──required by──> Live Participant Count
    └──required by──> Guest Answer Count Progress (host)

Question CRUD + Reorder
    └──required by──> Question Push (host -> all clients)
    └──required by──> Host Answer-Lock Action
    └──required by──> Host Correct-Answer Reveal

Host Answer-Lock Action
    └──required by──> Live A/B Distribution Bars (final freeze)
    └──required by──> Host Correct-Answer Reveal

Host Correct-Answer Reveal
    └──required by──> Score Update Post-Reveal
    └──required by──> Reveal Animation (correct answer flash)
    └──required by──> "You got it!" / "Nice try" micro-copy

Score Update Post-Reveal
    └──required by──> Inter-Round Leaderboard
    └──required by──> Animated Leaderboard Rank Changes

Inter-Round Leaderboard
    └──required by──> Game-End / Winner Screen
    └──required by──> Winner Spotlight (top 3 podium)

TV / Display Mode (route exists)
    └──enhanced by──> QR Code Join Screen (lobby phase)
    └──enhanced by──> Live A/B Distribution Bars (TV view)
    └──enhanced by──> Reveal Animation
    └──enhanced by──> Animated Leaderboard Rank Changes
    └──enhanced by──> Winner Spotlight (top 3 podium)
    └──enhanced by──> Cosmetic Countdown

Cosmetic Countdown
    └──does NOT affect──> Answer Lock (purely visual, host-driven only)
    └──does NOT affect──> Auto-Advance (timer is decorative)
```

### Dependency Notes

- **Device token must be issued and persisted at join time**, before the lobby renders. It is the foundation for answer deduplication and reconnect. All game logic depends on stable player identity.
- **Answer lock precedes reveal**: the host locks answers first (closes submission window), then reveals. The distribution bars freeze at lock; the correct answer highlights at reveal. Skipping lock and going straight to reveal is technically allowed but bad UX — the bars would still be animating while the answer is shown.
- **Reconnect depends on current game state being fetchable**: the server must expose a "what is the current state of the game?" endpoint (or Supabase row) that a rejoining client can pull synchronously before subscribing to Realtime events. Without this, reconnecting guests see a blank screen until the next event fires.
- **Leaderboard rank animations require previous-round scores**: the client must retain pre-question scores locally to compute deltas. This is a client-side concern — the server stores only current scores.
- **TV Display Mode is a separate client** subscribed to the same Realtime channel as guest phones. It renders the host-controlled events (question push, lock, reveal, leaderboard, end) in a full-screen cinematic layout. No interactive elements on the display route.
- **Confetti / winner screen requires game-end event**: host explicitly triggers end-game, which broadcasts a `game_ended` event; both TV display and guest phones transition to the winner screen simultaneously.

---

## MVP Definition

### Launch With (v1 — Night of the Wedding)

Everything here is required for the event to work. These are the table-stakes features.

- [ ] Name-only join with device token generation — no identity, no game
- [ ] Lobby / waiting screen with live participant count — guests need to know they're in
- [ ] Host dashboard authentication — must be protected from curious guests
- [ ] Question CRUD + reorder (pre-event authoring) — can't run a quiz without questions
- [ ] Question push (host -> all clients simultaneously) — the core real-time loop
- [ ] Binary A/B answer selection with server-side lock (one answer, immutable) — the interaction
- [ ] "Waiting for host" post-answer state on guest phone — prevents confusion after answering
- [ ] Host answer-lock action + broadcast — closes submissions before reveal
- [ ] Guest answer count progress on host dashboard ("X of Y answered") — host decides when to lock
- [ ] Host correct-answer reveal + broadcast — the dramatic moment
- [ ] Score update (flat 1pt) after reveal — keeps the game meaningful
- [ ] Inter-round leaderboard (guest phone + TV display) — drives competition
- [ ] Host "next question" advance — controls pacing
- [ ] Reconnect + state resync via device token — must survive venue wifi drops
- [ ] Host reset for current round — recovery from host error
- [ ] Game-end / winner screen — required climax; event is incomplete without it
- [ ] TV / Display Mode route (separate full-screen client) — the projector experience
- [ ] Confetti on winner screen — minimal celebration, trivially low cost, high impact

### Add After Validation (v1.x — If Time Permits Before Event)

- [ ] Live A/B distribution bars on TV display (animating in real time during answering) — high impact, medium complexity; add if core is stable early
- [ ] Reveal animation (Framer Motion flash + bar collapse on TV) — polishes the dramatic moment
- [ ] Animated leaderboard rank changes — FLIP animation; significant WOW factor
- [ ] QR code on TV lobby screen — removes URL-typing friction for late arrivals
- [ ] "You got it!" micro-copy on guest phones — small but memorable

### Future Consideration (v2+ / Next Event)

- [ ] Winner spotlight top-3 podium visual — nice but not required; flat leaderboard works
- [ ] Cosmetic countdown (host-triggered 3-2-1 on TV) — theatrical, easy to build; defer if v1 is tight
- [ ] Answer distribution + who-answered-what in host dashboard — useful for MC narration; can use Supabase Studio query as workaround

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Name-only join + device token | HIGH | LOW | P1 |
| Lobby + participant count | HIGH | LOW | P1 |
| Host auth | HIGH | LOW | P1 |
| Question CRUD + reorder | HIGH | MEDIUM | P1 |
| Question push (realtime) | HIGH | MEDIUM | P1 |
| A/B answer select + server lock | HIGH | LOW | P1 |
| Waiting-for-host post-answer state | HIGH | LOW | P1 |
| Host answer-lock action | HIGH | LOW | P1 |
| Answer count progress (host) | HIGH | LOW | P1 |
| Correct-answer reveal | HIGH | MEDIUM | P1 |
| Flat 1pt score update | HIGH | LOW | P1 |
| Inter-round leaderboard | HIGH | MEDIUM | P1 |
| Host next-question advance | HIGH | LOW | P1 |
| Reconnect + state resync | HIGH | HIGH | P1 |
| Host round reset | MEDIUM | LOW | P1 |
| Game-end / winner screen | HIGH | MEDIUM | P1 |
| TV Display Mode route | HIGH | MEDIUM | P1 |
| Confetti on winner screen | MEDIUM | LOW | P1 |
| Live A/B distribution bars (TV) | HIGH | MEDIUM | P2 |
| Reveal animation (Framer Motion) | HIGH | MEDIUM | P2 |
| Animated leaderboard rank changes | HIGH | MEDIUM | P2 |
| QR code on TV lobby | MEDIUM | LOW | P2 |
| "You got it!" micro-copy | MEDIUM | LOW | P2 |
| Cosmetic countdown (3-2-1) | MEDIUM | LOW | P3 |
| Winner spotlight podium visual | MEDIUM | MEDIUM | P3 |
| Who-answered-what host table | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch (event fails without it)
- P2: Should have — adds significant quality; build when P1 is stable
- P3: Nice to have — defer to post-event or v2

---

## Competitor Feature Analysis

| Feature | Kahoot | Crowdpurr | AhaSlides | Our Approach |
|---------|--------|-----------|-----------|--------------|
| Join flow | PIN or QR, nickname required | PIN or link | QR or link | Name only, no PIN needed (single private event) |
| Question types | Multi-choice, T/F, puzzle, slider | Multi-choice | Multi-choice, poll, word cloud | Binary A/B only — simplest possible for big tap targets |
| Timer | Auto-advance on timer expiry | Optional auto/host-controlled | Optional | Cosmetic only — host always locks manually |
| Scoring | Speed-weighted (time bonus) | Flat or speed-weighted | Speed-weighted option | Flat 1pt — fair on unreliable wifi |
| Answer lock | Auto on timer | Host-controlled button | Auto on timer | Host-controlled button |
| Reveal | Auto after lock | Manual (host keyboard shortcut) | Auto | Manual (host dashboard button) |
| Live distribution | Yes (% bars animate live) | Yes (after host shows results) | Yes | Yes — both during answering and post-reveal |
| Leaderboard | After every question, top 5 only | Host-triggered anytime | After every question | After every question, full list on host / top-N on TV |
| TV / Display Mode | Yes (fullscreen, read from projector) | Yes (dedicated presentation view) | Yes (slide-based) | Yes — dedicated `/display` route, landscape-optimized |
| Reconnect | Session re-join by nickname | Not documented | Not documented | Device token (localStorage UUID) -> server-side re-association |
| Host controls | Start, kick, ghost mode, settings | Keyboard shortcuts (A/C/N/R) | Manual advance | Dashboard buttons: lock / reveal / next / reset / end |
| Accounts required | Host yes, guests no | Host yes, guests no | Host yes, guests no | Host password only; guests are anonymous |
| QR code lobby | Yes | Yes | Yes | Yes (TV display during lobby phase) |

---

## Sources

- Kahoot host flow documentation: https://support.kahoot.com/hc/en-us/articles/360039422694
- Kahoot live game settings: https://support.kahoot.com/hc/en-us/articles/115016055107
- Crowdpurr running the trivia game (host controls A/C/N/R): https://help.crowdpurr.com/en/articles/10524802-running-the-trivia-game
- Crowdpurr playback modes (host-controlled vs automatic vs crowd-controlled): https://help.crowdpurr.com/en/articles/10524916-experience-playback-modes-explained
- Ably real-time multiplayer quiz architecture (channels, presence, reconnect): https://ably.com/topic/multiplayer-quiz-app-architecture
- AhaSlides quiz improvements and host controls: https://ahaslides.com/blog/improvements-to-the-quiz-playing-experience-on-ahaslides
- QuizWitz quizmaster app host controls: https://www.quizwitz.com/quizmaster-app
- WebSocket reconnection state sync: https://websocket.org/guides/reconnection/

---

*Feature research for: Live A/B trivia game-show — wedding event (Joc project)*
*Researched: 2026-06-01*
