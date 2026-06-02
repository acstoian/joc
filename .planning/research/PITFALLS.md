# Pitfalls Research

**Domain:** Live realtime multiplayer audience game — Next.js 15 + Supabase Realtime + Vercel, single live event, 100+ concurrent guests on phones
**Researched:** 2026-06-01
**Confidence:** HIGH (Supabase limits from official docs; Vercel constraints from official docs; pattern pitfalls from community post-mortems and architecture docs)

---

## Critical Pitfalls

### Pitfall 1: Postgres Changes Fan-Out Kills Your Database at 100 Clients

**What goes wrong:**
You subscribe every guest client to a Supabase Postgres Changes channel on the `game_state`, `answers`, or `scores` tables. The host triggers a single row update (e.g. advancing to the next question). Supabase Realtime runs one RLS authorization query **per subscriber** for every change event. With 100 guests, one UPDATE = 100 synchronous DB reads on a single processing thread. At the moment of peak activity (host clicks "Reveal Answer") all 100 queries fire simultaneously, the DB saturates, change events queue and delay, and guests see different questions at different times.

**Why it happens:**
Postgres Changes with RLS enabled is designed for per-user data visibility (e.g. "show this user only their rows"). For a public game state visible to all, it is the wrong primitive. Developers reach for it because it feels natural ("listen to DB changes") without reading the scaling footnote in the docs.

**How to avoid:**
Use **Broadcast** for all game-state fan-out, not Postgres Changes. The architecture should be:
1. Host action hits a Next.js API route or Server Action (runs with service role).
2. Route writes to Postgres (authoritative state).
3. Route immediately publishes a Broadcast message to the shared game channel (e.g. `game:session-123`).
4. All clients — guests and TV display — receive the Broadcast. No DB fan-out.
5. On reconnect, clients fetch current state via a single REST/RPC call, then re-subscribe to Broadcast.

Postgres Changes can be used server-side only (one backend subscriber) as an audit trail or for triggering server-sent broadcasts, never client-side at scale.

**Warning signs:**
- Host clicks "next question" and different phones show different questions for 2–5 seconds.
- Supabase dashboard shows DB CPU spike on every host action.
- Realtime logs show delayed change delivery at >10 clients.

**Phase to address:** Phase 1 (Realtime architecture) — lock in Broadcast as the fan-out primitive before writing any game-state subscription code. Document it as a non-negotiable constraint.

---

### Pitfall 2: Concurrent Connection Quota Exceeded Mid-Event (Free Plan)

**What goes wrong:**
The project runs on the Supabase Free plan (200 concurrent connection limit). With 100 guests + host + TV display = 102+ persistent WebSocket connections. Aggressive reconnects after a wifi blip can push peak connections above 200. Supabase throttles or closes connections with `too_many_connections` error. Guests lose their realtime feed silently. On Free plan, Supabase can also **suspend the entire project** for quota exceedance, taking the app fully offline mid-event.

**Why it happens:**
Developers test with 5–10 browser tabs and never hit the limit. They do not account for reconnect spikes: if 80 guests drop at once (wifi AP restarts) and all reconnect within 10 seconds, the peak connection counter is measured at the highest point in the billing cycle — one storm can suspend a Free plan project.

**How to avoid:**
- **Use the Pro plan ($25/month)** for the event. Pro gives 500 concurrent connections with overages billed at $10/1,000 — a 100-guest wedding costs ~$0 in overage. Free plan is unsuitable for production live events.
- Disable Spend Cap on Pro to allow graceful overage billing rather than suspension.
- Each client must use **exactly one channel** for the entire session (not one per component). Multiplex all game events over a single `game:{session_id}` channel per client.
- Implement exponential backoff with jitter on reconnect (see Pitfall 5) to prevent reconnect storms amplifying connection peaks.

**Warning signs:**
- Supabase dashboard Realtime > Connections graph approaching 80% of plan limit during testing.
- Guests report "not receiving updates" while others are fine — partial connection loss.
- Client console shows `RealtimeDisabledForTenant` or `too_many_connections` error codes.

**Phase to address:** Phase 1 (Infrastructure setup) — select Pro plan before any deployment. Phase 2 (Realtime core) — enforce single-channel-per-client in architecture.

---

### Pitfall 3: Thundering Herd — 100 Clients Reconnect Simultaneously After Wifi Blip

