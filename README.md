# Autonomous AI Creator

An autonomous agent that discovers AI/tech topics, judges which ones are worth
posting about, writes persona-consistent posts, avoids repeating itself, and
publishes on a schedule — all triggered by a single API call.

## 1. What this project does

You call `POST /api/agent/init` once with a persona (name + domain). From
that moment on, without any further human input, the agent:

1. **Discovers** current AI/tech stories from a live source (Hacker News).
2. **Checks memory** to avoid repeating recent topics.
3. **Judges** the candidates and either selects the strongest one or
   explicitly rejects the cycle if nothing meets the publishing bar.
4. **Writes** a short post in the configured persona's voice, with a
   rationale and sources.
5. **Publishes** it.
6. **Waits**, then repeats, indefinitely.

You watch it happen by polling `GET /api/agent/feed?agentId=<id>`.

## 2. Architecture

```
                         +---------------------------------------+
Evaluator / judge  --->  |              backend/                  |
POST /api/agent/init     |  server.js  - Express app, port 3001   |
GET  /api/agent/feed     |  routes/agent.js - /init, /feed, /info |
                         |  db.js      - SQLite (agents, posts)   |
                         |  loopManager.js - starts/tracks the    |
                         |    autonomous loop per agentId         |
                         +------------------+----------------------+
                                            | requires directly (no HTTP
                                            | hop, same process)
                                            v
                         +---------------------------------------+
                         |              agent/                    |
                         |  cycle.js     - one DISCOVER->PUBLISH  |
                         |                 pass                   |
                         |  discovery.js - Hacker News source     |
                         |  memory.js    - dedup via SQLite       |
                         |  judge.js     - score + reject         |
                         |  writer.js    - persona-voiced text    |
                         |  scheduler.js - the interval loop      |
                         +---------------------------------------+

Optional, NOT required by the evaluator:
  frontend/            React/Vite dashboard (create agent, view feed,
                        activity log, run-now/pause/resume)
  agent/control-server.js   Separate HTTP server (port 4000) so the
                        frontend's "Create Agent" form can plan a
                        persona from a natural-language prompt. This is
                        a convenience for demos/humans, not part of the
                        official evaluator contract.
  agent/agent.js        CLI entry point (`node agent.js "<prompt>"`) -
                        also optional; useful for local testing, not
                        required for the graded flow.
```

**The fix in one sentence:** `backend/routes/agent.js`'s `POST /init`
handler now calls `loopManager.startLoopForAgent()` directly, in the same
process, right after the agent row is inserted — instead of just writing a
database row and stopping. `loopManager.js` requires `agent/cycle.js` and
`agent/scheduler.js` straight from the backend (no extra `npm install`,
no second server — those files have zero external npm dependencies of
their own).

## 3. Natural-language agent creation (optional, demo-only)

The frontend's "Create Agent" form sends a free-text prompt (e.g. *"Create
an agent that posts concise funny AI news every 30 minutes for tech
students"*) to `agent/control-server.js`, which uses `agent/planner.js` to
turn that into a structured persona (`name`, `domain`, `tone`, `audience`,
`frequencyMinutes`, `contentStyle`) — via an LLM if `AI_API_KEY` is set, or
a deterministic keyword parser if not — and then calls the same
`POST /api/agent/init` endpoint. This is a convenience layer for a human
demo. **It is never required** — the evaluator's flow only ever touches
the backend directly with a structured `persona` object.

## 4. How `/api/agent/init` works

```
POST /api/agent/init
{ "persona": { "name": "TechPulse", "domain": "AI news" } }

-> 201 { "agentId": "..." }
```

- Validates `persona.name` and `persona.domain` (required strings).
  Optional: `tone`, `audience`, `frequencyMinutes` (positive number,
  minutes between cycles, default 10), `contentStyle`.
- Inserts a row into the `agents` table.
- **Starts the autonomous loop for that exact `agentId`, in-process,
  before the HTTP response is sent.** The first cycle runs immediately.

## 5. How autonomous scheduling works

`agent/scheduler.js` is a dependency-free interval loop: run a cycle, wait
`frequencyMinutes`, run again — forever. A failed cycle is caught and
logged; it never stops future cycles. `loopManager.js` tracks which
`agentId`s already have a loop running in the current process, so an
agent can never accidentally get double-scheduled.

**Surviving a restart:** on startup, `backend/server.js` reads every agent
already in SQLite and resumes its loop automatically — so a redeploy or
crash during the evaluation window doesn't require a new `/init` call to
keep posting.

## 6. How discovery works

`agent/discovery.js` queries the free Hacker News Algolia search API
(`query=AI`, sorted by date) for real, current stories. If that request
fails (offline, rate-limited, etc.), it falls back to a small built-in
mock list so one flaky network call never kills the loop.

## 7. How memory prevents repetition

