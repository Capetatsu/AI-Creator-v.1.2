import { IconInbox } from "./icons.jsx";

export default function EmptyState() {
  return (
    <div className="state-panel">
      <div className="state-panel__icon state-panel__icon--muted">
        <IconInbox width={22} height={22} />
      </div>
      <p className="state-panel__title">No posts yet</p>
      <p>This agent hasn't published anything. Check back after its next run.</p>
    </div>
  );
}