**What goes wrong:**
The venue wifi AP restarts or briefly drops (common in event halls with overloaded access points). All 100 WebSocket connections close at the same second. All clients use the same default retry intervals: 1s, 2s, 5s, 10s. Every single client hits the Supabase Realtime server at t+1s, then again at t+2s, then t+5s. The Realtime server, already under load from the event, receives 100 simultaneous reconnect handshakes in a burst. The Supabase connection limit of 500 (Pro) measures **peak** — this burst counts. The DB receives 100 state-fetch queries in the same second (if clients fetch current state on reconnect). The system staggers and some reconnects fail, causing those clients to fall into longer retry loops.

**Why it happens:**
The Supabase JS client's default `reconnectAfterMs` does not add jitter by default in all configurations — it uses `[1000, 2000, 5000, 10000]`. Without per-client randomization, all clients share identical retry schedules.

**How to avoid:**
Configure `reconnectAfterMs` with jitter when creating the Supabase client:
```typescript
const supabase = createClient(url, anonKey, {
  realtime: {
    reconnectAfterMs: (tries: number) => {
      const base = [1000, 2000, 5000, 10000][Math.min(tries, 3)];
      return base + Math.random() * 2000; // spread reconnects over 2s window
    },
  },
});
```
On successful reconnect, clients must immediately call a lightweight REST endpoint (e.g. `GET /api/game/state`) to resync current question/phase — they cannot trust that they received all Broadcast messages while disconnected. This single REST fetch is fine; it does not fan-out.

**Warning signs:**
- Supabase Realtime connection graph shows a sharp dip followed by a spike (all disconnect then reconnect in unison).
- Guests simultaneously report "game froze" then "refreshed and it's fine."
- Realtime logs show burst of `phx_join` messages in a 1-second window.

**Phase to address:** Phase 2 (Realtime core) — add jitter to reconnect config at client initialization. Phase 3 (Reconnect/recovery) — implement state resync on reconnect.

---

### Pitfall 4: State Desync — TV Display and Phones Show Different Questions

**What goes wrong:**
After any client reconnect, the UI shows stale state: a guest's phone still shows Question 3 while the TV and everyone else is on Question 5. Or worse, the TV display (which has been running unattended for 30 minutes) silently loses its Broadcast subscription without displaying a reconnect indicator, and freezes on a stale screen visible to the entire room.

**Why it happens:**
Broadcast is ephemeral: messages are fire-and-forget, not stored. A client that was disconnected for even 500ms receives no replay of what it missed. If reconnect handling only re-subscribes to the channel without fetching current state, the client is stuck at its last known state. The TV display is particularly vulnerable: it runs in a browser tab that may be backgrounded briefly, triggering iOS/Android browser throttling which kills the WebSocket heartbeat silently.

**How to avoid:**
- On **every** channel re-subscription (including initial subscribe), clients must call `GET /api/game/state` to fetch current canonical state from the DB before rendering.
- The Postgres `game_sessions` table is the single source of truth: current question index, phase (lobby/question/reveal/leaderboard/end), and locked status.
- Use Supabase `worker: true` on the Realtime client for the TV display to prevent browser throttling from killing the heartbeat when the projector computer's browser tab loses focus.
- Show a visible reconnect indicator on the TV display (e.g. pulsing dot) so the host notices immediately if the display loses sync.
- On heartbeat failure detection, automatically trigger a state resync fetch, not just a reconnect.

**Warning signs:**
- TV display freezes mid-game without any on-screen indicator.
- Guests ask "which question are we on?" because their phone says a different number.
- After venue wifi drops and restores, some phones show old answer percentages.

**Phase to address:** Phase 2 (Realtime core) — state-on-subscribe fetch pattern. Phase 3 (TV Display) — worker heartbeat + visible sync indicator.

---

### Pitfall 5: Duplicate Answer Submission — Race Condition at the Database

**What goes wrong:**
A guest taps answer A. The request takes 300ms (slow venue wifi). They tap again. Two POST requests hit `/api/answers` in flight simultaneously. The server processes both: the first check (`SELECT WHERE guest_id=X AND question_id=Y`) runs in both requests before either INSERT completes (classic read-modify-write race). Two rows are inserted. Guest gets 2 points or the answer record is ambiguous. Alternatively, a guest's answer arrives after the host has clicked "Lock" — the locking check is a non-atomic read-then-write that can race.

