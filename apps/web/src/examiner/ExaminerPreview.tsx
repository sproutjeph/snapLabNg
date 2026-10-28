import { useEffect, useState } from "react";
import ExaminerConsole from "./ExaminerConsole";
import { G1_FIRST_QUESTION, mockAsk } from "./mockExaminer";

/**
 * Preview page for `/?examiner=1` showcasing the Examiner Console
 * with the scripted Golden Page 1 (G1) mock examiner.
 */
export default function ExaminerPreview() {
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    window.__SNAPLAB_READY__ = true;
    return () => {
      delete window.__SNAPLAB_READY__;
    };
  }, []);

  const handleRestart = () => {
    setSessionKey((prev) => prev + 1);
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--paper)",
        overflow: "hidden",
      }}
    >
      {/* Top Preview Bar */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 16px",
          background: "var(--paper)",
          borderBottom: "var(--rule)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--ink)" }}>
            SnapLab NG
          </span>
          <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>&bull;</span>
          <span style={{ fontSize: "0.82rem", color: "var(--ink-2)", fontWeight: 600 }}>
            Examiner Preview (G1 Mock)
          </span>
        </div>
        <button
          type="button"
          onClick={handleRestart}
          style={{
            background: "var(--card)",
            color: "var(--ink)",
            border: "1px solid var(--ink-2)",
            borderRadius: "var(--radius)",
            padding: "5px 12px",
            fontSize: "0.78rem",
            fontFamily: "var(--f-cond)",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            minHeight: "var(--tap)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>Restart</span>
        </button>
      </header>

      {/* Main Console Container */}
      <main style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <ExaminerConsole
          key={sessionKey}
          first={G1_FIRST_QUESTION}
          ask={mockAsk}
          maxTurns={3}
          voice={true}
        />
      </main>
    </div>
  );
}
