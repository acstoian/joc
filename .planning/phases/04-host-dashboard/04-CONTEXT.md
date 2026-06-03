# Phase 4: Host Dashboard - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

A password-gated host dashboard (the host-facing UI) that lets the host:
- author questions before the event (create, edit, delete, reorder, mark correct A/B — QSTN-01..05),
- drive every live phase transition (Start, Lock, Reveal, Next, End) using the Phase 3 host API routes,
- watch live stats (participant count, A/B distribution, who answered what — HOST-08/09/10),
- recover from mistakes with emergency controls (reset round, jump to question, force-end — HOST-11).

This phase builds the UI + any host-only read/CRUD endpoints it needs. It consumes the Phase 3 write-path routes and the `useGameSync` realtime hook. It does NOT change the guest experience (Phase 5) or the cinematic Display Mode (later).
</domain>

<decisions>
## Implementation Decisions

### Auth & Session
- **D-01:** Host auth uses the **sessionStorage + `x-host-password` header** pattern. The host enters the password once on a gate screen; it is stored in `sessionStorage` and attached as the `x-host-password` header on every host API call (the exact header `validateHostAuth` already checks). Persists for the session, clears on tab close. No new cookie/middleware layer. (Mirrors the existing wedding-site admin auth pattern; SC1.)
- **D-01a:** The gate is client-side UI protection only — real enforcement is server-side per request via Phase 3's `validateHostAuth`. Wrong password → host routes already return 401; the gate just avoids showing the dashboard chrome.

### Dashboard Structure
- **D-02:** Single protected route (e.g. `/host`) with **tabs: Control · Questions · Stats**. One `useGameSync` subscription shared across tabs.
- **D-02a:** **Mobile-first** — the host holds a phone during the event. Must be fully usable one-handed on a phone; should also be fine on a laptop. Live control + stats are the priority surface; question authoring lives in its own tab (mostly used pre-event).

### Question Editor UX (QSTN-01..05)
- **D-03:** **Inline edit-in-list** — each question is a row edited in place (text, option A, option B, correct-answer A/B toggle). Add-row at the bottom to create. Delete per row with confirm.
- **D-03a:** Reorder via **▲/▼ up/down buttons** (no drag-and-drop library) — touch-friendly and simpler to build reliably. Order persists (QSTN-05).

### Live Stats (HOST-08/09/10)
- **D-04:** Always show **participant count** + a live **A/B distribution bar**. The **per-option name lists** ("who picked A" / "who picked B") live in a **collapsible/expandable** section so the phone screen stays uncluttered during control. Satisfies HOST-10 without crowding the control surface.

### Phase Controls & Emergency (behavior locked by ROADMAP SCs)
- **D-05:** Phase buttons (Start/Lock/Reveal/Next/End) are enabled only when valid for the current phase; a clicked button is disabled while its request is in-flight and re-enables when the Broadcast confirms the new state (SC4). Drive enable/disable from `useGameSync` `state.phase` + `status`.
- **D-06:** Emergency panel (reset round / jump-to-question-by-number / force-end-from-any-state) maps to Phase 3 `host/reset`, `host/transition` (next with chosen question), and `host/transition` end. Each must take effect + broadcast within ~2s (SC5).

### Claude's Discretion
- shadcn/ui component choices (Tabs, Card, Button, Dialog/Sheet for confirms, Input), exact visual styling, optimistic-UI details, and whether the gate is a separate route or an overlay — left to UI-spec/research/planner.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 3 server contracts this dashboard drives
- `src/app/api/host/transition/route.ts` — Start/Lock/Next/End state machine; request body `{ gameId, action, nextQuestionId? }`; D-07 CAS (idempotent noop vs 409). Powers control buttons + jump-to-question + force-end.
- `src/app/api/host/reveal/route.ts` — reveal correct answer + recompute scores; body `{ gameId, choice }`.
- `src/app/api/host/reset/route.ts` — surgical round reset (emergency); body `{ gameId }`.
- `src/lib/auth/host.ts` — `validateHostAuth(req)`; reads `x-host-password` header. The dashboard MUST send this header on every host call. NOTE: `HOST_PASSWORD` must be set in `.env.local` + Vercel (currently empty — see Deferred/known issue).

