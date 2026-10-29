import type { Annotation, Box, MarkItem, MarkSheet } from "@snaplab/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import { findPageTextLocation, G1_PRECAUTION_1_BOX, G1_PRECAUTION_2_BOX } from "./g1Page";
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

/** Plain words for each rule, for a student (the rule codes stay in the detail view). */
const RULE_WORDS: Record<MarkItem["rule"], string> = {
  "CHEM-BUR-2DP": "Burette readings to 2 d.p.",
  "CHEM-CONCORD": "Concordant titres",
  "CHEM-ROUGH": "Rough titre",
  "CHEM-PARALLAX": "Reading the meniscus",
  "CHEM-MOLE-RATIO": "Mole ratio",
  "CHEM-3SF": "Answer to 3 s.f.",
  "CHEM-ENDPOINT": "End point",
  "PHYS-OPT-TRACES": "Ray traces",
  "PHYS-OPT-ARROW": "Ray arrows",
  "PHYS-1DP": "Lengths to 1 d.p.",
  "PHYS-3SF": "Values to 3 s.f.",
  "PHYS-TABLE": "Table",
  "GRAPH-AXES": "Graph axes",
  "GRAPH-POINTS": "Plotted points",
  "GRAPH-LINE": "Line of best fit",
  "GRAPH-INTERCEPT": "Intercept",
  "GRAPH-SCALE": "Graph scale",
  "GRAPH-SLOPE": "Slope",
  "PHYS-EVAL": "Working",
  "PHYS-ACCURACY": "Accuracy",
  PRECAUTIONS: "Precautions",
  "PHYS-2DP": "Meter readings to 2 d.p.",
  "PHYS-TREND": "Trend of the readings",
  "PHYS-LAW": "The law",
  "PHYS-CALC": "Calculation",
};

export function ruleWords(rule: MarkItem["rule"]): string {
  return RULE_WORDS[rule] ?? rule;
}

