// cycle.js
// One full autonomous cycle: DISCOVER -> MEMORY CHECK -> JUDGE -> WRITE -> PUBLISH.
//
// This is the exact same logic that used to live inline in agent.js.
// It's pulled out into its own file so both the CLI entry point
// (agent.js) and the HTTP control server (control-server.js) can run
// the same pipeline without copy-pasting it. discovery.js, memory.js,
// judge.js, and writer.js themselves are NOT changed.

const { discoverTopics } = require("./discovery");
const { selectTopic } = require("./judge");
const { writePost } = require("./writer");
const backend = require("./backend");

/**
 * Runs one full autonomous cycle for the given agent.
 * @param {string} agentId
 * @param {{name:string, domain:string, tone?:string}} persona - the agent's config
 * @param {(stage: string, message: string) => void} [onEvent] - optional progress callback
 * @returns {Promise<Object|null>} the published post, or null if the cycle was skipped
 */
async function runCycle(agentId, persona, onEvent) {
  const log = onEvent || (() => {});

  log("DISCOVERY", "Searching for candidate topics");
  const candidates = await discoverTopics();
  log("DISCOVERY", `Found ${candidates.length} candidates`);

  log("MEMORY", "Checking previous posts for repeats");
  log("JUDGE", "Scoring candidates and selecting a topic");
  const judged = selectTopic(agentId, candidates, persona);

  if (judged.status !== "SELECTED") {
    log("JUDGE", `No suitable topic this cycle — ${judged.reason}`);
    return null;
  }
  const topic = judged.topic;
  log("JUDGE", `Selected topic: "${topic.title}" (score ${topic._score.toFixed(1)})`);

  log("WRITER", "Generating post");
  const { text, rationale, sources } = await writePost(persona, topic);

  log("PUBLISH", "Publishing post");
  const post = backend.publishPost({ agentId, text, rationale, sources });
  log("PUBLISH", `Published post ${post.id}`);

  return post;
}

module.exports = { runCycle };
