---
title: "Nineteen Hours of Silence"
description: "How a git submodule killed auto-sync for nineteen hours without a single error message."
date: 2026-03-15
tags: ["debugging", "git", "hooks", "silent-failures"]
---

Auto-sync had been dead for nineteen hours. No error. No warning. No log entry saying something went wrong. Just... nothing. Sessions started, sessions ended, changes piled up, and the `SessionEnd` hook that commits and pushes `~/.claude` kept returning silently.

The lock file was sitting right there in `.git/index.lock`. Created at 09:36 that morning. No process owned it. But `isGitBusy()` didn't care about ownership. It saw the lock, returned `true`, and GitAutoSync bailed with a polite stderr message nobody reads.

```typescript
function isGitBusy(deps: GitAutoSyncDeps): boolean {
  const lockPath = join(deps.claudeDir, ".git", "index.lock");
  if (!deps.fileExists(lockPath)) return false;
  return true;  // that's it. that's the whole check.
}
```

So where did the orphan lock come from?

Around March 9, `pai-hooks` was added as a git submodule. Submodules make `git add -A` slower. Not dramatically, but enough. The timeout for `git add` was 5 seconds. On a repo with a submodule, that's tight. Node's `execSync` doesn't ask nicely when a timeout hits. It kills the process. Mid-write. Index file open. Lock file created but never cleaned up.

The cleanup code existed. It ran after a failed `git add` or `git commit`. But the timeout didn't trigger a failed result from inside the contract. `execSync` threw, the lock stayed, and the next session hit `isGitBusy()` at the gate. Before the add. Before the commit. Before the cleanup could run.

Five second timeout. Orphaned lock. Permanent gate. Chain reaction.

The last successful sync was March 14 at 07:36 UTC. Everything after that was a session ending in silence, writing its "Skipped -- index.lock exists" to stderr, and moving on.

The fix is boring in the best way. `isGitBusy()` now calls `stat()` on the lock file, checks its age, and if it's older than two minutes with no owning process, removes it and proceeds. Two minutes is conservative. No legitimate git operation in this repo takes anywhere close to that long.

```typescript
const ageMinutes = (deps.dateNow() - statResult.value.mtimeMs) / (1000 * 60);
if (ageMinutes > STALE_LOCK_MINUTES) {
  deps.removeFile(lockPath);
  return false;
}
```

The timeouts went up too. `git add` from 5 seconds to 15. `git commit` from 10 to 20. Not because the submodule actually needs that long, but because killing a git process mid-operation is how you get orphaned locks in the first place.

33 tests. 56 assertions. 100% function coverage. The stale lock got removed, auto-sync committed at `03b9e5ee`, and the system resumed like nothing happened. Because from the outside, nothing had.

That's the thing about silent failures. They don't announce themselves. They don't page anyone. They just stop doing the thing you assumed was happening. And if you're not checking, you won't notice until something downstream breaks and you wonder why your last sync was nineteen hours ago.
