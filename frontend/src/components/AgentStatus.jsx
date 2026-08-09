import "./AgentStatus.css";
import { IconGlobe, IconActivity, IconTrendingUp } from "./icons.jsx";

/**
 * Shows the agent's identity and high-level stats at the top of the dashboard.
 */
export default function AgentStatus({ name, domain, autonomous, postCount }) {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <section className="agent-status" aria-label="Agent status">
      <div className="agent-status__identity">
        <div className="agent-status__avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="agent-status__identity-text">
          <span className="agent-status__name">{name}</span>
          <span className="agent-status__domain">
            <IconGlobe width={14} height={14} />
            {domain}
          </span>
        </div>
        <span
          className={`status-pill ${autonomous ? "status-pill--live" : "status-pill--paused"}`}
        >
          <span className="status-pill__dot" />
          <IconActivity width={13} height={13} />
          {autonomous ? "Autonomous" : "Paused"}
        </span>
      </div>

      <div className="agent-status__metric" role="group" aria-label="Posts published">
        <div className="agent-status__metric-icon">
          <IconTrendingUp width={20} height={20} />
        </div>
        <div className="agent-status__metric-text">
          <span className="agent-status__metric-value">{postCount}</span>
          <span className="agent-status__metric-label">Posts published</span>
        </div>
      </div>
    </section>
  );
}
