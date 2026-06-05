---
phase: 04
slug: host-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — no test framework configured (CLAUDE.md: "No test framework is configured"; package.json has no jest/vitest/playwright) |
| **Config file** | none |
| **Quick run command** | `npm run lint` (ESLint) + `npx tsc --noEmit` (typecheck) |
| **Full suite command** | `npm run build` (Next.js production build — proves routes compile + types resolve) |
| **Estimated runtime** | ~30–60 seconds for build |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` (typecheck the touched files)
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** `npm run build` must succeed and manual UAT below must pass
- **Max feedback latency:** ~60 seconds (build)

---

## Per-Task Verification Map

> No automated test framework. Verification is build/typecheck (static) + manual behavioral UAT (runtime). Each requirement below maps to a manual verification because the behaviors are realtime, multi-client UI flows that cannot be unit-tested without infrastructure this project does not have.

| Req ID | Requirement | Static Check | Manual Behavioral Check |
|--------|-------------|--------------|--------------------------|
| HOST-08 | Live participant count | build passes | Open dashboard + join page in two tabs; count increments within 2s |
| HOST-09 | Live A/B distribution bar | build passes | Submit answers from guest tab; bar updates live in dashboard |
| HOST-10 | Per-option name lists (who answered) | build passes | Submit answers; expand collapsible; names appear under A/B |
| HOST-11 | Emergency controls within 2s | build passes | Use reset / jump / force-end; change visible within 2s in second tab |
| QSTN-01 | Create question persists | build passes | Create question; reload page; it persists |
| QSTN-02 | Edit question persists | build passes | Edit text/options; reload; change persists |
| QSTN-03 | Delete question removes it | build passes | Delete with confirm; reload; gone |
| QSTN-04 | Correct option (A/B) persists | build passes | Toggle correct to A; reload; toggle still A |
| QSTN-05 | Reorder persists | build passes | Reorder via ▲/▼; reload; new order persists |

---

## Wave 0 Requirements

- [ ] `npx shadcn@latest add tabs card button input alert-dialog badge collapsible separator skeleton sonner` — install the shadcn primitives the dashboard needs (currently `src/components/ui` is empty)
- [ ] Confirm `src/app/globals.css` `@import "tailwindcss"` + `@theme` tokens remain intact after shadcn install

*No test framework to install — existing static checks (lint, tsc, build) plus manual UAT cover all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Password gate (deny wrong / grant correct / persist session) | SC1 | Auth + sessionStorage UI flow | Enter wrong password → denied; correct → dashboard shows; reload tab → still in; close tab → re-prompt |
| Live participant count | HOST-08 / SC3 | Realtime, multi-client | Two tabs (host + join); count rises within 2s of join |
| Live A/B distribution | HOST-09 / SC3 | Realtime, multi-client | Guest answers; host A/B bar updates live |
| Who answered what (names) | HOST-10 | Host-auth read + UI collapsible | Expand section; names listed per option |
| Phase button enable/disable + in-flight lock | HOST-11 / SC4 | Realtime state-driven UI | Tap Start → disables immediately → re-enables when phase badge changes via Broadcast |
| Emergency reset / jump / force-end within 2s | HOST-11 / SC5 | Realtime state mutation | Trigger each; verify state change broadcasts within 2s |
| Question CRUD + reorder persistence | QSTN-01..05 / SC2 | DB persistence through new host API | Mutate; reload; verify persisted via the questions tab |

*All Phase 4 behaviors are realtime/UI flows verified manually; static checks (tsc + build) guard the contracts.*

---

## Validation Sign-Off

- [ ] All tasks have a static check (tsc/build) or are gated by the Wave 0 shadcn install
- [ ] Sampling continuity: build run after each wave
- [ ] Wave 0 covers the shadcn primitive install (the only setup dependency)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (build)
- [ ] `nyquist_compliant: true` set in frontmatter once map above is confirmed against final plans

**Approval:** pending
