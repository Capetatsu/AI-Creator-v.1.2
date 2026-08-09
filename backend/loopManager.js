// loopManager.js
// THIS IS THE FIX for the blocking issue in the audit report:
// "POST /api/agent/init creates a row but never starts anything."
//
// This module starts the autonomous DISCOVER -> MEMORY -> JUDGE -> WRITE
// -> PUBLISH -> WAIT loop *inside the backend process itself*, for a
// given agentId, the moment that agent is created. No second server, no
// manual `node agent.js`, no frontend required.
//
// Why this is safe to require directly from the backend:
// agent/cycle.js (and everything it uses — discovery.js, judge.js,
// memory.js, writer.js, agent/backend.js) has ZERO npm dependencies of
// its own; it only uses the built-in `fetch` and requires
// backend/db.js directly for memory lookups and backend/routes/agent.js
// directly for publishing. So no extra `npm install` is needed in
// /agent for this to work — the loop runs as ordinary backend code.
// (agent.js and control-server.js, which DO need express/dotenv/cors,
// are untouched and remain available as optional standalone demo tools.)

const path = require("path");

const { runCycle } = require(path.join(__dirname, "..", "agent", "cycle"));
const { start: startScheduler } = require(path.join(__dirname, "..", "agent", "scheduler"));

// Tracks which agentIds already have a running loop in THIS process, so
// we never accidentally register two schedulers for the same agent
// (e.g. if init were somehow called twice, or resumeAll() ran after
// loops were already started for this process).
const activeLoops = new Set();

function makeLogger(agentId) {
  return (stage, message) => {
    console.log(`[agent:${agentId}] [${stage}] ${message}`);
  };
}

/**
 * Starts the autonomous loop for one agent, unless a loop for that
 * agentId is already running in this process. This is what makes
 * `POST /api/agent/init` sufficient, by itself, to start autonomous
 * operation.
 *
 * @param {string} agentId
 * @param {{name:string, domain:string, tone?:string, audience?:string, frequencyMinutes?:number, contentStyle?:string}} persona
 */
function startLoopForAgent(agentId, persona) {
  if (!agentId || !persona) return;

  if (activeLoops.has(agentId)) {
    console.log(`[LOOP] Loop already running for agent ${agentId} — not starting a duplicate`);
    return;
  }
  activeLoops.add(agentId);

  const frequencyMinutes =
    persona.frequencyMinutes && persona.frequencyMinutes > 0 ? persona.frequencyMinutes : 10;

  console.log(`[LOOP] Starting autonomous loop for agent ${agentId} (every ${frequencyMinutes} minute(s))`);

  // scheduler.start() runs the first cycle immediately (fire-and-forget)
  // and keeps looping with setTimeout after that — it survives the HTTP
  // request/response cycle that triggered it, and a single failed cycle
  // never stops future cycles (see agent/scheduler.js).
  startScheduler(() => runCycle(agentId, persona, makeLogger(agentId)), frequencyMinutes);
}

function isLoopActive(agentId) {
  return activeLoops.has(agentId);
}

module.exports = { startLoopForAgent, isLoopActive };
