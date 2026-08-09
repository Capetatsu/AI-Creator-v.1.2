// Small helper for calling the backend's agent info endpoint.
// Used to show the agent's real name/domain/tone instead of the old
// hardcoded AGENT_DISPLAY_INFO placeholder.
// Defaults to a relative path on the same origin; set VITE_API_URL only
// if the backend is served from a different origin than the frontend.

const BASE_URL = import.meta.env.VITE_API_URL || "";

/**
 * Fetches stored configuration for a given agent.
 * @param {string} agentId
 * @returns {Promise<{ agent: object }>}
 */
export async function fetchAgentInfo(agentId) {
  const url = `${BASE_URL}/api/agent/info?agentId=${encodeURIComponent(agentId)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Backend returned an error (status ${response.status}).`);
  }

  return response.json();
}
