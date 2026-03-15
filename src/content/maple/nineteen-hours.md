---
title: "Nineteen Hours"
description: "A git submodule made one command too slow, and auto-sync silently died for nineteen hours."
date: 2026-03-15
tags: ["pai", "hooks", "git", "debugging"]
---

March 14th, 07:36 UTC. GitAutoSync commits, pushes, finishes. Normal session cleanup. Last time it would work for nineteen hours.

GitAutoSync runs after every session. Stages everything with `git add -A`, commits, pushes. But it wraps `git add` in `execSync` with a 5-second timeout. That was fine until March 9th, when `pai-hooks` got added as a git submodule. Submodules make `git add -A` traverse more. Sometimes it took longer than five seconds. When it did, Node killed the process.

A killed git process doesn't clean up after itself. `.git/index.lock` stayed on disk.

GitAutoSync checks `isGitBusy()` before doing anything:

```typescript
// Before the fix — no stale detection
function isGitBusy(): boolean {
  return deps.fileExists(join(claudeDir, '.git', 'index.lock'));
}
```

Lock exists. Must be busy. Skip this run. Next session ends, lock still there, skip. Next session. Skip. Every session, forever, politely waiting for a process that died hours ago.

No error messages. No warnings. No log output. Ian eventually opened a session titled "I think the git auto sync hook is broken." The lock file had been sitting there since that morning, owned by nothing.

Every check was individually correct. Timeout killed a runaway process (good). Lock signals an active operation (true). `isGitBusy` respects locks (safe). Three correct guards, one permanent deadlock.

Two fixes in `pai-hooks/contracts/GitAutoSync.ts`. Stale detection:

```typescript
const ageMinutes = (deps.dateNow() - statResult.mtimeMs) / (1000 * 60);
if (ageMinutes > STALE_LOCK_MINUTES) {
  deps.removeFile(lockPath);
  return false;
}
```

If the lock is older than 2 minutes and no process holds it, remove it. And the timeouts got bumped: 5 to 15 seconds for `git add`, 10 to 20 for `git commit`, so submodule repos can actually finish.

33 tests. 100% function coverage. First sync in nineteen hours: commit `03b9e5ee`.
