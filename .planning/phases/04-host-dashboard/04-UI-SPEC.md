---
phase: 4
phase_name: host-dashboard
status: draft
design_system: shadcn/ui new-york (neutral base, Tailwind v4)
created: 2026-06-03
revised: 2026-06-03
---

# UI-SPEC: Phase 4 — Host Dashboard

## Source Decisions

| Artifact | Decisions Extracted |
|----------|-------------------|
| CONTEXT.md / D-01 | sessionStorage password gate, x-host-password header pattern |
| CONTEXT.md / D-02 | Single `/host` route, three tabs: Control · Questions · Stats |
| CONTEXT.md / D-02a | Mobile-first, one-handed phone use is the primary design constraint |
| CONTEXT.md / D-03 | Inline edit-in-list for questions (no modal editor) |
| CONTEXT.md / D-03a | Up/down buttons for reorder — no drag-and-drop |
| CONTEXT.md / D-04 | Participant count + A/B bar always visible; per-option name lists in collapsible |
| CONTEXT.md / D-05 | Phase buttons enabled only when valid; disabled while in-flight; re-enabled on Broadcast confirm |
| CONTEXT.md / D-06 | Emergency panel: reset round / jump-to-question / force-end |
| globals.css | Soft-luxury dark palette: ink, champagne, gold, blush, sage — all existing tokens |
| globals.css | Fonts: Playfair Display (heading), Inter (body); `.glass` and `.glass-gold` utilities |
| components.json | shadcn/ui new-york style, neutral base, lucide icons, Tailwind v4, `@/components/ui` |
| sync-demo | Established pattern: `min-h-[44px]` touch targets, `glass` cards, `text-gold-bright` accents |
| REQUIREMENTS.md | All text Romanian. HOST-08..11 + QSTN-01..05 are the full scope. |

---

## 1. Design System

**Tool:** shadcn/ui (new-york style, neutral base)
**Tailwind version:** v4 — use `@theme` block tokens only; no raw hex values
**Icon library:** lucide-react
**Component directory:** `@/components/ui` (currently empty — add via `npx shadcn@latest add`)
**Animation library:** motion (`motion/react`) — for in-flight state transitions on control buttons

### shadcn/ui Components Required for This Phase

| Component | Use |
|-----------|-----|
| `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` | Control · Questions · Stats tab shell |
| `Card` / `CardHeader` / `CardTitle` / `CardContent` | Live stats panels, question row wrappers |
| `Button` | All action buttons — phase controls, CRUD actions, emergency controls |
| `Input` | Question text fields (inline editing) |
| `AlertDialog` | Destructive confirmations (delete question, force-end game, reset round) |
| `Badge` | Phase status indicator, connection status |
| `Collapsible` / `CollapsibleTrigger` / `CollapsibleContent` | Who-answered-what name lists (D-04) |
| `Separator` | Section dividers |
| `Skeleton` | Loading placeholders on initial data fetch |
| `sonner` | Toast feedback for host actions (success / error) |

**Registry:** shadcn official only. No third-party registries.

---

## 2. Spacing Scale

8-point scale. All spacing must be a multiple of 4px.

| Token | px | Use |
|-------|----|-----|
| 4 | 4px | Fine gaps, icon inner padding |
| 8 | 8px | Tight inline gaps (label + value) |
| 12 | 12px | Card inner padding (mobile) |
| 16 | 16px | Card inner padding (desktop), section gaps |
| 20 | 20px | Between major sections inside a tab |
| 24 | 24px | Between tab content blocks |
| 32 | 32px | Page horizontal padding (desktop) |
| 48 | 48px | Vertical rhythm between tab sections (desktop) |

**Touch target minimum:** 44px height and width for every tappable element.
This applies to phase control buttons, question action icons (▲ ▼ delete), the A/B correct-answer toggle, and the collapsible trigger.

---

## 3. Typography

All text is in Romanian.

4 sizes, 2 weights. The host dashboard is a utility UI — a single heading size suffices.

