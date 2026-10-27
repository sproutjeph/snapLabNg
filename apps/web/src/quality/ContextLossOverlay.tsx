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
        backgroundColor: "rgba(9, 11, 16, 0.92)",
        color: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif",
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
          borderRadius: "10px",
          border: "1px solid #334155",
          backgroundColor: "#1e293b",
          color: "#f8fafc",
          fontSize: "16px",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Tap to reload the scene
      </button>
    </div>
  );
}
