// Small helper for calling the backend's agent info endpoint.
// Used to show the agent's real name/domain/tone instead of the old
// hardcoded AGENT_DISPLAY_INFO placeholder.

const BASE_URL = import.meta.env.VITE_API_URL;

/**
 * Fetches stored configuration for a given agent.
 * @param {string} agentId
 * @returns {Promise<{ agent: object }>}
 */
export async function fetchAgentInfo(agentId) {
  if (!BASE_URL) {
    throw new Error(
      "VITE_API_URL is not set. Create a .env file (see .env.example)."
    );
  }

  const url = `${BASE_URL}/api/agent/info?agentId=${encodeURIComponent(agentId)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Backend returned an error (status ${response.status}).`);
  }

  return response.json();
}