| Role | Font | Size | Weight | Line-height | Token |
|------|------|------|--------|-------------|-------|
| Section heading / card title / page title | Playfair Display (`font-heading`) | 16px | 700 | 1.2 | `text-base font-bold` |
| Body / label | Inter (`font-body`) | 14px | 400 | 1.5 | `text-sm` |
| Phase button label | Inter (`font-body`) | 14px | 700 | 1 | `text-sm font-bold` |
| Caption / status | Inter (`font-body`) | 12px | 400 | 1.4 | `text-xs` |
| Live count (large) | Inter (`font-body`) | 28px | 700 | 1 | `text-3xl font-bold` |

**Two weights in use: 400 (regular) and 700 (bold).**

Note: the former 20px "page title" row has been removed. All headings — including the sticky header "Joc — Gazda" and tab section titles — use `text-base font-bold` (16px/700).

---

## 4. Color Contract

The entire dashboard lives on the soft-luxury dark palette already defined in `globals.css`. No new tokens are needed.

### 60/30/10 Split

| Role | Token | Use |
|------|-------|-----|
| 60% Dominant surface | `--color-ink` (`#0f0f1a`) | Page background, body background |
| 30% Secondary surface | `--color-ink-light` (`#1a1a2e`) | Cards (`glass`), tab panel background |
| 10% Accent | `--color-gold` / `--color-gold-bright` | See reserved list below |

### Accent Reserved For

Gold (`--color-gold`, `--color-gold-bright`) is reserved exclusively for:
1. The active/correct phase button (e.g. "Blocare Raspunsuri" while game is in question phase)
2. Participant count number
3. A/B distribution bar fill (dominant choice)
4. Current question indicator badge
5. "Correct answer" toggle selection (A or B marked correct)

All other interactive elements use neutral or muted treatments.

### Semantic Colors

| Purpose | Token | Elements |
|---------|-------|---------|
| Destructive / error | `red-400` / `red-500` | Delete question button, force-end button, error toasts, API 4xx feedback |
| Warning / locked | `--color-blush` (`#e8a0a0`) | "Blocat" phase badge when answers are locked |
| Success / correct | `--color-gold-bright` (`#f0c060`) | Correct-answer reveal badge, success toast |
| Waiting / idle | `--color-sage` (`#7a9e8e`) | "In asteptare" lobby/idle phase badge |
| Disabled | opacity-40 on token color | Disabled phase control buttons |

### Glass Utilities (from globals.css)

- `.glass` — primary card surface (ink-light at 60% opacity + blur)
- `.glass-gold` — highlight panels (question being played, live stats focus)

---

## 5. Screens and States

### 5.1 Password Gate (`/host`, unauthenticated)

A centered full-screen gate on `--color-ink` background.

**Layout:** Single card (`glass`) centered vertically and horizontally.
- Card width: 100% on mobile, max 360px on desktop
- Playfair Display heading: "Dashboard Gazda" — `text-base font-bold`
- Subheading (caption): "Introdu parola pentru a accesa controlul jocului."
- Input (type password) with label "Parola"
- Button: "Intra" (full width, gold accent on hover)
- Error state: red-400 inline message below input — "Parola gresita. Incearca din nou."

**No navigation chrome visible when unauthenticated.**

### 5.2 Authenticated Dashboard Shell (`/host`, authenticated)

**Overall layout (mobile-first):**
- Full-height (`min-h-dvh`) `bg-ink` page
- Sticky header bar (48px tall): "Joc — Gazda" in `font-heading text-base font-bold` + connection status badge (top-right)
- `Tabs` below header, filling remaining height
- `TabsList` is sticky at top (below the header) so the host can switch tabs while scrolled

**Tabs:**
1. Control
2. Intrebari
3. Statistici

### 5.3 Control Tab

**Primary surface. This is what the host uses live.**

Sections from top to bottom:

**A. Game Status Strip (always visible, top of tab)**
- Phase badge: pill shape, 12px label, semantic color per phase (see color contract)
- Phase values in Romanian: "In asteptare" (lobby) · "Intrebare" (question) · "Blocat" (locked) · "Dezvaluit" (revealed) · "Incheiat" (ended)
- Connected guest count: `text-3xl font-bold text-gold-bright` number + `text-xs text-champagne-dim/60` label "jucatori conectati"
- A/B distribution bar (HOST-09): thin bar (height 8px, rounded), split proportionally between A and B; counts shown as `text-xs` labels on each side; updates live via `useGameSync`

