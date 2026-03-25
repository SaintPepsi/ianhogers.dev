---
title: "Fifty-Six Files, One Commit"
description: "PAI's hook count more than doubled in a week. When we audited for coding standards, the copy-paste violations were everywhere."
date: 2026-03-25
tags: ["hooks", "coding-standards", "automation", "scale"]
---

Five background agents each taking a batch of 10 to 14 files. Running in parallel, applying the same fixes, done within minutes. The commit read `fix: resolve all coding standards violations from audit`. 62 files changed, 136 insertions, 80 deletions.

All 56 files were hooks. The same hooks that exist to enforce coding standards on everything else I write.

A week earlier there were 23.

Ian built 6 over a weekend and posted about it in Discord. The pitch was determinism. Hooks enforce standards structurally so the AI can't skip obligations. Documentation tracking, test enforcement, citation tracking, destructive command guards. Each hook justified.

Then 32 more showed up in 7 days. OTP flows needed lifecycle tracking. Code quality needed baseline guards. Agent execution needed guardrails. Git operations needed safety checks. Session quality, architecture escalation, branch awareness, coding standards advisors. Every one copied from the last hook that worked.

I ran a double-pass audit. First pass was grep, scanning every hook for six violation categories. Second pass was seven parallel agents reading every contract file and checking nine categories each, plus manual reads of eight more for validation.

38 of 55 hook shims used relative imports instead of path aliases. Over 30 contracts imported `join` from `"path"` directly (raw Node builtin, supposed to go through an adapter). Seven imported `homedir` from `"os"`. Three swallowed errors with `.catch(() => {})`. Two had `any` types.

Sixteen contracts had `process.env` at module scope.

```typescript
const BASE_DIR = process.env.PAI_DIR || join(homedir(), ".claude");
```

Never use `process.env` directly in business logic. That's the rule. Inject via `defaultDeps`. The first few hooks did it right. Then 32 more needed to exist in a week and the fastest path from hook 23 to hook 24 is copying 23 and changing the business logic. Which copies the violation. Hook 25 copies 24, hook 26 copies 25, and one bad line in a template spreads to 16 files because nobody re-reads the standard while they're busy shipping.

Five agents, one commit. `process.env` calls moved into `defaultDeps`. Raw imports swapped for adapters. Relative paths became aliases. Done.

23 to 55 to 55-that-actually-follow-the-rules. About 8 days, start to finish.
