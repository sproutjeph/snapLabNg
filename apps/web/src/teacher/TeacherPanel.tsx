import { useState } from "react";
import { parseOhms } from "./teacherStore";
import type { UseTeacherResult } from "./useTeacher";
import { useTeacher } from "./useTeacher";

function TeacherPanelInner({ teacher }: { teacher: UseTeacherResult }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const trimmed = input.trim();
    if (!trimmed) {
      setError("Enter the true value, e.g. 3.0 Ω.");
      setSaved(false);
      return;
    }
    if (parseOhms(trimmed) === null) {
      setError("Enter a number above 0 and at most 10,000 Ω, e.g. 3.0 Ω.");
      setSaved(false);
      return;
    }
    const ok = teacher.setX(trimmed);
    if (!ok) {
      setError("Enter a number above 0 and at most 10,000 Ω, e.g. 3.0 Ω.");
      setSaved(false);
      return;
    }
    teacher.enable();
    setError(null);
    setSaved(true);
  }

  function handleTurnOff() {
    teacher.disable();
    setInput("");
    setError(null);
    setSaved(false);
  }

  function handleClear() {
    teacher.clear();
    setInput("");
    setError(null);
    setSaved(false);
  }

  const btnStyle: React.CSSProperties = {
    minHeight: "var(--tap)",
    padding: "8px 12px",
    borderRadius: "var(--radius)",
    border: "1px solid var(--ink-2)",
    backgroundColor: "var(--card)",
    color: "var(--ink)",
    fontFamily: "var(--f-cond)",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    fontSize: "13px",
    cursor: "pointer",
  };

  return (
    <div style={{ boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={{
            minHeight: "var(--tap)",
            padding: "8px 12px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--ink-2)",
            backgroundColor: "var(--card)",
            color: "var(--ink)",
            fontFamily: "var(--f-cond)",
            fontSize: "13px",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          For teachers
        </button>
        {teacher.enabled ? (
          <span
            role="status"
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--paper)",
              backgroundColor: "var(--ink)",
              borderRadius: "var(--radius)",
              padding: "3px 8px",
            }}
          >
            Teacher mode on
          </span>
        ) : null}
      </div>

      {open ? (
        <section
          aria-label="Teacher mode"
          style={{
            marginTop: "12px",
            border: "var(--rule)",
            borderRadius: "var(--radius)",
            backgroundColor: "var(--card)",
            padding: "16px",
            boxSizing: "border-box",
          }}
        >
          <h2 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>
            Teacher mode
          </h2>
          <p
            style={{ margin: "0 0 12px", fontSize: "14px", lineHeight: 1.6, color: "var(--ink-2)" }}
          >
            This value is kept on this device only and is used only to mark accuracy.
          </p>

          <label
            htmlFor="teacher-x-input"
            style={{ display: "block", fontSize: "14px", color: "var(--ink)" }}
          >
            True value of X (Ω)
            <input
              id="teacher-x-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 3.0"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
                setSaved(false);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "teacher-x-error" : undefined}
              style={{
                display: "block",
                width: "100%",
                marginTop: "6px",
                padding: "9px 10px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--ink-2)",
                backgroundColor: "var(--paper)",
                color: "var(--ink)",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </label>

          {error ? (
            <p
              id="teacher-x-error"
              role="alert"
              style={{
                margin: "8px 0 0",
                fontSize: "13px",
                color: "var(--accent)",
                lineHeight: 1.5,
              }}
            >
              {error}
            </p>
          ) : null}
          {saved && !error ? (
            <p role="status" style={{ margin: "8px 0 0", fontSize: "13px", color: "var(--green)" }}>
              Saved. Teacher mode is on.
            </p>
          ) : null}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "12px",
            }}
          >
            <button type="button" onClick={handleSave} style={btnStyle}>
              Save
            </button>
            <button type="button" onClick={handleTurnOff} style={btnStyle}>
              Turn off teacher mode
            </button>
            <button type="button" onClick={handleClear} style={btnStyle}>
              Clear
            </button>
          </div>

          <p
            style={{ margin: "12px 0 0", fontSize: "12px", lineHeight: 1.6, color: "var(--muted)" }}
          >
            On shared computers, use Clear to remove the value when you finish. Students do not see
            this value while teacher mode is off.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function TeacherPanelWithHook() {
  const teacher = useTeacher();
  return <TeacherPanelInner teacher={teacher} />;
}

export default function TeacherPanel({ teacher }: { teacher?: UseTeacherResult } = {}) {
  if (teacher) return <TeacherPanelInner teacher={teacher} />;
  return <TeacherPanelWithHook />;
}