`agent/memory.js` reads the agent's last 50 published posts straight from
the shared SQLite database and computes Jaccard similarity (keyword-set
overlap, common stopwords removed) between a candidate's title and each
past post's text. A similarity >= 0.5 counts as a duplicate and the
candidate is skipped.

*Known limitation:* similarity is computed against the full *published
post text* (which includes persona framing, not just the title), so the
extra wording can dilute the score for the no-API-key fallback writer.
This is the original, audit-approved dedup design and hasn't been
rewritten — see **Limitations** below.

## 8. How judging works

`agent/judge.js` first applies a hard **quality bar** — title must be
reasonably long and have a real `http(s)` source URL — independent of
scoring. Candidates that fail it are rejected outright. Remaining
candidates are filtered by memory (see above), then scored on freshness,
community interest (points), source quality, and a relevance bonus if the
title shares keywords with the persona's domain. The top scorer still has
to clear a minimum score; if it doesn't, the cycle is rejected rather than
force-publishing something weak. The result is always one of:

```
{ status: "SELECTED", topic: {...}, reason: null }
{ status: "REJECTED", topic: null, reason: "<why>" }
```

`cycle.js` logs the rejection reason and simply waits for the next cycle.

## 9. How writing works

`agent/writer.js` builds a prompt from the persona (name, domain, tone)
and the selected topic, and calls the configured OpenAI-compatible chat
endpoint (`AI_API_URL` / `AI_API_KEY` / `AI_MODEL`) if a key is set,
parsing out `POST:` and `RATIONALE:` sections. If no key is set, or the
API call fails, it falls back to one of five persona-aware templates
(picked deterministically per topic, so it's varied across topics but
stable for the same topic) — not one repeated sentence.

## 10. How posts are persisted

`backend/db.js` uses Node's built-in `node:sqlite` module (`agents` and
`posts` tables, WAL journal mode). `routes/agent.js` exports a
`createPost()` function that both the HTTP layer and the in-process
autonomous loop call directly — no HTTP round-trip for publishing.

## 11. How `/api/agent/feed` works

```
GET /api/agent/feed?agentId=<id>

-> 200 { "posts": [ { id, agentId, createdAt, text, rationale, sources }, ... ] }
```

Newest first, unique `id`s (UUID v4), ISO 8601 UTC `createdAt`, an empty
array when there are no posts yet, and posts persist across restarts.
Unknown `agentId` -> `404`.

## 12. How to run locally

```bash
npm run install:all      # installs backend/, agent/, frontend/ deps
npm run start:backend    # starts the ONE service the evaluator needs
```

That's it for the evaluator flow — see the curl examples below.

To also run the demo frontend + control server locally:

```bash
npm install               # installs concurrently, at the root
npm run install:all
npm run dev                # backend + control-server + frontend, together
```

Or start each piece by hand in three terminals:

```bash
cd backend && npm install && npm start        # http://localhost:3001
cd agent   && npm install && npm run control  # http://localhost:4000 (optional, for the demo UI)
cd frontend&& npm install && npm run dev      # http://localhost:5173 (optional)
```

## 13. Environment variables

| File | Variable | Required? | Purpose |
|---|---|---|---|
| `backend/.env` | `PORT` | No (default `3001`) | Backend port |
| `agent/.env` | `BACKEND_URL` | Only for `agent.js`/`control-server.js` (demo tools) | Where to reach the backend |
| `agent/.env` | `AI_API_URL`, `AI_API_KEY`, `AI_MODEL` | No | OpenAI-compatible endpoint for writing/planning. Blank key -> deterministic fallback, no paid service required |
| `agent/.env` | `AGENT_NAME`, `AGENT_DOMAIN`, `AGENT_TONE`, `AGENT_AUDIENCE`, `AGENT_CONTENT_STYLE`, `AGENT_INTERVAL_MINUTES` | No | Only used by `node agent.js` with no prompt argument (demo CLI) |
| `agent/.env` | `CONTROL_PORT` | No (default `4000`) | Port for the optional control server |
| `frontend/.env` | `VITE_API_URL` | Yes, for the frontend | Backend base URL |
| `frontend/.env` | `VITE_CONTROL_URL` | Only if using the "Create Agent" prompt form | Control-server base URL |

Copy each `.env.example` to `.env` and fill in what you need. Never commit
a real `.env` file — `.gitignore` already excludes them everywhere.

## 14. Node version requirement

**Node.js >= 22.5.0 is required**, for both `backend/` and `agent/` (the
agent's `memory.js` reads the backend's SQLite database directly).
`backend/db.js` uses the built-in `node:sqlite` module, which doesn't
exist on older Node versions. `frontend/` has no such constraint but
using the same Node version is recommended. This is now declared
accurately in every `package.json`'s `engines` field — make sure your
deploy target actually provisions Node >= 22.5.

## 15. How to test the evaluator flow

```bash
cd backend && npm install && npm start
```

In another terminal:

```bash
curl -s -X POST http://localhost:3001/api/agent/init \
  -H "Content-Type: application/json" \
  -d '{"persona":{"name":"TechPulse","domain":"AI news","frequencyMinutes":1}}'
# -> {"agentId":"..."}

curl -s "http://localhost:3001/api/agent/feed?agentId=<paste-agentId-here>"
# -> {"posts":[{...}]}  (may be empty for a few seconds on the very first cycle)
```

No other endpoint, no frontend, and no manual script is needed — see
**Test results** below for an actual run of this exact sequence.

## 16. How to deploy

Simplest option — one service:

- `render.yaml` at the repo root deploys the backend as a single Render
  web service, building the frontend into `frontend/dist` first;
  `backend/server.js` automatically serves that build (static files +
  SPA fallback) alongside the API, so one URL serves both.
- A `Dockerfile` is provided as an equivalent single-container option
  for any other Node-friendly host.

Either way, only the backend needs to be deployed for the evaluator's
required flow to work. The frontend and control server are optional
add-ons for a human demo and can be deployed separately (or not at all).

## 17. How the frontend works

A React/Vite dashboard: a "Create Agent" form (prompt -> control server ->
`/init`), agent status, post count, the live feed with rationale and
sources, an activity log, and Run Now / Pause / Resume controls (via the
control server). It talks to the backend only through
`VITE_API_URL`/`VITE_CONTROL_URL`, both configurable, and it is **never**
required for the autonomous agent to keep running — closing the browser
tab does not stop or pause anything, because the loop lives entirely in
the backend process.

## 18. AI API fallback behavior

Both `agent/writer.js` (post text + rationale) and `agent/planner.js`
(prompt -> persona config) work fully with **no AI_API_KEY set** — no paid
service is required to see the whole pipeline run end to end. If a key
*is* set and the call fails or returns something unparseable, both fall
back to their deterministic logic automatically rather than crashing the
cycle.

---

## Official evaluator flow (documented explicitly, as required)

```
POST /api/agent/init   (once)
        |
receive agentId
        |
poll GET /api/agent/feed?agentId=<id>   (periodically)
        |
posts appear automatically, no further calls needed
```

No requirement for: opening the frontend, calling `/api/control/*`,
running `node agent.js` by hand, or any other manual step.

## Test results (this run)

Run against this exact codebase, with a real backend process and real
HTTP requests:

- `POST /init` -> `201 { agentId }`, loop started immediately (log:
  `[LOOP] Starting autonomous loop for agent <id>`).
- First cycle ran with **no further calls**; `GET /feed` returned 1 post
  with the correct `agentId`, a valid ISO 8601 `createdAt`, a non-empty
  `rationale`, and `sources`.
- A second cycle ran automatically after the configured interval;
  `GET /feed` returned both posts, newest first.
- Backend was killed and restarted (simulating a crash/redeploy): the 2
  existing posts were still present, and the loop resumed **without a
  new `/init` call**, publishing 2 more posts on schedule.
- `GET /feed?agentId=<unknown>` -> `404 { error: "Agent not found" }`.
- `POST /init` with a missing `persona.domain` -> `400` with a clear
  error message.
- `agent/judge.js` unit-tested directly: empty candidate list, all-low-
  quality candidates, and a below-threshold candidate were all correctly
  `REJECTED` with a specific reason; a strong candidate was `SELECTED`.
- `agent/writer.js` fallback (no `AI_API_KEY`) produced 5 visibly
  different sentences across 5 different topics, each using the
  persona's name/domain/tone/audience — not one repeated template.
- Network-dependent discovery (Hacker News) failed in the test sandbox
  (no outbound network there) and correctly fell back to the built-in
  mock candidates every time, without crashing the loop — this also
  exercises the "discovery source unavailable" resilience path.

## Limitations

- **Memory dedup dilution (pre-existing, not introduced by this fix):**
  because the fallback writer's published text contains more words than
  just the topic title, Jaccard similarity between a new candidate's
  title and an old post's full text can fall just under the 0.5
  duplicate threshold even when they're about the same underlying topic
  — most visible when the same 1-2 mock candidates repeat in an
  offline/no-network environment. With the real Hacker News feed
  (distinct fresh stories each cycle) this is far less likely to matter.
  Fixing it would mean changing `memory.js`'s comparison logic, which the
  audit explicitly asked not to be rewritten — flagging it here instead.
- **SQLite persistence across redeploys** depends on your host's disk
  persistence. Restarts/crashes on the same instance are safe (tested
  above); a redeploy to a fresh filesystem on a host with ephemeral
  storage is not, unless you attach a persistent volume (see
  `render.yaml` / `Dockerfile` notes).
- The Hacker News discovery source restricts candidates to `query=AI`
  regardless of the configured persona domain; the judge's relevance
  bonus rewards a domain match but discovery itself isn't re-scoped per
  persona.
- `node:sqlite` is still an experimental Node API (logs a startup
  warning); it's stable enough for this project's needs but is worth
  knowing about if Node changes its interface in a future release.
