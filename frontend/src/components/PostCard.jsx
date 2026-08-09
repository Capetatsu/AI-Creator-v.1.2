import "./PostCard.css";
import { IconClock, IconSparkle, IconLink } from "./icons.jsx";

/**
 * Formats an ISO timestamp as an explicit UTC string, e.g. "08 Aug 2026, 10:30 UTC".
 */
function formatUtc(isoString) {
  const date = new Date(isoString);
  const datePart = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const timePart = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  });
  return `${datePart}, ${timePart} UTC`;
}

/** Pulls a short, readable label (hostname) out of a source URL. */
function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function PostCard({ post }) {
  const { text, rationale, sources, createdAt } = post;

  return (
    <article className="post-card">
      <div className="post-card__meta">
        <IconClock width={14} height={14} />
        <time dateTime={createdAt}>{formatUtc(createdAt)}</time>
      </div>

      <p className="post-card__text">{text}</p>

      {rationale && (
        <div className="post-card__rationale">
          <span className="post-card__rationale-label">
            <IconSparkle width={13} height={13} />
            Why this post
          </span>
          <p>{rationale}</p>
        </div>
      )}

      {sources && sources.length > 0 && (
        <div className="post-card__sources">
          <span className="post-card__sources-label">Sources</span>
          <ul>
            {sources.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <IconLink width={13} height={13} />
                  {hostnameOf(url)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