### Realtime + read model
- `src/hooks/useGameSync.ts` — returns `{ state, status, participantCount }`. Already provides participant count (HOST-08), `state.distribution` A/B counts (HOST-09), `state.phase`, `state.leaderboard`. The dashboard's live surface should reuse this hook.
- `src/app/api/game/state/route.ts` — current snapshot endpoint. IMPORTANT: it returns `distribution` as **A/B counts only**, not names. HOST-10 ("who answered what") needs per-option NAMES — planner/researcher must decide whether to extend this endpoint (host-only fields) or add a dedicated host stats endpoint.
- `src/app/sync-demo/page.tsx` — throwaway Phase 2 harness showing how to wire `useGameSync` + host actions; useful reference, not production.

### Planning sources
- `.planning/ROADMAP.md` § Phase 4 — goal, 9 requirements (HOST-08..11, QSTN-01..05), 5 success criteria. **Locked scope.**
- `.planning/REQUIREMENTS.md` — requirement definitions + traceability.
- `.planning/phases/03-*/03-CONTEXT.md` — Phase 3 decisions (D-07 CAS, header auth) that this phase builds on.

### Known gap to address in this phase
- **Question CRUD API does not exist yet.** Phase 3 built no question routes. QSTN-01..05 require new host-only endpoints (create/edit/delete/reorder + set `correct_option`), e.g. under `src/app/api/host/questions/`. These touch the `questions` base table via the service-role admin client and must be gated by `validateHostAuth`. Planner should scope these alongside the UI.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useGameSync` hook — single realtime primitive; gives `state` (phase/distribution/leaderboard/correctOption), `status` (connection), `participantCount`. Reuse for Control + Stats tabs.
- Phase 3 host routes — the entire write path is done; Phase 4 is largely a UI client over them + question CRUD.
- shadcn/ui configured (`components.json`: new-york style, neutral base, lucide icons, `@/components/ui`). `src/components/ui` is currently empty — add components via `npx shadcn@latest add ...` as needed.
- Wedding-site admin auth pattern (sessionStorage password gate) — the reuse model for D-01.

### Established Patterns
- Host API routes validate `x-host-password` server-side per request (no session/JWT). Client must attach the header.
- Tailwind v4 `@theme` tokens + custom fonts already in `src/app/globals.css`.
- All UI text is in Romanian (`lang="ro"`); the host dashboard text should be Romanian too.

### Integration Points
- Dashboard Control tab → POST host/transition, host/reveal, host/reset (with `x-host-password`).
- Dashboard Stats tab → `useGameSync` (+ a host-only names source for HOST-10).
- Questions tab → new `/api/host/questions` CRUD endpoints (to be built this phase).
</code_context>

<specifics>
## Specific Ideas

- Host is on a **phone**, one-handed, during a live wedding — control + stats must be glanceable and hard to mis-tap. This is the primary design constraint.
- Question authoring is mostly a **pre-event** activity; it can be denser/laptop-friendly in its own tab.
</specifics>

<deferred>
## Deferred Ideas

- **Set a real `HOST_PASSWORD`** in `.env.local` and the Vercel project env — currently empty, so host auth fails closed. This is an operational config task (tracked in `.planning/phases/03-*/03-HUMAN-UAT.md` Gaps), not Phase 4 code, but the dashboard is unusable until it's set.
- Cinematic Display Mode / TV projection — its own later phase.
- Guest-facing app polish — Phase 5.
- httpOnly-cookie auth hardening — could revisit post-MVP if the shared-secret header proves insufficient; out of scope now.

None of the above expands Phase 4 scope.
</deferred>

---

*Phase: 4-host-dashboard*
*Context gathered: 2026-06-03*
