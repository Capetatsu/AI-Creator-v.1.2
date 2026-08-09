// scheduler.js
// Simple, dependency-free interval loop. No job queue, no cron library —
// just: run a cycle, wait, run again. A single failed cycle is caught
// and logged so it never permanently stops the agent.

const DEFAULT_INTERVAL_MINUTES = 10;

/**
 * Starts the autonomous loop.
 * @param {() => Promise<void>} runCycle - one full discover->publish cycle
 * @param {number} [intervalMinutes] - defaults to AGENT_INTERVAL_MINUTES env var or 10
 */
function start(runCycle, intervalMinutes) {
  const minutes =
    intervalMinutes ||
    Number(process.env.AGENT_INTERVAL_MINUTES) ||
    DEFAULT_INTERVAL_MINUTES;

  const intervalMs = minutes * 60 * 1000;

  console.log(`[SCHEDULER] Starting loop, running every ${minutes} minute(s)`);

  const loop = async () => {
    try {
      await runCycle();
    } catch (err) {
      // A failure anywhere in the cycle lands here. We log it and keep going.
      console.error("[SCHEDULER] Cycle failed, will retry next interval:", err.message);
    } finally {
      console.log(`[SCHEDULER] Waiting ${minutes} minute(s) for next cycle`);
      setTimeout(loop, intervalMs);
    }
  };

  // Run the first cycle immediately, then keep looping.
  loop();
}

module.exports = { start };
