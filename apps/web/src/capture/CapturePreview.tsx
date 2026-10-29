import { useEffect, useState } from "react";
import { RectifyPreview } from "../rectify/RectifyPreview";
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
        backgroundColor: "var(--paper)",
        color: "var(--ink)",
        padding: "24px",
        overflowY: "auto",
        fontFamily: "var(--f-body)",
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
            <p style={{ margin: "4px 0 0", fontSize: "14px", color: "var(--muted)" }}>
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
              minHeight: "var(--tap)",
              padding: "8px 18px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--ink-2)",
              backgroundColor: "var(--card)",
              color: "var(--ink)",
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
                backgroundColor: "var(--card)",
                border: "var(--rule)",
                borderRadius: "var(--radius)",
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
                  borderRadius: "var(--radius)",
                }}
              />
            </div>
          )}

          <div
            style={{
              backgroundColor: "var(--card)",
              border: "var(--rule)",
              borderRadius: "var(--radius)",
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
                borderRadius: "var(--radius)",
                backgroundColor: "var(--paper-2)",
                color: "var(--ink-2)",
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

        <RectifyPreview result={result} />
      </div>
    </div>
  );
}
