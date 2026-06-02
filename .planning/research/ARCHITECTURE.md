# Architecture Research

**Domain:** Live realtime multiplayer game-show web app (Next.js 15 + Supabase Realtime + Vercel)
**Researched:** 2026-06-01
**Confidence:** HIGH (Supabase Realtime mechanisms, DB constraints, Vercel constraints) / MEDIUM (reconnect patterns — official docs incomplete on mobile specifics)

---

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                         CLIENT TIER                                │
│                                                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │   Guest App      │  │  Host Dashboard  │  │   TV Display     │ │
│  │  /join, /play    │  │  /admin          │  │  /display        │ │
│  │  (mobile-first)  │  │  (laptop/tablet) │  │  (landscape TV)  │ │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘ │
│           │                    │                       │           │
│           └────────────────────┴───────────────────────┘           │
│                                │                                   │
│              WebSocket (Supabase Realtime SDK)                     │
└────────────────────────────────┼───────────────────────────────────┘
                                 │
┌────────────────────────────────┼───────────────────────────────────┐
│                    SUPABASE REALTIME CLUSTER                       │
│                    (Elixir/Phoenix, managed)                       │
│                                                                    │
│   Channel: "game:{gameId}"                                         │
│   ├── Broadcast  (game_state events from host)                     │
│   ├── Presence   (participant count / connected guests)            │
│   └── [No Postgres Changes at scale — see rationale below]        │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
┌────────────────────────────────┼───────────────────────────────────┐
│                     NEXT.JS / VERCEL LAYER                         │
│                   (Serverless Functions / Edge)                    │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  API Routes / Server Actions                                │   │
│  │  POST /api/game/join          ← guest registers             │   │
│  │  POST /api/game/answer        ← guest submits answer        │   │
│  │  POST /api/host/transition    ← host advances phase         │   │
│  │  POST /api/host/reveal        ← host reveals correct answer │   │
│  └────────────────────────┬────────────────────────────────────┘   │
└───────────────────────────┼────────────────────────────────────────┘
                            │ service_role key (server only)
┌───────────────────────────┼────────────────────────────────────────┐
│                      SUPABASE POSTGRES                             │
│                                                                    │
│   games · players · questions · answers · scores                   │
└────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Boundary |
|-----------|----------------|----------|
| Guest App (`/join`, `/play`) | Name entry, device-token persistence, answer submission, receiving live state | Client component; reads game state from Broadcast; writes answers via API route |
| Host Dashboard (`/admin`) | Password auth, phase transitions, question management, live stats | Client component; mutates game state via API routes which then broadcast |
| TV Display (`/display`) | Cinematic presentation of current state, leaderboard, reveal animations | Client component; subscribes to same Broadcast channel; purely read-only |
| API Routes / Server Actions | Authoritative write path for all mutations; enforces dedup and constraints; triggers Broadcast via Supabase REST API | Server only; uses `service_role` key; never exposes to client |
| Supabase Realtime Cluster | Distributes live game-state events to all WebSocket subscribers | Managed; clients connect directly; no server intermediary for receiving |
| Supabase Postgres | Durable source of truth for all state; enforces uniqueness constraints at DB layer | Accessed from server only for writes; anon key for initial state fetches on join |

---

## Database Schema

### Rationale

The schema is designed around one invariant: **the `games` row is the canonical game state machine**. All clients derive their displayed state from this row (fetched on join/reconnect, then kept live via Broadcast). The other tables are the durable record — players, answers, scores — that survive reconnects and page refreshes.

### Tables

