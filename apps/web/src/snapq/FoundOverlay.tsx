import type { ApparatusKind, Box, QuestionRead } from "@snaplab/contracts";
import "./foundOverlay.css";

// FoundOverlay (gemini/found-overlay, docs/plans/snap-question.md, "Gemini: found overlay").
// Pure display component showing the student's diagram photo at its aspect ratio with
// ink-style outline boxes and tags that draw in for each identified apparatus part.

export interface FoundOverlayProps {
  /** Object URL of the photo the diagram is on. */
  photo: string;
  /** The parts Spark found on that photo, in the order found; grows as they arrive. */
  parts: QuestionRead["diagram"]["parts"];
  /** SAM's box per part index, when SAM found one; otherwise the part's own Spark box is drawn. */
  outlines: ReadonlyMap<number, Box>;
  /** The part to emphasise (index into `parts`), or null. */
  highlight: number | null;
}

export function kindToName(kind: ApparatusKind | string): string {
  switch (kind) {
    case "cells":
      return "cells";
    case "key":
      return "key";
    case "ammeter":
      return "ammeter";
    case "voltmeter":
      return "voltmeter";
    case "resistance_box":
      return "resistance box";
    case "wire_xy":
      return "wire XY";
    case "rheostat":
      return "rheostat";
    case "metre_rule":
      return "metre rule";
    case "connecting_wires":
      return "connecting wires";
    case "galvanometer":
      return "galvanometer";
    default:
      return "part";
  }
}

export function formatTag(label: string | null | undefined, kind: ApparatusKind | string): string {
  const name = kindToName(kind);
  const trimmed = label?.trim();
  return trimmed ? `${trimmed} · ${name}` : name;
}

function roundPct(n: number): string {
  const rounded = Number(n.toFixed(4));
  return `${rounded}%`;
}

export function FoundOverlay({ photo, parts, outlines, highlight }: FoundOverlayProps) {
  const list = parts ?? [];

  return (
    <div className="fo-root" data-testid="found-overlay">
      <img className="fo-photo" src={photo} alt="Your diagram" data-testid="found-photo" />
      <div className="fo-overlay" aria-hidden="true">
        {list.map((part, index) => {
          const outline = outlines?.get(index);
          const box = outline ?? part.box;
          if (!box) return null;

          const hasOutline = outlines ? outlines.has(index) : false;
          const x0 = Math.min(box.x0, box.x1);
          const y0 = Math.min(box.y0, box.y1);
          const width = Math.max(0, Math.abs(box.x1 - box.x0));
          const height = Math.max(0, Math.abs(box.y1 - box.y0));

          const topPct = y0 * 100;
          const isNearTop = topPct < 6;
          const isHighlighted = highlight !== null && highlight === index;
          const isDimmed = highlight !== null && highlight !== index;

          const classNames = ["fo-part"];
          if (isHighlighted) {
            classNames.push("fo-highlight", "is-highlighted", "highlight");
          } else if (isDimmed) {
            classNames.push("fo-dim", "is-dimmed", "dimmed");
          }

          const tag = formatTag(part.label_as_printed, part.kind);
          const partKey = `${part.kind}:${part.label_as_printed ?? ""}:${box.x0}:${box.y0}:${box.x1}:${box.y1}`;

          return (
            <div
              key={partKey}
              className={classNames.join(" ")}
              style={{
                left: roundPct(x0 * 100),
                top: roundPct(y0 * 100),
                width: roundPct(width * 100),
                height: roundPct(height * 100),
              }}
              data-testid={`found-box-${index}`}
              data-part-index={index}
              data-part-kind={part.kind}
              data-box-source={hasOutline ? "outline" : "spark"}
              data-highlighted={isHighlighted ? "1" : undefined}
              data-dimmed={isDimmed ? "1" : undefined}
              data-edge-top={isNearTop ? "1" : undefined}
            >
              <svg
                className="fo-box-svg"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <rect className="fo-box-rect" x="0.5" y="0.5" width="99" height="99" rx="2" />
              </svg>
              <span className="fo-tag" data-testid={`found-tag-${index}`}>
                {tag}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default FoundOverlay;
