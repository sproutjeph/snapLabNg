export default function TeacherNotes() {
  return (
    <section
      aria-labelledby="teacher-notes-heading"
      style={{
        border: "var(--rule)",
        borderRadius: "var(--radius)",
        backgroundColor: "var(--card)",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <h2
        id="teacher-notes-heading"
        style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}
      >
        Teacher notes — metre bridge model
      </h2>
      <p style={{ margin: "0 0 12px", fontSize: "14px", lineHeight: 1.6, color: "var(--ink-2)" }}>
        What the bench computes, in plain language. These notes describe the model only; they do not
        mark any work.
      </p>

      <h3 style={{ margin: "14px 0 6px", fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
        Balance and the graph
      </h3>
      <ul
        style={{
          margin: 0,
          paddingLeft: "20px",
          fontSize: "14px",
          lineHeight: 1.7,
          color: "var(--ink-2)",
        }}
      >
        <li>
          At balance, <code>R / X = l / (100 − l)</code>, where <code>l</code> is the balance length
          in cm from the R end of the 100 cm wire.
        </li>
        <li>
          Rearranged for the graph: <code>l⁻¹ = (X / 100) · R⁻¹ + 1 / 100</code>. So the slope is{" "}
          <code>s = X / 100</code>, the intercept is <code>c = 1 / 100</code>, and{" "}
          <code>X = s / c</code>. The 100 cancels, so the student does not have to assume the wire
          is exactly 100 cm.
        </li>
      </ul>

      <h3 style={{ margin: "14px 0 6px", fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
        End corrections and interchanging R and X
      </h3>
      <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.7, color: "var(--ink-2)" }}>
        With small end corrections α₁ and α₂ at the two ends of the wire, balance is{" "}
        <code>R / X = (l + α₁) / (100 − l + α₂)</code>. Interchanging R and X and averaging (the
        mean of l₁ and 100 − l₂) cancels the unequal part α₂ − α₁ exactly. What remains is{" "}
        <code>(k − 1)(α₁ + α₂) / (2(1 + k))</code> with <code>k = R / X</code>, which is zero at{" "}
        <code>R = X</code> and small near the middle. That is why a balance point near the middle of
        the wire gives the smallest error.
      </p>

      <h3 style={{ margin: "14px 0 6px", fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
        Cell, jockey and wire
      </h3>
      <ul
        style={{
          margin: 0,
          paddingLeft: "20px",
          fontSize: "14px",
          lineHeight: 1.7,
          color: "var(--ink-2)",
        }}
      >
        <li>
          Leclanché polarisation: while the key is closed, the cell polarises, so sensitivity falls.
          It changes sensitivity, not the balance point. Opening the key between readings lets the
          cell recover.
        </li>
        <li>
          A dragged jockey scrapes the wire. The scrape raises local resistance by a few percent, so
          later balance points shift by a few millimetres. The jockey should be tapped, not dragged.
        </li>
        <li>
          The wire is constantan, chosen for its very small temperature coefficient. It warms by a
          few degrees in use and never glows.
        </li>
      </ul>

      <p style={{ margin: "14px 0 0", fontSize: "12px", lineHeight: 1.6, color: "var(--muted)" }}>
        Sources: docs/07_SCIENCE_ENGINE.md section 4.2 (metre bridge model) and
        docs/15_METRE_BRIDGE_HERO.md sections 4 and 9. WAEC reports listed in docs/15 section 9:
        May/June 2023 Q3B, May/June 2018 Q3A, Nov/Dec 2011 Q3, May/June 2014 Q3 and 2008 Q3 (WAEC
        e-Learning). Cited as plain text only.
      </p>
    </section>
  );
}
