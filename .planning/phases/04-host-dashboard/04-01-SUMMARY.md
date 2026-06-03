---
phase: "04-host-dashboard"
plan: "01"
subsystem: "host-dashboard"
tags: ["auth", "shadcn", "ui", "host", "realtime"]
dependency_graph:
  requires:
    - "03-server-write-path-state-machine"
  provides:
    - "host-password-gate"
    - "host-dashboard-shell"
    - "shadcn-primitives"
    - "host-constants-module"
    - "useHostAuth-hook"
  affects:
    - "04-02-PLAN"
    - "04-03-PLAN"
    - "04-04-PLAN"
    - "04-05-PLAN"
tech_stack:
  added:
    - "shadcn/ui tabs, card, button, input, alert-dialog, badge, collapsible, separator, skeleton, sonner"
    - "class-variance-authority (shadcn peer dep)"
    - "lucide-react (shadcn peer dep)"
  patterns:
    - "sessionStorage-backed host auth gate (D-01)"
    - "single useGameSync subscription shared across all tab bodies (D-02)"
    - "HOST_SENTINEL_PLAYER_ID UUID for host observer pattern (RQ-3)"
    - "x-host-password header probe for auth validation (RQ-4)"
key_files:
  created:
    - "src/components/ui/tabs.tsx"
    - "src/components/ui/card.tsx"
    - "src/components/ui/button.tsx"
    - "src/components/ui/input.tsx"
    - "src/components/ui/alert-dialog.tsx"
    - "src/components/ui/badge.tsx"
    - "src/components/ui/collapsible.tsx"
    - "src/components/ui/separator.tsx"
    - "src/components/ui/skeleton.tsx"
    - "src/components/ui/sonner.tsx"
    - "src/lib/host/constants.ts"
    - "src/hooks/useHostAuth.ts"
    - "src/app/host/page.tsx"
    - "src/components/host/ControlTab.tsx"
    - "src/components/host/QuestionsTab.tsx"
    - "src/components/host/StatsTab.tsx"
  modified:
    - "src/app/layout.tsx"
    - "package.json"
    - "package-lock.json"
decisions:
  - "Placeholder tab components use eslint-disable-next-line for _props parameter; plans 02/03/04 replace the full component body"
  - "class-variance-authority and lucide-react installed manually after shadcn CLI omitted them from package.json"
  - "Password show/hide toggle added to gate (UX skill: password-toggle rule)"
  - ".env.local copied from main repo to worktree to enable production build"
metrics:
  duration: "~55 min"
  completed: "2026-06-03T14:15:00Z"
  tasks: 3
  files: 16
---

# Phase 4 Plan 1: shadcn Setup + Host Gate + Dashboard Shell Summary

Wave 0 setup complete. shadcn primitives installed, host constants and auth hook established, password gate and three-tab dashboard shell at `/host` working.

## What Was Built

### Task 1: shadcn Primitives + globals.css Integrity
Installed all 10 required shadcn components via `npx shadcn@latest add`. The CLI reported "Installing dependencies" success but omitted `class-variance-authority` and `lucide-react` from `package.json` — these were installed manually. `src/app/globals.css` `@import "tailwindcss"` line 1 and `@theme` block are intact and unmodified.

### Task 2: Shared Host Constants + useHostAuth Gate Hook
`src/lib/host/constants.ts` exports `GAME_ID`, `HOST_SENTINEL_PLAYER_ID` (`"00000000-0000-4000-8000-000000000000"` — valid UUID v4 shape), `SESSION_KEY`, and `hostFetch`. No server-only imports — safe for client bundles (T-04-02). `src/hooks/useHostAuth.ts` implements sessionStorage-backed gate with auth probe against `/api/host/questions`, treating only 401 as wrong password (any other status = accepted, RQ-4).

### Task 3: /host Page + Placeholder Tab Components
`src/app/host/page.tsx` renders `PasswordGate` (no stored password) or `DashboardShell` (authenticated). Gate is a mobile-first centered glass card with visible label, password show/hide toggle (lucide Eye/EyeOff), inline Romanian error on 401, and submit feedback. Shell has sticky 48px header with connection status Badge driven by `useGameSync`, and three shadcn `TabsTrigger`s (Control · Intrebari · Statistici) with exactly one `useGameSync(GAME_ID, HOST_SENTINEL_PLAYER_ID)` call passing props down to all tabs. Three placeholder tab components created using shadcn Card composition; each replaced by Plans 02/03/04 respectively. `lang="en"` → `lang="ro"` in root layout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] class-variance-authority and lucide-react missing after shadcn install**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** `npx shadcn@latest add` CLI installed files referencing `class-variance-authority` and `lucide-react` but did not add them to `package.json`. Both are well-known official shadcn/ui peer dependencies.
- **Fix:** `npm install class-variance-authority lucide-react`
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** 5109ac9

