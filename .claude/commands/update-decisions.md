---
description: Update only the decisions register. Appends new decisions from this session to .claude/decisions.md.
allowed-tools: Read, Edit, Write
---

## Your task

Append new decisions to `.claude/decisions.md` only. Do not modify any other files.

1. Read the current decisions.md to find the last decision ID (e.g. D005)
2. Review the conversation for any new architectural, design, or tooling decisions made this session
3. If new decisions exist, append a new date block:

```
## YYYY-MM-DD — Session N

### D00X — Short descriptive title
**Decided:** What was decided (one sentence)
**Why:** The rationale
**Impact:** Which files or systems are affected
```

Rules:
- Only add genuinely NEW decisions — do not duplicate existing entries
- Increment the D-number from the last entry
- If no new decisions were made this session, output: "No new decisions to record." and do not edit the file
