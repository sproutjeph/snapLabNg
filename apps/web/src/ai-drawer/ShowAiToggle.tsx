export interface ShowAiToggleProps {
  running: boolean;
  open?: boolean;
  onClick(): void;
}

export function ShowAiToggle({ running, open, onClick }: ShowAiToggleProps) {
  return (
    <>
      <style>
        {`
          @keyframes snaplabAiPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.35); opacity: 0.45; }
          }
          .snaplab-show-ai-toggle {
            right: 16px;
          }
          @media (min-width: 769px) {
            .snaplab-show-ai-toggle[data-drawer-open="true"] {
              right: 436px;
            }
          }
        `}
      </style>
      <button
        type="button"
        onClick={onClick}
        aria-expanded={open}
        data-ai-drawer-toggle="true"
        data-drawer-open={open ? "true" : "false"}
        aria-label={running ? "Show the AI (models running)" : "Show the AI"}
        className="snaplab-show-ai-toggle"
        style={{
          position: "fixed",
          top: "12px",
          zIndex: 80,
          minHeight: "var(--tap)",
          padding: "7px 14px",
          borderRadius: "var(--radius)",
          border: "1px solid var(--ink-2)",
          backgroundColor: "var(--card)",
          color: "var(--ink)",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontFamily: "var(--f-cond)",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
          boxShadow: "none",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: "9px",
            height: "9px",
            borderRadius: "999px",
            backgroundColor: running ? "var(--green)" : "var(--ink)",
            boxShadow: "none",
            animation: running ? "snaplabAiPulse 1.1s ease-in-out infinite" : "none",
          }}
        />
        <span>Show the AI</span>
      </button>
    </>
  );
}

export default ShowAiToggle;
