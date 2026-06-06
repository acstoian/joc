# Phase 4: Host Dashboard — Discussion Log

**Date:** 2026-06-03
**Mode:** discuss (default)

> Human-reference record of the discussion. Not consumed by downstream agents — see `04-CONTEXT.md` for the canonical decisions.

## Areas selected for discussion
All four offered: Auth & session model, Dashboard structure, Question editor UX, Live stats + who-answered-what.

## Q1 — Auth & session model
- **Options:** sessionStorage + x-host-password header (recommended) · httpOnly cookie + middleware · re-enter each load
- **Chosen:** sessionStorage + x-host-password header
- **Rationale:** Reuses the proven wedding-site admin pattern and the exact header Phase 3's `validateHostAuth` checks; persists for the session; no new cookie/middleware layer. → D-01

## Q2 — Dashboard structure
- **Options:** Tabs on one /host route (recommended) · separate routes · single scrolling console
- **Chosen:** Tabs (Control · Questions · Stats) on one route
- **Rationale:** One `useGameSync` subscription; mobile-first for a host holding a phone; control+stats prioritized, authoring isolated to its tab. → D-02

## Q3 — Question editor UX
- **Options:** Inline edit + ▲/▼ buttons (recommended) · modal/drawer + drag-drop · inline + drag-drop
- **Chosen:** Inline edit-in-list + up/down reorder buttons
- **Rationale:** Touch-friendly, no dnd dependency, simplest to build reliably. → D-03

## Q4 — Live stats / who-answered-what (HOST-08/09/10)
- **Options:** Count + A/B bar + collapsible names (recommended) · count + bar only · full name columns
- **Chosen:** Count + A/B bar always; per-option name lists collapsible
- **Rationale:** Satisfies HOST-10 without crowding the phone control surface. → D-04

## Claude's discretion
- shadcn component selection, visual styling, optimistic-UI details, gate-as-route-vs-overlay.

## Surfaced implementation notes (for planner)
- `GET /api/game/state` returns A/B **counts**, not names — HOST-10 needs a host-only names source.
- **Question CRUD API doesn't exist yet** — QSTN-01..05 require new `/api/host/questions` endpoints this phase.

## Deferred (not scope creep into Phase 4)
- Set real `HOST_PASSWORD` (ops config; dashboard unusable until set).
- Display Mode / TV projection — later phase.
- Guest app polish — Phase 5.
- httpOnly-cookie auth hardening — post-MVP.
