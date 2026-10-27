import type { Annotation, Box, MarkItem, MarkSheet } from "@snaplab/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import { boxPath, circlePath, formatHalf, strikePath, tickPath, underlinePath } from "./inkPaths";
import { MarkDetail } from "./MarkDetail";
import { ScoreCard } from "./ScoreCard";

export interface RedInkOverlayProps {
  pageImageUrl: string;
  pageAspect: number;
  sheet: MarkSheet;
  playing: boolean;
  onItemOpen?(id: string): void;
}

const OVERLAY_STYLE_ID = "snaplab-red-ink-overlay-style";
const ITEM_DRAW_MS = 400;
const ITEM_STAGGER_MS = 70;

function ensureOverlayStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(OVERLAY_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = OVERLAY_STYLE_ID;
  style.textContent = `
    @keyframes snaplab-ink-draw {
      from {
        stroke-dashoffset: 1;
      }
      to {
        stroke-dashoffset: 0;
      }
    }
    @keyframes snaplab-ink-fade {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    .snaplab-ink-item {
      cursor: pointer;
      outline: none;
    }
    .snaplab-ink-item:focus-visible .snaplab-ink-focus-ring {
      opacity: 1;
    }
    @media (prefers-reduced-motion: reduce) {
      .snaplab-ink-stroke,
      .snaplab-ink-label {
        animation: none !important;
        stroke-dashoffset: 0 !important;
        opacity: 1 !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function itemTopY(item: MarkItem): number {
  let minY = Number.POSITIVE_INFINITY;
  for (const ev of item.evidence) {
    if (ev.box && ev.box.y0 < minY) {
      minY = ev.box.y0;
    }
  }
  return Number.isFinite(minY) ? minY : 1;
}

function itemLeftX(item: MarkItem): number {
  let minX = Number.POSITIVE_INFINITY;
  for (const ev of item.evidence) {
    if (ev.box && ev.box.x0 < minX) {
      minX = ev.box.x0;
    }
  }
  return Number.isFinite(minX) ? minX : 1;
}

function buildAnnotationPath(kind: Annotation, box: Box, aspect: number, seed: number): string {
  switch (kind) {
    case "circle":
      return circlePath(box, aspect, seed);
    case "underline":
      return underlinePath(box, aspect, seed);
    case "strike":
      return strikePath(box, aspect, seed);
    case "box":
      return boxPath(box, aspect, seed);
    case "tick":
      return tickPath(box, aspect, seed);
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * 2D red-ink examiner marking overlay over the student's flattened page image.
 * Draws hand-inked annotations in top-to-bottom order, counts up the score in half-marks,
 * and opens `MarkDetail` when any annotation is clicked or activated via keyboard.
 */
export function RedInkOverlay({
  pageImageUrl,
  pageAspect,
  sheet,
  playing,
  onItemOpen,
}: RedInkOverlayProps) {
  const safeAspect = Number.isFinite(pageAspect) && pageAspect > 0 ? pageAspect : 4 / 3;
  const reducedMotion = usePrefersReducedMotion();
  const shouldAnimate = playing && !reducedMotion;

  useEffect(() => {
    ensureOverlayStyles();
  }, []);

  // Sort items top-to-bottom of the page, interleaving lost and earned items as they appear.
  const sortedItems = useMemo(() => {
    return [...sheet.items].sort((a, b) => {
      const dy = itemTopY(a) - itemTopY(b);
      if (Math.abs(dy) > 1e-4) return dy;
      return itemLeftX(a) - itemLeftX(b);
    });
  }, [sheet.items]);

  const [completedCount, setCompletedCount] = useState<number>(() =>
    shouldAnimate ? 0 : sortedItems.length,
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, SVGGElement>>(new Map());

  useEffect(() => {
    if (!shouldAnimate) {
      setCompletedCount(sortedItems.length);
      return;
    }
    setCompletedCount(0);
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    sortedItems.forEach((_, idx) => {
      const finishMs = idx * ITEM_STAGGER_MS + ITEM_DRAW_MS;
      const timer = setTimeout(() => {
        setCompletedCount((prev) => Math.max(prev, idx + 1));
      }, finishMs);
      timers.push(timer);
    });
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [shouldAnimate, sortedItems]);

  const earnedSoFar = useMemo(() => {
    if (completedCount >= sortedItems.length) {
      return sheet.earned;
    }
    let sum = 0;
    for (let i = 0; i < completedCount && i < sortedItems.length; i++) {
      const item = sortedItems[i];
      if (item) {
        sum += item.marks_earned;
      }
    }
    return Math.round(sum * 2) / 2;
  }, [completedCount, sortedItems, sheet.earned]);

  const selectedItem = useMemo(
    () => sortedItems.find((item) => item.id === selectedItemId) ?? null,
    [sortedItems, selectedItemId],
  );

  const handleActivateItem = (item: MarkItem) => {
    setSelectedItemId(item.id);
    onItemOpen?.(item.id);
  };

  const handleCloseDetail = () => {
    const prevId = selectedItemId;
    setSelectedItemId(null);
    if (prevId) {
      const node = itemRefs.current.get(prevId);
      node?.focus();
    }
  };

  const handFont =
    '"Bradley Hand", "Segoe Print", "Comic Sans MS", "Chalkboard SE", cursive, sans-serif';

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
      }}
    >
      {/* Floating ScoreCard pinned at top-right */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "12px",
          zIndex: 30,
        }}
      >
        <ScoreCard
          questionLabel={sheet.question_label}
          earned={earnedSoFar}
          available={sheet.available}
          completedCount={completedCount}
          totalCount={sortedItems.length}
        />
      </div>

      {/* Aspect-locked page box holding the image and the 0..1 x 0..aspect SVG overlay */}
      <div
        style={{
          position: "relative",
          aspectRatio: `1 / ${safeAspect}`,
          maxHeight: "100%",
          maxWidth: "100%",
          boxShadow: "0 12px 32px rgba(2, 6, 23, 0.55)",
          borderRadius: "6px",
          overflow: "hidden",
          background: "#faf6ec",
        }}
      >
        <img
          src={pageImageUrl}
          alt={`${sheet.question_label} marked exercise-book page`}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "fill",
          }}
        />

        <svg
          viewBox={`0 0 1 ${safeAspect}`}
          preserveAspectRatio="none"
          aria-label={`Examiner red-ink annotations for ${sheet.question_label}`}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "visible",
          }}
        >
          {/* Setup issues (circled in red with no mark penalty) */}
          {sheet.setup_issues.map((issue, issueIdx) => {
            if (!issue.box) return null;
            const seed = hashSeed(`setup:${issue.description}:${issueIdx}`);
            const d = circlePath(issue.box, safeAspect, seed);
            const issueW = issue.box.x1 - issue.box.x0;
            const labelX = Math.min(issue.box.x1 + 0.11 * issueW + 0.01, 0.72);
            const labelY = ((issue.box.y0 + issue.box.y1) / 2) * safeAspect;
            return (
              <g key={`setup-${issue.description}`}>
                <path
                  d={d}
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth={0.0028}
                  strokeDasharray="0.008 0.005"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <text
                  x={labelX}
                  y={labelY}
                  fill="#b91c1c"
                  fontSize={0.0165}
                  fontWeight={700}
                  fontFamily={handFont}
                  dominantBaseline="middle"
                >
                  {issue.description}
                </text>
              </g>
            );
          })}

          {/* Scheme items interleaved top-to-bottom */}
          {sortedItems.map((item, itemIdx) => {
            const isLost = item.outcome === "lost";
            // Lost items use their specified annotation; earned items get a red tick only.
            const effectiveAnnotation: Annotation = isLost ? item.annotation : "tick";
            const delayMs = itemIdx * ITEM_STAGGER_MS;
            const lostMarks = item.marks_available - item.marks_earned;
            const markText = isLost
              ? `−${formatHalf(lostMarks)}`
              : `+${formatHalf(item.marks_earned)}`;
            const isSelected = selectedItemId === item.id;
            const firstBox = item.evidence.find((ev) => ev.box !== null)?.box ?? null;

            return (
              // biome-ignore lint/a11y/useSemanticElements: SVG <g> requires role="button" + tabIndex for keyboard-focusable vector annotations
              <g
                key={item.id}
                ref={(node) => {
                  if (node) {
                    itemRefs.current.set(item.id, node);
                  } else {
                    itemRefs.current.delete(item.id);
                  }
                }}
                className="snaplab-ink-item"
                role="button"
                tabIndex={0}
                aria-label={`${item.rule} (${item.outcome} ${markText})${
                  item.correction ? ` — ${item.correction}` : ""
                }`}
                aria-pressed={isSelected}
                data-item-id={item.id}
                data-outcome={item.outcome}
                onClick={() => handleActivateItem(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleActivateItem(item);
                  }
                }}
              >
                {item.evidence.map((ev, evIdx) => {
                  if (!ev.box) return null;
                  const box = ev.box;
                  const seed = hashSeed(`${item.id}:${evIdx}`);
                  const d = buildAnnotationPath(effectiveAnnotation, box, safeAspect, seed);
                  const strokeStyle = shouldAnimate
                    ? {
                        strokeDasharray: 1,
                        strokeDashoffset: 1,
                        animation: `snaplab-ink-draw ${ITEM_DRAW_MS}ms ease-out ${delayMs}ms forwards`,
                      }
                    : {
                        strokeDashoffset: 0,
                      };

                  const evKey = `${item.id}-${box.x0}-${box.y0}-${box.x1}-${box.y1}`;
                  return (
                    <g key={evKey}>
                      {/* Transparent hit target over the evidence box for easy touch/click */}
                      <rect
                        x={box.x0}
                        y={box.y0 * safeAspect}
                        width={Math.max(box.x1 - box.x0, 0.02)}
                        height={Math.max((box.y1 - box.y0) * safeAspect, 0.02)}
                        fill="transparent"
                      />

                      {/* Keyboard/selection focus halo */}
                      <rect
                        className="snaplab-ink-focus-ring"
                        x={box.x0 - 0.008}
                        y={box.y0 * safeAspect - 0.008}
                        width={Math.max(box.x1 - box.x0, 0.02) + 0.016}
                        height={Math.max((box.y1 - box.y0) * safeAspect, 0.02) + 0.016}
                        rx={0.006}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth={0.0025}
                        opacity={isSelected ? 0.9 : 0}
                      />

                      {/* Red hand-inked stroke */}
                      <path
                        className="snaplab-ink-stroke"
                        d={d}
                        pathLength={1}
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth={isLost ? 0.0032 : 0.003}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={strokeStyle}
                      />
                    </g>
                  );
                })}

                {/* Non-colour-only mark deduction ("−½" / "−1") and cursive correction right of the box */}
                {isLost && firstBox && (
                  <text
                    className="snaplab-ink-label"
                    x={Math.min(firstBox.x1 + 0.1 * (firstBox.x1 - firstBox.x0) + 0.012, 0.895)}
                    y={((firstBox.y0 + firstBox.y1) / 2) * safeAspect}
                    fill="#b91c1c"
                    fontSize={0.0175}
                    fontWeight={700}
                    fontFamily={handFont}
                    dominantBaseline="middle"
                    style={
                      shouldAnimate
                        ? {
                            opacity: 0,
                            animation: `snaplab-ink-fade 220ms ease-out ${
                              delayMs + ITEM_DRAW_MS * 0.65
                            }ms forwards`,
                          }
                        : { opacity: 1 }
                    }
                  >
                    {item.correction ? `${markText}  ${item.correction}` : markText}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {selectedItem && <MarkDetail item={selectedItem} onClose={handleCloseDetail} />}
    </div>
  );
}

export default RedInkOverlay;