**B. Phase Control Buttons**

A 2-column grid of large tap targets on mobile (full-width stacked on very small screens):

| Button Label (Romanian) | Enabled In Phase | API Action |
|------------------------|-----------------|------------|
| "Porneste Jocul" | lobby | host/transition start |
| "Blocheaza Raspunsurile" | question | host/transition lock |
| "Dezvaluie Raspunsul" | locked | host/reveal |
| "Urmatoarea Intrebare" | revealed | host/transition next |
| "Incheie Jocul" | question / revealed | host/transition end |

Button sizing: `min-h-[56px]` (larger than default — primary live-event target), full width on mobile, `w-full sm:w-auto` on desktop.

Active/valid button: `bg-gold/20 text-gold-bright border border-gold/40 hover:bg-gold/30`
Disabled button: `opacity-40 cursor-not-allowed` (same base style)
In-flight button: disabled + `Spinner` icon + "..." suffix on label

**C. Emergency Controls (collapsible, collapsed by default)**

Trigger label: "Controale de urgenta" with `ChevronDown` icon. Trigger is styled `text-xs text-champagne-dim/60` (subdued — not for casual use).

Inside the collapsible panel (`glass` card, `border border-red-500/20`):
- "Reseteaza Runda" button (variant: outline, destructive color ring) → AlertDialog confirm
- "Sari la Intrebarea #[input]" — number input (1–N) + "Sari la Intrebare" button
- "Incheie Fortat Jocul" button (variant: destructive) → AlertDialog confirm

AlertDialog copy for "Reseteaza Runda":
- Title: "Resetezi runda curenta?"
- Description: "Raspunsurile pentru aceasta intrebare vor fi sterse si faza revine la 'Intrebare'. Actiunea nu poate fi anulata."
- Cancel: "Renunta" | Confirm: "Da, reseteaza"

AlertDialog copy for "Incheie Fortat Jocul":
- Title: "Inchei jocul fortat?"
- Description: "Jocul se va incheia imediat din orice stare. Aceasta actiune nu poate fi anulata."
- Cancel: "Renunta" | Confirm: "Da, incheie"

### 5.4 Questions Tab (Intrebari)

**Used pre-event. Can be denser than Control tab.**

**Question list:**
- Each question is a `Card` (glass) in a vertical list
- Row shows: question number badge, question text (truncated if not editing), A label, B label, correct-answer toggle (A/B pill), reorder buttons (▲ ▼), delete button
- Editing state: question text becomes `Input`, A text becomes `Input`, B text becomes `Input`, correct-answer toggle remains; save/cancel icons replace reorder buttons during edit

**Inline edit affordance:**
- Tap anywhere on the question text row to enter edit mode (or an explicit "Editeaza" icon button)
- Editing row expands vertically
- "Salveaza" button (gold accent) + "Renunta" button (ghost)

**Correct-answer toggle:**
- Two pills side by side: "A" and "B"
- Selected/correct one: `bg-gold text-ink font-bold`
- Unselected: `bg-ink-muted text-champagne-dim`
- Touch target: `min-h-[44px] min-w-[44px]`

**Reorder buttons (▲ ▼):**
- `ChevronUp` / `ChevronDown` from lucide-react
- `min-h-[44px] min-w-[44px]`
- Disabled (opacity-40) when at first or last position

**Delete button:**
- `Trash2` icon from lucide-react, `text-red-400 hover:text-red-300`
- Triggers AlertDialog:
  - Title: "Stergi aceasta intrebare?"
  - Description: "Aceasta actiune nu poate fi anulata."
  - Cancel: "Renunta" | Confirm: "Da, sterge"

**Add question row (bottom of list):**
- `Button` variant ghost: `+ Adauga Intrebare`
- Clicking appends a new empty editing row at the bottom

