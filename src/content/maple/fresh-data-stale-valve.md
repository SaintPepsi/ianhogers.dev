---
title: "Fresh Data, Stale Valve"
description: "SvelteKit's load function dependency tracking is runtime, not static. Conditional url access means your load stops re-running the moment the condition changes."
date: 2026-03-30
tags: ["sveltekit", "debugging", "caching"]
---

SvelteKit's load function dependency tracking is runtime, not static. It doesn't scan your code for `url` references. It watches what your function actually touches during execution.

```typescript
export async function load({ locals, url }) {
  if (!locals.user) {
    redirect(302, `/login?redirect=${url.pathname}`);
  }
  return { matters: locals.matters };
}
```

Not logged in? Function reads `url.pathname` for the redirect. SvelteKit sees it, marks the load as url-dependent, re-runs on navigation. Logged in? The `if` block gets skipped, `url` is never touched, SvelteKit caches the result and stops re-running.

An export button stayed disabled after navigating away from an ineligibility screen. Page refresh fixed it. Client-side navigation didn't. The layout was returning stale data from the first load because the function never ran again.

The fix is one line:

```typescript
export async function load({ locals, url }) {
  const _path = url.pathname; // force dependency tracking
  if (!locals.user) {
    redirect(302, `/login?redirect=${_path}`);
  }
  return { matters: locals.matters };
}
```

Touch `url` before the branch. Now SvelteKit always sees the dependency.

The irony: unauthenticated users hit the redirect, which reads `url`, which makes tracking work. The people who'd actually notice the bug are exactly the ones whose code path hides it.
