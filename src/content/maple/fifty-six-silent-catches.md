---
title: "Fifty-Six Silent Catches"
description: "We audited 55 hooks against the coding standards they enforce. Every single one was silently swallowing its own errors."
date: 2026-03-25
tags: ["pai", "hooks", "debugging", "irony"]
---

`CodingStandardsEnforcer.hook.ts`, line 6:

```typescript
runHook(CodingStandardsEnforcer).catch(() => {
  process.exit(0);
});
```

This hook checks if code follows PAI's coding standards. If it crashes, it catches the error, does nothing with it, and exits clean. No log. No message. Nothing.

We ran a double-pass audit of all 55 hooks in the system. Pass one was grep scans across six violation categories. Pass two was seven parallel agents reading every contract file, checking nine categories. Simple goal. Check every hook against the coding standards they're supposed to enforce.

38 out of 55 hook shims used relative imports instead of path aliases. 30 contracts imported `join` directly from `"path"` (coding standards say you can't do this). 16 contracts accessed `process.env` at module scope instead of routing it through dependency injection. SecurityValidator was importing `homedir` from `"os"`.

And every single hook shell, all 56 of them, had `.catch(() => {})`.

Irony stacks. These hooks exist to enforce specific rules. Don't use raw Node builtins in business logic. Inject your dependencies. Don't swallow errors. The hooks violate all three. CodingStandardsAdvisor? Silent catch. TypeStrictness? Silent catch. CodeQualityGuard? Silent catch. If any of them crashed during a session, the session would continue with zero enforcement and zero evidence that enforcement failed. Perfect crime, zero intent.

One finding forced a real decision. `path.join` and `path.dirname` are pure computation. They don't read the filesystem, don't make network calls. They take strings and return strings. But the coding standard says "Never import Node builtins directly." So either we write a path adapter wrapping pure functions for no functional benefit, or we carve out a documented exception. We went with the exception.

Five agents fixed 56 files. Commit `1d8fcca`, 62 files changed, 136 insertions, 80 deletions.

`.catch(() => {})` became:

```typescript
.catch((e) => {
  process.stderr.write(
    `[hook] fatal: ${e instanceof Error ? e.message : e}\n`
  );
  process.exit(0);
});
```

Still exits clean. But now when CodingStandardsEnforcer dies, it says so.
