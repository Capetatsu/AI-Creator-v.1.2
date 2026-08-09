// discovery.js
// Finds candidate topics from a real, free source, scoped to the
// requesting agent's configured domain.
//
// We use the Hacker News Algolia Search API (hn.algolia.com). It's free,
// requires no API key, and is a reasonable source of current discussion
// for a hackathon demo.
//
// Previously this always searched for "AI" regardless of the agent's
// domain, which is why a gaming agent kept discovering AI/business
// stories. The search query is now built from persona.domain via the
// shared domainTopics classifier, so different agents actually search
// for different things.
//
// If the request fails (offline, rate limited, etc.), we fall back to a
// small built-in mock list so a single flaky network call never kills
// the autonomous loop. The mock candidates are also domain-aware.

const { resolveDomainCategory } = require("./domainTopics");

const HN_SEARCH_BASE = "https://hn.algolia.com/api/v1/search_by_date?tags=story&query=";

/**
 * Builds the HN search URL for this agent's domain. Combines the
 * category's curated query terms with any specific words from the
 * persona's own domain text (e.g. "gaming" + "Valorant") so the search
 * is biased toward the agent's actual niche, not just its broad category.
 */
function buildSearchUrl(persona) {
  const domainText = ((persona && persona.domain) || "").trim();
  const category = resolveDomainCategory(domainText);

  const extraTerms = domainText
    .toLowerCase()
    .replace(/\bnews\b/g, "")
    .trim();

  const query =
    extraTerms && extraTerms !== category.searchQuery.toLowerCase()
      ? `${category.searchQuery} ${extraTerms}`
      : category.searchQuery;

  return HN_SEARCH_BASE + encodeURIComponent(query);
}

/**
 * Builds a small set of domain-appropriate mock candidates for when the
 * real source is unavailable, so the fallback doesn't silently drop the
 * agent back into generic AI content.
 */
function mockCandidatesFor(persona) {
  const domainText = ((persona && persona.domain) || "").trim();
  const category = resolveDomainCategory(domainText);
  const label = domainText || category.label;
  const now = new Date().toISOString();

  return [
    {
      title: `Community roundup: what's new in ${label} this week`,
      url: "https://example.com/mock-source-1",
      points: 50,
      createdAt: now,
    },
    {
      title: `Analysts and fans weigh in on the latest ${label} trends`,
      url: "https://example.com/mock-source-2",
      points: 30,
      createdAt: now,
    },
  ];
}

/**
 * Fetches candidate topics for the agent to consider, scoped to its
 * configured domain.
 * @param {{domain?:string, name?:string}} [persona] - the agent's config
 * @returns {Promise<Array<{title:string,url:string,points:number,createdAt:string}>>}
 */
async function discoverTopics(persona) {
  const url = buildSearchUrl(persona);

  try {
    const res = await fetch(url);

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
      console.log("[DISCOVERY] No real candidates found, using domain-aware mock fallback");
      return mockCandidatesFor(persona);
    }

    return candidates;
  } catch (err) {
    console.error("[DISCOVERY] Source unavailable, using domain-aware mock fallback:", err.message);
    return mockCandidatesFor(persona);
  }
}

module.exports = { discoverTopics, buildSearchUrl };
