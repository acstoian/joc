# Phase 4: Host Dashboard — Research

**Researched:** 2026-06-03
**Domain:** Next.js 15 App Router client UI, Supabase Realtime (reuse), host-auth pattern, shadcn/ui components, question CRUD API design
**Confidence:** HIGH — all findings grounded in actual codebase files read this session

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Host auth uses sessionStorage + `x-host-password` header pattern. Password entered once on gate screen, stored in `sessionStorage`, attached as header on every host API call. Persists for the session, clears on tab close.
- **D-01a:** Gate is client-side UI protection only — real enforcement is server-side per-request via `validateHostAuth`. Wrong password → 401; gate avoids showing dashboard chrome.
- **D-02:** Single protected route `/host` with tabs: Control · Questions · Stats. One `useGameSync` subscription shared across tabs.
- **D-02a:** Mobile-first — host holds a phone during the event. Fully usable one-handed on a phone. Live control + stats are the priority surface.
- **D-03:** Inline edit-in-list for questions — each question is a row edited in place (text, option A, option B, correct-answer A/B toggle). Add-row at bottom to create. Delete per row with confirm.
- **D-03a:** Reorder via ▲/▼ up/down buttons (no drag-and-drop library). Touch-friendly and simpler. Order persists (QSTN-05).
- **D-04:** Always show participant count + live A/B distribution bar. Per-option name lists ("who picked A" / "who picked B") live in a collapsible/expandable section.
- **D-05:** Phase buttons enabled only when valid for current phase; disabled while in-flight; re-enabled when Broadcast confirms new state. Drive from `useGameSync` `state.phase` + `status`.
- **D-06:** Emergency panel (reset round / jump-to-question-by-number / force-end-from-any-state) maps to Phase 3 `host/reset`, `host/transition` (next with chosen question), and `host/transition` end.

### Claude's Discretion

- shadcn/ui component choices (Tabs, Card, Button, Dialog/Sheet for confirms, Input), exact visual styling, optimistic-UI details, and whether the gate is a separate route or an overlay.

### Deferred Ideas (OUT OF SCOPE)

- Set a real `HOST_PASSWORD` in `.env.local` and Vercel project env — operational config task, not Phase 4 code.
- Cinematic Display Mode / TV projection — own later phase.
- Guest-facing app polish — Phase 5.
- httpOnly-cookie auth hardening — post-MVP.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOST-08 | Host sees the live participant count | `useGameSync` already returns `participantCount` from Presence — wire directly to Stats + Control tab. |
| HOST-09 | Host sees the live A/B answer distribution as answers arrive | `state.distribution` (`{A:number, B:number}`) from `useGameSync`/`GET /api/game/state`. Populated when phase is `locked` or `revealed`. For live during `question` phase see RQ-1 below. |
| HOST-10 | Host can see who answered what for the current question | `GET /api/game/state` returns **counts only**. Need a dedicated `GET /api/host/answers?gameId=` endpoint that returns player names per choice — see HOST-10 design below. |
| HOST-11 | Host has emergency recovery controls (reset round / jump to question / force-end) | Phase 3 routes cover all three: `POST /api/host/reset`, `POST /api/host/transition { action:"next", nextQuestionId }`, `POST /api/host/transition { action:"end" }`. UI only. |
| QSTN-01 | Host can create a question | New `POST /api/host/questions` route needed. |
| QSTN-02 | Host can edit a question | New `PUT /api/host/questions/[id]` route needed (or PATCH). |
| QSTN-03 | Host can delete a question | New `DELETE /api/host/questions/[id]` route needed. |
| QSTN-04 | Host can mark which option (A or B) is correct | Covered by QSTN-01/02 — `correct_option` is a field on the question row. Can also be set at edit time. |
| QSTN-05 | Host can reorder questions | New `PATCH /api/host/questions/reorder` or bulk-update endpoint — updates `display_order` for a list of IDs. |
</phase_requirements>

---

## Summary

Phase 4 is primarily a **UI client** built over three already-complete Phase 3 server primitives (transition, reveal, reset routes) plus new question-CRUD endpoints that must be built this phase. The largest engineering decisions are: (1) how to serve player names per answer option for HOST-10 without exposing that data to the public `GET /api/game/state` endpoint, (2) what contract the new `/api/host/questions` endpoints implement, and (3) how the dashboard's in-flight state machine avoids double-taps and correctly re-enables buttons after Broadcast confirmation.

The `useGameSync` hook is ready to reuse as-is. It returns `{ state, status, participantCount }` where `state.distribution` covers HOST-09 (answer counts), `participantCount` covers HOST-08, and `state.leaderboard` is available for the Stats tab. The hook accepts `(gameId, playerId)` — the host dashboard should pass the `gameId` from an env var (single-game MVP) and a sentinel `playerId` like `"host"` (which will produce null `myAnswer` and that is fine because the host has no answer to look up; the route validates that playerId is a UUID so a special constant UUID should be used).

The dashboard route (`/host`) should be a `"use client"` page component that renders the password gate first; on successful auth, it stores the password in `sessionStorage` and renders the tabbed dashboard shell. All host API calls are plain `fetch` with `"x-host-password": password` header.

**Primary recommendation:** Build the dashboard as a single `/src/app/host/page.tsx` client component backed by a `useHostAuth` hook (sessionStorage gate), a shared `useGameSync` instance, a `useHostQuestions` hook (fetch from the new CRUD API), and a `useHostAnswerNames` hook (fetch from the new `GET /api/host/answers` endpoint). Add all shadcn components in one CLI invocation before any UI work begins.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Password gate UI | Browser / Client | — | sessionStorage is browser-only; no server session |
| Phase control buttons | Browser / Client | API / Backend | UI state is local; mutation goes to Phase 3 routes |
| Live participant count | Browser / Client | Supabase Realtime | `useGameSync` Presence — no backend work needed |
| Live A/B distribution (counts) | Browser / Client | API / Backend | `useGameSync` → `state.distribution` via GET /api/game/state |
| Who answered what (names) | API / Backend | Browser / Client | New host-auth-gated read endpoint required |
| Question CRUD | API / Backend | Browser / Client | New `/api/host/questions` routes + adminClient |
| Question ordering | API / Backend | Browser / Client | `display_order` field + bulk PATCH endpoint |
| Emergency controls | API / Backend | Browser / Client | Phase 3 routes already exist — UI only |

