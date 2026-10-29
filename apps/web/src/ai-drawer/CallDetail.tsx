import { useEffect, useMemo, useRef, useState } from "react";
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
      return { bg: "var(--card)", fg: "var(--green)", text: "OK" };
    case "running":
      return { bg: "var(--card)", fg: "var(--ink)", text: "RUNNING" };
    case "fallback":
      return { bg: "var(--card)", fg: "var(--ink-2)", text: "FALLBACK" };
    case "error":
      return { bg: "var(--card)", fg: "var(--ink-2)", text: "ERROR" };
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
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    void callId;
    setExpanded(false);
    setShowFull(false);
    setCopyState("idle");
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
    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== "function"
    ) {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 1500);
      return;
    }
    try {
      await navigator.clipboard.writeText(formattedJson);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 1500);
    }
  };

  return (
    <div
      style={{
        border: "var(--rule)",
        borderRadius: "var(--radius)",
        backgroundColor: "var(--paper)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          backgroundColor: "var(--paper-2)",
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
            color: "var(--ink)",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            minHeight: "var(--tap)",
            padding: "2px 4px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            textAlign: "left",
          }}
        >
          <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
          <span>{title}</span>
          <span style={{ color: "var(--muted)", fontWeight: 500 }}>
            ({formattedJson.length.toLocaleString("en-US")} chars)
          </span>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          style={{
            minHeight: "var(--tap)",
            padding: "4px 10px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--ink-2)",
            backgroundColor: "var(--paper)",
            color: copyState === "failed" ? "var(--ink-2)" : "var(--ink)",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy"}
        </button>
      </div>

      {expanded && (
        <div style={{ padding: "10px" }}>
          <pre
            style={{
              margin: 0,
              fontSize: "11px",
              lineHeight: 1.45,
              color: "var(--ink-2)",
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
                minHeight: "var(--tap)",
                padding: "4px 10px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--ink-2)",
                backgroundColor: "var(--paper)",
                color: "var(--ink-2)",
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
  const sectionRef = useRef<HTMLElement>(null);
  const durationMs = Math.max(0, (call.endMs ?? nowMs) - call.startMs);
  const badge = statusBadgeStyle(call.status);

  useEffect(() => {
    void call.id;
    sectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [call.id]);

  return (
    <section
      ref={sectionRef}
      aria-label={`Call details for ${call.label}`}
      style={{
        marginTop: "12px",
        padding: "12px",
        borderRadius: "var(--radius)",
        border: "1px solid var(--ink-2)",
        backgroundColor: "var(--card)",
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
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{call.label}</div>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
            Model:{" "}
            <code
              style={{
                color: "var(--ink-2)",
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
                minHeight: "var(--tap)",
                minWidth: "var(--tap)",
                padding: "2px 8px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--ink-2)",
                backgroundColor: "var(--paper)",
                color: "var(--ink)",
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
            backgroundColor: "var(--paper-2)",
            border: "1px solid var(--accent)",
            color: "var(--ink-2)",
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
