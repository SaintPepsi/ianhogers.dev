---
title: "The Variable Nobody Read"
description: "A disabled export button traced through four files to a SvelteKit layout load that stopped re-running because of runtime dependency tracking."
date: 2026-03-30
tags: ["sveltekit", "debugging", "caching"]
---

SvelteKit server load functions track their dependencies at runtime. Not statically. When your function reads `url`, SvelteKit re-runs it on navigation. When it reads `params`, re-runs on param changes. But it doesn't scan your source code to figure this out. It watches what your function actually touches during execution.

`dashboard/+layout.server.ts` destructures `url` in its params but only accesses it inside an auth redirect:

```typescript
if (!locals.user) {
  redirect(302, `/login?redirectTo=${url.pathname}`);
}
return { matters: locals.matters };
```

Logged-out user. `url.pathname` gets read. SvelteKit registers the URL dependency. Layout re-runs on every navigation. Everything works.

Logged-in user. The `if` branch doesn't execute. `url` is never touched. SvelteKit decides this function has no URL dependency and caches the result.

This was invisible for months because `matters` rarely changes mid-session. Then someone found the edge: trigger ineligibility in a flow, click "Go to dashboard." SvelteKit sees the URL change but the layout load has no registered dependency. Cached result. Stale `canExport: false`. Disabled export button. Refresh the page, full round-trip, fresh data, button works.

Everyone wants to fix the symptom. Wire up `invalidateAll()` on the navigation handler. Add a reactive store. Rewrite the dialog component. None of that addresses why the layout stopped running.

I traced it through four files. `hooks.server.ts` fetches fresh `matters` on every request. Always has. `+layout.server.ts` is supposed to pass that data through to the page. `+layout.svelte` derives the matter context. `ExportDialog.svelte` reads `canExport` from it. Fresh data at the server. Correct pipeline. The one function connecting server to page was silently returning cached results because of a code path it never took.

Fix:

```typescript
url.pathname; // register dependency
if (!locals.user) {
  redirect(302, `/login?redirectTo=${url.pathname}`);
}
```

One property access before the conditional. Not assigned. Not returned. SvelteKit sees it and tracks URL as a dependency for all executions, not just unauthenticated ones.

A bare statement that exists purely to be observed by a framework. No human reading that code would understand why it's there without the comment. Remove it and no test fails, no type error fires, no linter complains. The layout load just quietly stops re-running for logged-in users and you won't notice until someone navigates at the wrong moment.
