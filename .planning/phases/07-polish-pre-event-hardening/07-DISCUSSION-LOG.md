# Phase 7: Polish & Pre-Event Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 07-polish-pre-event-hardening
**Areas discussed:** Animation upgrade, Animated gradients, Confetti scope

---

## Animation Upgrade

### AnimatePresence scope

| Option | Description | Selected |
|--------|-------------|----------|
| TV display only | AnimatePresence on TV display only — guest stays CSS-only for phone reliability | ✓ |
| Both guest + TV | AnimatePresence on both surfaces | |
| You decide | Let planner pick | |

**User's choice:** TV display only

---

### TV phase transition style

| Option | Description | Selected |
|--------|-------------|----------|
| Slide + fade | New screen slides up + fades in; old screen fades out. Reuses existing globals.css keyframes. | ✓ |
| Cross-fade only | Current fades out, new fades in. Simpler, no translation. | |
| Scale + fade | New screen scales up from 95% → 100% while fading in. | |

**User's choice:** Slide + fade

---

### Leaderboard stagger

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — 0.08s per row | Each rank entry slides/fades in sequentially. Applied to both RevealDisplay and WinnerDisplay. | ✓ |
| All at once | Whole leaderboard fades in together. | |
| You decide | Let planner pick timing. | |

**User's choice:** Yes — stagger in with 0.08s delay per row

---

### Guest app motion

| Option | Description | Selected |
|--------|-------------|----------|
| Tap feedback only | whileTap={{ scale: 0.96 }} on A/B buttons. No AnimatePresence. | ✓ |
| AnimatePresence on guest too | Guest phase transitions also get AnimatePresence. | |
| CSS-only, no motion/react changes | Guest app unchanged. | |

**User's choice:** Tap feedback only

---

## Animated Gradients

### Gradient placement

| Option | Description | Selected |
|--------|-------------|----------|
| Background only | Slow ambient gradient shift on all page backgrounds. | |
| Hero text + accents only | Gold-to-champagne gradient on key headings/labels. | ✓ |
| Both background + text | Ambient background AND text gradient. | |

**User's choice:** Hero text + accents only

---

### Gradient targets (multi-select)

| Option | Selected |
|--------|----------|
| TV LobbyDisplay game title | ✓ |
| TV WinnerDisplay #1 hero player name | ✓ |
| Guest NameGate heading | ✓ |
| TV RevealDisplay correct answer label | ✓ |

**User's choice:** All four targets selected

---

### Gradient style

| Option | Description | Selected |
|--------|-------------|----------|
| Static gold-to-champagne | background-clip: text, linear-gradient(gold → champagne). No animation. | ✓ |
| Slow pulsing shimmer | background-position animation, 3-4s loop. | |
| Bright shimmer sweep | Highlight sweeps once on mount. | |

**User's choice:** Static gold-to-champagne gradient (CSS only, no animation)

---

## Confetti Scope

### Guest correct-answer confetti

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — small burst on correct reveal | Mini canvas-confetti burst when guest sees they got it right. | ✓ |
| No — winner screen only | Keep confetti to end-game only. | |

**User's choice:** Yes — small burst on correct reveal

---

### TV display winner confetti

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — TV gets confetti on winner screen | WinnerDisplay fires canvas-confetti at game end. | ✓ |
| No — guest-side only | Per Phase 6 D-09, keep confetti guest-only. | |

**User's choice:** Yes — TV WinnerDisplay also gets confetti (overrides Phase 6 CONTEXT.md D-09)

---

## Claude's Discretion

None — user made explicit choices for all questions.

## Deferred Ideas

None — discussion stayed within phase scope.
