import { useOnline } from "./useOnline";

/**
 * Fixed banner shown while offline. It sits at the top of the screen, so it
 * never covers the bottom 64 px on phones where the capture controls live.
 */
export default function OfflineNotice() {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        top: "max(12px, env(safe-area-inset-top))",
        left: 12,
        right: 12,
        zIndex: 60,
        padding: "10px 14px",
        borderRadius: "var(--radius)",
        border: "1px solid var(--ink-2)",
        background: "var(--card)",
        color: "var(--ink)",
        font: "14px/1.45 var(--f-body)",
        textAlign: "center",
        boxSizing: "border-box",
      }}
    >
      You're offline. The demo page still works; snapping a new page needs a connection.
    </div>
  );
}