---

## Standard Stack

### Core (all already installed)

| Library | Version (installed) | Purpose | Why Standard |
|---------|--------------------|---------|--------------| 
| `next` | 15.3.9 | App Router, API routes, page routing | Project-constrained |
| `react` | 19.x | UI rendering | Bundled with Next.js 15 |
| `@supabase/supabase-js` | ^2.106.0 | Realtime, DB client | Project-constrained |
| `motion` | ^12.40.0 | Button in-flight animation (D-05) | Project-constrained; import from `motion/react` |
| `zustand` | ^5.0.0 | Available if local UI state grows complex | Project-constrained; likely not needed this phase |
| `clsx` + `tailwind-merge` | installed | `cn()` utility, shadcn pattern | Already in `src/lib/utils.ts` |

[VERIFIED: package.json read this session]

### shadcn/ui Components (install via CLI before any UI work)

All components are copied into `src/components/ui` via `npx shadcn@latest add`. The `components.json` is already configured (new-york style, neutral base, Tailwind v4, lucide icons, `@/components/ui`). The directory is currently empty.

```bash
npx shadcn@latest add tabs card button input alert-dialog badge collapsible separator skeleton sonner
```

| Component | Package(s) installed | Purpose in Phase 4 |
|-----------|---------------------|-------------------|
| `tabs` | `@radix-ui/react-tabs` | Control · Questions · Stats tab shell |
| `card` | (CSS only in new-york style) | Stats panels, question row wrappers |
| `button` | (CSS only in new-york style) | All action buttons |
| `input` | (CSS only in new-york style) | Inline question editing |
| `alert-dialog` | `@radix-ui/react-alert-dialog` | Delete/reset/force-end confirmations |
| `badge` | (CSS only) | Phase status pill, connection status |
| `collapsible` | `@radix-ui/react-collapsible` | Who-answered-what + Emergency panel |
| `separator` | `@radix-ui/react-separator` | Section dividers |
| `skeleton` | (CSS only) | Loading placeholders |
| `sonner` | `sonner` (2.0.7 on npm) | Toast feedback for host actions |

[VERIFIED: @radix-ui/react-tabs 1.1.13, @radix-ui/react-collapsible 1.1.12, @radix-ui/react-alert-dialog 1.1.15, @radix-ui/react-separator 1.1.8, sonner 2.0.7, lucide-react 1.17.0 — npm view confirmed this session]

**Tailwind v4 gotcha with shadcn:** shadcn components use CSS variables for theming. With Tailwind v4, these variables are defined in the `@theme` block. The project already has custom tokens (`--color-ink`, `--color-gold`, etc.). shadcn's new-york style generates its own `--background`, `--foreground`, `--primary`, etc. CSS vars. When `npx shadcn@latest add` runs, it will inject variable definitions into `globals.css`. These new vars must not conflict with the existing `@theme` tokens. Resolution: inspect the injected vars after install — shadcn's neutral base uses grays which do not conflict with the project's named palette. The `cn()` utility and Tailwind class overrides take care of the rest.

**`tailwindcss-animate` is deprecated** — shadcn as of March 2025 uses native CSS animations. Do not install it. [CITED: 04-CONTEXT.md canonical refs, CLAUDE.md "What NOT to Use"]

---

## Package Legitimacy Audit

> slopcheck installation was blocked by the auto-mode sandbox (pip execution of external packages is restricted). Falling back to manual registry verification for all new packages.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `sonner` | npm | 3+ yrs | ~4M/wk | github.com/emilkowalski/sonner | Not run | Approved — well-known toast library, confirmed at 2.0.7 [ASSUMED: slopcheck not run] |
| `@radix-ui/react-tabs` | npm | 3+ yrs | ~20M/wk | github.com/radix-ui/primitives | Not run | Approved — Radix UI core, confirmed at 1.1.13 [ASSUMED: slopcheck not run] |
| `@radix-ui/react-collapsible` | npm | 3+ yrs | ~15M/wk | github.com/radix-ui/primitives | Not run | Approved — Radix UI core, confirmed at 1.1.12 [ASSUMED: slopcheck not run] |
| `@radix-ui/react-alert-dialog` | npm | 3+ yrs | ~15M/wk | github.com/radix-ui/primitives | Not run | Approved — Radix UI core, confirmed at 1.1.15 [ASSUMED: slopcheck not run] |
| `@radix-ui/react-separator` | npm | 3+ yrs | ~15M/wk | github.com/radix-ui/primitives | Not run | Approved — Radix UI core, confirmed at 1.1.8 [ASSUMED: slopcheck not run] |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time (sandbox restriction). All Radix UI packages and sonner are well-established packages confirmed on the npm registry. The planner should treat each `npx shadcn@latest add` invocation as an implicit checkpoint — shadcn CLI only adds packages from the official Radix/shadcn ecosystem.*

---

## Architecture Patterns

### System Architecture Diagram