**Empty state (no questions yet):**
- Centered in the tab: `text-champagne-dim/60 text-sm` "Nu ai intrebari inca."
- Below: "Adauga prima intrebare" button (gold accent)

### 5.5 Stats Tab (Statistici)

**Live stats view, updated via `useGameSync`.**

**A. Participant count card**
- Large `text-3xl font-bold text-gold-bright` number
- Label: "jucatori conectati"
- Connection status inline: green dot + "conectat" / amber pulsing + "reconectare..." / red dot + "deconectat"

**B. Current question A/B distribution card (HOST-09)**
- Question text at top (current question from `state`)
- A/B distribution bar (same as Control tab, but larger — 16px height)
- Counts: "A: X raspunsuri" · "B: Y raspunsuri"
- Empty state if no answers yet: "Niciun raspuns inca."

**C. Who answered what (HOST-10) — collapsible**
- `Collapsible` default closed
- Trigger: "Vezi cine a raspuns" + `ChevronDown`
- Two columns inside: "Au ales A" list | "Au ales B" list
- Each name: `text-sm text-champagne-dim` row
- Empty column: "Niciun jucator" in muted text

**D. Leaderboard card (from `state.leaderboard`)**
- Ordered list: rank number + player name + score
- Top 3 get gold/silver/bronze tint on rank badge
- If leaderboard is empty: "Niciun punctaj inca."

---

## 6. Interaction States

| State | Visual Treatment |
|-------|----------------|
| Default enabled | Token color at full opacity |
| Hover (desktop) | `hover:bg-gold/30` for gold-accent buttons; `hover:bg-ink-muted` for neutral |
| Focus-visible | 2px gold outline ring (`focus-visible:ring-2 focus-visible:ring-gold`) |
| In-flight / loading | Button disabled + `Spinner` (lucide `Loader2` with `animate-spin`) + label suffix "..." |
| Disabled / invalid phase | `opacity-40 cursor-not-allowed pointer-events-none` |
| Error (API 4xx/5xx) | `sonner` toast with red background: "[Action] a esuat. Incearca din nou." |
| Success (action complete) | `sonner` toast with gold/green: "[Action] aplicat." (2s auto-dismiss) |
| Realtime reconnecting | Amber pulsing badge in header strip — "reconectare..." |
| Realtime connected | Green dot badge — "conectat" |
| Realtime error | Red badge — "eroare conexiune" |

---

## 7. Copywriting Contract

All copy is in Romanian.

### Primary CTAs

| Action | Button Label |
|--------|-------------|
| Start game | "Porneste Jocul" |
| Lock answers | "Blocheaza Raspunsurile" |
| Reveal answer | "Dezvaluie Raspunsul" |
| Next question | "Urmatoarea Intrebare" |
| End game (normal) | "Incheie Jocul" |
| Save question edits | "Salveaza" |
| Add question | "Adauga Intrebare" |
| Enter dashboard | "Intra" |
| Jump to question | "Sari la Intrebare" |

### Empty States

| Surface | Copy |
|---------|------|
| Questions tab — no questions | "Nu ai intrebari inca." → CTA: "Adauga prima intrebare" |
| Stats — no answers yet | "Niciun raspuns inca." |
| Stats — no leaderboard | "Niciun punctaj inca." |
| Who answered A — empty | "Niciun jucator" |
| Who answered B — empty | "Niciun jucator" |

### Error States

| Trigger | Toast Copy |
|---------|-----------|
| Wrong password | "Parola gresita. Incearca din nou." (inline, not toast) |
| Any host API 4xx | "Actiunea a esuat. Verifica conexiunea si incearca din nou." |
| Any host API 5xx | "Eroare de server. Incearca din nou in cateva secunde." |
| Phase CAS conflict (409) | "Starea jocului s-a schimbat. Actiunea nu mai este valida." |
| Realtime disconnect | Badge: "reconectare..." (amber, no toast — ambient indicator) |

### Destructive Confirmations

