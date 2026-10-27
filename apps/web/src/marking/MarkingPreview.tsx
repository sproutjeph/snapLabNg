import { useEffect, useMemo, useState } from "react";
import { createG1PageDataUrl, G1_PAGE_ASPECT } from "./g1Page";
import { g1Sheet } from "./g1Sheet";
import { RedInkOverlay } from "./RedInkOverlay";

/**
 * Standalone preview route (`/?marking=1`) for the G1 red-ink marking overlay.
 */
export default function MarkingPreview() {
  const pageImageUrl = useMemo(() => createG1PageDataUrl(), []);
  const [replayKey, setReplayKey] = useState(0);

  useEffect(() => {
    (window as { __SNAPLAB_READY__?: boolean }).__SNAPLAB_READY__ = true;
    return () => {
      delete (window as { __SNAPLAB_READY__?: boolean }).__SNAPLAB_READY__;
    };
  }, []);

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "#0b1120",
        color: "#f8fafc",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "10px 16px",
          borderBottom: "1px solid #1e293b",
          background: "#0f172a",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 700,
              color: "#f8fafc",
            }}
          >
            SnapLab NG · Red-Ink Examiner Marking (G1 Metre Bridge)
          </h1>
          <span
            style={{
              fontSize: "12px",
              color: "#cbd5e1",
            }}
          >
            Tap or press Enter on any red mark to inspect the WAEC rule & fix
          </span>
        </div>

        <button
          type="button"
          onClick={() => setReplayKey((k) => k + 1)}
          style={{
            background: "#0369a1",
            color: "#ffffff",
            border: "1px solid #38bdf8",
            borderRadius: "8px",
            padding: "6px 14px",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Replay
        </button>
      </header>

      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          padding: "12px",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <RedInkOverlay
          key={replayKey}
          pageImageUrl={pageImageUrl}
          pageAspect={G1_PAGE_ASPECT}
          sheet={g1Sheet}
          playing={true}
        />
      </div>
    </main>
  );
}