```
Host Browser (phone)
  │
  ├─► /host page (client component)
  │     ├── useHostAuth (sessionStorage gate)
  │     ├── useGameSync(gameId, HOST_PLAYER_ID)   ←── Supabase Realtime Broadcast
  │     │     returns: { state, status, participantCount }
  │     ├── useHostQuestions(gameId, password)     ←── GET /api/host/questions?gameId=
  │     └── useHostAnswerNames(gameId, questionId, password)  ←── GET /api/host/answers?gameId=&questionId=
  │
  ├─► Control tab: phase buttons + emergency
  │     └── POST /api/host/transition | /reveal | /reset  (x-host-password header)
  │
  ├─► Questions tab: inline CRUD list
  │     └── POST/PUT/DELETE/PATCH /api/host/questions  (x-host-password header)
  │
  └─► Stats tab: participant count + distribution + names + leaderboard
        └── (all data from useGameSync + useHostAnswerNames)

Server (Next.js API Routes)
  ├── /api/host/transition   [Phase 3, complete]
  ├── /api/host/reveal       [Phase 3, complete]
  ├── /api/host/reset        [Phase 3, complete]
  ├── /api/host/questions    [NEW — Phase 4]
  │     GET   ?gameId=       → full question list (ordered by display_order)
  │     POST               → create question
  │     PUT  /[id]          → update question (body, optionA, optionB, correctOption)
  │     DELETE /[id]        → delete question
  │     PATCH /reorder      → bulk update display_order
  └── /api/host/answers      [NEW — Phase 4, HOST-10 only]
        GET   ?gameId=&questionId=  → { A: string[], B: string[] } (player names)
```

### Recommended Project Structure

```
src/
├── app/
│   ├── host/
│   │   └── page.tsx              # single client component: gate + tabbed dashboard
│   ├── api/
│   │   ├── host/
│   │   │   ├── transition/       # Phase 3 — complete
│   │   │   ├── reveal/           # Phase 3 — complete
│   │   │   ├── reset/            # Phase 3 — complete
│   │   │   ├── questions/
│   │   │   │   ├── route.ts      # GET + POST
│   │   │   │   ├── [id]/
│   │   │   │   │   └── route.ts  # PUT + DELETE
│   │   │   │   └── reorder/
│   │   │   │       └── route.ts  # PATCH
│   │   │   └── answers/
│   │   │       └── route.ts      # GET (HOST-10 names)
│   └── globals.css               # unchanged
├── components/
│   ├── ui/                       # shadcn (add via CLI)
│   └── host/
│       ├── ControlTab.tsx
│       ├── QuestionsTab.tsx
│       ├── StatsTab.tsx
│       ├── PhaseButton.tsx        # single button with in-flight state
│       ├── QuestionRow.tsx        # inline editable row
│       ├── DistributionBar.tsx    # animated A/B bar (motion.div)
│       └── EmergencyPanel.tsx
└── hooks/
    ├── useGameSync.ts             # Phase 2 — complete, reuse as-is
    ├── useHostAuth.ts             # NEW: sessionStorage gate + password state
    ├── useHostQuestions.ts        # NEW: CRUD state + fetch
    └── useHostAnswerNames.ts      # NEW: HOST-10 name lists
```

---

## Key Research Question Answers

### RQ-1: HOST-10 Names Source — Recommendation

**Verified from code:** `GET /api/game/state` (`src/app/api/game/state/route.ts`) returns `distribution: { A: number; B: number }` (counts only, lines 139–153). There are no player names in the snapshot. Adding names to this public endpoint would expose all player choices to any browser calling it — a privacy/fairness issue.

**Recommendation: Add a dedicated `GET /api/host/answers?gameId=&questionId=` endpoint** gated by `validateHostAuth`. This keeps the public state endpoint clean and avoids leaking names to guests or the TV display. The endpoint query:

```typescript
// Source: codebase analysis of answers table schema (0001_init_schema.sql)
// JOIN answers → players to get display_name per choice
const { data } = await adminClient
  .from("answers")
  .select("choice, players(display_name)")
  .eq("question_id", questionId);
// Returns: [{ choice: "A", players: { display_name: "Andrei" } }, ...]
// Pivot to { A: string[], B: string[] }
```

Response contract:
```json
{ "A": ["Andrei", "Maria"], "B": ["Ion", "Elena"] }
```

**The `useHostAnswerNames` hook** fetches this on demand (when the collapsible opens) + on every `GAME_EVENT` broadcast while the collapsible is open. No polling needed.

**RQ-1 bonus: HOST-09 during `question` phase.** The current `GET /api/game/state` only populates `distribution` when phase is `locked` or `revealed` (lines 140–153). This is correct for the public endpoint (no premature reveal). But the host needs live distribution as answers arrive. Two options:
1. Also populate distribution in the host-answers endpoint response (count + names together).
2. Extend the state endpoint with an `x-host-password` header check to include distribution during `question` phase too.

**Recommendation: Include live counts in `GET /api/host/answers`** — return `{ A: string[], B: string[] }` and the UI can derive counts from array lengths. The Stats tab calls this on every GAME_EVENT while in question/locked/revealed phase. This avoids changing the public endpoint.

---

### RQ-2: Question CRUD API — Full Specification

