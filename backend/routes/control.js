// routes/control.js
// The same endpoints agent/control-server.js used to expose on its own
// port (4000): POST /create, /run-now, /pause, /resume, GET /status.
// Mounted here at /api/control so the whole app — API, dashboard, and
// the create/run-now/pause/resume controls — runs as ONE Express app on
// ONE port. This is what lets a single Railway/Render service work: the
// frontend can call same-origin relative paths instead of needing a
// separate VITE_CONTROL_URL pointed at a second process that Railway
// was never starting in the first place.
//
// Design note: this intentionally does NOT go through loopManager.js.
// insertAgent() (backend/routes/agent.js) only writes the DB row; it
// does not auto-start a loopManager loop. This router runs its own
// setTimeout-based scheduler (ported straight from control-server.js),
// so each agent created here has exactly one loop — no duplicate
// scheduling between two different loop owners.

const express = require("express");
const { planPersona } = require("../../agent/planner");
const { runCycle } = require("../../agent/cycle");
const { insertAgent } = require("./agent");

const router = express.Router();

// Single in-memory agent, kept intentionally simple for a one-day
// hackathon demo (one agent running at a time). The agent's actual
// data (posts, config) always lives safely in the backend's SQLite
// database — this in-memory state is just for scheduling/UI status.
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
 */
router.post("/create", async (req, res) => {
  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    logActivity("PLANNER", `Interpreting prompt: "${prompt}"`);
    const config = await planPersona(prompt);
    logActivity("PLANNER", `Configuration: ${JSON.stringify(config)}`);

    const agentId = insertAgent(config);
    logActivity("AGENT", `Initialized. agentId = ${agentId}`);

    if (state.timer) clearTimeout(state.timer);
    state = { agentId, config, paused: false, timer: null, activityLog: state.activityLog };

    // Run the first cycle immediately, then keep looping.
    runOneCycle().then(scheduleNext);

    return res.status(201).json({ agentId, config });
  } catch (err) {
    logActivity("ERROR", `Agent creation failed: ${err.message}`);
    return res.status(500).json({ error: err.message || "Failed to create agent" });
  }
});

/** POST /api/control/run-now — triggers one cycle immediately. */
router.post("/run-now", async (req, res) => {
  if (!state.agentId) {
    return res.status(400).json({ error: "No active agent. Create one first." });
  }
  const post = await runOneCycle();
  return res.status(200).json({ post });
});

/** POST /api/control/pause — skip cycles until resumed. */
router.post("/pause", (req, res) => {
  state.paused = true;
  logActivity("CONTROL", "Paused by user");
  return res.status(200).json({ paused: true });
});

/** POST /api/control/resume — resume normal scheduled cycles. */
router.post("/resume", (req, res) => {
  state.paused = false;
  logActivity("CONTROL", "Resumed by user");
  return res.status(200).json({ paused: false });
});

/** GET /api/control/status — everything the dashboard needs. */
router.get("/status", (req, res) => {
  return res.status(200).json({
    agentId: state.agentId,
    config: state.config,
    paused: state.paused,
    activityLog: state.activityLog,
  });
});

module.exports = router;
