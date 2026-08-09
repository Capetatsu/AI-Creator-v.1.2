import { IconAlert } from "./icons.jsx";

export default function ErrorState({ message, onRetry }) {
  return (
    <div className="state-panel state-panel--error">
      <div className="state-panel__icon state-panel__icon--error">
        <IconAlert width={22} height={22} />
      </div>
      <p className="state-panel__title">Couldn't load the feed</p>
      <p>{message}</p>
      <button type="button" className="retry-button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
