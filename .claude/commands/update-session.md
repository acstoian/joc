---
description: Update only the session log. Appends a new entry to .claude/sessionlog.md with what was accomplished, blocked, and changed this session.
allowed-tools: Read, Edit, Write
---

## Your task

Update `.claude/sessionlog.md` only. Insert a new session block at the TOP (below the comment header).

1. Review the conversation for completions and blockers
2. Note which files were created or modified
3. Write the new block in this format:

```
## Session N — YYYY-MM-DD

### Accomplished
- Specific bullet list

### Blocked / In Progress
- What and why

### Files Changed This Session
- `path/to/file` — description
```

Increment the session number from the previous top entry. Do not modify any other files.
