/**
 * Skeleton placeholders shaped like post cards, so the layout doesn't
 * jump once real content arrives.
 */
export default function LoadingState() {
  return (
    <div className="skeleton-list" role="status" aria-live="polite">
      <span className="sr-only">Loading the latest posts…</span>
      {[0, 1, 2].map((i) => (
        <div className="skeleton-card" key={i} aria-hidden="true">
          <div className="skeleton-line skeleton-line--sm" />
          <div className="skeleton-line skeleton-line--lg" />
          <div className="skeleton-line skeleton-line--lg" />
          <div className="skeleton-line skeleton-line--md" />
          <div className="skeleton-block" />
        </div>
      ))}
    </div>
  );
}
