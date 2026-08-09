// control-server.js
// A small, separate HTTP server so the React frontend can create and
// control an agent from a prompt, without the frontend ever needing to
// run Node code itself or the backend needing to know about
// discovery/memory/judge/writer.
//
// IMPORTANT: this does NOT replace agent.js's CLI mode (`node agent.js
// "<prompt>"` still works exactly as described in Priority 1) — it's a
// second, optional entry point for the frontend-driven flow. Both reuse
// the same planner.js, cycle.js, backend.js, and scheduler.js untouched.
//
// Run with:  node control-server.js
// (requires .env configured — see .env.example; needs BACKEND_URL to
// point at the running backend, same as agent.js)

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const backend = require("./backend");
const { planPersona } = require("./planner");
const { runCycle } = require("./cycle");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.CONTROL_PORT || 4000;

// Single in-memory agent, kept intentionally simple for a one-day
// hackathon demo (one agent running at a time). The agent's actual
// data (posts, config) always lives safely in the backend's SQLite
// database — this in-memory state is just for scheduling/UI status
// and is rebuilt fresh each time you create an agent.
let state = {
  agentId: null,
  config: null,
  paused: false,
  timer: null,
  activityLog: [],
};

function logActivity(stage, message) {
  state.activityLog.unshift({ stage, message, at: new Date().toISOString() });
  state.activityLog = state.activityLog.slice(0, 30); // keep the log small
  console.log(`[${stage}] ${message}`);
}

function scheduleNext() {
  if (state.timer) clearTimeout(state.timer);
  if (!state.config) return;

  const ms = state.config.frequencyMinutes * 60 * 1000;
  logActivity("SCHEDULER", `Next run in ${state.config.frequencyMinutes} minute(s)`);

  state.timer = setTimeout(async () => {
    if (state.paused) {
      logActivity("SCHEDULER", "Paused — skipping this cycle");
    } else {
      await runOneCycle();
    }
    scheduleNext();
  }, ms);
}

async function runOneCycle() {
  if (!state.agentId || !state.config) return null;
  try {
    return await runCycle(state.agentId, state.config, logActivity);
  } catch (err) {
    logActivity("ERROR", `Cycle failed: ${err.message}`);
    return null;
  }
}

/**
 * POST /api/control/create
 * body: { prompt: string }
 * Plans a config from the prompt, initializes the agent with the
 * backend, runs the first cycle immediately (same as agent.js), then
 * starts the autonomous loop at the planned frequency.
 */
app.post("/api/control/create", async (req, res) => {
  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    logActivity("PLANNER", `Interpreting prompt: "${prompt}"`);
    const config = await planPersona(prompt);
    logActivity("PLANNER", `Configuration: ${JSON.stringify(config)}`);

    const agentId = await backend.initAgent(config);
    logActivity("AGENT", `Initialized. agentId = ${agentId}`);

    if (state.timer) clearTimeout(state.timer);

    state = {
      agentId,
      config,
      paused: false,
      timer: null,
      activityLog: state.activityLog,
    };

return res.status(201).json({ agentId, config });
  } catch (err) {
    logActivity("ERROR", `Agent creation failed: ${err.message}`);
    return res.status(500).json({ error: err.message || "Failed to create agent" });
  }
});

/**
 * POST /api/control/run-now
 * Triggers one cycle immediately, outside the normal schedule.
 */
app.post("/api/control/run-now", async (req, res) => {
  if (!state.agentId) {
    return res.status(400).json({ error: "No active agent. Create one first." });
  }
  const post = await runOneCycle();
  return res.status(200).json({ post });
});

/** POST /api/control/pause — skip cycles until resumed. */
app.post("/api/control/pause", (req, res) => {
  state.paused = true;
  logActivity("CONTROL", "Paused by user");
  return res.status(200).json({ paused: true });
});

/** POST /api/control/resume — resume normal scheduled cycles. */
app.post("/api/control/resume", (req, res) => {
  state.paused = false;
  logActivity("CONTROL", "Resumed by user");
  return res.status(200).json({ paused: false });
});

/**
 * GET /api/control/status
 * Everything the dashboard needs to show current agent + activity.
 */
app.get("/api/control/status", (req, res) => {
  return res.status(200).json({
    agentId: state.agentId,
    config: state.config,
    paused: state.paused,
    activityLog: state.activityLog,
  });
});

app.listen(PORT, () => {
  console.log(`Agent control server running at http://localhost:${PORT}`);
});