**Why it happens:**
Standard `if (no row exists) { insert row }` in application code is not atomic in a concurrent environment. Under slow mobile networks, double-taps and retry logic make duplicate requests common, not edge cases.

**How to avoid:**
- Add a **unique constraint** on `(guest_id, question_id)` in the `answers` table. This makes the DB the enforcer, not application logic.
- Use `INSERT ... ON CONFLICT DO NOTHING` so duplicate submissions are silently ignored rather than causing errors.
- The lock phase check must be: compare answer `submitted_at` timestamp against `question_locked_at` in the same atomic transaction, or simply enforce with the unique constraint + reject submissions when `game_state.phase != 'answering'`.
- Disable the answer buttons in the UI immediately on first tap (optimistic lock), and do not re-enable them on network error — show a "submitting..." state instead. This is UX-layer protection, not a replacement for DB constraints.

**Warning signs:**
- Leaderboard shows guests with more correct answers than questions asked.
- Answer distribution (A vs B) sums to more than 100% of players.
- DB `answers` table has duplicate `(guest_id, question_id)` pairs.

**Phase to address:** Phase 2 (Answer submission) — unique constraint in migration. Phase 2 (API) — ON CONFLICT DO NOTHING in insert query.

---

### Pitfall 6: Host Double-Click Advances Game Twice

**What goes wrong:**
The host clicks "Next Question" on their phone. The tap is slow (they're nervous, or the phone is laggy). They tap again. Two Server Actions or API requests fire. The game jumps from Question 3 to Question 5, skipping one entirely, or the leaderboard is shown prematurely mid-reveal.

**Why it happens:**
Host UI buttons are not disabled during the in-flight request. Server Actions in Next.js 15 do not have built-in idempotency — if called twice in quick succession with identical parameters, both execute.

**How to avoid:**
- Disable all host action buttons immediately on click. Re-enable only after the Broadcast message confirms the state change was applied (close the optimistic loop via Realtime feedback).
- Make all game state transitions **idempotent at the database level**: `UPDATE game_sessions SET current_question_index = $1 WHERE id = $2 AND current_question_index = $1 - 1` (compare-and-swap). If the question is already at the target index, the update is a no-op.
- The API response (or Broadcast confirmation) should carry the new canonical state — the host UI updates from that, not from the button click itself.

**Warning signs:**
- A question disappears from the sequence mid-game.
- Host reports "I only clicked once but it jumped two questions."
- DB `question_index` increments by 2 in the log for a single user action.

**Phase to address:** Phase 3 (Host dashboard) — button disable + compare-and-swap transitions.

---

### Pitfall 7: Animation Overuse Tanks Low-End Phone Performance

**What goes wrong:**
The game UI uses Framer Motion `AnimatePresence` on every answer update, layout animations on the leaderboard, and an animated gradient background that updates every frame. Each Broadcast message causes a state update which re-renders the entire page tree. On a Samsung Galaxy A-series or an older iPhone SE, the UI drops to <30fps, buttons feel unresponsive, and guests think their answer didn't register. CSS `layout` animations trigger reflow on every frame, consuming CPU on the JS main thread.

**Why it happens:**
Framer Motion feels cheap to add during development on a MacBook Pro. The developer never tests on the actual device range: mid-2018 Android phones with 2GB RAM and a throttled Chrome. Realtime events from Broadcast arrive 5–20 times per second during active gameplay, each triggering a React state update without memoization.

**How to avoid:**
- Animate **only** `transform` and `opacity` — never animate `width`, `height`, `top`, `left`, or properties that trigger layout.
- Memoize child components that don't depend on realtime state (`React.memo`). The question text, answer buttons, and static UI should not re-render on every Broadcast event.
- Realtime events update a single Zustand slice (or `useRef`-backed state); only components subscribed to that specific slice re-render.
- The leaderboard animation runs once (after reveal), not on every score increment.
- Test on a real Android mid-range device (or Chrome DevTools with 4x CPU throttle + slow network) before the event.
- Use `will-change: transform` sparingly and only on actively animating elements.
- Disable the animated gradient background during active question phases if performance testing shows it hurts.

**Warning signs:**
- Chrome DevTools shows frame rate dropping below 30fps during answer submission on CPU-throttled profile.
- Button tap-to-visual-response latency exceeds 100ms on low-end device test.
- React DevTools Profiler shows entire component tree re-rendering on each Broadcast message.

**Phase to address:** Phase 2 (Guest UI) — memoization architecture from the start. Phase 4 (Polish) — animation audit with real-device testing.

---

### Pitfall 8: Vercel Serverless — No WebSockets in API Routes / Cold Start Spikes

**What goes wrong:**
A developer attempts to open a persistent WebSocket from a Next.js API route on Vercel (e.g. to proxy game events). It fails — Vercel serverless functions terminate after responding; there is no persistent process to hold a socket open. Separately, the first host action after a quiet period (e.g. "Start Game") hits a cold-started function and takes 2–4 seconds to respond, making the game feel broken right at the opening moment.

**Why it happens:**
Vercel's serverless model is HTTP request/response only. Even Fluid Compute (Vercel's newer persistent-function feature) does not support WebSocket server roles — it only allows function reuse between HTTP requests. Cold starts occur when functions have not been invoked for several minutes (the pre-event quiet window before the host starts).

