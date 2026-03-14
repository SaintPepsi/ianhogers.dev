# Guestbook Notes API

REST endpoint for the interactive guestbook.

## Routes

- `GET /api/guestbook/notes?page=N` — fetch notes for a page (or all if no `page` param)
- `POST /api/guestbook/notes` — create a note with overlap detection and profanity filtering
- `DELETE /api/guestbook/notes` — clear in-memory store (dev only)

## Environment dependencies

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | No | Neon Postgres connection string. Falls back to in-memory store when absent. |
| `KV_REST_API_URL` | No | Vercel KV endpoint for IP-based rate limiting. Cooldown skipped when absent. |
| `KV_REST_API_TOKEN` | No | Vercel KV auth token. Cooldown skipped when absent. |

All three are optional — the API falls back gracefully for staging/preview/local dev.

## Tests

```bash
npm run test
```

Tests live at `src/lib/components/guestbook/lib/db.test.ts` and cover the in-memory fallback path.
