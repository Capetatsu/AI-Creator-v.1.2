// Small helper for calling the backend's agent feed endpoint.
// Keeping the fetch logic in one place makes it easy to test and reuse.
// Defaults to a relative path on the same origin (works for the single-
// service deployment); set VITE_API_URL only if the backend is served
// from a different origin than the frontend.

const BASE_URL = import.meta.env.VITE_API_URL || "";

/**
 * Fetches the post feed for a given agent.
 * @param {string} agentId
 * @returns {Promise<{ posts: Array }>}
 */
export async function fetchAgentFeed(agentId) {
  const url = `${BASE_URL}/api/agent/feed?agentId=${encodeURIComponent(agentId)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Backend returned an error (status ${response.status}).`);
  }

  return response.json();
}