**How to avoid:**
- WebSocket connections go directly from clients to **Supabase Realtime** — never through Vercel functions. Vercel functions handle only:
  - REST state mutations (answer submission, host state transitions).
  - State fetch on reconnect.
  These are short-lived HTTP calls, which is exactly what serverless is built for.
- To mitigate cold starts: warm the API routes by hitting them during the pre-event dry run. Alternatively, configure a Vercel cron job (or a simple `setInterval` ping from the host dashboard) to keep functions warm in the 15 minutes before the event starts.
- Set `maxDuration` on API routes that do DB writes to at least 10s to prevent timeout on slow Supabase cold-path.

**Warning signs:**
- First API call after deploy takes >3 seconds; subsequent calls are fast.
- Any attempt to use `new WebSocketServer()` or `socket.io` inside a Next.js API route.

**Phase to address:** Phase 1 (Architecture) — document that all persistent connections go to Supabase, Vercel is HTTP only. Phase 4 (Pre-event) — add warm-up procedure to event day checklist.

---

### Pitfall 9: Service Role Key Exposed in Client Bundle

**What goes wrong:**
A developer uses the Supabase `service_role` key in a Next.js component or client utility to bypass RLS (e.g. "it wasn't working so I used the admin key"). The key is bundled into the client JavaScript. Any guest opening DevTools > Network > JS sources can read it. With the service role key, they have full unrestricted access to the Postgres database: can read all answers, manipulate scores, delete game data, or exfiltrate all guests' personal information.

**Why it happens:**
When anon key + RLS blocks a legitimate operation, the fastest fix is to switch to service role. AI code generators frequently suggest this without flagging the security implication. The mistake is invisible in development because the browser console shows no error.

