// Small helper for calling the agent control server (control-server.js
// in /agent), which is a separate process from the main backend.
// Mirrors the style of fetchFeed.js.

const CONTROL_URL = import.meta.env.VITE_CONTROL_URL;

function requireControlUrl() {
  if (!CONTROL_URL) {
    throw new Error(
      "VITE_CONTROL_URL is not set. Create a .env file (see .env.example)."
    );
  }
}

/**
 * Sends a natural-language prompt to create a new agent.
 * @param {string} prompt
 * @returns {Promise<{ agentId: string, config: object }>}
 */
export async function createAgent(prompt) {
  requireControlUrl();

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
  requireControlUrl();
  const response = await fetch(`${CONTROL_URL}/api/control/run-now`, { method: "POST" });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to run a cycle now.");
  }
  return data;
}

/** Pauses the autonomous loop (skips cycles until resumed). */
export async function pauseAgent() {
  requireControlUrl();
  const response = await fetch(`${CONTROL_URL}/api/control/pause`, { method: "POST" });
  return response.json();
}

/** Resumes the autonomous loop. */
export async function resumeAgent() {
  requireControlUrl();
  const response = await fetch(`${CONTROL_URL}/api/control/resume`, { method: "POST" });
  return response.json();
}

/** Fetches current agent config, pause state, and recent activity log. */
export async function getStatus() {
  requireControlUrl();
  const response = await fetch(`${CONTROL_URL}/api/control/status`);
  if (!response.ok) {
    throw new Error(`Failed to fetch agent status (status ${response.status}).`);
  }
  return response.json();
}