**Schema verified from `0001_init_schema.sql`:**
```sql
questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id        UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  body           TEXT NOT NULL,
  option_a       TEXT NOT NULL,
  option_b       TEXT NOT NULL,
  correct_option TEXT CHECK (correct_option IN ('A','B')),  -- NULL until revealed
  display_order  INT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

**RLS:** anon role has `USING(false)` on ALL question operations (verified from `0002_rls_policies.sql` lines 42–54). The new routes MUST use `adminClient` (which bypasses RLS). This is consistent with all existing Phase 3 host routes.

**Endpoint contracts:**

#### `GET /api/host/questions?gameId=`
- Auth: `validateHostAuth(req)` → 401 on fail
- Returns: full question list ordered by `display_order ASC`
- Fields: `id, body, option_a, option_b, correct_option, display_order, created_at`
- Use `adminClient.from("questions")` (NOT `questions_public` — need `correct_option`)
- Response: `{ questions: Question[] }`

#### `POST /api/host/questions`
- Auth: `validateHostAuth(req)` → 401 on fail
- Body: `{ gameId: UUID, body: string, option_a: string, option_b: string, correct_option?: "A"|"B" }`
- Sets `display_order` to `MAX(display_order) + 1` for this game (or 1 if first question)
- Returns: `{ question: Question }` with generated `id`
- Validation: `body`, `option_a`, `option_b` all required non-empty strings; `gameId` UUID-validated

#### `PUT /api/host/questions/[id]`
- Auth: `validateHostAuth(req)` → 401 on fail
- Body: `{ body?: string, option_a?: string, option_b?: string, correct_option?: "A"|"B"|null }`
- Partial update — only provided fields are changed
- `id` from URL params (UUID-validated); verify question belongs to the host's game (cross-game edit guard)
- Returns: `{ question: Question }`

#### `DELETE /api/host/questions/[id]`
- Auth: `validateHostAuth(req)` → 401 on fail
- `id` from URL params
- Guard: do not delete a question that is `games.current_question_id` (active question during live game)
- Returns: `{ ok: true }`

#### `PATCH /api/host/questions/reorder`
- Auth: `validateHostAuth(req)` → 401 on fail
- Body: `{ gameId: UUID, order: UUID[] }` — full ordered array of question IDs
- Execute as individual UPDATEs (no batch update in supabase-js without RPC): for each `id` at index `i`, `UPDATE questions SET display_order = i+1 WHERE id = id AND game_id = gameId`
- Alternative: single `Promise.all` over the updates (acceptable at ≤50 questions)
- Returns: `{ ok: true }`

**display_order for reorder:** The `▲/▼` buttons in the UI swap adjacent questions' `display_order` values, then call the reorder endpoint with the new full ordering. This is simpler than increment/decrement because gaps and conflicts are impossible.

---

### RQ-3: `useGameSync` Consumption — Exact API

**Verified from `src/hooks/useGameSync.ts`:**

```typescript
// Signature:
function useGameSync(
  gameId: string,
  playerId: string
): { state: GameStateSnapshot | null; status: SyncStatus; participantCount: number }

// SyncStatus values (used for connection badge):
type SyncStatus = "connecting" | "connected" | "reconnecting" | "error";

// GameStateSnapshot fields available to the dashboard:
type GameStateSnapshot = {
  phase: "lobby" | "question" | "locked" | "revealed" | "ended";
  currentQuestionId: string | null;
  currentQuestion: { id, body, optionA, optionB } | null;
  myAnswer: "A" | "B" | null;      // irrelevant for host; will be null
  correctOption: "A" | "B" | null;  // populated when phase === "revealed"
  distribution: { A: number; B: number } | null;   // populated when locked/revealed
  leaderboard: { name: string; score: number }[];
};
```

**How the dashboard consumes it:**

| Dashboard Surface | State Field | Notes |
|------------------|-------------|-------|
| Control tab — phase buttons enable/disable | `state.phase` | Map phase → which buttons are valid per UI-SPEC table |
| Control tab — connection badge | `status` | "connected" / "reconnecting" / "error" |
| Stats tab — participant count (HOST-08) | `participantCount` | Direct; updates live |
| Stats tab — A/B bar (HOST-09, locked/revealed) | `state.distribution` | null until phase is locked/revealed; show "Niciun raspuns inca." in question phase |
| Stats tab — leaderboard | `state.leaderboard` | Empty array until first reveal |
| Stats tab — current question text | `state.currentQuestion` | Display in distribution card header |
| Jump-to-question bounds check | total from `useHostQuestions` | `state` has no question count; use CRUD hook |

**CRITICAL: `playerId` parameter for host.** The hook calls `GET /api/game/state?gameId=&playerId=` which validates `playerId` as a UUID (UUID_REGEX on line 51 of state/route.ts). The host has no player record. Passing `null` or an empty string will return 400. Pass a **sentinel UUID** constant (e.g. a well-formed UUID like `"00000000-0000-0000-0000-000000000000"`) — the route will skip the `myAnswer` lookup (line 101: `if (playerId && game.current_question_id)`) and return `myAnswer: null` which is correct for the host.

Actually re-reading more carefully: `playerId` is optional — the route checks `if (playerId !== null && !isValidUuid(playerId))` meaning passing `null` in the query string is fine (it becomes the string `"null"` which fails the UUID regex — that returns 400). The safest approach: pass `playerId` as the empty string `""` or omit it from the query string. If omitted, `searchParams.get("playerId")` returns `null`, which passes the optional check (line 51). So the host dashboard should call `useGameSync(gameId, "")` and the route handler's optional check (`playerId !== null`) means it won't validate an empty string.

Wait — reading lines 50-52 more carefully:
```typescript
if (playerId !== null && !isValidUuid(playerId)) {
  return NextResponse.json({ error: "playerId malformed" }, { status: 400 });
}
```
`searchParams.get("playerId")` returns `null` when not present in URL. The fetch inside `useGameSync` always passes `playerId`: `/api/game/state?gameId=${gameId}&playerId=${playerId}`. If `playerId` is empty string `""`, the query string has `playerId=` — then `searchParams.get("playerId")` returns `""` which is not null, so `isValidUuid("")` fails → 400.

**Correct solution: use a sentinel null-UUID.** Pass `playerId = "00000000-0000-4000-8000-000000000000"` — this is a valid UUID v4 shape that passes `UUID_REGEX`, is clearly not a real player (all zeros), and `myAnswer` lookup will simply return no rows. Add this as a named constant `HOST_SENTINEL_PLAYER_ID`.

---

### RQ-4: Host Auth Wiring — Confirmed Contract

**Verified from `src/lib/auth/host.ts`:**

- `validateHostAuth(req)` reads `req.headers.get("x-host-password")` first, then `Authorization: Bearer <password>` as fallback
- Compares with `process.env.HOST_PASSWORD` using `timingSafeEqual` (constant-time)
- Returns `false` (fail-closed) if `HOST_PASSWORD` is unset
- All three Phase 3 host routes call this as the very first statement

**What the dashboard client must do:**
```typescript
// Attach on every host API call:
fetch("/api/host/transition", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-host-password": password,  // from sessionStorage
  },
  body: JSON.stringify({ gameId, action }),
});
```

**Password gate implementation pattern (mirrors wedding-site admin):**
```typescript
// useHostAuth.ts (source: D-01 pattern)
"use client";
const KEY = "host_password";

