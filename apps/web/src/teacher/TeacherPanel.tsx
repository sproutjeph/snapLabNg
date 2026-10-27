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
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid #64748b",
    backgroundColor: "#263448",
    color: "#f8fafc",
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
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #64748b",
            backgroundColor: "transparent",
            color: "#f8fafc",
            fontSize: "13px",
            fontWeight: 600,
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
              color: "#0f172a",
              backgroundColor: "#facc15",
              borderRadius: "999px",
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
            border: "1px solid #334155",
            borderRadius: "8px",
            backgroundColor: "#0f172a",
            padding: "16px",
            boxSizing: "border-box",
          }}
        >
          <h2 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700, color: "#f8fafc" }}>
            Teacher mode
          </h2>
          <p style={{ margin: "0 0 12px", fontSize: "14px", lineHeight: 1.6, color: "#cbd5e1" }}>
            This value is kept on this device only and is used only to mark accuracy.
          </p>

          <label
            htmlFor="teacher-x-input"
            style={{ display: "block", fontSize: "14px", color: "#f1f5f9" }}
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
                borderRadius: "6px",
                border: "1px solid #475569",
                backgroundColor: "#020617",
                color: "#f8fafc",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </label>

          {error ? (
            <p
              id="teacher-x-error"
              role="alert"
              style={{ margin: "8px 0 0", fontSize: "13px", color: "#fca5a5", lineHeight: 1.5 }}
            >
              {error}
            </p>
          ) : null}
          {saved && !error ? (
            <p role="status" style={{ margin: "8px 0 0", fontSize: "13px", color: "#86efac" }}>
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

          <p style={{ margin: "12px 0 0", fontSize: "12px", lineHeight: 1.6, color: "#94a3b8" }}>
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