```sql
-- ─── games ────────────────────────────────────────────────────────
-- One row per game session (one wedding = one row, reused across questions)
CREATE TABLE games (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  phase               TEXT NOT NULL DEFAULT 'lobby'
                      CHECK (phase IN ('lobby','question','locked','revealed','ended')),
  current_question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ
);

-- ─── questions ────────────────────────────────────────────────────
-- Authored by host before or during the game; order is explicit
CREATE TABLE questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id        UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  body           TEXT NOT NULL,
  option_a       TEXT NOT NULL,
  option_b       TEXT NOT NULL,
  correct_option TEXT CHECK (correct_option IN ('A','B')),  -- NULL until revealed
  display_order  INT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── players ──────────────────────────────────────────────────────
-- Guest identity: name + persistent device token (localStorage UUID)
-- device_token is how reconnect re-links a returning browser tab
CREATE TABLE players (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id      UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  device_token UUID NOT NULL,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, device_token)  -- one player record per device per game
);

-- ─── answers ──────────────────────────────────────────────────────
-- One row per player per question — the UNIQUE constraint is the anti-cheat
CREATE TABLE answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  choice      TEXT NOT NULL CHECK (choice IN ('A','B')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, question_id)  -- hard dedup: DB rejects second submission
);

-- ─── scores ───────────────────────────────────────────────────────
-- Denormalized running total; updated by server after each reveal
-- Avoids recounting answers on every leaderboard request
CREATE TABLE scores (
  player_id      UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  correct_count  INT NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Key Constraints

| Constraint | Location | Effect |
|------------|----------|--------|
| `UNIQUE (player_id, question_id)` on `answers` | DB | Prevents any duplicate submission — second INSERT raises a 23505 unique violation |
| `UNIQUE (game_id, device_token)` on `players` | DB | Reconnecting guest gets back their existing player row via upsert |
| `phase CHECK` on `games` | DB | Prevents invalid state machine transitions at the storage layer |
| `correct_option` nullable on `questions` | DB | Answer is hidden until host reveals; NULL = not yet revealed |

### Indexes

```sql
-- Answer lookups for scoring after reveal
CREATE INDEX answers_question_id_idx ON answers(question_id);
-- Leaderboard sort
CREATE INDEX scores_correct_count_idx ON scores(correct_count DESC);
-- Player lookup on reconnect
CREATE INDEX players_device_token_idx ON players(device_token);
```

---

## Realtime Architecture

### Mechanism Selection

Supabase Realtime offers three mechanisms. The choice here is critical at 100+ concurrent clients:

| Mechanism | How it scales at 100+ clients | Use in this app |
|-----------|-------------------------------|-----------------|
| **Broadcast** | Excellent — no per-client DB query; benchmarked at 32,000 concurrent / 6ms median latency | Game state transitions, phase changes, leaderboard snapshots |
| **Presence** | Good for slow-changing state; avoid rapid `track()` calls | Participant count (connected clients in lobby) |
| **Postgres Changes** | Poor at scale — one RLS check per subscriber per DB change; 100 clients = 100 auth queries per INSERT; single-threaded ordering | NOT used for high-frequency paths |

**The core finding from official benchmarks:** Postgres Changes runs a database authorization query for every subscribed client on every change. At 100 clients, one answer INSERT triggers 100 RLS queries. Broadcast bypasses the DB entirely for delivery and benchmarks at 224,000 msg/sec at 32,000 concurrent clients. **Use Broadcast for all game-state distribution.**

### Channel Design

One channel per game: `"game:{gameId}"`

All three client types (guest, host, TV) subscribe to the same channel. The host's API route broadcasts state updates to this channel via the Supabase REST Broadcast API (HTTP POST from the serverless function — no WebSocket needed server-side).

```
Channel: "game:{gameId}"

Events (Broadcast):
  game_state        { phase, current_question_id, question_body, option_a, option_b }
  answer_locked     { question_id }                    -- host locked, no more answers
  answer_revealed   { question_id, correct_option, distribution: { A: N, B: N } }
  leaderboard       { rankings: [{ name, score }][] }  -- sent after reveal
  countdown         { seconds_remaining }              -- cosmetic only, host-initiated

Presence tracking:
  Each connected guest tracks: { player_id, display_name }
  Host dashboard reads Presence state for live participant count
```

### Why Broadcast (Not Postgres Changes) for Game State

The host-driven architecture means all state changes flow through the server write path (API route). The server:
1. Writes the mutation to Postgres (durable record)
2. Immediately calls Supabase's REST Broadcast API to push the event to all clients

This gives both durability (Postgres) and low-latency delivery (Broadcast) without the RLS overhead of Postgres Changes. Clients never need to independently query the DB for state transitions — they receive the broadcast and trust it, with Postgres as the fallback on reconnect.

### Server-Side Broadcast (No WebSocket in Serverless Function)

Vercel serverless functions cannot hold long-lived WebSocket connections. The Supabase Realtime REST API solves this: the server POSTs an HTTP request to the Realtime cluster, which then fans it out to all WebSocket-connected clients.

```typescript
// In a Server Action or API Route — no WebSocket needed
const supabaseAdmin = createClient(url, serviceRoleKey)

