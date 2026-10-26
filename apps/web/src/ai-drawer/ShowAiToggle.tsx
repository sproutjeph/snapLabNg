export interface ShowAiToggleProps {
  running: boolean;
  onClick(): void;
}

export function ShowAiToggle({ running, onClick }: ShowAiToggleProps) {
  return (
    <>
      <style>
        {`
          @keyframes snaplabAiPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.35); opacity: 0.45; }
          }
        `}
      </style>
      <button
        type="button"
        onClick={onClick}
        aria-label={running ? "Show the AI (models running)" : "Show the AI"}
        style={{
          position: "fixed",
          top: "12px",
          right: "16px",
          zIndex: 80,
          minHeight: "38px",
          padding: "7px 14px",
          borderRadius: "999px",
          border: "1px solid #38bdf8",
          backgroundColor: "#0f172a",
          color: "#f8fafc",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "0.01em",
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
          boxShadow: "0 6px 18px rgba(0, 0, 0, 0.45)",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: "9px",
            height: "9px",
            borderRadius: "999px",
            backgroundColor: running ? "#22c55e" : "#38bdf8",
            boxShadow: running ? "0 0 8px #22c55e" : "none",
            animation: running ? "snaplabAiPulse 1.1s ease-in-out infinite" : "none",
          }}
        />
        <span>Show the AI</span>
      </button>
    </>
  );
}

export default ShowAiToggle;