/** Plain words for one item: the table's parts get their own names. */
export function itemWords(item: MarkItem): string {
  if (item.id.startsWith("PHYS-TABLE:units")) return "Units in the headings";
  if (item.id === "PHYS-TABLE:columns") return "Table columns";
  if (item.id === "PHYS-EVAL:mean") return "Mean";
  return ruleWords(item.rule);
}
export const LOST_STEP_MS = 450;
export const LOST_DRAW_MS = 400;
export const EARNED_STAGGER_MS = 100;
export const EARNED_DRAW_MS = 280;

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
    /* Above the page at every width: pinned over it, it hid her heading in narrow columns. */
    .snaplab-score-slot {
      z-index: 30;
      flex-shrink: 0;
      align-self: stretch;
      margin-bottom: 8px;
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

/**
 * Resolves the page evidence boxes for a mark item.
 * When `markMeterBridge` emits `box: null` (e.g. `PRECAUTIONS`), matches `text_as_written`
 * against the precaution lines drawn in `g1Page.ts`.
 * Items that still have no box (e.g. `PHYS-TABLE:columns` with `evidence: []`) return `[]`
 * and are rendered in the margin list.
 */
function resolveItemBoxes(item: MarkItem): Box[] {
  const boxes: Box[] = [];
  for (const ev of item.evidence) {
    if (ev.box) {
      boxes.push(ev.box);
      continue;
    }
    const matched = findPageTextLocation(ev.text_as_written);
    if (matched) {
      boxes.push(matched);
      continue;
    }
    if (item.rule === "PRECAUTIONS") {
      if (item.id.endsWith(":1")) {
        boxes.push(G1_PRECAUTION_1_BOX);
      } else if (item.id.endsWith(":2")) {
        boxes.push(G1_PRECAUTION_2_BOX);
      }
    }
  }
  return boxes;
}

function boxKey(box: Box): string {
  return `${box.x0.toFixed(4)},${box.y0.toFixed(4)},${box.x1.toFixed(4)},${box.y1.toFixed(4)}`;
}

function boxesTopY(boxes: readonly Box[]): number {
  let minY = Number.POSITIVE_INFINITY;
  for (const b of boxes) {
    if (b.y0 < minY) minY = b.y0;
  }
  return Number.isFinite(minY) ? minY : 0.785;
}

function boxesLeftX(boxes: readonly Box[]): number {
  let minX = Number.POSITIVE_INFINITY;
  for (const b of boxes) {
    if (b.x0 < minX) minX = b.x0;
  }
  return Number.isFinite(minX) ? minX : 0.07;
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

function lostLabelReason(item: MarkItem): string | null {
  if (item.correction) return item.correction;
  if (item.id === "GRAPH-SCALE:size" || item.rule === "GRAPH-SCALE") {
    return "graph < ⅓ page";
  }
  if (item.id === "GRAPH-SLOPE:large" || item.rule === "GRAPH-SLOPE") {
    return "small triangle";
  }
  return null;
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

interface PreparedItem {
  item: MarkItem;
  boxes: Box[];
  delayMs: number;
  drawMs: number;
  finishMs: number;
  marginIndex: number | null;
}

interface BoxShareStats {
  lostCount: number;
  earnedCount: number;
}

/**
 * 2D red-ink examiner marking overlay over the student's flattened page image.
 * Draws lost annotations one after another (~450 ms each), then earned ticks with a quick
 * ~100 ms stagger, counts up the score in half-marks, renders boxless items in a margin list,
 * offsets shared graph boxes so ticks and labels never stack, and opens `MarkDetail` on click/Enter.
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

  const { preparedItems, shareStatsByBoxKey, itemShareIndexByKey } = useMemo(() => {
    const withBoxes = sheet.items.map((item) => ({
      item,
      boxes: resolveItemBoxes(item),
    }));

    const comparePos = (
      a: { item: MarkItem; boxes: Box[] },
      b: { item: MarkItem; boxes: Box[] },
    ) => {
      const dy = boxesTopY(a.boxes) - boxesTopY(b.boxes);
      if (Math.abs(dy) > 1e-4) return dy;
      return boxesLeftX(a.boxes) - boxesLeftX(b.boxes);
    };

    // Draw lost items one after another (~450 ms each), then earned ticks (~100 ms stagger).
    const lostGroup = withBoxes.filter((entry) => entry.item.outcome === "lost").sort(comparePos);
    const earnedGroup = withBoxes.filter((entry) => entry.item.outcome !== "lost").sort(comparePos);
    const ordered = [...lostGroup, ...earnedGroup];

    const statsMap = new Map<string, BoxShareStats>();
    const shareIdxMap = new Map<string, number>();

    for (const entry of ordered) {
      const first = entry.boxes[0];
      if (!first || entry.boxes.length !== 1) continue;
      const key = boxKey(first);
      const current = statsMap.get(key) ?? { lostCount: 0, earnedCount: 0 };
      if (entry.item.outcome === "lost") {
        shareIdxMap.set(entry.item.id, current.lostCount);
        current.lostCount += 1;
      } else {
        shareIdxMap.set(entry.item.id, current.earnedCount);
        current.earnedCount += 1;
      }
      statsMap.set(key, current);
    }

    let nextMarginIndex = 0;
    const lostTotalMs = lostGroup.length * LOST_STEP_MS;
    const prepared: PreparedItem[] = ordered.map((entry, idx) => {
      const isLost = entry.item.outcome === "lost";
      const delayMs = isLost
        ? idx * LOST_STEP_MS
        : lostTotalMs + (idx - lostGroup.length) * EARNED_STAGGER_MS;
      const drawMs = isLost ? LOST_DRAW_MS : EARNED_DRAW_MS;
      const marginIndex = entry.boxes.length === 0 ? nextMarginIndex++ : null;
      return {
        item: entry.item,
        boxes: entry.boxes,
        delayMs,
        drawMs,
        finishMs: delayMs + drawMs,
        marginIndex,
      };
    });

    return {
      preparedItems: prepared,
      shareStatsByBoxKey: statsMap,
      itemShareIndexByKey: shareIdxMap,
    };
  }, [sheet.items]);

  const [completedCount, setCompletedCount] = useState<number>(() =>
    shouldAnimate ? 0 : preparedItems.length,
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, SVGGElement>>(new Map());

  useEffect(() => {
    if (!shouldAnimate) {
      setCompletedCount(preparedItems.length);
      return;
    }
    setCompletedCount(0);
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    preparedItems.forEach((entry, idx) => {
      const timer = setTimeout(() => {
        setCompletedCount((prev) => Math.max(prev, idx + 1));
      }, entry.finishMs);
      timers.push(timer);
    });
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [shouldAnimate, preparedItems]);

  const earnedSoFar = useMemo(() => {
    if (completedCount >= preparedItems.length) {
      return sheet.earned;
    }
    let sum = 0;
    for (let i = 0; i < completedCount && i < preparedItems.length; i++) {
      const entry = preparedItems[i];
      if (entry) {
        sum += entry.item.marks_earned;
      }
    }
    return Math.round(sum * 2) / 2;
  }, [completedCount, preparedItems, sheet.earned]);

  const selectedItem = useMemo(
    () => preparedItems.find((entry) => entry.item.id === selectedItemId)?.item ?? null,
    [preparedItems, selectedItemId],
  );

  const offPageItems = useMemo(
    () => preparedItems.filter((entry) => entry.marginIndex !== null),
    [preparedItems],
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
      {/* ScoreCard: stacked above page on narrow screens, pinned in right margin outside page on laptop widths */}
      <div className="snaplab-score-slot">
        <ScoreCard
          questionLabel={sheet.question_label}
          earned={earnedSoFar}
          available={sheet.available}
          completedCount={completedCount}
          totalCount={preparedItems.length}
        />
      </div>

      {/* Aspect-locked page box holding the image and the 0..1 x 0..aspect SVG overlay */}
      <div
        style={{
          position: "relative",
          aspectRatio: `1 / ${safeAspect}`,
          flex: "1 1 auto",
          minHeight: 0,
          maxHeight: "100%",
          maxWidth: "100%",
          boxShadow: "none",
          borderRadius: "var(--radius)",
          overflow: "hidden",
          background: "var(--card)",
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
          {/* Setup issues (circled in red with label placed in the open space above the circle) */}
          {sheet.setup_issues.map((issue, issueIdx) => {
            if (!issue.box) return null;
            const seed = hashSeed(`setup:${issue.description}:${issueIdx}`);
            const d = circlePath(issue.box, safeAspect, seed);
            const labelX = (issue.box.x0 + issue.box.x1) / 2;
            const labelY = Math.max(issue.box.y0 - 0.015, 0.02) * safeAspect;
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
                  fontSize={0.016}
                  fontWeight={700}
                  fontFamily={handFont}
                  textAnchor="middle"
                  dominantBaseline="auto"
                >
                  {issue.description}
                </text>
              </g>
            );
          })}

          {/* Scheme items (lost items first, then earned items) */}
          {preparedItems.map((entry) => {
            const { item, boxes, delayMs, drawMs, marginIndex } = entry;
            const isLost = item.outcome === "lost";
            const effectiveAnnotation: Annotation = isLost ? item.annotation : "tick";
            const lostMarks = item.marks_available - item.marks_earned;
            const markText = isLost
              ? `−${formatHalf(lostMarks)}`
              : `+${formatHalf(item.marks_earned)}`;
            const isSelected = selectedItemId === item.id;

            // Items with no place on her page (e.g. PHYS-TABLE:columns) are listed under it.
            if (marginIndex !== null) return null;

            const firstBox = boxes[0] ?? null;
            const lostReason = isLost ? lostLabelReason(item) : null;
            const singleShareStats =
              firstBox && boxes.length === 1
                ? (shareStatsByBoxKey.get(boxKey(firstBox)) ?? null)
                : null;
            const isSharedBox =
              singleShareStats !== null &&
              singleShareStats.lostCount + singleShareStats.earnedCount > 1;
            const shareIdx = itemShareIndexByKey.get(item.id) ?? 0;

            // Compute label position for lost items, offsetting when multiple lost items share a box
            let labelX = 0;
            let labelY = 0;
            if (isLost && firstBox) {
              if (isSharedBox) {
                labelX = Math.min(firstBox.x1 + 0.034, 0.855);
                labelY = (firstBox.y0 + 0.022 + shareIdx * 0.032) * safeAspect;
              } else {
                labelX = Math.min(firstBox.x1 + 0.1 * (firstBox.x1 - firstBox.x0) + 0.012, 0.885);
                labelY = ((firstBox.y0 + firstBox.y1) / 2) * safeAspect;
              }
            }

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
                {boxes.map((rawBox, evIdx) => {
                  // Offset shared boxes so earned ticks and lost boxes do not pile up on one spot
                  let effectiveBox = rawBox;
                  let hitBox = rawBox;
                  if (isSharedBox && singleShareStats) {
                    if (isLost) {
                      const inset = shareIdx * 0.005;
                      effectiveBox = {
                        x0: rawBox.x0 + inset,
                        y0: rawBox.y0 + inset,
                        x1: rawBox.x1 - inset,
                        y1: rawBox.y1 - inset,
                      };
                      hitBox = effectiveBox;
                    } else {
                      const startY =
                        rawBox.y0 +
                        (singleShareStats.lostCount > 0
                          ? singleShareStats.lostCount * 0.032 + 0.018
                          : 0.014);
                      const col = Math.floor(shareIdx / 4);
                      const row = shareIdx % 4;
                      const tickRight = rawBox.x1 + 0.044 + col * 0.036;
                      const tickY0 = startY + row * 0.03;
                      // Give tickPath a 0.075-wide box ending at tickRight so its check mark has natural aspect
                      effectiveBox = {
                        x0: tickRight - 0.075,
                        y0: tickY0,
                        x1: tickRight,
                        y1: tickY0 + 0.024,
                      };
                      hitBox = {
                        x0: tickRight - 0.018,
                        y0: tickY0,
                        x1: tickRight + 0.008,
                        y1: tickY0 + 0.024,
                      };
                    }
                  }

                  const seed = hashSeed(`${item.id}:${evIdx}`);
                  const d = buildAnnotationPath(
                    effectiveAnnotation,
                    effectiveBox,
                    safeAspect,
                    seed,
                  );
                  const strokeStyle = shouldAnimate
                    ? {
                        strokeDasharray: 1,
                        strokeDashoffset: 1,
                        animation: `snaplab-ink-draw ${drawMs}ms ease-out ${delayMs}ms forwards`,
                      }
                    : {
                        strokeDashoffset: 0,
                      };

                  const evKey = `${item.id}-${hitBox.x0}-${hitBox.y0}-${hitBox.x1}-${hitBox.y1}`;
                  return (
                    <g key={evKey}>
                      {/* Transparent hit target over the evidence box for easy touch/click */}
                      <rect
                        x={hitBox.x0}
                        y={hitBox.y0 * safeAspect}
                        width={Math.max(hitBox.x1 - hitBox.x0, 0.02)}
                        height={Math.max((hitBox.y1 - hitBox.y0) * safeAspect, 0.02)}
                        fill="transparent"
                      />

                      {/* Keyboard/selection focus halo */}
                      <rect
                        className="snaplab-ink-focus-ring"
                        x={hitBox.x0 - 0.008}
                        y={hitBox.y0 * safeAspect - 0.008}
                        width={Math.max(hitBox.x1 - hitBox.x0, 0.02) + 0.016}
                        height={Math.max((hitBox.y1 - hitBox.y0) * safeAspect, 0.02) + 0.016}
                        rx={0.006}
                        fill="none"
                        stroke="#1d2430"
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
                    x={labelX}
                    y={labelY}
                    fill="#b91c1c"
                    fontSize={isSharedBox ? 0.015 : 0.0165}
                    fontWeight={700}
                    fontFamily={handFont}
                    dominantBaseline="middle"
                    style={
                      shouldAnimate
                        ? {
                            opacity: 0,
                            animation: `snaplab-ink-fade 220ms ease-out ${
                              delayMs + drawMs * 0.65
                            }ms forwards`,
                          }
                        : { opacity: 1 }
                    }
                  >
                    {lostReason ? `${markText}  ${lostReason}` : markText}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {offPageItems.length > 0 && (
        <ul
          aria-label="Marks with no single place on the page"
          style={{ listStyle: "none", margin: "10px 0 0", padding: 0, width: "100%" }}
        >
          {offPageItems.map(({ item }) => {
            const isLost = item.outcome === "lost";
            const markText = isLost
              ? `−${formatHalf(item.marks_available - item.marks_earned)}`
              : `+${formatHalf(item.marks_earned)}`;
            return (
              <li key={item.id} style={{ margin: "0 0 6px" }}>
                <button
                  type="button"
                  onClick={() => handleActivateItem(item)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 10px",
                    borderRadius: "var(--radius)",
                    border: "var(--rule)",
                    background: "var(--card)",
                    color: isLost ? "var(--red-ink)" : "var(--green)",
                    fontFamily: handFont,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {isLost ? "✗" : "✓"} {itemWords(item)} {markText}
                  {item.correction ? ` · ${item.correction}` : ""}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selectedItem && (
        <MarkDetail key={selectedItem.id} item={selectedItem} onClose={handleCloseDetail} />
      )}
    </div>
  );
}

export default RedInkOverlay;