**How to avoid:**
- **Never use `SUPABASE_SERVICE_ROLE_KEY` in any file that is or could be imported by client components.** The only files that may use it: Next.js API routes (`/app/api/`), Server Actions, and server-side utilities imported exclusively by those.
- Set up ESLint or a custom lint rule to error on `process.env.SUPABASE_SERVICE_ROLE_KEY` appearing in `src/components/` or `src/app/(game)/` directories.
- For this game: anon key + RLS policies are sufficient for guests. Service role is only needed in Server Actions for host operations (e.g. writing game state, scoring). This is a clean and safe boundary.
- Name the env var `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix) — Next.js will never include it in the client bundle.
- Verify: run `grep -r "service_role" .next/` after build. Any match is a critical security failure.

**Warning signs:**
- `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` anywhere in the codebase.
- Service role key in a file inside `src/components/`.
- Any Supabase client created outside of API routes or Server Actions that is not using the anon key.

**Phase to address:** Phase 1 (Project setup) — establish env var naming convention and the two-client rule (anon for client, service-role for server only) before any code is written.

---

### Pitfall 10: No Recovery Path — Stuck Game State With Guests Waiting

**What goes wrong:**
Mid-event, the host accidentally clicks "End Game" instead of "Next Question." Or a bug causes the game state machine to reach an invalid transition (e.g. `phase = 'reveal'` but `correct_answer` is null). The game is frozen. 120 guests are staring at their phones. The host panics. There is no "undo" or "reset to question N" button. The only path is a DB edit via Supabase Studio — but the host does not have Studio access and the developer is 300km away.

**Why it happens:**
Game flow recovery UI is treated as "nice to have" and deferred. The host is assumed to never make mistakes. No dry run was conducted to discover what breaking states look like.

**How to avoid:**
- Build an explicit **"Reset / Emergency Controls"** section in the host dashboard:
  - Reset current round (clear answers for current question, reset phase to 'question').
  - Jump to question N (select from dropdown).
  - Force-end game.
  - Restart game from beginning (clears all answers and scores, resets to lobby).
- All state transitions must be explicit DB writes, not derived state — so a "jump to question 3" is a single `UPDATE` that the host dashboard can issue.
- Conduct a **mandatory dry run** 24 hours before the event on the production deployment with the actual host using the actual device they will use at the event.
- Give the host simple access to Supabase Studio (guest read-only + game table edit) as a nuclear option.

**Warning signs:**
- Host dashboard has no way to go backward or reset.
- Game state is stored only in memory or derived from event stream.
- No dry run has been done on production.

**Phase to address:** Phase 3 (Host dashboard) — recovery controls are not optional features. Phase 5 (Pre-event) — dry run as a required gate before the event.

---

### Pitfall 11: RLS Misconfiguration Silently Blocks Legitimate Operations

**What goes wrong:**
RLS is enabled on `answers` or `game_sessions` but policies are incomplete. Guests can submit answers but cannot read back their own answer to show the "locked" state. Or the host cannot read answer distributions. The app silently returns empty arrays instead of errors — the UI shows "0 answers" while the DB has 80. The developer spent hours debugging "realtime not working" when the issue was RLS blocking the initial REST fetch.

**Why it happens:**
RLS defaults to deny-all. Adding `SELECT` policies for anon role is easily overlooked, especially for tables where writes work (INSERT policy exists) but reads do not (SELECT policy missing). Supabase returns `[]` not `403` on a blocked SELECT, making it look like empty data.

**How to avoid:**
- For every table, explicitly define all four operations (SELECT, INSERT, UPDATE, DELETE) for both `anon` and `authenticated` roles — even if the policy is `USING (false)` (explicit deny).
- For this game: `game_sessions` and `questions` are public read (anon can SELECT); `answers` anon can INSERT their own and SELECT their own (`player_token = current_setting('request.jwt.claims')` or a simpler device-token approach); host operations use service role which bypasses RLS.
- After writing each policy, test with the Supabase client using the anon key (not service role) to verify.
- Use Supabase's built-in RLS policy testing in the dashboard before deploying.

**Warning signs:**
- Supabase queries return `[]` with no error when you expect rows.
- Features work in Supabase Studio (which uses service role) but not in the app.
- `console.log(supabase.auth.getSession())` shows `null` but data seems to be saving.

**Phase to address:** Phase 1 (Database) — write and test RLS policies as part of each migration, not as a post-hoc step.

---

### Pitfall 12: iOS Safari Silently Kills WebSocket When Phone Locks or Switches Apps

**What goes wrong:**
A guest locks their phone screen for 30 seconds during the host's preamble. iOS Safari freezes the tab and kills the WebSocket heartbeat. The Supabase Realtime server closes the connection after no heartbeat for ~30s (default timeout). When the guest unlocks their phone, the tab is still open but the WebSocket is dead — no reconnect UI is shown. The guest's phone shows a frozen lobby. They do not receive Question 1. They are effectively dropped from the game invisibly.

**Why it happens:**
iOS aggressively throttles background JavaScript to save battery. Unlike Android Chrome, iOS Safari can kill a WebSocket heartbeat even in a foreground-but-locked state. The Supabase JS client's default heartbeat is 30s — right at the edge of iOS tolerance.

**How to avoid:**
- Configure `worker: true` on guest Realtime clients (Web Worker for heartbeat, separate from main thread, harder for iOS to throttle).
- Reduce heartbeat interval to 15s (`heartbeatIntervalMs: 15000`) so disconnection is detected faster and reconnect starts sooner.
- Show a persistent non-intrusive connection status indicator on the guest UI (green dot = connected, pulsing amber = reconnecting). Guests will self-diagnose and pull-to-refresh.
- On `visibilitychange` event (tab becomes visible again), immediately check connection status and trigger reconnect + state fetch if disconnected.
- Show a "reconnecting..." overlay with auto-dismiss when connection restores, so guests know the delay is temporary.

**Warning signs:**
- Test: lock an iPhone for 60 seconds, unlock, and observe whether the guest UI auto-recovers without a manual refresh.
- Supabase dashboard shows connection count dropping by 10–20% during a quiet period (guests checking other apps).

**Phase to address:** Phase 2 (Realtime core) — visibility-change handler and worker heartbeat. Phase 3 (Guest UI) — connection status indicator.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use Postgres Changes instead of Broadcast for game state | Simpler code, automatic DB sync | 100x DB query amplification at 100 clients; game freezes under load | Never — use Broadcast from day one |
| Skip unique constraint on `(guest_id, question_id)` | Faster schema iteration | Duplicate answers silently accepted; corrupt leaderboard | Never — add constraint in first migration |
| Use service role key in a shared utility | RLS headaches disappear | Key exposed in client bundle; full DB compromise possible | Never |
| Single channel per component (not per session) | Simpler component logic | Channel count multiplies with component mounts; hits 100-channel-per-connection limit fast | Never — one channel per client session |
| Skip dry run "we'll test on the day" | Saves 2 hours of prep | Discover critical bugs with 100 guests waiting; no recovery time | Never for a live event |
| Framer Motion `layout` on leaderboard rows | Smooth auto-layout animation | Triggers reflow on every state change; tanks low-end phones | Only if verified non-impactful on real devices |
| Free plan Supabase | $0 cost | 200 connection limit; project auto-pause risk; no SLA | Never for a production live event |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Realtime + React | Creating a new channel inside a component body (not useEffect), causing a new channel on every render | Create channel in `useEffect`, store reference, call `supabase.removeChannel(channel)` in cleanup |
| Supabase Realtime + React StrictMode | StrictMode runs effects twice; subscription created, immediately destroyed, then created again — channel ends up in bad state | Handle the double-effect with a ref guard or use the channel name to check if already subscribed before creating |
| Next.js Server Actions + Supabase | Using the anon Supabase client in a Server Action for host operations — RLS blocks them | Create a separate server-only Supabase client with service role for Server Actions; anon client for guest-facing API routes |
| Vercel + Supabase connection pooling | Each serverless function invocation creates a new DB connection; under burst load (100 guests all submitting at the same second) you exhaust the Postgres connection pool | Use Supabase's built-in connection pooler (PgBouncer, already enabled by default via the pooler URL). Use the pooler connection string in `DATABASE_URL`, not the direct connection string. |
| Supabase Realtime + mobile Safari | Default 30s heartbeat lost when phone locks, causing silent disconnection without any client-side detection for up to 30s | Use `worker: true`, reduce heartbeat to 15s, handle `visibilitychange` event |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Every Broadcast message triggers full component tree re-render | UI stutters every 100–500ms during active play; 60fps drops to 20fps on mid-range phones | Zustand slice per data domain; `React.memo` on static subtrees; selector functions to minimize re-renders | With any Broadcast traffic on an unoptimized component tree |
| Framer Motion `layout` prop on list items | Leaderboard reflow on every score update causes jank | Animate on reveal only; use `transform`/`opacity` only during active phases | Immediately visible on phones with <2GB RAM |
| Fetching full answer list on every Broadcast event | N+1 pattern: each guest event triggers a full REST fetch of all 100 answers | Trust Broadcast payload for incremental updates; fetch full list only on initial load and reconnect | At 20+ guests submitting simultaneously |
| Supabase Postgres Changes with RLS on a high-write table | DB CPU saturates; change delivery lags 5–30 seconds; some changes never delivered | Switch to server-side Broadcast pattern (server writes DB, then publishes Broadcast) | At 10+ concurrent subscribers |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` in env vars | Service role key in client bundle; full DB access for any guest | Never prefix service role key with `NEXT_PUBLIC_`; verify with `grep -r "service_role" .next/` post-build |
| No RLS on `answers` table | Any guest can read, modify, or delete other guests' answers | Enable RLS on all tables; add explicit policies; test with anon key |
| Host auth via simple password in `sessionStorage` with no server validation per-action | Determined guest reads sessionStorage, crafts host API requests manually | Every host API route must re-validate the session/password on each request, not just on login |
| Guest device token in plain localStorage without expiry | Guest can clone another guest's token by copying localStorage, impersonating them | Token is opaque and session-scoped; validate server-side that token matches the `player_id` in the DB for that session |
| Trusting client-sent `is_correct: true` in answer submission | Guest submits `{ answer: 'A', is_correct: true }` and gets a point regardless of correct answer | Server always computes correctness by fetching `questions.correct_answer` — never trust client-sent scoring flags |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No connection status indicator | Guest cannot tell if their answer registered or if the app is frozen | Persistent subtle dot indicator: green (connected), amber pulsing (reconnecting), with auto-recovery banner |
| Answer button stays active after submission | Guest double-taps, sees duplicate request, panics ("did it count?") | Disable and visually lock answer immediately on tap; show selected state with animation |
| TV display shows answer percentages before reveal | Guests and host can see answer distribution before reveal, removing tension | Suppress percentage bar on TV display until host explicitly triggers reveal phase |
| Leaderboard shows during answering phase | Kills motivation to answer correctly (already losing; why bother?) | Show leaderboard only in dedicated leaderboard phase after each reveal |
| No lobby countdown or waiting indicator | Guests join and see blank screen; think app is broken | Lobby shows guest's name, live "X players joined" counter, and "waiting for host to start" message |
| Host dashboard loads slowly on event day (cold start) | Host panics when clicking "Start" with nothing happening for 3s | Warm up host dashboard in the 10 minutes before the event; show loading state immediately on click |

