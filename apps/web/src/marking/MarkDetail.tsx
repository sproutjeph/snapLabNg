import type { MarkItem } from "@snaplab/contracts";
import { useEffect, useRef } from "react";
import { formatHalf } from "./inkPaths";

export interface MarkDetailProps {
  item: MarkItem;
  onClose(): void;
}

const SHEET_STYLE_ID = "snaplab-mark-detail-style";

function ensureStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(SHEET_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = SHEET_STYLE_ID;
  style.textContent = `
    .snaplab-mark-detail {
      position: fixed;
      z-index: 60;
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid #334155;
      box-shadow: 0 18px 40px rgba(2, 6, 23, 0.65);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-sizing: border-box;
      overflow-y: auto;
    }
    @media (max-width: 768px) {
      .snaplab-mark-detail {
        left: 0;
        right: 0;
        bottom: 0;
        max-height: 62vh;
        border-radius: 16px 16px 0 0;
        padding: 14px 16px 20px;
      }
    }
    @media (min-width: 769px) {
      .snaplab-mark-detail {
        right: 20px;
        bottom: 20px;
        width: 380px;
        max-height: calc(100vh - 120px);
        border-radius: 14px;
        padding: 16px 18px;
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Displays the selected mark item's rule code, outcome, mark delta ("−½" or "+1"),
 * English fix, Nigerian Pidgin fix (when present), and WAEC e-Learning report link.
 * Renders as a bottom sheet on narrow viewports so long Pidgin text never overflows.
 */
export function MarkDetail({ item, onClose }: MarkDetailProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    ensureStyles();
  }, []);

  useEffect(() => {
    // Move focus into the dialog when it opens.
    if (closeButtonRef.current) {
      closeButtonRef.current.focus();
    } else {
      dialogRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const isLost = item.outcome === "lost";
  const deltaValue = isLost ? item.marks_available - item.marks_earned : item.marks_earned;
  const deltaBadge = isLost ? `−${formatHalf(deltaValue)}` : `+${formatHalf(deltaValue)}`;
  const written = item.evidence[0]?.text_as_written ?? null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={`Mark detail for ${item.rule}`}
      tabIndex={-1}
      className="snaplab-mark-detail"
      data-testid="mark-detail"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          marginBottom: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
              fontSize: "12px",
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: "6px",
              background: "#1e293b",
              color: "#e2e8f0",
              border: "1px solid #475569",
            }}
          >
            {item.rule}
          </span>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: "6px",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              background: isLost ? "#7f1d1d" : "#14532d",
              color: isLost ? "#fecaca" : "#bbf7d0",
            }}
          >
            {item.outcome}
          </span>
          <span
            style={{
              fontSize: "14px",
              fontWeight: 800,
              padding: "2px 8px",
              borderRadius: "6px",
              background: isLost ? "#dc2626" : "#15803d",
              color: "#ffffff",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {deltaBadge}
          </span>
        </div>

        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          style={{
            background: "#1e293b",
            color: "#f8fafc",
            border: "1px solid #475569",
            borderRadius: "8px",
            padding: "5px 10px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>

      {(written || item.correction) && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            padding: "8px 10px",
            borderRadius: "8px",
            background: "#1e293b",
            marginBottom: "10px",
            fontSize: "13px",
          }}
        >
          {written && (
            <div>
              <span style={{ color: "#94a3b8" }}>Written: </span>
              <code style={{ color: "#f8fafc", fontWeight: 600 }}>{written}</code>
            </div>
          )}
          {item.correction && (
            <div>
              <span style={{ color: "#fca5a5" }}>Expected: </span>
              <code style={{ color: "#fecaca", fontWeight: 700 }}>{item.correction}</code>
            </div>
          )}
        </div>
      )}

      <p
        style={{
          margin: "0 0 8px",
          fontSize: "14px",
          lineHeight: 1.45,
          color: "#f1f5f9",
        }}
      >
        {item.fix_en}
      </p>

      {item.fix_pcm && (
        <div
          style={{
            margin: "0 0 10px",
            padding: "8px 10px",
            borderRadius: "8px",
            background: "rgba(30, 41, 59, 0.75)",
            borderLeft: "3px solid #f59e0b",
            fontSize: "13px",
            lineHeight: 1.45,
            color: "#fde68a",
            overflowWrap: "break-word",
          }}
        >
          <strong style={{ color: "#fbbf24" }}>Pidgin: </strong>
          {item.fix_pcm}
        </div>
      )}

      {item.source && (
        <div style={{ fontSize: "12px", marginTop: "6px" }}>
          <a
            href={item.source.url}
            target="_blank"
            rel="noreferrer"
            style={{
              color: "#7dd3fc",
              textDecoration: "underline",
              fontWeight: 600,
            }}
          >
            {item.source.label} ↗
          </a>
        </div>
      )}
    </div>
  );
}
