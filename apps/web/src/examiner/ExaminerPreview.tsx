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
        background: "#030712",
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
          background: "#0b1120",
          borderBottom: "1px solid #1e293b",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "1rem" }}>🔬</span>
          <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#f8fafc" }}>SnapLab NG</span>
          <span style={{ color: "#64748b", fontSize: "0.82rem" }}>&bull;</span>
          <span style={{ fontSize: "0.82rem", color: "#38bdf8", fontWeight: 600 }}>
            Examiner Preview (G1 Mock)
          </span>
        </div>
        <button
          type="button"
          onClick={handleRestart}
          style={{
            background: "#1e293b",
            color: "#f8fafc",
            border: "1px solid #334155",
            borderRadius: "6px",
            padding: "5px 12px",
            fontSize: "0.78rem",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>🔄</span>
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