---

## "Looks Done But Isn't" Checklist

- [ ] **Answer submission:** Unique constraint `(player_id, question_id)` exists in the DB migration — verify with `\d answers` in Supabase SQL editor.
- [ ] **Broadcast fan-out:** Zero Postgres Changes subscriptions exist on client side for game state tables — verify by searching codebase for `.on('postgres_changes'` in client components.
- [ ] **Service role isolation:** `grep -r "SERVICE_ROLE" src/` returns only files inside `src/app/api/` and `src/lib/supabase-server.ts` — any other match is a bug.
- [ ] **Single channel per client:** `supabase.getChannels().length === 1` in guest browser console during gameplay — verify manually.
- [ ] **Reconnect recovery:** Lock phone for 60 seconds → unlock → guest UI auto-recovers and shows current question without manual refresh.
- [ ] **TV display worker heartbeat:** `worker: true` is set in the Realtime client used by the Display Mode page.
- [ ] **Host idempotency:** Click "Next Question" twice in rapid succession → game advances by exactly 1 question, not 2.
- [ ] **RLS coverage:** Every table has explicit SELECT, INSERT, UPDATE, DELETE policies for both `anon` and `authenticated` roles (even if policy body is `USING (false)`).
- [ ] **Free plan not in use:** Supabase dashboard shows Pro plan active before the event date.
- [ ] **Dry run completed:** Full end-to-end game run on production (not localhost) with at least 5 devices, host on their actual device.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Game state stuck / host clicked wrong button | LOW (if recovery UI exists) | Host uses "Jump to Question N" or "Reset Round" button in dashboard |
| Game state stuck / no recovery UI | HIGH | Developer accesses Supabase Studio, manually UPDATEs `game_sessions.current_question_index` and `phase`; takes 5–10 minutes; guests wait |
| Supabase Free plan project suspended mid-event | CRITICAL | Log into Supabase dashboard, upgrade to Pro, wait for project to resume (~2 min); guests see total outage |
| TV display loses sync silently | LOW | Reload the browser tab on the projector laptop — state fetch on subscribe restores current question immediately |
| 20% of guests dropped and not reconnecting | MEDIUM | Announce "please refresh the page if your screen is stuck" — state-on-subscribe ensures they rejoin correctly |
| Duplicate answer rows in DB | LOW (if caught before scoring) | SQL: `DELETE FROM answers a WHERE a.id NOT IN (SELECT MIN(id) FROM answers GROUP BY player_id, question_id)` |
| Host device battery dies mid-game | MEDIUM | Pre-configure backup device with host dashboard URL and password; test login during dry run |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Postgres Changes fan-out | Phase 1 — Architecture | No `.on('postgres_changes'` in client components; only Broadcast subscriptions |
| Connection quota exceedance | Phase 1 — Infrastructure | Supabase dashboard shows Pro plan; single channel per client confirmed |
| Thundering herd reconnect | Phase 2 — Realtime core | Client `reconnectAfterMs` configured with jitter; confirmed in client source |
| State desync on reconnect | Phase 2 — Realtime core | State-fetch-on-subscribe tested: disconnect client, reconnect, verify UI matches DB |
| Duplicate answer submission | Phase 2 — Answer API | Unique constraint in migration verified; ON CONFLICT DO NOTHING in INSERT confirmed |
| Host double-click advance | Phase 3 — Host dashboard | Compare-and-swap UPDATE implemented; button disable on click implemented |
| Animation on low-end phones | Phase 2 (architecture) + Phase 4 (audit) | Chrome DevTools 4x CPU throttle test shows consistent 60fps; no layout animations |
| Vercel cold start | Phase 4 — Pre-event | Warm-up sequence in event day checklist; maxDuration set on API routes |
| Service role key exposure | Phase 1 — Setup | Post-build grep confirms key not in `.next/`; no `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` |
| No game recovery path | Phase 3 — Host dashboard | Recovery controls (reset round, jump to question, force-end) implemented and tested |
| RLS misconfiguration | Phase 1 — Database | Every table RLS tested with anon key client; all expected operations succeed |
| iOS Safari WebSocket drop | Phase 2 — Realtime core | Phone lock test passes (60s lock, auto-recovery on unlock) |

