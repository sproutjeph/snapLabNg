import { useEffect, useMemo, useState } from "react";
import { createG1PageDataUrl, G1_PAGE_ASPECT } from "./g1Page";
import { g1Sheet } from "./g1Readings";
import { RedInkOverlay } from "./RedInkOverlay";

/**
 * Standalone preview route (`/?marking=1`) for the G1 red-ink marking overlay.
 */
export default function MarkingPreview() {
  const pageImageUrl = useMemo(() => createG1PageDataUrl(), []);
  const [replayKey, setReplayKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      (window as { __SNAPLAB_READY__?: boolean }).__SNAPLAB_READY__ = true;
    }, 4500);
    return () => {
      clearTimeout(timer);
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
        background: "var(--paper)",
        color: "var(--ink)",
        fontFamily: "var(--f-body)",
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
          borderBottom: "var(--rule)",
          background: "var(--paper)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 700,
              color: "var(--ink)",
            }}
          >
            SnapLab NG · Red-Ink Examiner Marking (G1 Metre Bridge)
          </h1>
          <span
            style={{
              fontSize: "12px",
              color: "var(--muted)",
            }}
          >
            Tap or press Enter on any red mark to inspect the WAEC rule & fix
          </span>
        </div>

        <button
          type="button"
          onClick={() => setReplayKey((k) => k + 1)}
          style={{
            background: "var(--ink)",
            color: "var(--paper)",
            border: "1px solid var(--ink)",
            borderRadius: "var(--radius)",
            padding: "6px 14px",
            fontSize: "13px",
            fontFamily: "var(--f-cond)",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            minHeight: "var(--tap)",
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