| Action | AlertDialog Title | AlertDialog Description | Confirm Label |
|--------|------------------|------------------------|---------------|
| Delete question | "Stergi aceasta intrebare?" | "Aceasta actiune nu poate fi anulata." | "Da, sterge" |
| Reset round | "Resetezi runda curenta?" | "Raspunsurile pentru aceasta intrebare vor fi sterse si faza revine la 'Intrebare'. Actiunea nu poate fi anulata." | "Da, reseteaza" |
| Force-end game | "Inchei jocul fortat?" | "Jocul se va incheia imediat din orice stare. Aceasta actiune nu poate fi anulata." | "Da, incheie" |

Cancel label for all AlertDialogs: "Renunta"

---

## 8. Layout Grid

### Mobile (< 640px) — primary target

- Single column
- Tab navigation: horizontal scroll if tabs overflow (`overflow-x-auto` on TabsList)
- Phase buttons: full-width stacked, 56px minimum height
- Stats collapsibles: full-width
- Questions list: full-width cards

### Desktop (>= 640px)

- Max content width: 640px centered (this is a utility dashboard, not a wide canvas)
- Phase buttons: 2-column grid
- Stats: side-by-side A/B distribution columns visible by default (still collapsible for name lists)

---

## 9. Animation

Motion library: `motion/react` (import from `motion/react`).

| Element | Animation |
|---------|-----------|
| Phase button: in-flight → confirmed | `animate={{ scale: [1, 0.96, 1] }}` (subtle press confirm) — 200ms |
| Tab switch | No animation — instant (performance on low-end phones) |
| A/B distribution bar | `motion.div` width transition `transition={{ duration: 0.4, ease: "easeOut" }}` |
| Collapsible open/close | Native CSS transition via Radix `CollapsibleContent` (no extra Motion needed) |
| Error toast | sonner default (slide in from bottom) |
| AlertDialog | shadcn default (fade + scale) |
| Connection status badge | `animate-pulse` on amber dot when reconnecting (Tailwind native, no Motion) |

**Heavy animations (confetti, animated gradients) are deferred to Phase 7.** Do not add them here.

---

## 10. Accessibility

- `lang="ro"` on `<html>` (already in layout.tsx — verify during implementation)
- All interactive elements have `aria-label` in Romanian when the visual label is icon-only
- Phase buttons use `aria-disabled` (not just `disabled`) when in wrong phase, so screen readers announce the reason
- In-flight buttons: `aria-busy="true"` during pending state
- A/B distribution bar: `role="meter"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax` = total answers
- AlertDialog: uses shadcn's built-in accessible dialog structure (`DialogTitle` + `DialogDescription` required)
- Collapsible trigger: `aria-expanded` managed by Radix automatically
- Toast messages: `role="status"` / `aria-live="polite"` (sonner default)
- Correct-answer toggle (A/B pills): `aria-pressed` on each pill

---

## 11. Registry Safety Gate

**Third-party registries:** None declared.
**Safety gate status:** Not applicable — shadcn official registry only.

---

## 12. Open Questions / Deferred to Planner

The following design gaps are noted for the planner to resolve during task decomposition — they do not block UI-SPEC approval:

1. **HOST-10 per-name source:** `GET /api/game/state` currently returns A/B counts only, not player names per option. The planner must decide: extend the state endpoint with host-only fields (gated by `x-host-password`) OR add a dedicated `GET /api/host/answers?gameId=` endpoint. The UI is designed to consume a list of player name strings per option regardless of source.

2. **Jump-to-question number input bounds:** The emergency "Sari la Intrebarea #" input needs to know the total question count. The planner should ensure the questions tab data (or a `useHostQuestions` hook) is available on the Control tab to compute max value.

3. **Game ID in host context:** The dashboard needs a `gameId` to drive all API calls and the `useGameSync` subscription. The planner must specify how the host obtains this (env var, hardcoded for single-game MVP, or a game-select screen). Given the single-game MVP constraint, a hardcoded or env-var gameId is acceptable and preferred.

---

*Phase: 4-host-dashboard*
*UI-SPEC authored: 2026-06-03*
*UI-SPEC revised: 2026-06-03*
*Status: draft — awaiting gsd-ui-checker approval*
