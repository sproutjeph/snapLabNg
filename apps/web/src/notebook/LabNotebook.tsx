import { useState } from "react";
import { formatLength, formatOhm, reciprocalRow } from "./format";
import type { NotebookProps } from "./types";

export default function LabNotebook({ current, readings, onRecord, onDelete }: NotebookProps) {
  const [workedOut, setWorkedOut] = useState(false);

  const counts = new Map<number, number>();
  for (const reading of readings) {
    counts.set(reading.rOhm, (counts.get(reading.rOhm) ?? 0) + 1);
  }
  const duplicateRs = [...counts.entries()].filter(([, n]) => n > 1).map(([r]) => r);

  return (
    <section
      aria-label="Lab notebook"
      style={{
        backgroundColor: "var(--card)",
        backgroundImage:
          "repeating-linear-gradient(to bottom, transparent 0, transparent 31px, var(--line) 31px, var(--line) 32px)",
        color: "var(--ink)",
        border: "var(--rule)",
        borderRadius: "var(--radius)",
        padding: "20px",
        fontFamily: "var(--f-body)",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>My metre bridge readings</h2>
      <p style={{ margin: "6px 0 0", fontSize: "13px", lineHeight: 1.5 }}>
        Write down each R you set and the l where your needle stayed still. R⁻¹ and l⁻¹ are plain
        arithmetic from your own numbers, worked out only when you ask.
      </p>

      <p style={{ margin: "12px 0 0", fontSize: "14px" }} aria-live="polite">
        {current
          ? `On the bench now: R = ${formatOhm(current.rOhm)} Ω, your tap at l = ${formatLength(current.lCm)} cm.`
          : "The jockey is up or the key is open, so there is no reading to record yet."}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "12px" }}>
        <button
          type="button"
          disabled={!current}
          onClick={() => {
            if (current) {
              setWorkedOut(false);
              onRecord({ rOhm: current.rOhm, lCm: current.lCm });
            }
          }}
          style={{
            minHeight: "var(--tap)",
            padding: "10px 14px",
            borderRadius: "var(--radius)",
            fontFamily: "var(--f-cond)",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            border: "1px solid var(--ink)",
            backgroundColor: current ? "var(--ink)" : "var(--pencil)",
            color: "var(--paper)",
            fontSize: "14px",
            cursor: current ? "pointer" : "not-allowed",
          }}
        >
          Record reading
        </button>
        <button
          type="button"
          disabled={readings.length === 0}
          onClick={() => setWorkedOut(true)}
          style={{
            minHeight: "var(--tap)",
            padding: "10px 14px",
            borderRadius: "var(--radius)",
            fontFamily: "var(--f-cond)",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            border: "1px solid var(--ink-2)",
            backgroundColor: "var(--card)",
            color: "var(--ink)",
            fontSize: "14px",
            cursor: readings.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          Work out R⁻¹ and l⁻¹
        </button>
      </div>

      <div role="status">
        {duplicateRs.map((r) => (
          <p key={r} style={{ margin: "10px 0 0", fontSize: "13px", color: "var(--accent)" }}>
            You already have a reading for R = {formatOhm(r)} Ω
          </p>
        ))}
      </div>

      <div style={{ overflowX: "auto", marginTop: "14px" }}>
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            minWidth: "340px",
            fontSize: "14px",
            backgroundColor: "transparent",
          }}
        >
          <thead>
            <tr>
              <th scope="col" style={{ border: "var(--rule)", padding: "8px", textAlign: "left" }}>
                R (Ω)
              </th>
              <th scope="col" style={{ border: "var(--rule)", padding: "8px", textAlign: "left" }}>
                l (cm)
              </th>
              <th scope="col" style={{ border: "var(--rule)", padding: "8px", textAlign: "left" }}>
                R⁻¹ (Ω⁻¹)
              </th>
              <th scope="col" style={{ border: "var(--rule)", padding: "8px", textAlign: "left" }}>
                l⁻¹ (cm⁻¹)
              </th>
              <th scope="col" style={{ border: "var(--rule)", padding: "8px", textAlign: "left" }}>
                <span style={{ position: "absolute", left: "-9999px" }}>Delete</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {readings.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ border: "var(--rule)", padding: "8px" }}>
                  No readings yet. Find a still needle, then record it.
                </td>
              </tr>
            ) : (
              readings.map((reading) => {
                const inv = workedOut ? reciprocalRow(reading) : null;
                return (
                  <tr key={reading.id}>
                    <td style={{ border: "var(--rule)", padding: "8px" }}>
                      {formatOhm(reading.rOhm)}
                    </td>
                    <td style={{ border: "var(--rule)", padding: "8px" }}>
                      {formatLength(reading.lCm)}
                    </td>
                    <td style={{ border: "var(--rule)", padding: "8px" }}>{inv?.rInv ?? ""}</td>
                    <td style={{ border: "var(--rule)", padding: "8px" }}>{inv?.lInv ?? ""}</td>
                    <td style={{ border: "var(--rule)", padding: "8px" }}>
                      <button
                        type="button"
                        aria-label={`Delete reading R = ${formatOhm(reading.rOhm)} Ω, l = ${formatLength(reading.lCm)} cm`}
                        onClick={() => onDelete(reading.id)}
                        style={{
                          border: "var(--rule)",
                          borderRadius: "var(--radius)",
                          backgroundColor: "var(--card)",
                          color: "var(--ink)",
                          padding: "4px 9px",
                          cursor: "pointer",
                        }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