await supabaseAdmin
  .from('games')
  .update({ phase: 'revealed', ... })
  .eq('id', gameId)

// Broadcast the new state to all clients
await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
  method: 'POST',
  headers: {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [{
      topic: `game:${gameId}`,
      event: 'game_state',
      payload: { phase: 'revealed', current_question_id: questionId, ... }
    }]
  })
})
```

---

## State Model

### Game Phase State Machine

```
lobby → question → locked → revealed → (next question: question) → ended
```

The `games.phase` column is the authoritative state. Transitions are:
- `lobby → question`: Host starts game, sets `current_question_id`
- `question → locked`: Host locks answers (no more submissions accepted)
- `locked → revealed`: Host reveals correct answer; scoring runs
- `revealed → question`: Host advances to next question
- `revealed → ended`: Host ends game after final question

### Client State Derivation

Each client maintains a local state object populated from:
1. **On join/reconnect**: `GET /api/game/state` — returns current `games` row + current question + player's existing answer (if any)
2. **While connected**: Broadcast events update the local state object reactively

Local state shape (per client):
```typescript
type GameState = {
  phase: 'lobby' | 'question' | 'locked' | 'revealed' | 'ended'
  currentQuestion: { id: string; body: string; optionA: string; optionB: string } | null
  myAnswer: 'A' | 'B' | null         // locked once submitted
  correctOption: 'A' | 'B' | null    // revealed on 'revealed' phase
  distribution: { A: number; B: number } | null  // shown after reveal
  leaderboard: { name: string; score: number }[]
  participantCount: number            // from Presence
}
```

---

## Server-Side Write Path

### API Routes (authoritative writes only)

All mutations go through server-side routes with the `service_role` key. The anon key is used only for reading public-safe data (e.g., fetching current game state on join).

| Route | Method | Actor | What it does |
|-------|--------|-------|--------------|
| `/api/game/join` | POST | Guest | Upserts player by `(game_id, device_token)`; returns `player_id` |
| `/api/game/answer` | POST | Guest | Inserts answer; catches 23505 unique violation = already answered; broadcasts nothing (host controls reveal) |
| `/api/host/transition` | POST | Host | Validates host password; updates `games.phase + current_question_id`; broadcasts `game_state` event |
| `/api/host/reveal` | POST | Host | Sets `questions.correct_option`; calculates scores; updates `scores` table; broadcasts `answer_revealed` + `leaderboard` |
| `/api/game/state` | GET | Any | Returns current authoritative game state for reconnect resync |

### Answer Deduplication (Two Layers)

**Layer 1 — DB constraint:** `UNIQUE (player_id, question_id)` on `answers`. A second INSERT raises PostgreSQL error code `23505`. The API catches this and returns `409 Conflict` — not a 500.

**Layer 2 — Phase check:** The `/api/game/answer` route reads `games.phase` before inserting. If phase is not `'question'`, the answer is rejected with `403 Forbidden` (answers locked or not in question phase). This handles the race between a guest tapping just as the host locks.

```typescript
// In POST /api/game/answer
const { data: game } = await supabase.from('games').select('phase').eq('id', gameId).single()
if (game.phase !== 'question') return Response.json({ error: 'answers_locked' }, { status: 403 })

