---
"keaveai": patch
---

Resume delivery after acceptance using a dedicated reviewer per worktree. Serialize final review through merge for tasks sharing a local target, and verify a recorded merge is still present before reporting `merged-local` again. Add an explicit cleanup command for clean, locally merged task worktrees that preserves the branch and delivery record.
