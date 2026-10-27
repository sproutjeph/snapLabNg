import { useEffect } from "react";
import TeacherNotes from "./TeacherNotes";
import TeacherPanel from "./TeacherPanel";
import { useTeacher } from "./useTeacher";

/**
 * Standalone preview route (`/?teacher=1`) for teacher mode.
 * The stored value is printed only while teacher mode is on.
 */
export default function TeacherPreview() {
  const teacher = useTeacher();

  useEffect(() => {
    window.__SNAPLAB_READY__ = true;
  }, []);

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
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>Teacher mode preview</h1>
        <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#a8b3c2", lineHeight: 1.5 }}>
          Enter the true value of X so accuracy can be marked. The value stays in this browser and
          is hidden while teacher mode is off.
        </p>

        <div style={{ marginTop: "18px" }}>
          <TeacherPanel teacher={teacher} />
        </div>

        <p
          role="status"
          style={{
            margin: "16px 0 0",
            fontSize: "14px",
            lineHeight: 1.6,
            color: "#cbd5e1",
            border: "1px solid #334155",
            borderRadius: "8px",
            padding: "10px 12px",
            backgroundColor: "#0f172a",
            boxSizing: "border-box",
          }}
        >
          {teacher.enabled && teacher.xOhm !== null
            ? `xOhm: ${teacher.xOhm} Ω`
            : "xOhm: — (teacher mode off)"}
        </p>

        <div style={{ marginTop: "16px" }}>
          <TeacherNotes />
        </div>
      </div>
    </div>
  );
}
