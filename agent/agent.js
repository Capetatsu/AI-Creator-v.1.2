// agent.js
// Entry point for the autonomous AI agent.
//
// Flow: interpret prompt (or env vars) -> initialize once -> start the
// autonomous loop. Each cycle: DISCOVER -> MEMORY CHECK -> JUDGE -> WRITE
// -> PUBLISH -> WAIT (see cycle.js for the cycle itself, unchanged).
//
// Run with a prompt (new):
//   node agent.js "Create an agent that posts concise funny AI news every 30 minutes for technology students"
//
// Run with no prompt (old behavior, still works — reads .env):
//   node agent.js
// (requires .env configured — see .env.example)

require("dotenv").config();

const backend = require("./backend");
const scheduler = require("./scheduler");
const { runCycle } = require("./cycle");
const { planPersona } = require("./planner");

// Everything after "node agent.js" is treated as the prompt.
const promptArg = process.argv.slice(2).join(" ").trim();

/**
 * Resolves the agent's configuration either from a natural-language
 * prompt (via planner.js) or, if no prompt was given, from the same
 * environment variables agent.js always used.
 */
async function resolveConfig() {
  if (promptArg) {
    console.log(`[PLANNER] Interpreting prompt: "${promptArg}"`);
    const config = await planPersona(promptArg);
    console.log("[PLANNER] Resulting configuration:");
    console.log(JSON.stringify(config, null, 2));
    return config;
  }

  console.log("[AGENT] No prompt given — using .env configuration.");
  return {
    name: process.env.AGENT_NAME || "TechPulse",
    domain: process.env.AGENT_DOMAIN || "AI and technology news",
    tone: process.env.AGENT_TONE || "informative and concise",
    audience: process.env.AGENT_AUDIENCE || "general audience",
    frequencyMinutes: Number(process.env.AGENT_INTERVAL_MINUTES) || 10,
    contentStyle: process.env.AGENT_CONTENT_STYLE || "concise",
  };
}

/**
 * Initializes the agent with the backend (once) then starts the loop.
 */
async function main() {
  const config = await resolveConfig();

  console.log("[AGENT] Initializing with backend...");
  const agentId = await backend.initAgent(config);
  console.log(`[AGENT] Initialized. agentId = ${agentId}`);
  console.log("[AGENT] Leave this running — posts will appear automatically.");

  scheduler.start(
    () => runCycle(agentId, config, (stage, message) => console.log(`[${stage}] ${message}`)),
    config.frequencyMinutes
  );
}

main().catch((err) => {
  console.error("[AGENT] Fatal error during startup:", err.message);
  process.exit(1);
});
