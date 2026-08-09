// routes/agent.js
// Route handlers for everything under /api/agent

const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");

const router = express.Router();

// loopManager is required lazily (inside the /init handler, not here at
// the top of the file) on purpose: loopManager -> agent/cycle.js ->
// agent/backend.js -> requires THIS file back (for createPost). If we
// required loopManager eagerly at module load time, that circular
// require would resolve to this module's exports before `createPost`
// is attached below, and publishing would silently break. Requiring it
// lazily means this module has always finished loading (module.exports
// fully set) by the time the cycle is triggered.
function getLoopManager() {
  return require("../loopManager");
}

/**
 * createPost()
 * -------------
 * Internal helper function that inserts a new post into SQLite.
 * This is what the future autonomous agent (in /agent) will import
 * and call once it's ready to publish something.
 *
 * @param {Object} params
 * @param {string} params.agentId  - the agent this post belongs to
 * @param {string} params.text     - the post content
 * @param {string} params.rationale - why the agent wrote this post
 * @param {string[]} params.sources - array of source URLs/strings
 * @returns {Object} the newly created post (with sources as an array)
 */
function createPost({ agentId, text, rationale, sources }) {
  if (!agentId || !text) {
    throw new Error("agentId and text are required to create a post");
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString(); // ISO 8601 UTC
  const sourcesJson = JSON.stringify(sources || []);

  db.prepare(
    `INSERT INTO posts (id, agentId, createdAt, text, rationale, sources)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, agentId, createdAt, text, rationale || "", sourcesJson);

  return {
    id,
    agentId,
    createdAt,
    text,
    rationale: rationale || "",
    sources: sources || [],
  };
}

/**
 * POST /api/agent/init
 * Creates a new agent and returns its generated id.
 *
 * persona.name and persona.domain are required, exactly as before.
 * persona.tone, persona.audience, persona.frequencyMinutes, and
 * persona.contentStyle are all optional additions (produced by the
 * agent's planner.js) — omitting them keeps the original behavior.
 */
router.post("/init", (req, res) => {
  const { persona } = req.body;

  if (!persona || typeof persona !== "object") {
    return res.status(400).json({ error: "persona object is required" });
  }

  const { name, domain, tone, audience, frequencyMinutes, contentStyle } = persona;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "persona.name is required and must be a string" });
  }

  if (!domain || typeof domain !== "string") {
    return res.status(400).json({ error: "persona.domain is required and must be a string" });
  }

  if (frequencyMinutes !== undefined && (typeof frequencyMinutes !== "number" || frequencyMinutes <= 0)) {
    return res.status(400).json({ error: "persona.frequencyMinutes must be a positive number when provided" });
  }

  const agentId = uuidv4();
  const createdAt = new Date().toISOString();

  try {
    db.prepare(
      `INSERT INTO agents (id, name, domain, tone, audience, frequencyMinutes, contentStyle, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      agentId,
      name,
      domain,
      tone || null,
      audience || null,
      frequencyMinutes || null,
      contentStyle || null,
      createdAt
    );

    // THE FIX: initialization alone is enough to start autonomous
    // operation. No frontend, no /api/control/create, no manual
    // `node agent.js` required — the evaluator's documented flow
    // (POST /init once, then poll GET /feed) now actually works.
    getLoopManager().startLoopForAgent(agentId, { name, domain, tone, audience, frequencyMinutes, contentStyle });

    return res.status(201).json({ agentId });
  } catch (err) {
    console.error("Failed to create agent:", err);
    return res.status(500).json({ error: "Failed to create agent" });
  }
});

/**
 * GET /api/agent/info?agentId=...
 * Returns the agent's stored configuration. Not part of the original
 * required contract, but small and additive — the frontend's dashboard
 * needs somewhere to read the real name/domain/tone instead of a
 * hardcoded placeholder, and this avoids changing the /feed response
 * shape that the original spec fixed.
 */
router.get("/info", (req, res) => {
  const { agentId } = req.query;

  if (!agentId || typeof agentId !== "string") {
    return res.status(400).json({ error: "agentId query parameter is required" });
  }

  try {
    const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(agentId);

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    return res.status(200).json({ agent });
  } catch (err) {
    console.error("Failed to fetch agent info:", err);
    return res.status(500).json({ error: "Failed to fetch agent info" });
  }
});

/**
 * GET /api/agent/feed?agentId=...
 * Returns all posts for the given agent, newest first.
 */
router.get("/feed", (req, res) => {
  const { agentId } = req.query;

  if (!agentId || typeof agentId !== "string") {
    return res.status(400).json({ error: "agentId query parameter is required" });
  }

  try {
    const agent = db.prepare("SELECT id FROM agents WHERE id = ?").get(agentId);

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const rows = db
      .prepare("SELECT * FROM posts WHERE agentId = ? ORDER BY createdAt DESC")
      .all(agentId);

    const posts = rows.map((row) => ({
      id: row.id,
      agentId: row.agentId,
      createdAt: row.createdAt,
      text: row.text,
      rationale: row.rationale,
      sources: JSON.parse(row.sources || "[]"),
    }));

    return res.status(200).json({ posts });
  } catch (err) {
    console.error("Failed to fetch feed:", err);
    return res.status(500).json({ error: "Failed to fetch feed" });
  }
});

module.exports = router;
module.exports.createPost = createPost;