export function useHostAuth() {
  const [password, setPassword] = useState<string | null>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem(KEY) : null
  );
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function login(pw: string) {
    setChecking(true);
    const res = await fetch("/api/host/transition", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-host-password": pw },
      // Intentionally invalid body to get a 400 (not 401) on right password
      // Better: use a dedicated /api/host/auth endpoint if needed
      // OR: use /api/host/questions GET with a known gameId as the auth probe
      body: JSON.stringify({ gameId: GAME_ID, action: "invalid_probe" }),
    });
    // 401 = wrong password; 400 = wrong action but password accepted
    if (res.status === 401) {
      setError("Parola gresita. Incearca din nou.");
    } else {
      sessionStorage.setItem(KEY, pw);
      setPassword(pw);
      setError(null);
    }
    setChecking(false);
  }
  // ...
}
```

**Better auth probe pattern:** Use `GET /api/host/questions?gameId=GAME_ID` as the auth check. A 200 or 404 (no questions yet) means the password is correct; a 401 means wrong password. This avoids crafting an intentionally invalid request.

**gameId availability:** Single-game MVP — store `GAME_ID` as `process.env.NEXT_PUBLIC_GAME_ID` (or a hardcoded constant in the dashboard). This must be decided by the planner. Per the UI-SPEC open question 3, hardcoded/env-var is acceptable. Recommendation: `NEXT_PUBLIC_GAME_ID` env var; falls back to the seed UUID `"a0000000-0000-4000-8000-000000000001"` in dev.

---

### RQ-5: shadcn/ui Setup

**Verified from `components.json`:** Configuration is complete — new-york style, neutral base, Tailwind v4, `cssVariables: true`, `@/components/ui` directory. `src/components/ui` is currently empty.

**Exact install command (run once before UI work):**
```bash
npx shadcn@latest add tabs card button input alert-dialog badge collapsible separator skeleton sonner
```

**Tailwind v4 integration notes:**
- shadcn new-york with Tailwind v4: uses `oklch()` color values for CSS variables injected into `globals.css`
- The injected vars (`--background`, `--foreground`, `--primary`, etc.) will appear at the top of `globals.css` in the `:root` and `.dark` blocks
- These do NOT conflict with the existing `@theme` block tokens (`--color-ink`, `--color-gold`, etc.) because shadcn uses different variable names
- One potential conflict: shadcn injects `--font-sans` and `--font-mono` but the project uses `--font-heading` and `--font-body`. These are different namespaces — no conflict.
- After running the CLI: verify `globals.css` still has the `@import "tailwindcss"` and `@theme` block intact; the CLI prepends its own CSS variable block

**`Loader2` for in-flight spinner:** lucide-react already installed at 1.17.0. `import { Loader2 } from "lucide-react"` for `animate-spin` spinner. No additional install needed.

---

### RQ-6: Optimistic UI / In-Flight Disable Pattern

**Pattern for D-05 + SC4** — disable on click, re-enable on Broadcast confirmation:

The canonical pattern for this codebase is:

```typescript
// Source: analysis of useGameSync and sync-demo patterns
// PhaseButton.tsx — recommended implementation

"use client";
type InFlightAction = "start" | "lock" | "reveal" | "next" | "end" | null;

// Parent (ControlTab) holds a single `inFlight` state for the whole panel.
// Only one action can be in-flight at a time (host can't click two buttons simultaneously).
const [inFlight, setInFlight] = useState<InFlightAction>(null);

// After the action succeeds at the API layer, set inFlight to null ONLY when
// the Broadcast confirms the new phase via useGameSync.
// Rationale: the API response (200 ok) means the DB was written. The Broadcast
// confirms that useGameSync.state.phase has updated — which is when buttons
// re-enable based on the new phase. This avoids a flash where buttons briefly
// re-enable in the old phase before the Broadcast arrives.

async function handleAction(action: InFlightAction, ...params) {
  if (inFlight !== null) return;  // prevent double-tap
  setInFlight(action);
  try {
    const res = await fetch("/api/host/...", { ... });
    if (!res.ok) {
      showErrorToast(res.status === 409 ? "CAS_CONFLICT" : "API_ERROR");
      setInFlight(null);  // re-enable immediately on error
    }
    // On success: do NOT setInFlight(null) here.
    // Wait for useGameSync state.phase to change (see useEffect below).
  } catch {
    showErrorToast("NETWORK_ERROR");
    setInFlight(null);
  }
}