**2. [Rule 1 - Bug] ESLint no-unused-vars rejects underscore-prefixed params in placeholder components**
- **Found during:** Task 3 `npm run build`
- **Issue:** `next/typescript` ESLint preset treats `_props` as unused even with underscore prefix — no argsIgnorePattern configured.
- **Fix:** Added `// eslint-disable-next-line @typescript-eslint/no-unused-vars` above each placeholder function. This is intentional: plans 02/03/04 replace the function body and will use props normally.
- **Files modified:** ControlTab.tsx, QuestionsTab.tsx, StatsTab.tsx
- **Commit:** 5bdf403

**3. [Rule 3 - Blocking] .env.local missing from worktree, causing build-time Supabase credential error**
- **Found during:** Task 3 `npm run build`
- **Issue:** Worktree lacked `.env.local`; `adminClient` initialization throws during page data collection.
- **Fix:** Copied `.env.local` from main repo to worktree. Not committed (gitignored).
- **Commit:** 5bdf403 (same task 3 commit)

### UX Enhancement (skill-driven, Rule 2)

**4. [Rule 2 - Missing Critical Functionality] Password show/hide toggle added to gate**
- **Found during:** Task 3 implementation
- **Trigger:** ui-ux-pro-max skill rule `password-toggle`: "Provide show/hide toggle for password fields (MD)"
- **Fix:** Added Eye/EyeOff lucide icons in an absolutely-positioned button inside the password Input; aria-label in Romanian ("Arata parola" / "Ascunde parola").
- **Files modified:** `src/app/host/page.tsx`

## Human Verification Needed

**Type:** checkpoint:human-verify
**Gate:** blocking

**What was built:** The password gate + three-tab dashboard shell at `/host`, plus all shadcn primitives. `HOST_PASSWORD` and `NEXT_PUBLIC_GAME_ID` env vars must be present for the gate to accept the password (`validateHostAuth` fails closed when `HOST_PASSWORD` is unset).

**How to verify:**
1. Ensure `.env.local` has `HOST_PASSWORD=<your-password>` and optionally `NEXT_PUBLIC_GAME_ID` (dev falls back to the seed UUID). Restart `npm run dev` after editing env.
2. Visit http://localhost:3000/host — you should see the "Dashboard Gazda" gate, NOT the tabs.
3. Enter a WRONG password, click "Intra" — expect the inline red message "Parola gresita. Incearca din nou." and NO dashboard. (Note: until Plan 03 builds `/api/host/questions`, the probe may return 404 and accept any password — that is expected at this stage; real wrong-password rejection is verifiable end-to-end after Plan 03.)
4. Enter the CORRECT password — expect the three-tab shell (Control · Intrebari · Statistici) with a connection status badge in the header.
5. Reload the tab — you should stay logged in. Close the tab and reopen `/host` — you should be prompted again.

**Resume signal:** Type "approved" or describe what rendered incorrectly.

## Known Stubs

The three tab components (`ControlTab`, `QuestionsTab`, `StatsTab`) render minimal "(in curand)" placeholders. This is intentional per plan design — these placeholders are the goal of Plan 04-01 and each will be replaced by a subsequent plan:
- `ControlTab` — replaced by Plan 04-02
- `QuestionsTab` — replaced by Plan 04-03
- `StatsTab` — replaced by Plan 04-04

These stubs do not prevent the plan's goal (gate + shell + navigation structure).

## Threat Surface Scan

No new security-relevant surface introduced beyond the plan's threat model:
- `src/app/host/page.tsx` — client-only gate UI; no server-side trust boundary
- `src/lib/host/constants.ts` — confirmed no server-only imports (T-04-02 mitigated)
- `src/hooks/useHostAuth.ts` — sessionStorage scope only; no cookie/JWT (T-04-03 accepted)

## Self-Check: PASSED

All 16 created/modified files confirmed present. All 3 task commits verified in git log:
- `5109ac9` — feat(04-01): install shadcn primitives + fix globals.css integrity
- `48653e2` — feat(04-01): add host constants + useHostAuth gate hook
- `5bdf403` — feat(04-01): /host page gate + tabbed shell + placeholder tab components
