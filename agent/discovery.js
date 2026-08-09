// discovery.js
// Finds candidate AI/technology topics from a real, free source.
//
// We use the Hacker News Algolia Search API (hn.algolia.com). It's free,
// requires no API key, and is a reasonable source of current AI/tech
// discussion for a hackathon demo.
//
// If the request fails (offline, rate limited, etc.), we fall back to a
// small built-in mock list so a single flaky network call never kills
// the autonomous loop.

const HN_SEARCH_URL =
  "https://hn.algolia.com/api/v1/search_by_date?tags=story&query=AI";

const MOCK_CANDIDATES = [
  {
    title: "Open-source model release improves reasoning benchmarks",
    url: "https://example.com/mock-source-1",
    points: 50,
    createdAt: new Date().toISOString(),
  },
  {
    title: "New study on AI agent reliability in production systems",
    url: "https://example.com/mock-source-2",
    points: 30,
    createdAt: new Date().toISOString(),
  },
];

/**
 * Fetches candidate topics for the agent to consider.
 * @returns {Promise<Array<{title:string,url:string,points:number,createdAt:string}>>}
 */
async function discoverTopics() {
  try {
    const res = await fetch(HN_SEARCH_URL);

    if (!res.ok) {
      throw new Error(`Discovery source returned ${res.status}`);
    }

    const data = await res.json();

    const candidates = (data.hits || [])
      .filter((hit) => hit.title && hit.url) // skip Ask HN / no-link posts
      .map((hit) => ({
        title: hit.title,
        url: hit.url,
        points: hit.points || 0,
        createdAt: hit.created_at || new Date().toISOString(),
      }));

    if (candidates.length === 0) {
      console.log("[DISCOVERY] No real candidates found, using mock fallback");
      return MOCK_CANDIDATES;
    }

    return candidates;
  } catch (err) {
    console.error("[DISCOVERY] Source unavailable, using mock fallback:", err.message);
    return MOCK_CANDIDATES;
  }
}

module.exports = { discoverTopics };