// Re-enable buttons when the Broadcast arrives and state.phase updates:
useEffect(() => {
  if (inFlight !== null) {
    setInFlight(null);
  }
}, [state?.phase]);  // state from useGameSync
```

**Why not re-enable on API response?** The useGameSync `state.phase` changes ~100-500ms after the API returns (Broadcast latency). If we re-enable on API return, there's a brief window where `state.phase` still shows the old phase and the next valid button might incorrectly appear enabled. By waiting for `state.phase` to update via the `useEffect`, the buttons transition atomically with the phase badge.

**Timeout safety:** Add a 5-second fallback `setTimeout(() => setInFlight(null), 5000)` in case the Broadcast never arrives (network drop). This prevents the dashboard being permanently stuck.

**409 handling:** The transition route returns 409 when the current phase does not match `expectedFrom`. This happens when two fast taps race. Response: show the "Starea jocului s-a schimbat" toast (per UI-SPEC), call `setInFlight(null)` immediately, and the current state from useGameSync will already show the correct phase.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible dialog/confirm | Custom modal with backdrop | shadcn `AlertDialog` | Focus trap, keyboard nav, aria-modal, escape key — all handled by Radix |
| Toast/notification | Custom notification component | shadcn `sonner` | Animation, dismiss, stacking, aria-live — non-trivial to replicate |
| Tab navigation | Custom tab state + panels | shadcn `Tabs` | Radix handles keyboard nav, aria-selected, controlled/uncontrolled modes |
| Animated bar width | CSS transitions via inline style | `motion.div` width transition | Hardware-accelerated; avoids CSSOM mutation on every update |
| Collapsible section | CSS height:0 / overflow:hidden | shadcn `Collapsible` | Radix handles animation, aria-expanded, keyboard — height animation has browser compat issues hand-rolled |
| UUID validation | Custom regex | The existing `UUID_REGEX` pattern from route files | Pattern is already established and tested; copy, don't invent |

---

## Common Pitfalls

### Pitfall 1: `useGameSync` playerId — passing invalid UUID
**What goes wrong:** Host dashboard calls `useGameSync(gameId, "")` or `useGameSync(gameId, "host")` — the state route returns 400 because `playerId` in the query string fails UUID validation, leaving `state` permanently null.
**Why it happens:** The route optional-validates playerId: `if (playerId !== null && !isValidUuid(playerId))` — any non-null, non-UUID string (including empty string `""` from `?playerId=`) triggers 400.
**How to avoid:** Use sentinel UUID `HOST_SENTINEL_PLAYER_ID = "00000000-0000-4000-8000-000000000000"` — it passes UUID_REGEX, the route returns `myAnswer: null`, no DB row found.
**Warning signs:** `state === null` after hook mounts; Network tab shows 400 from `/api/game/state`.

### Pitfall 2: Phase button re-enables before Broadcast arrives
**What goes wrong:** Setting `inFlight = null` inside the `fetch()` success handler means buttons re-enable ~200ms before `state.phase` updates. On a slow phone, the host sees the old phase briefly and may click again.
**Why it happens:** API response arrives before Broadcast propagates through Supabase → useGameSync re-fetch.
**How to avoid:** Re-enable buttons only in `useEffect(() => { setInFlight(null) }, [state?.phase])` — tied to the confirmed new state. Add 5s timeout fallback.
**Warning signs:** Double-tap advances game by two phases.

### Pitfall 3: Questions tab uses `questions_public` view instead of base table
**What goes wrong:** `GET /api/host/questions` reads from `questions_public` view — `correct_option` is always null (the view deliberately omits it).
**Why it happens:** Developers copy the pattern from `GET /api/game/state` which correctly uses the public view.
**How to avoid:** Host question endpoints MUST query `adminClient.from("questions")` (base table). The adminClient bypasses RLS. This is explicitly documented in the codebase (`GET /api/game/state` comment at line 70: "MUST use questions_public... NEVER the base questions table").
**Warning signs:** Correct-option toggle always shows neither A nor B selected in the Questions tab.

### Pitfall 4: Deleting a question that is currently active
**What goes wrong:** Host deletes a question while `games.current_question_id` points to it. The FK is `ON DELETE SET NULL` so `current_question_id` becomes null mid-game — the game enters an inconsistent state where `phase = "question"` but `current_question_id` is null, causing all clients to show no question.
**Why it happens:** FK cascade is valid DB behavior but breaks the game state machine.
**How to avoid:** In `DELETE /api/host/questions/[id]`, read `games.current_question_id` and reject with a 409 if it matches the question being deleted. Guard: "Aceasta intrebare este activa in joc. Reseteaza runda inainte de a o sterge."
**Warning signs:** After delete, all clients show blank question; phase is stuck at "question".

### Pitfall 5: `display_order` gaps after delete
**What goes wrong:** Host creates questions 1, 2, 3. Deletes question 2. `display_order` is now 1, 3. The UI correctly shows them in order, but the `▲/▼` buttons calculate swaps based on the full ordered list — works fine because the UI re-fetches after every mutation.
**Why it matters:** The `start` transition in `/api/host/transition` fetches the first question by `ORDER BY display_order ASC LIMIT 1` — gaps don't matter because it takes the smallest value.
**How to avoid:** No need to renumber after delete. Gaps are harmless.

### Pitfall 6: Admin client imported in a client component
**What goes wrong:** A component imports from `@/lib/supabase/admin` — the `import "server-only"` directive causes a build error: "You're importing a component that needs server-only".
**Why it happens:** Easy to accidentally import adminClient when writing host utility functions.
**How to avoid:** All API calls from the dashboard must be plain `fetch()` to API routes. Never import adminClient in any file under `src/app/host/` or `src/components/`.
**Warning signs:** Build error: `server-only` import in client component.

### Pitfall 7: shadcn CSS variable injection conflicts with globals.css
**What goes wrong:** `npx shadcn@latest add` injects CSS variable declarations into `globals.css`. If the `@import "tailwindcss"` line is moved or the `@theme` block is duplicated, Tailwind v4 silently drops custom tokens.
**Why it happens:** shadcn CLI writes to the CSS file path specified in `components.json` (`tailwind.css: "src/app/globals.css"`).
**How to avoid:** After running shadcn add, verify `globals.css` still starts with `@import "tailwindcss"` and the `@theme` block is intact. The shadcn-injected vars appear in `:root {}` blocks — distinct from the `@theme` block.
**Warning signs:** `bg-ink` class stops working after shadcn install.

### Pitfall 8: Reorder endpoint with individual sequential UPDATEs inside a transaction
**What goes wrong:** 20 questions × 1 UPDATE each = 20 sequential round-trips in the serverless function. On cold start this may hit Vercel's 10s timeout.
**Why it matters:** Supabase-js v2 does not support multi-statement transactions directly.
**How to avoid:** Use `Promise.all()` — fire all UPDATEs concurrently. 20 concurrent DB writes complete in ~200ms. This is acceptable at the question counts for one wedding (max ~30 questions). If Supabase RPC support is needed in Phase 7, a `reorder_questions(order UUID[])` function can batch it — out of scope now.

---

## Code Examples

### Pattern 1: Host API Route Shell (matches Phase 3 pattern)

```typescript
// Source: analysis of src/app/api/host/transition/route.ts (Phase 3 pattern)
// All new host routes follow this exact structure:

