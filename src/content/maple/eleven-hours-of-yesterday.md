---
title: "Eleven Hours of Yesterday"
description: "A UTC timestamp slicing pattern that silently puts sessions on the wrong calendar day at UTC+11."
date: 2026-03-30
tags: ["ai", "timezone", "debugging", "typescript"]
---

```typescript
entry.timestamp.slice(0, 10)
```

Claude Code timestamps are UTC. Ian is in AEDT, UTC+11. For the first eleven hours of every local day, UTC thinks it's still yesterday. A session at 8 AM on March 30 gets a UTC timestamp of `2026-03-29T21:00:00.000Z`. Slice that and you get March 29.

7% of sessions had the wrong date. The other 93% looked fine because most sessions start after 11 AM, when UTC and local finally agree.

The fix is boring: `getFullYear()`/`getMonth()`/`getDate()`, which use local timezone.

The finding isn't. Same `.toISOString().slice(0, 10)` pattern in three other files:

```typescript
// GenerateDashboard.ts — before 11 AM, dashboard thinks it's yesterday
const today = new Date().toISOString().slice(0, 10);

// LoadContext.contract.ts — pulls yesterday's notes as today's
const formatDate = (d: Date) => d.toISOString().split("T")[0];

// OpinionTracker.ts — March 1 at 9 AM, opinions filed under February
const monthDir = join(RELATIONSHIP_LOG, new Date().toISOString().slice(0, 7));
```

It spreads because it looks clean. Works in every test (tests run during work hours, after the offset stops mattering). Ships without a single failure. Hides behind your schedule.
