import { formatHalf } from "./inkPaths";

export interface ScoreCardProps {
  questionLabel: string;
  earned: number;
  available: number;
  completedCount?: number;
  totalCount?: number;
}

/**
 * Displays the WAEC question label and the running red-ink score in half-marks
 * (e.g. "Question 3: 15½ / 21"), using the Unicode `½` character.
 */
export function ScoreCard({
  questionLabel,
  earned,
  available,
  completedCount,
  totalCount,
}: ScoreCardProps) {
  const earnedText = formatHalf(earned);
  const availableText = formatHalf(available);

  return (
    <output
      aria-live="polite"
      data-testid="score-card"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "12px",
        padding: "8px 14px",
        borderRadius: "10px",
        background: "#fffdf9",
        border: "2px solid #dc2626",
        boxShadow: "0 4px 14px rgba(15, 23, 42, 0.25)",
        color: "#0f172a",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#991b1b",
          }}
        >
          Examiner-style marking · based on WAEC reports
        </span>
        <span
          style={{
            fontSize: "18px",
            fontWeight: 800,
            color: "#b91c1c",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {questionLabel}: {earnedText} / {availableText}
        </span>
      </div>
      {typeof completedCount === "number" && typeof totalCount === "number" && (
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "#475569",
            paddingLeft: "10px",
            borderLeft: "1px solid #fecaca",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {completedCount}/{totalCount} items
        </span>
      )}
    </output>
  );
}