const { error } = await supabase.from('answers').insert({ player_id, question_id, choice })
if (error?.code === '23505') return Response.json({ error: 'already_answered' }, { status: 409 })
```

---

## Reconnect and Resync Strategy

Mobile clients on flaky networks will disconnect silently (app backgrounded, network drop, venue WiFi hiccup). The Supabase Realtime SDK handles reconnection with exponential backoff (1s → 2s → 5s → 10s, capped at 10s), but **missed broadcast events are not replayed** — the client will be stale.

### Pattern: Subscribe then Fetch

The correct pattern (standard for this class of app) is "subscribe first, then fetch authoritative state."

```typescript
function useGameSync(gameId: string, playerId: string) {
  const [gameState, setGameState] = useState<GameState | null>(null)

  useEffect(() => {
    const channel = supabase.channel(`game:${gameId}`)

    // 1. Set up subscription handlers FIRST
    channel
      .on('broadcast', { event: 'game_state' }, ({ payload }) => {
        setGameState(prev => ({ ...prev, ...payload }))
      })
      .on('broadcast', { event: 'answer_revealed' }, ({ payload }) => {
        setGameState(prev => ({ ...prev, ...payload }))
      })
      .on('broadcast', { event: 'leaderboard' }, ({ payload }) => {
        setGameState(prev => ({ ...prev, leaderboard: payload.rankings }))
      })
      // Presence for participant count
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setGameState(prev => ({ ...prev, participantCount: Object.keys(state).length }))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // 2. After subscription is confirmed, fetch authoritative state
          const res = await fetch(`/api/game/state?gameId=${gameId}&playerId=${playerId}`)
          const data = await res.json()
          setGameState(data)  // hydrates from DB, overwriting any stale local state

          // 3. Track presence
          await channel.track({ player_id: playerId, display_name: data.displayName })
        }
      })

    // 4. Cleanup on unmount
    return () => { supabase.removeChannel(channel) }
  }, [gameId, playerId])

  return gameState
}
```

### Reconnect Visibility

Show a "Reconnecting..." toast when channel status is `CHANNEL_ERROR` or `TIMED_OUT`. The SDK fires status callbacks on reconnect attempts. On `SUBSCRIBED` after a gap, re-fetch authoritative state (same fetch as initial join).

---

## Vercel Serverless Constraints

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| No long-lived WebSocket connections in functions | Cannot hold realtime subscription server-side | Clients connect directly to Supabase Realtime; server sends Broadcast via REST HTTP POST |
| Execution time cap (10s Hobby / 60s Pro) | All API routes must complete quickly | All routes are simple DB writes + one HTTP POST to Supabase; well under limit |
| No persistent in-memory state between invocations | Cannot cache game state in server memory | `games` table is the state; each route reads from DB |
| Cold starts add latency | First request after idle period is slower | Keep routes lean; use Supabase connection pooling (Supavisor); consider warming for critical routes |
| Function isolation (no shared memory) | Multiple simultaneous host clicks could race | DB-level serialization via `UPDATE ... WHERE phase = 'question'` prevents invalid transitions |

**Key insight:** Vercel's serverless model is not a constraint for this architecture — it is naturally aligned with it. The server never holds state; Supabase Realtime holds the WebSocket connections; Postgres holds the durable state. Each serverless invocation is a single write + broadcast, completing in <200ms.

---

## Component Boundaries

### Guest App (`src/app/(guest)/`)

- `JoinPage` — name input, device-token generation, `POST /api/game/join`
- `PlayPage` — subscribes to `game:{gameId}` channel; renders current phase
  - `LobbyView` — waiting screen, participant count from Presence
  - `QuestionView` — A/B tap targets; submits via `POST /api/game/answer`; locks UI on submit
  - `RevealView` — shows correct option, personal result (right/wrong), distribution bars
  - `LeaderboardView` — ranking display after reveal
  - `EndView` — final winner screen

All are `'use client'` components. No server components inside game views (game state is dynamic and subscription-driven).

### Host Dashboard (`src/app/(host)/`)

- `HostAuthPage` — password gate (sessionStorage, same pattern as wedding app)
- `HostDashboard` — subscribes to same `game:{gameId}` channel + reads Presence for count
  - `QuestionManager` — CRUD for questions, reorder via `display_order`
  - `PhaseControls` — Start / Lock / Reveal / Next / End buttons; each calls an API route
  - `LiveAnswerDistribution` — A vs B counts (updated from DB poll or Broadcast, host sees raw numbers)
  - `ParticipantList` — live player list from Presence

### TV Display (`src/app/display/`)

- `DisplayPage` — subscribes to `game:{gameId}` channel; renders big-screen views
  - `LobbyScreen` — player join feed, game title
  - `QuestionScreen` — large A/B options, question text, animated entry
  - `LockedScreen` — "Answers locked" + live distribution bars updating in real time
  - `RevealScreen` — correct answer highlight, confetti/animation, distribution final
  - `LeaderboardScreen` — top N players, animated ranking
  - `CountdownOverlay` — host-triggered cosmetic countdown (Broadcast event)
  - `WinnerScreen` — final state cinematic

Display is a pure subscriber. It never writes anything.

### Shared

- `src/lib/supabase/client.ts` — browser Supabase client (anon key)
- `src/lib/supabase/server.ts` — server Supabase client (service_role, server-only)
- `src/lib/supabase/admin.ts` — admin client for broadcasts (service_role, server-only)
- `src/hooks/useGameSync.ts` — shared subscribe+fetch hook used by all three app surfaces
- `src/types/game.ts` — shared TypeScript types for GameState, Phase, Player, etc.

---

## Recommended Project Structure

```
src/
├── app/
│   ├── (guest)/
│   │   ├── join/
│   │   │   └── page.tsx          # name entry
│   │   └── play/
│   │       └── page.tsx          # game experience (uses useGameSync)
│   ├── (host)/
│   │   ├── page.tsx              # auth gate
│   │   └── dashboard/
│   │       └── page.tsx          # host controls
│   ├── display/
│   │   └── page.tsx              # TV/projector display
│   └── api/
│       ├── game/
│       │   ├── join/route.ts     # POST: upsert player
│       │   ├── answer/route.ts   # POST: submit answer (with dedup)
│       │   └── state/route.ts    # GET: authoritative state for resync
│       └── host/
│           ├── transition/route.ts   # POST: phase change + broadcast
│           ├── reveal/route.ts       # POST: reveal + score + broadcast
│           └── questions/route.ts    # GET/POST/PUT/DELETE: question management
├── components/
│   ├── guest/                    # LobbyView, QuestionView, RevealView, etc.
│   ├── host/                     # PhaseControls, QuestionManager, etc.
│   └── display/                  # LobbyScreen, RevealScreen, etc.
├── hooks/
│   └── useGameSync.ts            # subscribe + fetch + presence
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # browser client (anon key)
│   │   └── server.ts             # server client (service_role, never imported client-side)
│   └── game/
│       ├── scoring.ts            # scoring logic after reveal
│       └── broadcast.ts          # typed wrapper around Supabase REST Broadcast API
└── types/
    └── game.ts                   # GameState, Phase, Player, Answer, etc.
