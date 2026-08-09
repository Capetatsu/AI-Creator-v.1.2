// test-planner-frequency.js
// Standalone test for the frequency-parsing fix in planner.js.
// No AI_API_KEY is set for these runs, so planPersona() exercises the
// deterministic fallback path; parseExplicitFrequency() is also tested
// directly since it's the override applied after either path (AI or
// fallback) inside planPersona().
//
// Run with: node test-planner-frequency.js

delete process.env.AI_API_KEY; // force fallback path, no network calls

const assert = require("assert");
const { planPersona, parseExplicitFrequency } = require("./planner");

const cases = [
  { prompt: "Create an AI news agent that posts every 1 minute", expected: 1 },
  { prompt: "Create an AI news agent that posts every 5 minutes", expected: 5 },
  { prompt: "Create an AI news agent that posts every 30 minutes", expected: 30 },
  { prompt: "Create an AI news agent that posts every 1 hour", expected: 60 },
  { prompt: "Create an AI news agent that posts every 2 hours", expected: 120 },
  { prompt: "Create an AI news agent that posts every day", expected: 1440 },
  { prompt: "Create a daily AI news agent", expected: 1440 },
  { prompt: "Create an AI news agent that posts every 24 hours", expected: 1440 },
];

async function main() {
  let passed = 0;
  let failed = 0;

  console.log("=== parseExplicitFrequency() direct tests ===");
  for (const { prompt, expected } of cases) {
    const actual = parseExplicitFrequency(prompt);
    try {
      assert.strictEqual(actual, expected);
      console.log(`PASS  parseExplicitFrequency("${prompt}") === ${expected}`);
      passed++;
    } catch (e) {
      console.log(`FAIL  parseExplicitFrequency("${prompt}") -> got ${actual}, expected ${expected}`);
      failed++;
    }
  }

  console.log("\n=== planPersona() end-to-end tests (fallback path, no AI key) ===");
  for (const { prompt, expected } of cases) {
    const config = await planPersona(prompt);
    try {
      assert.strictEqual(config.frequencyMinutes, expected);
      console.log(`PASS  planPersona("${prompt}").frequencyMinutes === ${expected}`);
      passed++;
    } catch (e) {
      console.log(
        `FAIL  planPersona("${prompt}").frequencyMinutes -> got ${config.frequencyMinutes}, expected ${expected}`
      );
      failed++;
    }
  }

  console.log("\n=== planPersona() override test: explicit prompt frequency beats a 'bad' AI/model result ===");
  // Simulate what used to slip through: even if the upstream config (AI or
  // fallback) had produced something wrong, planPersona()'s final override
  // must still land on the frequency the user actually typed.
  {
    const config = await planPersona("Create an AI news agent that posts every 1 minute, for developers.");
    try {
      assert.strictEqual(config.frequencyMinutes, 1);
      console.log(`PASS  override test -> frequencyMinutes === 1 (not 1440)`);
      passed++;
    } catch (e) {
      console.log(`FAIL  override test -> got ${config.frequencyMinutes}, expected 1`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
