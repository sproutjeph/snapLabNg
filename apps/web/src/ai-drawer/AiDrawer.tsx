import { useEffect, useMemo, useState } from "react";
import { CallDetail } from "./CallDetail";
import { formatMs, LANE_ORDER, laneSpans, summarise } from "./timeline";
import type { AiTrace, CallStatus, LaneId } from "./types";

const PHONE_BREAKPOINT_PX = 768;

const LANE_META: Record<
  LaneId,
  { title: string; defaultModel: string; role: string; accent: string }
> = {
  spark: {
    title: "Spark",
    defaultModel: "muse-spark-1.3",
    role: "Blueprint compile & examiner turns",
    accent: "#38bdf8",
  },
  sam: {
    title: "SAM",
    defaultModel: "sam-3.1",
    role: "Object & graph outlines",
    accent: "#22c55e",
  },
  wonder: {
    title: "Wonder",
    defaultModel: "muse-wonder-1.0",
    role: "Handwritten table, graph & precautions",
    accent: "#a855f7",
  },
  voice: {
    title: "Voice",
    defaultModel: "muse-voice-transcribe-1.0",
    role: "Live student speech captions",
    accent: "#f59e0b",
  },
  engine: {
    title: "Engine",
    defaultModel: "engine",
    role: "Deterministic physics & WAEC rules",
    accent: "#14b8a6",
  },
};

function barStyleForStatus(status: CallStatus, laneAccent: string): { bg: string; border: string } {
  switch (status) {
    case "ok":
      return { bg: `${laneAccent}52`, border: laneAccent };
    case "running":
      return { bg: "rgba(37, 99, 235, 0.58)", border: "#60a5fa" };
    case "fallback":
      return { bg: "rgba(217, 119, 6, 0.58)", border: "#fbbf24" };
    case "error":
      return { bg: "rgba(220, 38, 38, 0.58)", border: "#f87171" };
  }
}

export interface AiDrawerProps {
  trace: AiTrace;
  nowMs: number;
  open: boolean;
  onClose(): void;
}

