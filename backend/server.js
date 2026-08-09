// server.js
// Entry point for the backend. Sets up Express, middleware, and routes.
//
// This is now the ONE service the evaluator needs: it exposes the
// required /api/agent/init and /api/agent/feed endpoints AND runs the
// autonomous agent loop in-process (see loopManager.js / routes/agent.js).
// If a production frontend build exists (frontend/dist, from
// `npm run build`), it's served from this same process too, so a single
// deployed URL can serve both the API and the dashboard.

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");

const db = require("./db");
const agentRoutes = require("./routes/agent");
const controlRoutes = require("./routes/control");
const { startLoopForAgent } = require("./loopManager");

const app = express();
const PORT = process.env.PORT || 3001;

// Allow the React frontend (running on a different port in dev) to call this API.
app.use(cors());

// Parse incoming JSON request bodies.
app.use(express.json());

// Health check endpoint.
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// All agent-related routes live under /api/agent
app.use("/api/agent", agentRoutes);

// Merged control-server routes (create/run-now/pause/resume/status),
// now served from this same process/port — see routes/control.js.
app.use("/api/control", controlRoutes);

// Optional: serve the built frontend (frontend/dist) from this same
// process/port, so one deployment serves both the API and the dashboard.
// This is purely additive — if the frontend hasn't been built, the
// backend still works exactly as before for the evaluator's API-only flow.
const frontendDistPath = path.join(__dirname, "..", "frontend", "dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

if (hasFrontendBuild) {
  app.use(express.static(frontendDistPath));

  // SPA fallback: any non-API GET request that doesn't match a static
  // file falls back to index.html so client-side routing still works.
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(frontendIndexPath);
  });
}

// Basic 404 handler for anything else (unmatched /api/* routes, or any
// route at all when no frontend build is present).
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

/**
 * On startup, resume the autonomous loop for every agent already
 * persisted in SQLite. This means a backend restart/redeploy during the
 * 48-hour evaluation window doesn't silently stop posting — the same
 * agentId keeps generating posts without any new call to /init.
 * loopManager's in-process activeLoops guard means this can never
 * register two schedulers for the same agent.
 */
function resumeExistingAgents() {
  try {
    const agents = db.prepare("SELECT * FROM agents").all();
    for (const agent of agents) {
      startLoopForAgent(agent.id, {
        name: agent.name,
        domain: agent.domain,
        tone: agent.tone || undefined,
        audience: agent.audience || undefined,
        frequencyMinutes: agent.frequencyMinutes || undefined,
        contentStyle: agent.contentStyle || undefined,
      });
    }
    if (agents.length > 0) {
      console.log(`[SERVER] Resumed autonomous loop for ${agents.length} existing agent(s)`);
    }
  } catch (err) {
    console.error("[SERVER] Failed to resume existing agents on startup:", err.message);
  }
}

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
  if (hasFrontendBuild) {
    console.log(`Serving frontend build from ${frontendDistPath}`);
  }
  resumeExistingAgents();
});
