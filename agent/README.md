# /agent — Autonomous AI Content Agent

> **Update:** `POST /api/agent/init` on the backend now starts this exact
> pipeline automatically (see `backend/loopManager.js` and the root
> `README.md`). Everything below still works exactly as described and is
> kept as an optional way to run/demo the agent by hand — it is just no
> longer the only way to get posts flowing.

This is Member 2's piece of AI-Creator-v1.0. It does **not** touch
`/backend` or create a frontend — it only reads from and writes to the
existing backend that Member 1 built.

## How it works

Once started, the agent runs this loop forever, with no further human input:

```
DISCOVER → MEMORY CHECK → JUDGE → WRITE → PUBLISH → WAIT → repeat
```

1. **Discover** (`discovery.js`) — pulls current AI/tech stories from the
   free Hacker News Algolia search API. If that's unreachable, falls back
   to a small built-in mock list so the loop never dies from one bad request.
2. **Memory check** (`memory.js`) — reads this agent's previous posts
   directly from the backend's SQLite database and flags topics that
   look like repeats (keyword-overlap similarity).
3. **Judge** (`judge.js`) — scores the non-duplicate candidates on
   freshness, community interest (points), and source quality, and picks
   the strongest one. If everything is a repeat, the cycle is skipped.
4. **Write** (`writer.js`) — generates the post text, rationale, and
   source list in the configured persona's voice, using any
   OpenAI-compatible chat API (see Environment Variables). Falls back to
   a simple template if no API key is set.
5. **Publish** (`backend.js`) — saves the post via the backend's own
   `createPost()` function.
6. **Wait** (`scheduler.js`) — waits `AGENT_INTERVAL_MINUTES`, then repeats.

Every cycle is wrapped in error handling (`scheduler.js`), so one failed
step (network error, API failure, malformed response, etc.) is logged and
skipped — it doesn't stop the loop.

## How it talks to the backend

- `POST /api/agent/init` — real HTTP call, done once at startup, to get an `agentId`.
- `GET /api/agent/feed` — the endpoint exists and Member 3's frontend can use it directly; the agent itself reads posts straight from the shared SQLite database for its duplicate check.
- **Publishing** — the backend has no HTTP route for creating posts. Instead, `routes/agent.js` exports a `createPost()` function specifically for this agent to `require()` and call directly (see the comment above it in that file). So `backend.js` imports it directly rather than making an HTTP request.

This means `/agent` must sit as a sibling folder to `/backend` in the repo
(exactly as it already does). The agent can still run as its own `node`
process alongside the backend server — `db.js` already enables SQLite's
WAL journal mode, which safely supports multiple processes reading and
writing the same database file at once.

If you'd rather the agent be fully decoupled from the backend's
filesystem (e.g. running on a different machine), the one-line
alternative is adding a `POST /api/agent/post` route to `routes/agent.js`
that just calls the existing `createPost()`. That's a backend change, so
it wasn't made here without Member 1's OK — flagging it as an option.

## Install & run

```bash
cd agent
npm install
cp .env.example .env
# edit .env if you want to set a persona or an AI API key
npm start
```

Make sure the backend is running first (`cd backend && npm start`) since
the agent calls it on startup to get its `agentId`.

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `BACKEND_URL` | Base URL of the running backend | `http://localhost:3001` |
| `AGENT_NAME` | Persona name | `TechPulse` |
| `AGENT_DOMAIN` | Persona's subject area | `AI and technology news` |
| `AGENT_TONE` | Persona's writing tone | `informative and concise` |
| `AGENT_INTERVAL_MINUTES` | Minutes between cycles | `10` |
| `AI_API_URL` | OpenAI-compatible chat completions endpoint | Groq's endpoint |
| `AI_API_KEY` | API key for the above (leave blank to use fallback template) | *(none)* |
| `AI_MODEL` | Model name to request | `llama-3.1-8b-instant` |

## For Member 1 (backend)

Nothing to change. The agent only calls `/api/agent/init` over HTTP and
imports `createPost()` directly — no new routes needed unless you'd
prefer the HTTP-only alternative described above.

## For Member 3 (frontend)

Use `GET /api/agent/feed?agentId=<id>` to display posts — it already
returns everything you need (`text`, `rationale`, `sources`, `createdAt`),
newest first. The `agentId` is printed to the console when the agent
starts (`node agent.js` logs `agentId = ...`).
