---
phase: 5
slug: guest-app
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None configured (CLAUDE.md: "No test framework is configured.") |
| **Config file** | none |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npm run lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build && npm run lint`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-xx-01 | env+deps | 0 | JOIN-04 | — | NEXT_PUBLIC_APP_URL only in public env | build | `npm run build` | ❌ W0 | ⬜ pending |
| 05-xx-02 | name gate | 1 | JOIN-04 | — | deviceToken stays in localStorage, not server | build | `npm run build` | ❌ W0 | ⬜ pending |
| 05-xx-03 | join API call | 1 | JOIN-04, JOIN-05 | — | crypto.randomUUID() format accepted by server | build | `npm run build` | ❌ W0 | ⬜ pending |
| 05-xx-04 | lobby screen | 1 | JOIN-04, JOIN-05 | — | QR encodes NEXT_PUBLIC_APP_URL | manual | — | ❌ W0 | ⬜ pending |
| 05-xx-05 | A/B tap | 2 | PLAY-01, PLAY-02 | — | Second tap no-ops after lock | manual | — | ❌ W0 | ⬜ pending |
| 05-xx-06 | answer submit | 2 | PLAY-02, PLAY-03 | — | deviceToken sent (not playerId) | build | `npm run build` | ❌ W0 | ⬜ pending |
| 05-xx-07 | reveal view | 2 | PLAY-04, PLAY-05 | — | Correct option highlighted, wrong dimmed | manual | — | ❌ W0 | ⬜ pending |
| 05-xx-08 | leaderboard | 3 | PLAY-06 | — | Rankings sorted by correct_count desc | manual | — | ❌ W0 | ⬜ pending |
| 05-xx-09 | winner/ended | 3 | PLAY-07 | — | Confetti fires once on ended phase | manual | — | ❌ W0 | ⬜ pending |
| 05-xx-10 | reconnect | 3 | JOIN-05, PLAY-03 | — | localStorage token re-links player record | manual | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `react-qr-code` and `canvas-confetti` + `@types/canvas-confetti` installed
- [ ] `NEXT_PUBLIC_APP_URL` documented in `.env.local.example` or equivalent

*No test file stubs — no test framework configured per CLAUDE.md.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live player count updates within 2s | JOIN-04 | Requires Supabase Realtime + second browser | Open two tabs; second joins; count increments on first |
| QR code is scannable and links to name gate | JOIN-05 | Visual + mobile scan required | Scan with phone camera; lands on / with name gate visible |
| Question appears within 1s of host start | PLAY-01 | Requires live host action + timing | Host clicks Start; guest screen transitions immediately |
| A/B tap locks on first tap, second tap no-ops | PLAY-02 | Mobile tap interaction | Tap A, then tap B — only A remains locked |
| Locked answer persists through refresh | PLAY-03 | Requires localStorage + server state | Tap A, refresh page — A shown as locked |
| Reveal appears within 1s of host reveal | PLAY-05 | Requires host action + timing | Host clicks Reveal; guest sees correct/wrong feedback |
| Leaderboard updates after each reveal | PLAY-06 | Requires completed round | After reveal, scroll down; see ranked players |
| Winner screen + confetti on game end | PLAY-07 | Requires host end-game + visual check | Host ends game; confetti fires once; #1 featured |
| Reconnect restores identity and phase | JOIN-05 | Requires network drop + localStorage | Background phone for 60s; resume; state restored |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