```

---

## Architectural Patterns

### Pattern 1: Subscribe-then-Fetch for Reconnect Safety

**What:** Establish the Realtime subscription before fetching authoritative state. When subscription confirms (`SUBSCRIBED`), fetch the current DB state. On reconnect, repeat the fetch.

**When to use:** Always. Prevents a race where a broadcast arrives between mount and the initial fetch, leaving the client behind.

**Trade-offs:** Adds one fetch per connection/reconnect. Negligible overhead vs. guaranteed consistency.

### Pattern 2: DB-Write + REST-Broadcast (Not DB-Broadcast-Only)

**What:** Server Action/API route writes to Postgres, then immediately calls the Supabase REST Broadcast endpoint. Both operations happen in the same server invocation.

**When to use:** All host-initiated transitions.

**Trade-offs:** Two HTTP calls instead of one, but keeps the broadcast payload fully controlled (server decides exactly what to send, not the raw DB row). Avoids sending `correct_option` to clients before reveal. The alternative (Postgres Changes) sends the raw row to clients, requiring RLS to hide `correct_option` — complex to get right and expensive at scale.

### Pattern 3: Upsert for Idempotent Player Join

**What:** `INSERT INTO players ... ON CONFLICT (game_id, device_token) DO UPDATE SET display_name = EXCLUDED.display_name`

**When to use:** Guest join endpoint. Handles refresh/reconnect returning the same player without creating duplicates.

**Trade-offs:** Slightly more complex SQL, but eliminates a whole class of "duplicate player" bugs.

### Pattern 4: Phase Guard Before Answer Insert

**What:** In the answer API route, read `games.phase` before attempting the `answers` INSERT. Reject immediately if not `'question'`.

**When to use:** Answer submission only.

**Trade-offs:** Adds one extra SELECT per submission. Worth it — prevents spurious "late answer" inserts that would be rejected by scoring anyway, and returns a clear user-facing error.

---

## Anti-Patterns

### Anti-Pattern 1: Postgres Changes for High-Fan-Out Events

**What people do:** Subscribe all 100+ clients to `postgres_changes` on the `games` table to receive phase transitions.

**Why it's wrong:** Every row UPDATE triggers one RLS authorization query per subscriber. 100 clients watching the `games` table = 100 DB queries per host button click. Single-threaded delivery ordering makes it worse under load. At scale this saturates the DB connection pool and introduces latency spikes measured in seconds.

**Do this instead:** Host writes to DB, server broadcasts the event via REST. Clients receive via Broadcast (no RLS, no DB query per client). Postgres Changes is fine for internal server-side use (e.g., a trigger to compute scores), not for client fan-out.

### Anti-Pattern 2: Trusting Client-Submitted Answer Timing

**What people do:** Accept answers from clients regardless of current game phase, or let the client tell the server what phase it thinks it's in.

**Why it's wrong:** Guests can manipulate requests. A guest could submit an answer after the host locks, or replay a submission.

**Do this instead:** Server reads `games.phase` from DB on every answer submission. Client sends only `{ question_id, choice }` — phase is authoritative from the DB, not from the client.

### Anti-Pattern 3: Presence for Rapidly Changing State

**What people do:** Use Presence `track()` to push answer choices or live cursor positions, updating on every tap.

**Why it's wrong:** Rapid `track()` calls flood the Presence channel and degrade performance for all subscribers. Official docs explicitly warn against this.

**Do this instead:** Use Broadcast for events, Presence only for slowly-changing connection state (is this player connected? what is their display name?).

### Anti-Pattern 4: Holding a WebSocket in a Server Action / API Route

**What people do:** Create a Supabase Realtime subscription in a Server Action to "listen" for responses or confirmations.

**Why it's wrong:** Vercel serverless functions time out (10–60s). WebSocket handshake inside a function invocation adds latency and the function can't hold the connection between requests.

**Do this instead:** Server Actions and API routes are fire-and-forget write paths. They write to DB and POST to the REST Broadcast endpoint. Clients handle their own subscriptions.

---

## Data Flow

### Host Advances Phase (most critical flow)

```
Host clicks "Lock Answers"
    ↓
