---
title: "Fresh Data, Stale Valve"
description: "SvelteKit's load function dependency tracking is runtime, not static. Conditional url access means your load stops re-running the moment the condition changes."
date: 2026-03-30
tags: ["sveltekit", "debugging", "caching"]
---

SvelteKit server load functions have a dependency tracking system. If your load function reads `url`, `params`, or calls `parent()` or `depends()` at runtime, SvelteKit re-runs it when those values change. If it doesn't read any of those, SvelteKit caches the result and skips it on subsequent navigations.

Runtime. Not static analysis. SvelteKit doesn't scan your code for references to `url`. It instruments the accessors and watches what your function actually touches during execution.

```typescript
// +layout.server.ts
export async function load({ locals, url }) {
  if (!locals.user) {
    redirect(302, `/login?redirect=${url.pathname}`);
  }
  return { matters: locals.matters };
}
```

When the user isn't logged in, the function reads `url.pathname` for the redirect. SvelteKit sees the access, marks the load as url-dependent, re-runs it on navigation. When the user IS logged in, the `if` block gets skipped. `url` is never touched. SvelteKit sees zero dependencies, caches the result, stops re-running.

I traced this down in a dashboard where an export button stayed disabled after navigating away from an ineligibility screen. Page refresh fixed it (full server round-trip, fresh load). Client-side navigation didn't. The layout kept returning stale `matters` data with `canExport: false` from the first page load because the load function simply never ran again.

Move `url.pathname` access before the conditional branch.

```typescript
export async function load({ locals, url }) {
  const _path = url.pathname; // force dependency tracking
  if (!locals.user) {
    redirect(302, `/login?redirect=${_path}`);
  }
  return { matters: locals.matters };
}
```

Now SvelteKit always sees `url` as a dependency, regardless of which branch executes.

What made this hard to find. `hooks.server.ts` calls `getUser()` on every request, populating `locals.matters` with fresh data. Server-side, always correct. Staleness lives one layer up, in the layout load function that hands data to the page but doesn't re-run to pick up the fresh version. Fresh data in the pipe, stale valve.

And the dependency tracking gap only shows up when logged in, because that's the only code path where `url` goes unread. Unauthenticated users hit the redirect, which touches `url`, which makes dependency tracking work. The people who'd notice the bug are exactly the people whose code path hides it.

SvelteKit documents this under "Rerunning load functions." Still took a full trace from `hooks.server.ts` through the layout load, into `setMatterContext()`, down to the `$derived(matterContext.canExport)` in `ExportDialog.svelte` to pin down.
