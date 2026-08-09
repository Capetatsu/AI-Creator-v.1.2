// judge.js
// Editorial judgment: score each candidate topic and pick the strongest
// one that isn't a duplicate of something already posted — or explicitly
// REJECT the whole cycle when nothing meets publishing standards.
//
// Kept intentionally simple (no ML ranking) — a transparent point
// system a second-year student can read top to bottom.

const { isDuplicate, keywordsOf } = require("./memory");

// A candidate must clear this bar just to be considered "publishable"
// content, independent of how it scores against other candidates.
const MIN_TITLE_LENGTH = 12; // reject near-empty / low-information titles
const MIN_SCORE = 8; // reject weak candidates even if nothing better exists

/**
 * Basic publishing-standards check, independent of scoring or duplicates.
 * A candidate that fails this is unsuitable no matter how "fresh" it is.
 */
function meetsQualityBar(candidate) {
  if (!candidate || typeof candidate.title !== "string") return false;
  if (candidate.title.trim().length < MIN_TITLE_LENGTH) return false; // not enough info
  if (!candidate.url || !/^https?:\/\//i.test(candidate.url)) return false; // no real source
  return true;
}

/**
 * Small relevance bonus when the candidate's title shares keywords with
 * the agent's configured domain (e.g. persona.domain = "security news").
 * Not a hard requirement (discovery is already domain-scoped upstream),
 * but it rewards candidates that are a closer editorial fit.
 */
function domainRelevanceBonus(candidate, persona) {
  if (!persona || !persona.domain) return 0;
  const domainWords = keywordsOf(persona.domain);
  const titleWords = keywordsOf(candidate.title);
  let overlap = 0;
  for (const word of domainWords) {
    if (titleWords.has(word)) overlap += 1;
  }
  return overlap > 0 ? 15 : 0;
}

/**
 * Scores a single candidate. Higher is better.
 * @param {Object} candidate
 * @param {{domain?:string}} [persona] - optional, adds a relevance bonus
 */
function scoreCandidate(candidate, persona) {
  let score = 0;

  // Freshness: newer stories score higher (decays over 48 hours).
  const ageHours = (Date.now() - new Date(candidate.createdAt).getTime()) / 3_600_000;
  score += Math.max(0, 48 - ageHours) * 0.5;

  // Impact/importance proxy: community points (HN upvotes, etc.)
  score += Math.min(candidate.points || 0, 200) * 0.3;

  // Source quality: prefer candidates that actually have a real URL.
  if (candidate.url && candidate.url.startsWith("http")) {
    score += 10;
  }

  // Editorial fit: does this look like it belongs to the agent's domain?
  score += domainRelevanceBonus(candidate, persona);

  return score;
}

/**
 * Picks the single strongest, non-duplicate, quality-bar-passing
 * candidate — or explicitly rejects the cycle with a reason.
 *
 * @param {string} agentId
 * @param {Array} candidates - from discovery.discoverTopics()
 * @param {{domain?:string}} [persona] - optional, used for relevance scoring
 * @returns {{status:"SELECTED"|"REJECTED", topic:Object|null, reason:string|null}}
 */
function selectTopic(agentId, candidates, persona) {
  if (!candidates || candidates.length === 0) {
    return { status: "REJECTED", topic: null, reason: "No candidates were discovered this cycle" };
  }

  const qualityFiltered = candidates.filter(meetsQualityBar);
  if (qualityFiltered.length === 0) {
    return {
      status: "REJECTED",
      topic: null,
      reason: "All candidates failed the publishing quality bar (title too short or missing a real source URL)",
    };
  }

  const fresh = qualityFiltered.filter((c) => !isDuplicate(agentId, c.title));
  if (fresh.length === 0) {
    return {
      status: "REJECTED",
      topic: null,
      reason: "All quality candidates were duplicates or near-duplicates of recent posts",
    };
  }

  const ranked = fresh
    .map((c) => ({ ...c, _score: scoreCandidate(c, persona) }))
    .sort((a, b) => b._score - a._score);

  const best = ranked[0];

  if (best._score < MIN_SCORE) {
    return {
      status: "REJECTED",
      topic: null,
      reason: `Best candidate scored ${best._score.toFixed(1)}, below the minimum publishing bar of ${MIN_SCORE}`,
    };
  }

  return { status: "SELECTED", topic: best, reason: null };
}

module.exports = { selectTopic, scoreCandidate, meetsQualityBar, MIN_SCORE, MIN_TITLE_LENGTH };