POST /api/host/transition { gameId, targetPhase: 'locked' }
    ↓
Server: validates host password
    ↓
Server: UPDATE games SET phase = 'locked' WHERE id = gameId AND phase = 'question'
    ↓
Server: POST https://{PROJECT_REF}.supabase.co/realtime/v1/api/broadcast
        { topic: "game:{gameId}", event: "game_state", payload: { phase: 'locked', ... } }
    ↓
Supabase Realtime cluster fans out to all WebSocket clients
    ↓
Guest App: receives 'game_state' → disables answer buttons, shows "Locked" state
Host Dashboard: receives 'game_state' → enables "Reveal" button
TV Display: receives 'game_state' → shows distribution bars, "Answers locked" overlay
```

### Guest Submits Answer

```
Guest taps "A"
    ↓
POST /api/game/answer { gameId, questionId, playerId, choice: 'A' }
    ↓
Server: reads games.phase → must be 'question'
    ↓
Server: INSERT INTO answers (player_id, question_id, choice)
        → if 23505 error: return 409 (already answered)
        → if phase guard fails: return 403 (locked)
        → on success: return 200
    ↓
Guest UI: locks choice display (no broadcast needed; only the submitter's UI updates)
```

### Guest Reconnects (page refresh / network drop)

```
Browser reconnects / page refreshes
    ↓
useGameSync initializes channel subscription (async)
    ↓
On 'SUBSCRIBED': fetch GET /api/game/state?gameId=X&playerId=Y
    ↓
Server: returns { phase, currentQuestion, myAnswer, correctOption, leaderboard }
        (reads directly from DB — always current)
    ↓
Client: hydrates local state from authoritative DB response
    ↓
Future events: received via Broadcast subscription (already active)
```

---

## Scaling Considerations

| Scale | Architecture | Notes |
|-------|-------------|-------|
| 1–50 guests | Current design | Well within free tier limits |
| 50–200 guests | Current design | Supabase free tier supports 200 concurrent Realtime connections; Pro supports 500+ |
| 200–500 guests | Upgrade Supabase plan | No code changes needed; increase concurrent connection limit |
| 500+ guests | Consider Supabase dedicated DB | Connection pooling via Supavisor becomes important; Broadcast still handles it |

For the target of 100+ concurrent guests at one wedding, the free or Pro Supabase tier is sufficient with no architectural changes.

**First bottleneck (if it occurs):** Supabase concurrent connection limit (plan-dependent). Not DB query performance or Broadcast throughput — those are overprovisioned for this scale.

**What will NOT be a bottleneck:** Vercel function concurrency (each answer submission is a single fast DB write), Broadcast latency (benchmarked at 6ms median for 32,000 clients).

---

## Build Order Implications

The architecture creates a clear dependency order for phases:

1. **DB schema + Supabase project setup first** — everything else depends on it. Get the schema, constraints, and RLS policies right before any UI.

2. **Game state API routes next** — the write path is the hardest part. Build and test `/api/game/join`, `/api/game/answer`, `/api/host/transition`, `/api/host/reveal` with proper dedup and phase guards before building any UI.

3. **`useGameSync` hook** — the subscribe+fetch pattern is shared by all three client surfaces. Build it once, test it with a mock channel, then wire up the UIs against it.

4. **Host Dashboard before Guest App** — the host drives all state. The guest app cannot be tested meaningfully without the ability to advance phases. Build host phase controls first so the guest UI can be tested end-to-end.

5. **TV Display last** — it is a pure subscriber and requires only reading from the channel. It can be built and tested after the other two surfaces are working.

---

## Integration Points

### External Services

| Service | Integration Pattern | Key Constraint |
|---------|---------------------|----------------|
| Supabase Realtime | Client WebSocket (anon key) for subscriptions; server REST API (service_role) for broadcasts | Never use service_role key client-side |
| Supabase Postgres | Server only via service_role; anon key for public reads (game state on join) | Use Row Level Security — guests should not read `questions.correct_option` until revealed |
| Vercel | Deploy Next.js app; set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `HOST_PASSWORD` as env vars | Service_role key must never be in `NEXT_PUBLIC_` env vars |

### Internal Boundaries

| Boundary | Communication | Rule |
|----------|---------------|------|
| Client ↔ Supabase Realtime | WebSocket (direct, no Next.js involved) | Client subscribes directly; Next.js server never holds this connection |
| Client ↔ Next.js API routes | HTTP (fetch) | All mutations; GET for state resync |
| Next.js API routes ↔ Supabase Postgres | Service_role key over HTTPS | Server-only; never expose service_role to client |
| Next.js API routes ↔ Supabase Realtime | REST Broadcast API (HTTP POST, service_role key) | After each write; fire-and-forget within the same function invocation |

---

## Sources

- [Supabase Realtime Benchmarks](https://supabase.com/docs/guides/realtime/benchmarks) — broadcast vs postgres changes performance at scale (HIGH confidence)
- [Supabase Realtime Architecture](https://supabase.com/docs/guides/realtime/architecture) — Elixir/Phoenix channel model (HIGH confidence)
- [Supabase Broadcast Docs](https://supabase.com/docs/guides/realtime/broadcast) — REST API server-side broadcast mechanism (HIGH confidence)
- [Supabase Presence Docs](https://supabase.com/docs/guides/realtime/presence) — presence sync, join/leave events, rapid-update warning (HIGH confidence)
- [Supabase Realtime GitHub](https://github.com/supabase/realtime) — Postgres Changes RLS overhead per subscriber (HIGH confidence)
- [Supabase Kahoot Alternative](https://supabase.com/blog/meetup-kahoot-alternative) — real-world quiz game pattern using Postgres Changes (MEDIUM confidence)
- [Supabase Realtime in Practice](https://eastondev.com/blog/en/posts/dev/supabase-realtime/) — reconnect strategy, subscribe-then-fetch (MEDIUM confidence)
- [Supabase + Next.js Realtime](https://dev.to/lra8dev/building-real-time-magic-supabase-subscriptions-in-nextjs-15-2kmp) — subscription cleanup pattern (MEDIUM confidence)
- [Vercel + Supabase constraints](https://kuberns.com/blogs/vercel-supabase/) — serverless execution limits (MEDIUM confidence)
- [Real-time quiz game with Vercel + Supabase](https://dev.classmethod.jp/en/articles/vercel-supabase-realtime-multiplayer-quiz-game/) — UNIQUE constraint for dedup, two client types pattern (MEDIUM confidence)

---
*Architecture research for: Live wedding game-show (Next.js 15 + Supabase Realtime + Vercel)*
*Researched: 2026-06-01*