import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { validateHostAuth } from "@/lib/auth/host";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ALWAYS FIRST — before any DB access
  if (!validateHostAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // ... route logic using adminClient
}
```

### Pattern 2: Host Fetch Helper (client-side)

```typescript
// Source: design pattern for useHostQuestions.ts
// Centralises the x-host-password header attachment

async function hostFetch(
  url: string,
  password: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-host-password": password,
      ...(options.headers ?? {}),
    },
  });
}
```

### Pattern 3: Phase → Valid Actions Map (for button enable/disable)

```typescript
// Source: analysis of TRANSITIONS map in src/app/api/host/transition/route.ts
// and UI-SPEC §5.3 phase control buttons table

const PHASE_ACTIONS: Record<GameStateSnapshot["phase"], Set<string>> = {
  lobby:    new Set(["start"]),
  question: new Set(["lock", "end"]),
  locked:   new Set(["reveal"]),
  revealed: new Set(["next", "end"]),
  ended:    new Set(),
};

// isActionEnabled(action, state.phase):
function isActionEnabled(action: string, phase: GameStateSnapshot["phase"] | null): boolean {
  if (!phase) return false;
  return PHASE_ACTIONS[phase].has(action);
}
```

Note: the transition route's `TRANSITIONS` map has `end: { expectedFrom: "revealed" }` only. But the UI-SPEC shows "Incheie Jocul" enabled in both `question` and `revealed` phases. This is a gap — see Open Questions #1 below.

### Pattern 4: Inline Question Row State Machine

```typescript
// Source: D-03 design pattern
type RowMode = "view" | "editing" | "saving" | "error";

// Each question row toggles between view and editing mode.
// During "saving": show spinner, disable save/cancel.
// On success: return to "view" mode with updated data.
// On error: return to "editing" mode + show inline error.
```

### Pattern 5: `GET /api/host/answers` implementation sketch

```typescript
// Source: analysis of answers table schema + RLS (0001 + 0002 migrations)
// answers.choice = "A"|"B"; answers.player_id → players.display_name

const { data, error } = await adminClient
  .from("answers")
  .select("choice, players!inner(display_name)")
  .eq("question_id", questionId);

