---
description: End-of-session wrap-up and context snapshot. Updates all session docs and writes a full context-snapshot.md so a new session can resume with zero information loss. Run at ~70% context or when done working.
allowed-tools: Read, Edit, Write, Glob
---

## Your task

Perform a complete context preservation and session wrap-up. The goal is that a brand new Claude instance reading these files will have 100% of the context needed to continue without any loss of detail.

Work through every step below in order. Do not skip any step.

---

### Step 1 — Inventory everything from this session

Before writing anything, build a mental inventory by reviewing the full conversation:
- Every file that was created or modified (with what changed and why)
- Every decision made (architectural, design, tooling, naming)
- Every task completed
- Every task started but not finished — and exactly where it was left off
- Every blocker encountered and its current status
- Any research, analysis, or findings that aren't yet in code
- Any code patterns, snippets, or approaches being actively worked on
- Any errors, test failures, or issues currently open
- The overall direction and next intended action

---

### Step 2 — Write `.claude/context-snapshot.md` (full detail — most important file)

This is the primary handoff document. Write it as if explaining the entire session to a senior developer who is taking over. Be exhaustive.

Structure:

```markdown
# Context Snapshot
_Captured: YYYY-MM-DD — Session N — at ~X% context_

## Where We Are Right Now
[2-3 sentences: what is the current state of the project at this exact moment]

## What Was Just Being Worked On
[The active task at context limit — what file, what change, what was the next step]

## Completed This Session
[Detailed list — not just what, but how and why each thing was done]

## In-Progress Work (resume here first)
[For each unfinished task: exact file, exact line if relevant, what remains, any gotchas]

## Open Issues / Blockers
[Each blocker: what it is, what was tried, what the next approach should be]

## Key Findings & Research
[Any analysis, discoveries, or information gathered this session that isn't obvious from the code]

## Active Code Patterns
[Any specific approaches, snippets, or patterns being used that a new instance needs to know]

## File Map — What Changed
[Every file touched: path → what changed and why]

## Critical Context (do not lose this)
[Anything that would be catastrophic to forget — API quirks, user preferences expressed this session,
 important constraints discovered, things that were tried and failed]

## Immediate Next Action
[The single most important thing to do when resuming. Be specific: which file, which function,
 which command to run.]
```

---

### Step 3 — Update `.claude/sessionlog.md`

Insert a new block at the TOP (below the comment header):

```markdown
## Session N — YYYY-MM-DD
_Context reset at ~70% — full details in context-snapshot.md_

### Accomplished
[Specific list]

### Blocked / In Progress
[What and why]

### Files Changed
[path — what changed]
```

---

### Step 4 — Fully rewrite `.claude/nextsession.md`

Replace the entire file. This is the quick-start guide:

```markdown
# Next Session Handoff
_Last updated: YYYY-MM-DD | Session N_

## ⚠️ Read First
Load `context-snapshot.md` for full detail before doing anything.

## Project Snapshot
[Stack, dev command, admin credentials — 3 lines max]

## Immediate Next Action
[Copy exactly from context-snapshot — the single thing to do first]

## Priority Queue
1. [Most urgent — with file paths and commands]
2. [Next...]
...

## Key Context
[Only things NOT in CLAUDE.md or context-snapshot]
```

---

### Step 5 — Append new decisions to `.claude/decisions.md`

Only genuinely new decisions from this session. Skip if none.

---

### Step 6 — Notify the user

After all files are written, output this message exactly:

```
---
Context snapshot complete. All session details preserved in:
  • .claude/context-snapshot.md  ← full detail
  • .claude/nextsession.md       ← priorities
  • .claude/sessionlog.md        ← history

Context is at ~70%. Please start a new Claude session.
The new session will read context-snapshot.md on startup and resume with full context.
---
```