---

## Sources

- [Supabase Realtime Limits — Official Docs](https://supabase.com/docs/guides/realtime/limits)
- [Supabase Realtime Benchmarks — Official Docs](https://supabase.com/docs/guides/realtime/benchmarks)
- [Supabase Postgres Changes — Official Docs](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase Broadcast — Official Docs](https://supabase.com/docs/guides/realtime/broadcast)
- [Supabase Realtime Architecture — Official Docs](https://supabase.com/docs/guides/realtime/architecture)
- [Supabase Troubleshooting: TooManyChannels Error](https://supabase.com/docs/guides/troubleshooting/realtime-too-many-channels-error)
- [Supabase Troubleshooting: Realtime Silent Disconnections in Background Apps](https://supabase.com/docs/guides/troubleshooting/realtime-handling-silent-disconnections-in-backgrounded-applications-592794)
- [Supabase Troubleshooting: Project Suspended for Exceeding Quotas](https://supabase.com/docs/guides/troubleshooting/realtime-project-suspended-for-exceeding-quotas)
- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase Row Level Security — Official Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Realtime Authorization — Official Docs](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase Realtime Broadcast and Presence Authorization](https://supabase.com/blog/supabase-realtime-broadcast-and-presence-authorization)
- [Vercel: Do Serverless Functions Support WebSockets?](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)
- [Vercel: Improve Cold Start Performance](https://vercel.com/kb/guide/how-can-i-improve-serverless-function-lambda-cold-start-performance-on-vercel)
- [Supabase Security: Exposed Anon Keys, RLS, and Misconfigurations](https://www.stingrai.io/blog/supabase-powerful-but-one-misconfiguration-away-from-disaster)
- [Is Supabase Safe for Production? RLS Trap, anon vs service_role](https://vibeappscanner.com/is-supabase-safe)
- [Supabase Realtime WebSocket Connection Management and Reconnection Strategies](https://eastondev.com/blog/en/posts/dev/20260512-supabase-realtime-practice/)
- [Motion (Framer Motion) Performance Guide](https://motion.dev/docs/performance)
- [Framer Motion: Reducing Re-renders During Animations](https://app.studyraid.com/en/read/7850/206069/reducing-re-renders-during-animations)
- [Safari WebSocket Drop on Screen Lock — graphql-ws discussion](https://github.com/enisdenjo/graphql-ws/discussions/290)
- [Supabase Realtime Issues with React 18 Strict Mode](https://github.com/supabase/realtime-js/issues/169)
- [The Problem of Reconnects in Phoenix LiveView (canonical reconnect storm analysis)](https://swmansion.com/blog/the-problem-of-reconnects-in-phoenix-live-view/)

---
*Pitfalls research for: live realtime multiplayer wedding game-show — Next.js 15 + Supabase Realtime + Vercel*
*Researched: 2026-06-01*
