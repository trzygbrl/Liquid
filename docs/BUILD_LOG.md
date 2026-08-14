# Build Log — Civic Access (Team Liquid)

This file tracks what's actually been built, in plain language, so any teammate can scroll through and understand progress without needing to read code or git commit history. Newest entries go on top.

**This is different from the PRD's Change Log:** the PRD Change Log tracks *decisions* (what we decided to change and why). This file tracks *what was actually built* as a result.

---

## How entries get added

Every build prompt given to a coding agent should end with an instruction like:

> "After completing this, append an entry to `/docs/BUILD_LOG.md` following the format below — what was built, which files were touched, and any decisions or trade-offs made."

The agent adds the entry itself, at the top of the "Entries" section below, following this format:

```
### [Date] — [Short title of what was built]
**Task:** [roadmap task number, e.g. 3.2]
**Owner:** [role or name]
**What changed:** [1-3 sentences, plain language, no jargon — written for someone who didn't watch it get built]
**Files touched:** [list of files/folders]
**Notes/trade-offs:** [anything worth flagging — a shortcut taken, something left for later, a decision made on the fly]
```

If you're building manually (not through an agent), add the same entry yourself when you finish a task.

---

## Entries

### [Fill in Day 1] — Repo, PRD, and roadmap committed
**Task:** 1.0
**Owner:** A
**What changed:** Created the GitHub repo, added the PRD, roadmap, and this build log to `/docs`.
**Files touched:** `/docs/liquid-prd.md`, `/docs/liquid-roadmap.md`, `/docs/BUILD_LOG.md`
**Notes/trade-offs:** None.

<!-- New entries go above this line, newest on top -->