export default function AiDrawer({ trace, nowMs, open, onClose }: AiDrawerProps) {
  const [isPhone, setIsPhone] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth <= PHONE_BREAKPOINT_PX : false,
  );
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  useEffect(() => {
    const onResize = () => {
      setIsPhone(window.innerWidth <= PHONE_BREAKPOINT_PX);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const spans = useMemo(() => laneSpans(trace, nowMs), [trace, nowMs]);
  const summary = useMemo(() => summarise(trace, nowMs), [trace, nowMs]);

  const spansByLane = useMemo(() => {
    const grouped: Record<LaneId, typeof spans> = {
      spark: [],
      sam: [],
      wonder: [],
      voice: [],
      engine: [],
    };
    for (const span of spans) {
      grouped[span.call.lane].push(span);
    }
    return grouped;
  }, [spans]);

  const selectedCall = useMemo(
    () => trace.calls.find((c) => c.id === selectedCallId) ?? null,
    [trace.calls, selectedCallId],
  );

  if (!open) {
    return null;
  }

  return (
    <aside
      aria-label="Show the AI pipeline drawer"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      style={
        isPhone
          ? {
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              height: "70vh",
              maxHeight: "70vh",
              zIndex: 70,
              backgroundColor: "#0b111e",
              color: "#f8fafc",
              borderTop: "2px solid #334155",
              borderTopLeftRadius: "16px",
              borderTopRightRadius: "16px",
              boxShadow: "0 -12px 32px rgba(0, 0, 0, 0.65)",
              display: "flex",
              flexDirection: "column",
              fontFamily: "system-ui, -apple-system, sans-serif",
              boxSizing: "border-box",
            }
          : {
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "420px",
              maxWidth: "100vw",
              zIndex: 70,
              backgroundColor: "#0b111e",
              color: "#f8fafc",
              borderLeft: "1px solid #334155",
              boxShadow: "-12px 0 32px rgba(0, 0, 0, 0.55)",
              display: "flex",
              flexDirection: "column",
              fontFamily: "system-ui, -apple-system, sans-serif",
              boxSizing: "border-box",
            }
      }
    >
      {/* Phone bottom-sheet drag handle */}
      {isPhone && (
        <div
          style={{
            paddingTop: "8px",
            paddingBottom: "4px",
            display: "flex",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: "42px",
              height: "5px",
              borderRadius: "999px",
              backgroundColor: "#64748b",
            }}
          />
        </div>
      )}

      {/* Header */}
      <header
        style={{
          padding: isPhone ? "8px 16px 10px" : "12px 152px 12px 16px",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "#f8fafc" }}>
            Show the AI · Live Pipeline
          </div>
          <div style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "2px" }}>
            {summary.totalCalls} calls · Clock {formatMs(Math.max(0, nowMs - trace.t0Ms))}
            {summary.longestCall ? ` · Longest: ${formatMs(summary.longestCall.durationMs)}` : ""}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close Show the AI drawer"
          style={{
            minHeight: "36px",
            padding: "6px 12px",
            borderRadius: "8px",
            border: "1px solid #475569",
            backgroundColor: "#1e293b",
            color: "#f8fafc",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </header>

      {/* Scrollable body */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {/* Motto banner */}
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "10px",
            backgroundColor: "#131c2e",
            border: "1px solid #38bdf8",
            color: "#f8fafc",
            fontSize: "13px",
            fontWeight: 700,
            textAlign: "center",
            letterSpacing: "0.01em",
          }}
        >
          The AI reads and judges. The engine decides.
        </div>

        {/* Five fixed-order lanes */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {LANE_ORDER.map((laneId) => {
            const meta = LANE_META[laneId];
            const laneCalls = spansByLane[laneId];
            const laneStat = summary.byLane[laneId];
            const modelName = laneCalls[0]?.call.model ?? meta.defaultModel;

            return (
              <section
                key={laneId}
                aria-label={`${meta.title} lane`}
                style={{
                  padding: "9px 10px",
                  borderRadius: "10px",
                  backgroundColor: "#141d2f",
                  border: "1px solid #263248",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    marginBottom: "6px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "999px",
                        backgroundColor: meta.accent,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#f8fafc" }}>
                      {meta.title}
                    </span>
                    <code
                      style={{
                        fontSize: "11px",
                        color: "#93c5fd",
                        backgroundColor: "#0b111e",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      }}
                    >
                      {modelName}
                    </code>
                  </div>

                  <span style={{ fontSize: "11px", color: "#cbd5e1", flexShrink: 0 }}>
                    {laneStat.count} {laneStat.count === 1 ? "call" : "calls"} ·{" "}
                    {formatMs(laneStat.totalMs)}
                  </span>
                </div>

                {laneCalls.length === 0 ? (
                  <div
                    style={{
                      height: "20px",
                      borderRadius: "6px",
                      backgroundColor: "#0b111e",
                      display: "flex",
                      alignItems: "center",
                      padding: "0 8px",
                      fontSize: "11px",
                      color: "#94a3b8",
                    }}
                  >
                    {meta.role} — idle
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    {laneCalls.map((span) => {
                      const { call, leftPct, widthPct, durationMs } = span;
                      const isSelected = selectedCallId === call.id;
                      const clampedLeft = Math.max(0, Math.min(98.5, leftPct));
                      const visibleWidth = Math.max(1.5, Math.min(100 - clampedLeft, widthPct));
                      const barColors = barStyleForStatus(call.status, meta.accent);
                      return (
                        <button
                          key={call.id}
                          type="button"
                          onClick={() =>
                            setSelectedCallId((prev) => (prev === call.id ? null : call.id))
                          }
                          aria-label={`${call.label} (${call.model}, ${formatMs(durationMs)}, status ${call.status})`}
                          style={{
                            position: "relative",
                            width: "100%",
                            height: "26px",
                            padding: "0 8px",
                            borderRadius: "6px",
                            border: isSelected ? "1.5px solid #f8fafc" : "1px solid #1e293b",
                            backgroundColor: "#0b111e",
                            color: "#f8fafc",
                            fontSize: "11px",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                            cursor: "pointer",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            boxSizing: "border-box",
                            textAlign: "left",
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              position: "absolute",
                              top: "2px",
                              bottom: "2px",
                              left: `${clampedLeft}%`,
                              width: `${visibleWidth}%`,
                              minWidth: "6px",
                              borderRadius: "4px",
                              backgroundColor: barColors.bg,
                              border: `1.5px solid ${barColors.border}`,
                              boxSizing: "border-box",
                              pointerEvents: "none",
                            }}
                          />
                          <span
                            style={{
                              position: "relative",
                              zIndex: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              color: "#f8fafc",
                              textShadow: "0 1px 2px rgba(0, 0, 0, 0.9)",
                            }}
                          >
                            {call.label}
                          </span>
                          <span
                            style={{
                              position: "relative",
                              zIndex: 1,
                              fontSize: "11px",
                              fontWeight: 700,
                              flexShrink: 0,
                              color: call.status === "fallback" ? "#fde68a" : "#e2e8f0",
                              textShadow: "0 1px 2px rgba(0, 0, 0, 0.9)",
                            }}
                          >
                            {formatMs(durationMs)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Flags list */}
        <section
          aria-label="Pipeline flags and assumptions"
          style={{
            padding: "9px 10px",
            borderRadius: "10px",
            backgroundColor: "#141d2f",
            border: "1px solid #263248",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#f8fafc",
              marginBottom: "6px",
            }}
          >
            Flags & Assumptions ({trace.flags.length})
          </div>
          {trace.flags.length === 0 ? (
            <div style={{ fontSize: "12px", color: "#cbd5e1" }}>No flags raised on this page.</div>
          ) : (
            <ul
              style={{
                margin: 0,
                paddingLeft: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              {trace.flags.map((flag) => (
                <li
                  key={`${flag.lane}:${flag.message}`}
                  style={{ fontSize: "12px", color: "#fde68a", lineHeight: 1.4 }}
                >
                  <strong style={{ color: "#f8fafc", textTransform: "uppercase" }}>
                    [{flag.lane}]
                  </strong>{" "}
                  {flag.message}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Call detail viewer when a bar is tapped */}
        {selectedCall ? (
          <CallDetail call={selectedCall} nowMs={nowMs} onClose={() => setSelectedCallId(null)} />
        ) : (
          <div
            style={{
              fontSize: "12px",
              color: "#cbd5e1",
              textAlign: "center",
              padding: "4px 0",
            }}
          >
            Tap or press Enter on any timing bar to inspect its redacted request & response JSON.
          </div>
        )}
      </div>
    </aside>
  );
}
