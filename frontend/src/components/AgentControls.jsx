import "./AgentControls.css";

/**
 * Demo controls for judges to see the autonomous loop in action:
 * manually trigger a cycle, pause/resume the schedule, and watch the
 * live activity log from the agent's control server.
 */
export default function AgentControls({
  paused,
  activityLog,
  onRunNow,
  onPause,
  onResume,
  onNewAgent,
  isRunning,
}) {
  return (
    <section className="agent-controls" aria-label="Agent controls">
      <div className="agent-controls__buttons">
        <button
          type="button"
          className="agent-controls__button agent-controls__button--primary"
          onClick={onRunNow}
          disabled={isRunning}
        >
          {isRunning ? "Running…" : "Run Now"}
        </button>
        {paused ? (
          <button type="button" className="agent-controls__button" onClick={onResume}>
            Resume
          </button>
        ) : (
          <button type="button" className="agent-controls__button" onClick={onPause}>
            Pause
          </button>
        )}
        {onNewAgent && (
          <button
            type="button"
            className="agent-controls__button agent-controls__button--ghost"
            onClick={onNewAgent}
            title="Stop displaying this agent on this browser and return to the create screen. It keeps running in the background — this doesn't delete or stop it."
          >
            New Agent
          </button>
        )}
      </div>

      {activityLog && activityLog.length > 0 && (
        <div className="agent-activity">
          <span className="agent-activity__label">Agent Activity</span>
          <ul className="agent-activity__list">
            {activityLog.slice(0, 8).map((entry, i) => (
              <li key={`${entry.at}-${i}`} className="agent-activity__item">
                <span className="agent-activity__stage">{entry.stage}</span>
                <span className="agent-activity__message">{entry.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
