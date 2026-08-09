// backend.js
// Everything the agent needs to talk to Member 1's existing backend.
//
// IMPORTANT DESIGN NOTE:
// The backend exposes HTTP routes for /init and /feed, but it does NOT
// expose an HTTP route for creating posts. Instead, routes/agent.js
// exports a `createPost()` function specifically so this agent can
// import and call it directly (see the comment above createPost in
// that file). So:
//   - initAgent()  -> real HTTP call to POST /api/agent/init
//   - getFeed()    -> real HTTP call to GET  /api/agent/feed
//   - publishPost()-> direct require() of backend/routes/agent.js
//
// This means the agent must live as a sibling folder to /backend
// (same repo layout given to us), but it can still run as its own
// process — the backend's db.js already turns on SQLite WAL mode,
// which safely supports multiple processes reading/writing the same
// database file at once.

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

// Direct import — no HTTP hop for publishing, per backend's own design.
const { createPost } = require("../backend/routes/agent");

/**
 * Registers a new agent with the backend and returns its agentId.
 * @param {{name: string, domain: string}} persona
 */
async function initAgent(persona) {
  const res = await fetch(`${BACKEND_URL}/api/agent/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Backend init failed: ${data.error || res.status}`);
  }

  return data.agentId;
}

/**
 * Fetches this agent's previously published posts (newest first).
 * @param {string} agentId
 * @returns {Promise<Array>} posts
 */
async function getFeed(agentId) {
  const res = await fetch(
    `${BACKEND_URL}/api/agent/feed?agentId=${encodeURIComponent(agentId)}`
  );
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Backend feed fetch failed: ${data.error || res.status}`);
  }

  return data.posts;
}

/**
 * Publishes a new post by calling the backend's own createPost() directly.
 * @param {{agentId: string, text: string, rationale: string, sources: string[]}} post
 */
function publishPost({ agentId, text, rationale, sources }) {
  return createPost({ agentId, text, rationale, sources });
}

module.exports = { initAgent, getFeed, publishPost };
