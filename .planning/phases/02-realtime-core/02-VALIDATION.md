---
phase: 02
slug: realtime-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-02
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

This phase has **no automated test framework** (CLAUDE.md: "No test framework is configured").
Validation is therefore a mix of **code-review/grep source assertions** (cheap, deterministic,
runnable per-task) and **manual harness verification** via the throwaway `/sync-demo` route that
Phase 2 builds. The grep assertions are the per-task feedback signal; the harness drives the
end-to-end success criteria.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None configured — grep/code-review assertions + manual `/sync-demo` harness |
| **Config file** | none |
| **Quick run command** | `npm run build` (typecheck) + targeted `grep` source assertions |
| **Full suite command** | `npm run build && npm run lint` + manual `/sync-demo` checklist |
| **Estimated runtime** | ~30–60 seconds (build/lint); harness checks are interactive |

---

## Sampling Rate

- **After every task commit:** Run the task's grep/source assertion(s) + `npm run build` if types changed
- **After every plan wave:** Run `npm run build && npm run lint`
- **Before `/gsd-verify-work`:** Build + lint green AND the `/sync-demo` manual checklist passes
- **Max feedback latency:** ~60 seconds for automated (build/grep); interactive for harness

---

## Per-Task Verification Map

| Item | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|------|------|-------------|-----------------|-----------|-------------------|--------|
| Realtime client opts (`worker`, jitter, heartbeat) | 1 | RT-04 | anon key only client-side | source assert | `grep -n "worker: true" src/lib/supabase/client.ts` | ⬜ pending |
| GAME_EVENT typed union | 1 | RT-01 | typed signal, no secrets in payload | source assert + build | `npm run build` | ⬜ pending |
| `GET /api/game/state` resync endpoint | 1 | RT-03 | server-only adminClient, no service key leak | source assert + build | `grep -rn "server-only" src/app/api/game/state` ; `npm run build` | ⬜ pending |
| `useGameSync` hook (subscribe-then-fetch) | 2 | RT-01, RT-03, RT-06 | headless, no postgres_changes | source assert | `grep -L "postgres_changes" src/hooks/useGameSync.ts` | ⬜ pending |
| visibilitychange + presence wiring | 2 | RT-03, RT-04 | single track() per connection | source assert | `grep -n "visibilitychange" src/hooks/useGameSync.ts` | ⬜ pending |
| `/sync-demo` harness | 3 | RT-01, RT-03 | throwaway, no prod surface | manual | `/sync-demo` checklist (below) | ⬜ pending |
| No client-side postgres_changes (repo-wide) | 3 | RT-01 (carries RT-02) | — | source assert | `grep -rn "postgres_changes" src/` returns 0 client matches | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no test framework to install.*
Phase 2 deliberately adds no test harness (per CLAUDE.md + RESEARCH.md §Validation Architecture).
The `/sync-demo` route built in Wave 3 IS the verification surface for the realtime success criteria.

---

## Manual-Only Verifications

These require a running app and (for SC2/SC4) browser DevTools — they cannot be asserted from source.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two tabs receive a broadcast within 1s | RT-01 | Requires live WebSocket fan-out across two clients | Open two tabs at `/sync-demo?gameId=X`; fire a host-trigger button in tab A; both subscriber panes update < 1s, no refresh |
| 60s offline → auto reconnect + resync | RT-03 | Requires real connection drop + SDK reconnect timing | DevTools Network → Offline 60s → Online; tab auto-reconnects and shows current authoritative state, no manual refresh |
| visibilitychange → immediate resync | RT-04 | Requires tab backgrounding lifecycle | Background tab ~30s; foreground it; a `GET /api/game/state` fetch fires immediately |
| 60s real-device screen-lock (iOS Safari + Android Chrome) | RT-03 | iOS `worker:true` efficacy unconfirmable in DevTools (D-08) | **Deferred to Phase 7 dry run (RT-08)** — not validated in Phase 2 |

---

## Validation Sign-Off

- [ ] Every task has a grep/source assertion OR is listed under Manual-Only Verifications
- [ ] Sampling continuity: no 3 consecutive tasks without an automated (grep/build) signal
- [ ] Wave 0 covers all MISSING references (N/A — no framework)
- [ ] No watch-mode flags in any command
- [ ] Feedback latency < 60s for automated checks
- [ ] `nyquist_compliant: true` set in frontmatter once plans encode these assertions

**Approval:** pending
