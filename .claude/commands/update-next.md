---
description: Update only the next session handoff doc. Rewrites .claude/nextsession.md with current priorities and context.
allowed-tools: Read, Edit, Write
---

## Your task

Completely rewrite `.claude/nextsession.md` to reflect the current state of the project.
Do not modify any other files.

The file must contain:

### Project Snapshot
Current stack and status in 2-3 lines. Include how to start the dev server and admin credentials.

### Immediate Priorities
Numbered list, most urgent first. Each priority must include:
- Specific file paths to edit
- Exact commands to run if applicable
- Enough detail that work can resume without reading the conversation

### Key Context
Facts a new Claude instance needs that aren't already in CLAUDE.md — design decisions, known issues, blocked items, external context (e.g. what the save-the-date looks like).

Update the `_Last updated_` date and session number at the top.
