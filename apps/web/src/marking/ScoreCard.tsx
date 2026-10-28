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
        gap: "10px",
        padding: "8px 12px",
        maxWidth: "350px",
        boxSizing: "border-box",
        borderRadius: "var(--radius)",
        background: "var(--card)",
        border: "1.5px solid var(--red-ink)",
        boxShadow: "none",
        color: "var(--ink)",
        fontFamily: "var(--f-body)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <span
          style={{
            fontSize: "10.5px",
            fontWeight: 700,
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            color: "var(--red-ink)",
            lineHeight: 1.25,
          }}
        >
          Examiner-style marking · based on WAEC reports
        </span>
        <span
          style={{
            fontSize: "18px",
            fontWeight: 800,
            color: "var(--red-ink)",
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
            color: "var(--muted)",
            paddingLeft: "10px",
            borderLeft: "var(--rule)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {completedCount}/{totalCount} items
        </span>
      )}
    </output>
  );
}
