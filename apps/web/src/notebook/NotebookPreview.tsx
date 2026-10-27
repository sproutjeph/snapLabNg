import { useEffect, useRef, useState } from "react";
import LabNotebook from "./LabNotebook";
import type { Reading } from "./types";

export default function NotebookPreview() {
  const [rInput, setRInput] = useState("2");
  const [lInput, setLInput] = useState("39.8");
  const [current, setCurrent] = useState<{ rOhm: number; lCm: number } | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    window.__SNAPLAB_READY__ = true;
  }, []);

  function handleSet() {
    const rOhm = Number(rInput);
    const lCm = Number(lInput);
    if (Number.isFinite(rOhm) && Number.isFinite(lCm) && rOhm > 0 && lCm > 0 && lCm <= 100) {
      setCurrent({ rOhm, lCm });
    } else {
      setCurrent(null);
    }
  }

  const inputStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    marginTop: "6px",
    padding: "9px 10px",
    borderRadius: "6px",
    border: "1px solid #475569",
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    fontSize: "14px",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#12161d",
        color: "#f1f5f9",
        padding: "24px",
        overflowY: "auto",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>Lab notebook preview</h1>
        <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#a8b3c2", lineHeight: 1.5 }}>
          Try the readings notebook on its own. Set a fake R and tap position below, record it, then
          work out the reciprocals. Nothing here marks your work.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "end",
            margin: "18px 0",
          }}
        >
          <label style={{ fontSize: "14px", flex: "1 1 150px" }}>
            Set R (Ω)
            <input
              style={inputStyle}
              type="number"
              min="0"
              step="0.1"
              value={rInput}
              onChange={(e) => setRInput(e.target.value)}
            />
          </label>
          <label style={{ fontSize: "14px", flex: "1 1 150px" }}>
            Set l (cm)
            <input
              style={inputStyle}
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={lInput}
              onChange={(e) => setLInput(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={handleSet}
            style={{
              padding: "10px 14px",
              borderRadius: "6px",
              border: "1px solid #64748b",
              backgroundColor: "#263448",
              color: "#f8fafc",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Put on bench
          </button>
          <button
            type="button"
            onClick={() => setCurrent(null)}
            style={{
              padding: "10px 14px",
              borderRadius: "6px",
              border: "1px solid #64748b",
              backgroundColor: "transparent",
              color: "#f8fafc",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Lift jockey
          </button>
        </div>

        <LabNotebook
          current={current}
          readings={readings}
          onRecord={(reading) => {
            const id = `reading-${nextId.current}`;
            nextId.current += 1;
            setReadings((prev) => [...prev, { id, ...reading }]);
          }}
          onDelete={(id) => setReadings((prev) => prev.filter((r) => r.id !== id))}
        />
      </div>
    </div>
  );
}
