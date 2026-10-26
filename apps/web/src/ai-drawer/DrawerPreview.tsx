import { useEffect, useMemo, useState } from "react";
import AiDrawer from "./AiDrawer";
import { MOCK_TRACE_END_MS, mockTrace } from "./mockTrace";
import { ShowAiToggle } from "./ShowAiToggle";
import { formatMs } from "./timeline";
import type { AiCall, AiTrace } from "./types";

function projectTraceAt(trace: AiTrace, nowMs: number): AiTrace {
  const projectedCalls: AiCall[] = [];
  for (const call of trace.calls) {
    if (call.startMs > nowMs) {
      continue;
    }
    if (call.endMs === null || nowMs < call.endMs) {
      projectedCalls.push({
        ...call,
        endMs: null,
        status: "running",
        response: null,
      });
    } else {
      projectedCalls.push(call);
    }
  }
  return {
    t0Ms: trace.t0Ms,
    calls: projectedCalls,
    flags: trace.flags,
  };
}

export default function DrawerPreview() {
  const [open, setOpen] = useState(true);
  const [nowMs, setNowMs] = useState(0);
  const [replayCount, setReplayCount] = useState(0);

  useEffect(() => {
    window.__SNAPLAB_READY__ = true;
  }, []);

  // Replay mockTrace against a clock starting at 0, updating nowMs at most 10 times/second
  useEffect(() => {
    void replayCount;
    setNowMs(0);
    const startPerf = performance.now();
    let lastTick = -100;
    let rafId = 0;

    const step = (nowPerf: number) => {
      const elapsed = Math.max(0, nowPerf - startPerf);
      if (elapsed - lastTick >= 100 || elapsed >= MOCK_TRACE_END_MS) {
        lastTick = elapsed;
        setNowMs(Math.min(Math.round(elapsed), MOCK_TRACE_END_MS));
      }
      if (elapsed < MOCK_TRACE_END_MS) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [replayCount]);

  const activeTrace = useMemo(() => projectTraceAt(mockTrace, nowMs), [nowMs]);
  const anyRunning = useMemo(
    () => activeTrace.calls.some((c) => c.status === "running" || c.endMs === null),
    [activeTrace],
  );

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#080c14",
        color: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <ShowAiToggle running={anyRunning} open={open} onClick={() => setOpen((prev) => !prev)} />

      {/* Preview stage controls on the left so they remain visible alongside the drawer */}
      <div
        style={{
          padding: "20px",
          maxWidth: "520px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              paddingRight: "144px",
              fontSize: "19px",
              fontWeight: 700,
              color: "#f8fafc",
              lineHeight: 1.3,
            }}
          >
            SnapLab NG · &ldquo;Show the AI&rdquo; Drawer Preview
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#cbd5e1", lineHeight: 1.5 }}>
            Replaying the metre bridge pipeline trace ({formatMs(nowMs)} /{" "}
            {formatMs(MOCK_TRACE_END_MS)}). Use <strong>Replay</strong> to restart from 0 ms or{" "}
            <strong>Show the AI</strong> at the top right to toggle the drawer.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setReplayCount((c) => c + 1)}
            style={{
              minHeight: "40px",
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid #38bdf8",
              backgroundColor: "#0369a1",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Replay
          </button>
        </div>
      </div>

      <AiDrawer trace={activeTrace} nowMs={nowMs} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