// Pivot:
const result = { A: [] as string[], B: [] as string[] };
for (const row of data ?? []) {
  const name = (row.players as { display_name: string }).display_name;
  if (row.choice === "A") result.A.push(name);
  else result.B.push(name);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` package | `motion` package, import from `motion/react` | 2024 | Same API, new canonical name — already correct in project |
| `tailwindcss-animate` | Native Tailwind v4 animations | March 2025 | Do not install tailwindcss-animate |
| `next lint` command | `eslint` directly | Next.js 15.5 | package.json already uses `eslint .` directly |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | All Radix UI packages and sonner are legitimate, well-established packages | Package Legitimacy Audit | Low — all are industry-standard packages on npm at realistic version numbers, confirmed by npm view |
| A2 | `HOST_PASSWORD` env var is currently unset (deferred config task) | RQ-4 | If it IS set, login will work immediately without config steps — no impact |
| A3 | Single-game MVP — gameId from env var or hardcoded seed UUID is sufficient | RQ-3/4 | If multi-game is needed, dashboard needs a game-select UI — but REQUIREMENTS.md explicitly lists multiple concurrent games as Out of Scope |
| A4 | Supabase-js `.select("choice, players!inner(display_name)")` join syntax works for the answers→players FK | RQ-1, Code Example Pattern 5 | If the join syntax differs, fallback is two-step: fetch answers, then fetch players by IDs |

---

## Open Questions

1. **"End Game" enabled in `question` phase?**
   - What we know: UI-SPEC §5.3 lists "Incheie Jocul" as enabled in `question / revealed`. But `/api/host/transition` TRANSITIONS map has `end: { expectedFrom: "revealed" }` — it will return 409 if called from `question` phase.
   - What's unclear: Was this intentional (host can end during reveal only) or was the UI-SPEC written more liberally?
   - Recommendation: The Phase 3 route is authoritative. If end-from-question is desired, the transition route needs a new action or an extra `expectedFrom` case. For now, the planner should either (a) accept that End is only enabled in `revealed` phase (safer, simpler), or (b) add a `force_end` action to the transition route that bypasses the expectedFrom check. The emergency "Incheie Fortat" panel covers the force-end use case for any phase.

2. **HOST-09 distribution during `question` phase (before lock)**
   - What we know: `state.distribution` is null when `phase === "question"`. The host may want to see live answers coming in before locking.
   - What's unclear: Is live-during-question distribution a hard requirement for HOST-09 or just a nice-to-have?
   - Recommendation: HOST-09 text says "sees the live A/B answer distribution as answers arrive" — this implies during question phase. The `GET /api/host/answers` endpoint returns names (and therefore counts) regardless of phase. The Stats tab can use that endpoint for live distribution. The Control tab A/B bar can show 0/0 with "Niciun raspuns inca" until the first answer arrives (the host clicks "See who answered" to expand counts). This is acceptable for SC3 and matches D-04.

3. **gameId discovery — env var vs hardcoded**
   - What we know: There is one game. The seed UUID is `a0000000-0000-4000-8000-000000000001`. The sync-demo page uses it as `SEED_GAME_ID`.
   - Recommendation: Add `NEXT_PUBLIC_GAME_ID` to `.env.local` and Vercel. Dashboard falls back to `SEED_GAME_ID` constant in dev if the env var is not set. The planner should include a Wave 0 env-setup task.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js build + dev | Assumed present (project already runs) | — | — |
| `npx shadcn@latest` | Install UI components | ✓ (npm available) | CLI-managed | — |
| `HOST_PASSWORD` env var | validateHostAuth | NOT SET (deferred task) | — | All host routes return 401 until set — dashboard UI will always show "wrong password" |
| `NEXT_PUBLIC_GAME_ID` env var | gameId for dashboard | NOT SET (new) | — | Fallback to seed UUID `a0000000-0000-4000-8000-000000000001` |

**Missing dependencies with no fallback:**
- `HOST_PASSWORD` — must be set in `.env.local` and Vercel before the dashboard can be used. The planner should include a human-checkpoint task for this.

**Missing dependencies with fallback:**
- `NEXT_PUBLIC_GAME_ID` — seed UUID fallback usable for development.

---

## Validation Architecture

> `workflow.nyquist_validation` key absent from `.planning/config.json` (file not found) — treating as enabled.

No test framework is configured in this project (verified: `package.json` has no `jest`, `vitest`, or `playwright` devDependencies; CLAUDE.md explicitly states "No test framework is configured"). Nyquist validation for Phase 4 is therefore **manual-only**.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Command | Notes |
|--------|----------|-----------|---------|-------|
| HOST-08 | Participant count updates live | Manual | Open dashboard + join page in two tabs; watch count increment | |
| HOST-09 | A/B distribution bar updates live | Manual | Submit answers from a guest tab; watch bar update in host dashboard | |
| HOST-10 | Names visible in collapsible | Manual | Submit answers; expand "who answered" | |
| HOST-11 | Emergency controls take effect within 2s | Manual | Use reset/jump/force-end buttons; verify in DB or second tab | |
| QSTN-01 | Create question persists | Manual | Create question; reload page; verify it appears | |
| QSTN-02 | Edit question persists | Manual | Edit question text; reload; verify | |
| QSTN-03 | Delete question removes it | Manual | Delete; verify removal | |
| QSTN-04 | Correct option persists | Manual | Mark A correct; reload; verify toggle shows A | |
| QSTN-05 | Reorder persists | Manual | Reorder; reload; verify new order | |

### Phase Success Criteria (from ROADMAP)

| SC | Criterion | How to Verify |
|----|-----------|---------------|
| SC1 | Password gate works | Try wrong password (denied) + correct password (granted + persists session) |
| SC2 | Question CRUD + reorder persist | Create/edit/delete/reorder + page reload |
| SC3 | Live participant count + A/B distribution | Two-browser session: join from one, watch host update |
| SC4 | Phase buttons enable/disable + in-flight disable | Tap Start — button disables immediately + re-enables when phase badge changes |
| SC5 | Emergency controls take effect within 2s | Time from button press to phase change visible in host dashboard |

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | `validateHostAuth` (server-side per-request) + sessionStorage client gate |
| V3 Session Management | Partial | No server session — sessionStorage only; host must re-enter password on tab close |
| V4 Access Control | Yes | All `/api/host/*` routes gated by `validateHostAuth`; questions endpoint must also be gated |
| V5 Input Validation | Yes | UUID validation pattern already established; new routes follow same pattern |
| V6 Cryptography | Yes | `timingSafeEqual` already in `validateHostAuth` — do not change |

### Known Threat Patterns for this Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Guest calling `/api/host/questions` without password | Elevation of Privilege | `validateHostAuth` as first statement — same as all Phase 3 routes |
| Host deleting active question mid-game | Denial of Service | Check `games.current_question_id` before delete; return 409 with Romanian error message |
| Parallel reorder requests corrupting display_order | Tampering | Reorder is idempotent (writes exact values); last writer wins. Acceptable for single host. |
| Unauthenticated read of answer names (HOST-10) | Information Disclosure | `GET /api/host/answers` is host-auth-gated — guests cannot discover who picked what |
| `HOST_PASSWORD` leaking to client bundle | Information Disclosure | `validateHostAuth` has `import "server-only"` — build error if imported client-side |

---

## Sources

### Primary (HIGH confidence)
- `src/hooks/useGameSync.ts` — exact return type, playerId validation behavior, state field names
- `src/app/api/game/state/route.ts` — confirmed distribution is counts-only; phase-gated correctOption
- `src/app/api/host/transition/route.ts` — TRANSITIONS map, action set, CAS/409 contract
- `src/app/api/host/reveal/route.ts` — reveal contract, re-reveal idempotency
- `src/app/api/host/reset/route.ts` — reset contract, surgical delete
- `src/lib/auth/host.ts` — exact header name `x-host-password`, timingSafeEqual, fail-closed behavior
- `supabase/migrations/0001_init_schema.sql` — questions table schema (all columns verified)
- `supabase/migrations/0002_rls_policies.sql` — anon USING(false) on questions confirmed
- `src/lib/supabase/admin.ts` — adminClient (service_role, bypasses RLS), broadcast helper
- `components.json` — new-york style, neutral base, cssVariables: true, Tailwind v4
- `src/app/globals.css` — @theme token names, .glass/.glass-gold utilities
- `package.json` — installed versions of all dependencies

### Secondary (MEDIUM confidence)
- `src/app/sync-demo/page.tsx` — established patterns: `min-h-[44px]`, glass cards, loading state pattern
- `.planning/phases/04-host-dashboard/04-CONTEXT.md` — locked decisions, canonical refs
- `.planning/phases/04-host-dashboard/04-UI-SPEC.md` — component choices, copy, interaction states

### Tertiary (LOW confidence)
- npm view results for @radix-ui packages and sonner — confirmed versions but slopcheck not run

---

## Metadata

**Confidence breakdown:**
- Host auth wiring: HIGH — read from source
- useGameSync API: HIGH — read from source
- Phase 3 route contracts: HIGH — read from source
- DB schema: HIGH — read from migrations
- shadcn install: HIGH — components.json verified, npm versions confirmed
- HOST-10 endpoint design: HIGH — grounded in actual schema and RLS
- In-flight disable pattern: MEDIUM — design recommendation based on codebase analysis, not existing implementation
- Question CRUD API contracts: MEDIUM — designed from schema, follows established patterns

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 (stable stack; Supabase/shadcn may release patches but API is stable)
