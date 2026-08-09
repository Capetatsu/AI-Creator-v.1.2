// domainTopics.js
// Shared domain -> search-query / relevance-keyword mapping.
//
// This is the single source of truth for "what does this agent's domain
// actually mean", used by three places that previously drifted out of
// sync with each other:
//   - planner.js   (fallback parser: prompt -> human-readable domain)
//   - discovery.js (build a topic-appropriate search query)
//   - judge.js     (reject candidates that don't belong to the domain)
//
// Add a new domain by adding one entry here — the planner fallback,
// discovery query, and judge relevance filter all pick it up automatically.

const DOMAIN_CATEGORIES = [
  {
    key: "gaming",
    label: "gaming news",
    match: /\b(games?|gaming|esports?|valorant|fortnite|minecraft|league of legends|\blol\b|csgo|cs2|playstation|xbox|nintendo|steam|twitch|streamer|riot games)\b/,
    searchQuery: "gaming esports video game",
    keywords: ["game", "games", "gaming", "esports", "esport", "valorant", "fortnite", "minecraft", "playstation", "xbox", "nintendo", "steam", "twitch", "streamer", "gamer", "console", "riot"],
  },
  {
    key: "crypto",
    label: "cryptocurrency news",
    match: /\b(crypto|bitcoin|ethereum|blockchain|defi|nft|web3|token)\b/,
    searchQuery: "crypto bitcoin blockchain",
    keywords: ["crypto", "cryptocurrency", "bitcoin", "ethereum", "blockchain", "defi", "nft", "web3", "token", "coin"],
  },
  {
    key: "startup",
    label: "startup news",
    match: /\b(startups?|venture|funding|seed round|y ?combinator)\b/,
    searchQuery: "startup funding venture",
    keywords: ["startup", "startups", "funding", "venture", "vc", "seed", "raise", "founders", "founder"],
  },
  {
    key: "sports",
    label: "sports news",
    match: /\b(sports?|football|soccer|basketball|nba|nfl|baseball|tennis|olympics?)\b/,
    searchQuery: "sports",
    keywords: ["sport", "sports", "football", "soccer", "basketball", "nba", "nfl", "baseball", "tennis", "olympic", "olympics", "league", "match", "tournament", "athlete"],
  },
  {
    key: "science",
    label: "science news",
    match: /\b(science|physics|biology|chemistry|astronomy|space|nasa|research)\b/,
    searchQuery: "science research",
    keywords: ["science", "scientific", "physics", "biology", "chemistry", "astronomy", "space", "nasa", "research", "study"],
  },
  {
    key: "security",
    label: "security news",
    match: /\b(security|cybersecurity|hack(er|ing)?|breach|vulnerabilit(y|ies)|exploit|malware|ransomware)\b/,
    searchQuery: "cybersecurity hacking",
    keywords: ["security", "cybersecurity", "hack", "hacker", "hacking", "breach", "vulnerability", "exploit", "malware", "ransomware", "cve"],
  },
  {
    key: "finance",
    label: "finance news",
    match: /\b(finance|financial|stocks?|market|investing|investment|economy|economic)\b/,
    searchQuery: "finance markets economy",
    keywords: ["finance", "financial", "stock", "stocks", "market", "markets", "investing", "investment", "economy", "economic"],
  },
  {
    key: "health",
    label: "health news",
    match: /\b(health|medicine|medical|fitness|wellness|nutrition)\b/,
    searchQuery: "health medicine",
    keywords: ["health", "medicine", "medical", "fitness", "wellness", "nutrition", "disease", "treatment"],
  },
  {
    key: "entertainment",
    label: "entertainment news",
    match: /\b(movies?|films?|tv show|television|celebrit(y|ies)|music|entertainment)\b/,
    searchQuery: "entertainment movies music",
    keywords: ["movie", "movies", "film", "television", "celebrity", "music", "entertainment", "show", "album", "actor"],
  },
  {
    key: "ai",
    label: "AI news",
    match: /(\bai\b|artificial intelligence|machine learning|\bllm\b|chatgpt|openai)/,
    searchQuery: "AI",
    keywords: ["ai", "artificial", "intelligence", "machine", "learning", "llm", "chatgpt", "openai", "model", "models"],
  },
];

// The old default: general AI/technology news. Used whenever nothing in
// DOMAIN_CATEGORIES matches, so pre-existing agents without a specific
// domain keep behaving the way they always did.
const GENERAL_CATEGORY = {
  key: "general",
  label: "AI and technology news",
  searchQuery: "technology",
  keywords: ["technology", "tech"],
};

/**
 * Finds the best-matching known category for free text (a prompt or a
 * persona.domain string like "gaming", "Valorant esports", "AI news").
 */
function resolveDomainCategory(text) {
  const lower = (text || "").toLowerCase();
  for (const category of DOMAIN_CATEGORIES) {
    if (category.match.test(lower)) return category;
  }
  return GENERAL_CATEGORY;
}

/**
 * Builds the full relevance keyword set for a persona: the resolved
 * category's known synonyms, PLUS any significant words straight out of
 * the persona's own domain/name text (so e.g. "Valorant Gamer" still
 * matches "Valorant" even though no category can enumerate every game).
 */
function domainKeywordSet(persona) {
  const domainText = (persona && persona.domain) || "";
  const category = resolveDomainCategory(domainText);
  const words = new Set(category.keywords);

  const extraSource = `${domainText} ${(persona && persona.name) || ""}`.toLowerCase();
  const extraWords = extraSource
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["news", "agent", "content"].includes(w));
  for (const w of extraWords) words.add(w);

  return { category, words };
}

module.exports = { DOMAIN_CATEGORIES, GENERAL_CATEGORY, resolveDomainCategory, domainKeywordSet };
