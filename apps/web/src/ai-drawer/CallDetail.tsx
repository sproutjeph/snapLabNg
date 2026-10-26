import { useEffect, useMemo, useState } from "react";
import { formatMs, redactForDisplay } from "./timeline";
import type { AiCall, CallStatus } from "./types";

const MAX_DISPLAY_CHARS = 20_000;

export interface CallDetailProps {
  call: AiCall;
  nowMs: number;
  onClose?: () => void;
}

function statusBadgeStyle(status: CallStatus): { bg: string; fg: string; text: string } {
  switch (status) {
    case "ok":
      return { bg: "#14532d", fg: "#bbf7d0", text: "OK" };
    case "running":
      return { bg: "#1e3a8a", fg: "#bfdbfe", text: "RUNNING" };
    case "fallback":
      return { bg: "#78350f", fg: "#fde68a", text: "FALLBACK" };
    case "error":
      return { bg: "#7f1d1d", fg: "#fecaca", text: "ERROR" };
  }
}

interface CollapsibleJsonProps {
  title: string;
  payload: unknown;
  callId: string;
}

function CollapsibleJson({ title, payload, callId }: CollapsibleJsonProps) {
  const [expanded, setExpanded] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void callId;
    setExpanded(false);
    setShowFull(false);
    setCopied(false);
  }, [callId]);

  const formattedJson = useMemo(() => {
    const safe = redactForDisplay(payload);
    if (safe === undefined) return "null";
    try {
      return JSON.stringify(safe, null, 2);
    } catch {
      return String(safe);
    }
  }, [payload]);

  const isCapped = formattedJson.length > MAX_DISPLAY_CHARS;
  const visibleJson =
    isCapped && !showFull ? `${formattedJson.slice(0, MAX_DISPLAY_CHARS)}\n…` : formattedJson;

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(formattedJson);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid #334155",
        borderRadius: "8px",
        backgroundColor: "#0f172a",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          backgroundColor: "#1e293b",
          gap: "8px",
        }}
      >
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
          style={{
            background: "none",
            border: "none",
            color: "#f8fafc",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            padding: "2px 4px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            textAlign: "left",
          }}
        >
          <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
          <span>{title}</span>
          <span style={{ color: "#cbd5e1", fontWeight: 500 }}>
            ({formattedJson.length.toLocaleString("en-US")} chars)
          </span>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          style={{
            padding: "4px 10px",
            borderRadius: "6px",
            border: "1px solid #475569",
            backgroundColor: "#0f172a",
            color: "#f8fafc",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {expanded && (
        <div style={{ padding: "10px" }}>
          <pre
            style={{
              margin: 0,
              fontSize: "11px",
              lineHeight: 1.45,
              color: "#e2e8f0",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "220px",
              overflowY: "auto",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            }}
          >
            {visibleJson}
          </pre>
          {isCapped && !showFull && (
            <button
              type="button"
              onClick={() => setShowFull(true)}
              style={{
                marginTop: "8px",
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid #38bdf8",
                backgroundColor: "#0f172a",
                color: "#7dd3fc",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Show more ({(formattedJson.length - MAX_DISPLAY_CHARS).toLocaleString("en-US")} more
              chars)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function CallDetail({ call, nowMs, onClose }: CallDetailProps) {
  const durationMs = Math.max(0, (call.endMs ?? nowMs) - call.startMs);
  const badge = statusBadgeStyle(call.status);

  return (
    <section
      aria-label={`Call details for ${call.label}`}
      style={{
        marginTop: "12px",
        padding: "12px",
        borderRadius: "10px",
        border: "1px solid #38bdf8",
        backgroundColor: "#141c2b",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#f8fafc" }}>{call.label}</div>
          <div style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "2px" }}>
            Model:{" "}
            <code
              style={{
                color: "#7dd3fc",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              {call.model}
            </code>{" "}
            · Duration: <strong>{formatMs(durationMs)}</strong>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "999px",
              backgroundColor: badge.bg,
              color: badge.fg,
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            {badge.text}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close call details"
              style={{
                padding: "2px 8px",
                borderRadius: "6px",
                border: "1px solid #475569",
                backgroundColor: "#0f172a",
                color: "#f8fafc",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {call.note && (
        <div
          style={{
            padding: "6px 8px",
            borderRadius: "6px",
            backgroundColor: "#422006",
            border: "1px solid #b45309",
            color: "#fde68a",
            fontSize: "12px",
          }}
        >
          {call.note}
        </div>
      )}

      <CollapsibleJson title="Request (redacted)" payload={call.request} callId={call.id} />
      <CollapsibleJson
        title={call.endMs === null ? "Response (streaming…)" : "Response (redacted)"}
        payload={call.response}
        callId={call.id}
      />
    </section>
  );
}

export default CallDetail;
