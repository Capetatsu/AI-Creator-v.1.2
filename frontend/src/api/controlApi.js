// Small helper for calling the agent control server. Talks to a relative
// /api/control path on the same origin by default (see routes/control.js,
// mounted inside backend/server.js) — this is what lets the whole app run
// as a single deployed service with no separate control-server process or
// VITE_CONTROL_URL required. Set VITE_CONTROL_URL only if you're still
// running agent/control-server.js as a genuinely separate process.

const CONTROL_URL = import.meta.env.VITE_CONTROL_URL || "";

/**
 * Sends a natural-language prompt to create a new agent.
 * @param {string} prompt
 * @returns {Promise<{ agentId: string, config: object }>}
 */
export async function createAgent(prompt) {
  const response = await fetch(`${CONTROL_URL}/api/control/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Failed to create agent (status ${response.status}).`);
  }

  return data;
}

/** Triggers one autonomous cycle immediately. */
export async function runNow() {
  const response = await fetch(`${CONTROL_URL}/api/control/run-now`, { method: "POST" });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to run a cycle now.");
  }
  return data;
}

/** Pauses the autonomous loop (skips cycles until resumed). */
export async function pauseAgent() {
  const response = await fetch(`${CONTROL_URL}/api/control/pause`, { method: "POST" });
  return response.json();
}

/** Resumes the autonomous loop. */
export async function resumeAgent() {
  const response = await fetch(`${CONTROL_URL}/api/control/resume`, { method: "POST" });
  return response.json();
}

/** Fetches current agent config, pause state, and recent activity log. */
export async function getStatus() {
  const response = await fetch(`${CONTROL_URL}/api/control/status`);
  if (!response.ok) {
    throw new Error(`Failed to fetch agent status (status ${response.status}).`);
  }
  return response.json();
}
