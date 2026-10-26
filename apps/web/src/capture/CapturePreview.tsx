import { useEffect, useState } from "react";
import CaptureFlow from "./CaptureFlow";
import type { CaptureResult } from "./types";

const CORNER_NAMES = ["TL", "TR", "BR", "BL"] as const;

export default function CapturePreview() {
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    window.__SNAPLAB_READY__ = true;
  }, []);

  useEffect(() => {
    if (!result) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(result.photo);
    setPhotoUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [result]);

  if (!result) {
    return <CaptureFlow onDone={setResult} />;
  }

  const sizeKb = (result.photo.size / 1024).toFixed(1);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0c0f14",
        color: "#f8fafc",
        padding: "24px",
        overflowY: "auto",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
            gap: "12px",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>Captured Page Result</h1>
            <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#94a3b8" }}>
              Source: <strong>{result.source}</strong> · Dimensions:{" "}
              <strong>
                {result.width} × {result.height} px
              </strong>{" "}
              · JPEG size: <strong>{sizeKb} KB</strong> ({result.photo.size} bytes)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setResult(null)}
            style={{
              minHeight: "42px",
              padding: "8px 18px",
              borderRadius: "8px",
              border: "1px solid #475569",
              backgroundColor: "#1e293b",
              color: "#f8fafc",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Capture Another Page
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
            alignItems: "start",
          }}
        >
          {photoUrl && (
            <div
              style={{
                backgroundColor: "#161b26",
                border: "1px solid #2d3748",
                borderRadius: "12px",
                padding: "12px",
              }}
            >
              <img
                src={photoUrl}
                alt="Compressed exercise-book page"
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  borderRadius: "8px",
                }}
              />
            </div>
          )}

          <div
            style={{
              backgroundColor: "#161b26",
              border: "1px solid #2d3748",
              borderRadius: "12px",
              padding: "16px",
              fontSize: "14px",
            }}
          >
            <h2 style={{ margin: "0 0 10px", fontSize: "15px", fontWeight: 700 }}>
              Four Page Corners (photo pixels)
            </h2>
            <ul style={{ margin: "0 0 18px", paddingLeft: "20px", lineHeight: 1.7 }}>
              {CORNER_NAMES.map((name, idx) => {
                const pt = result.corners[idx] ?? { x: 0, y: 0 };
                return (
                  <li key={name}>
                    <strong>{name}:</strong> ({pt.x}, {pt.y})
                  </li>
                );
              })}
            </ul>

            <h2 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 700 }}>
              Homography Matrix (row-major 3×3)
            </h2>
            <pre
              style={{
                margin: 0,
                padding: "10px",
                borderRadius: "8px",
                backgroundColor: "#0c0f14",
                color: "#cbd5e1",
                fontSize: "12px",
                overflowX: "auto",
              }}
            >
              {[
                result.homography
                  .slice(0, 3)
                  .map((v) => v.toFixed(4))
                  .join(", "),
                result.homography
                  .slice(3, 6)
                  .map((v) => v.toFixed(4))
                  .join(", "),
                result.homography
                  .slice(6, 9)
                  .map((v) => v.toFixed(6))
                  .join(", "),
              ].join("\n")}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
