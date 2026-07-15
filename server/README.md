# Vortex07 Community API

Backend for the Vortex07 Chrome extension — reputation, status lines, guestbook, activity feed, and more.

**Production:** https://vortex07-extension.vercel.app/api

## Quick start (automated)

From the repo root (requires `vercel login` once):

```bash
npm run api:setup    # fix root directory, link project, install deps
npm run api:deploy   # deploy production + verify all endpoints
npm run api:verify   # smoke-test live API only
```

## Project layout

```
api/
  api/index.js   → single Vercel function that routes /api/* requests
  handlers/      → route handler modules
  lib/           → shared store, CORS, rate limits
  vercel.json    → rewrites /api/* to api/index.js + CORS headers
  package.json
```

Deploy root on Vercel: **`api/`** (set automatically by `npm run api:setup`).

## Storage

Connect **Upstash Redis** in the Vercel project (Storage → Upstash). Without Redis, the API falls back to in-memory (resets on cold start).

Env vars auto-detected: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.

**Required for vote security (production):**

| Variable | Purpose |
|----------|---------|
| `VORTEX07_VOTE_SECRET` | HMAC key for signed rep votes — must match the extension service worker |
| `VORTEX07_ADMIN_SECRET` | Header auth for `/api/rep-audit` (admin tooling) |

Default extension values (set these on Vercel or change both sides together):

- `VORTEX07_VOTE_SECRET` = `vortex07-vote-hmac-v2-5-0-playvortex`
- `VORTEX07_ADMIN_SECRET` = `vortex07-admin-audit-v2-5-0`

## Endpoints

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/health` | GET | Service health + endpoint list |
| `/api/reputation` | GET, POST, DELETE | Global rep votes (POST/DELETE require signed `actorUserId`) |
| `/api/rep-audit` | GET | Dev rep vote audit log + spike alerts (`X-Vortex07-Admin` header) |
| `/api/players/batch` | GET | Rep + status batch (≤50 ids) |
| `/api/leaderboard` | GET | Top rep users |
| `/api/status` | GET, POST | Extension status lines |
| `/api/profile-views` | GET, POST | Profile visitor counts |
| `/api/guestbook` | GET, POST | Profile guestbook |
| `/api/activity` | GET | Recent rep activity feed |
| `/api/economy` | GET, POST | Vertex Points wallet + daily claim (POST requires signed `actorUserId`) |

Vote POST/DELETE use CORS origin `https://playvortex.io`. Other routes return `Access-Control-Allow-Origin: *`.

## Manual deploy

```bash
cd ..   # repo root
npx vercel deploy --prod --yes
```

## Extension

Default API base in the extension: `https://vortex07-extension.vercel.app/api`

Calls are proxied through the extension service worker to avoid page CORS.
