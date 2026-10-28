import { useEffect, useState } from "react";

export function ContextLossOverlay({
  canvas,
  onReload,
}: {
  canvas: HTMLCanvasElement | null;
  onReload: () => void;
}) {
  const [lost, setLost] = useState(false);

  useEffect(() => {
    setLost(false);
    if (!canvas) return;
    function handleLost(event: Event) {
      event.preventDefault();
      setLost(true);
    }
    function handleRestored() {
      setLost(false);
    }
    canvas.addEventListener("webglcontextlost", handleLost);
    canvas.addEventListener("webglcontextrestored", handleRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", handleLost);
      canvas.removeEventListener("webglcontextrestored", handleRestored);
    };
  }, [canvas]);

  if (!lost) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "14px",
        backgroundColor: "var(--paper)",
        color: "var(--ink)",
        fontFamily: "var(--f-body)",
        textAlign: "center",
        padding: "24px",
        boxSizing: "border-box",
        zIndex: 5,
      }}
    >
      <p style={{ margin: 0, fontSize: "16px", lineHeight: 1.5, maxWidth: "340px" }}>
        The 3D view stopped. Your work is saved.
      </p>
      <button
        type="button"
        onClick={onReload}
        style={{
          padding: "14px 20px",
          minHeight: "var(--tap)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--ink)",
          backgroundColor: "var(--ink)",
          color: "var(--paper)",
          fontFamily: "var(--f-cond)",
          fontSize: "16px",
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        Tap to reload the scene
      </button>
    </div>
  );
}
