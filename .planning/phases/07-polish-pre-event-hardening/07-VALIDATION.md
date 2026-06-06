---
phase: 7
slug: polish-pre-event-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None configured (no test framework per CLAUDE.md) |
| **Config file** | none |
| **Quick run command** | `npm run build` (TypeScript compilation proxy) |
| **Full suite command** | `npm run build && npm run lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build && npm run lint`
- **Before `/gsd-verify-work`:** Full suite must be green + manual dry run protocol complete
- **Max feedback latency:** ~30 seconds (build) + manual visual inspection

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 7-globals-css | TBD | 1 | RT-07 | — | N/A | build | `npm run build` | ⬜ pending |
| 7-display-animatepresence | TBD | 1 | RT-07 | — | N/A | manual+build | `npm run build` + visual | ⬜ pending |
| 7-lobby-gradient | TBD | 1 | RT-07 | — | N/A | build | `npm run build` | ⬜ pending |
| 7-reveal-stagger | TBD | 2 | RT-07 | — | N/A | manual+build | `npm run build` + visual | ⬜ pending |
| 7-winner-display | TBD | 2 | RT-07 | — | N/A | manual+build | `npm run build` + visual | ⬜ pending |
| 7-question-tap | TBD | 1 | RT-07 | — | N/A | device | `npm run dev` + phone tap | ⬜ pending |
| 7-namegate-gradient | TBD | 1 | RT-07 | — | N/A | build | `npm run build` | ⬜ pending |
| 7-revealscreen-confetti | TBD | 2 | RT-07 | — | N/A | device | `npm run dev` + correct answer | ⬜ pending |
| 7-perf-validation | TBD | 3 | RT-08 | — | N/A | manual | Chrome DevTools 4x CPU throttle | ⬜ pending |
| 7-dry-run | TBD | 3 | RT-08 | — | N/A | human-gate | Dry Run Protocol (5+ real devices) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — existing infrastructure (TypeScript compilation + manual testing) covers all phase requirements. No test framework to install.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Gold gradient text renders on 4 elements | RT-07 | CSS gradient — cannot unit test | `npm run dev` → visual inspect LobbyDisplay, WinnerDisplay, NameGate, RevealDisplay (correct option) |
| AnimatePresence fires on phase change (TV) | RT-07 | Browser animation — needs observation | `npm run dev` → host: start game, progress phases, observe slide+fade transitions |
| Leaderboard stagger fires on mount | RT-07 | Browser animation — needs observation | `npm run dev` → advance to reveal/winner phase, observe 10-row stagger (0-800ms) |
| `whileTap` scale on A/B buttons | RT-07 | Requires real device touch event | Load on phone → tap A/B buttons → confirm 0.96 scale briefly visible |
| Correct-answer confetti (guest RevealScreen) | RT-07 | Requires correct answer scenario + visual | Answer correctly → advance to reveal → confirm gold confetti burst |
| TV winner confetti (WinnerDisplay) | RT-07 | Requires full game + big screen | End game → observe confetti from upper-center of TV display |
| `prefers-reduced-motion` fallback | RT-07 | OS accessibility setting required | Enable reduce-motion in OS → verify no animations, flat gold color on gradient |
| 60fps on 4x CPU throttle | RT-08 | Chrome DevTools Performance required | DevTools → Performance → 4x CPU throttle → tap A/B buttons → confirm 60fps |
| No layout-triggering animations | RT-08 | Code + runtime review | Confirm all `motion/react` variants use only `opacity` + `transform` |
| Full dry run on production | RT-08 | Requires Vercel + Supabase Pro + 5 devices | Dry Run Protocol: join → play → reveal × N → winner on 5+ real devices including iPhone/Safari |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
