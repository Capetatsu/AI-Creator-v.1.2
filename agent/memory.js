// memory.js
// Simple repetition-check memory. No vector DB, no new database —
// we read directly from the backend's existing SQLite database
// (the single source of truth) via its db.js connection.

const db = require("../backend/db");

// Common words that don't help distinguish one topic from another.
const STOPWORDS = new Set([
  "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "with",
  "is", "are", "how", "new", "ai", "using", "into", "as", "at", "by",
]);

/**
 * Turns a title into a set of meaningful lowercase keywords.
 */
function keywordsOf(text) {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word))
  );
}

/**
 * Jaccard similarity between two keyword sets: intersection / union.
 */
function similarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

/**
 * Fetches this agent's previous posts directly from the database.
 * @param {string} agentId
 */
function getPreviousPosts(agentId) {
  const rows = db
    .prepare("SELECT text FROM posts WHERE agentId = ? ORDER BY createdAt DESC LIMIT 50")
    .all(agentId);
  return rows.map((row) => row.text);
}

/**
 * Returns true if `candidateTitle` looks like a repeat of something
 * already posted, based on simple keyword overlap.
 * @param {string} agentId
 * @param {string} candidateTitle
 * @param {number} threshold - similarity above this counts as duplicate (0-1)
 */
function isDuplicate(agentId, candidateTitle, threshold = 0.5) {
  const previousPosts = getPreviousPosts(agentId);
  const candidateWords = keywordsOf(candidateTitle);

  return previousPosts.some((postText) => {
    const postWords = keywordsOf(postText);
    return similarity(candidateWords, postWords) >= threshold;
  });
}

module.exports = { isDuplicate, getPreviousPosts, keywordsOf };
