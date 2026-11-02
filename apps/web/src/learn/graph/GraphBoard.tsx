import type { OhmsLawGraph, SheetPoint } from "@snaplab/contracts";
import type { ReactNode } from "react";
import "./graphBoard.css";
import { fmtTick, MARGIN, viewBoxFor } from "./model";

export interface GraphBoardProps {
  /** The demonstration's sheet so far, built by the Watch actor with learn/graph/model.ts ops. Read-only. */
  graph: OhmsLawGraph;
  /** One plain line under the slope working, e.g. "The slope is the resistance of wire XY." null hides it. */
  meaning: string | null;
}

interface Mapper {
  X(x: number): number;
  Y(y: number): number;
}

/** Grid lines every `stepTenths` tenths of a cm (2 is 2 mm, 10 is 1 cm, 50 is 5 cm). */
function gridPath(
  w: number,
  h: number,
  stepTenths: number,
  X: (x: number) => number,
  Y: (y: number) => number,
): string {
  const parts: string[] = [];
  for (let t = 0; t <= w * 10; t += stepTenths) {
    parts.push(`M${X(t / 10)} ${Y(0)}V${Y(h)}`);
  }
  for (let t = 0; t <= h * 10; t += stepTenths) {
    parts.push(`M${X(0)} ${Y(t / 10)}H${X(w)}`);
  }
  return parts.join("");
}

/** Scale numbers written along the axes every 2 cm once `units_per_cm` is set. */
function Ticks({ graph, X, Y }: { graph: OhmsLawGraph } & Mapper) {
  const { x, y, sheet } = graph;
  const out: ReactNode[] = [];
  if (x.units_per_cm !== null) {
    for (let cm = 0; cm <= sheet.width_cm; cm += 2) {
      out.push(
        <text key={`x${cm}`} className="gb-tick" x={X(cm)} y={Y(0) + 0.85} textAnchor="middle">
          {fmtTick(x.origin_value + cm * x.units_per_cm)}
        </text>,
      );
    }
  }
  if (y.units_per_cm !== null) {
    for (let cm = 0; cm <= sheet.height_cm; cm += 2) {
      out.push(
        <text key={`y${cm}`} className="gb-tick" x={X(0) - 0.25} y={Y(cm) + 0.18} textAnchor="end">
          {fmtTick(y.origin_value + cm * y.units_per_cm)}
        </text>,
      );
    }
  }
  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: a plain SVG group of numbers, not focusable
    <g aria-hidden="true">{out}</g>
  );
}

function RightAngle({ p, a, b, X, Y }: { p: SheetPoint; a: SheetPoint; b: SheetPoint } & Mapper) {
  const s = 0.45;
  const sx = Math.sign(a.x_cm - p.x_cm) || 1;
  const sy = Math.sign(b.y_cm - p.y_cm) || 1;
  return (
    <path
      className="gb-square"
      d={`M${X(p.x_cm + sx * s)} ${Y(p.y_cm)}L${X(p.x_cm + sx * s)} ${Y(p.y_cm + sy * s)}L${X(p.x_cm)} ${Y(p.y_cm + sy * s)}`}
    />
  );
}

/**
 * Big read-only 2 mm graph sheet for the Watch demonstration. Points pop in one by one as
 * `graph.points` grows, the best-fit line draws in when `graph.line` appears, and the slope
 * triangle and working display the exact strings provided by the actor. Performs no physics
 * maths of its own.
 */
export function GraphBoard({ graph, meaning }: GraphBoardProps) {
  const vb = viewBoxFor(graph.sheet);
  const W = graph.sheet.width_cm;
  const H = graph.sheet.height_cm;
  const sx = (x: number) => MARGIN.left + x;
  const sy = (y: number) => MARGIN.top + H - y;
  const ratio = vb.w / vb.h;

  const hasScales =
    graph.x.label_as_written !== null ||
    graph.y.label_as_written !== null ||
    graph.x.scale_as_written !== null ||
    graph.y.scale_as_written !== null;

  // The working (ΔV, ΔI, s and its meaning) shows only once the triangle is drawn: the sheet
  // reads as it is made.
  const hasWorking = graph.triangle !== null;

  const lastPointIndex = graph.points.length - 1;

  return (
    <section className="gb-root" data-testid="graph-board" aria-label="Demonstration graph sheet">
      <div className="gb-grid">
        {(hasScales || hasWorking) && (
          <div className="gb-side">
            {hasScales && (
              <section className="gb-sec" aria-label="Axes and scales">
                <h3 className="gb-h">Axes &amp; scales</h3>
                <dl className="gb-scales">
                  {(graph.x.label_as_written !== null || graph.x.scale_as_written !== null) && (
                    <div className="gb-kv" data-testid="graph-scale-x">
                      <dt>Horizontal ({graph.x.label_as_written ?? "x"})</dt>
                      <dd>{graph.x.scale_as_written ?? "—"}</dd>
                    </div>
                  )}
                  {(graph.y.label_as_written !== null || graph.y.scale_as_written !== null) && (
                    <div className="gb-kv" data-testid="graph-scale-y">
                      <dt>Vertical ({graph.y.label_as_written ?? "y"})</dt>
                      <dd>{graph.y.scale_as_written ?? "—"}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {hasWorking && (
              <section className="gb-sec" data-testid="graph-working" aria-label="Slope working">
                <h3 className="gb-h">Slope from the graph</h3>
                <dl className="gb-deltas">
                  {graph.delta_y_as_written !== null && (
                    <div className="gb-kv" data-testid="graph-delta-y">
                      <dt>ΔV (vertical side)</dt>
                      <dd>{graph.delta_y_as_written}</dd>
                    </div>
                  )}
                  {graph.delta_x_as_written !== null && (
                    <div className="gb-kv" data-testid="graph-delta-x">
                      <dt>ΔI (horizontal side)</dt>
                      <dd>{graph.delta_x_as_written}</dd>
                    </div>
                  )}
                  {graph.slope_as_written !== null && (
                    <div className="gb-kv" data-testid="graph-slope">
                      <dt>Slope s</dt>
                      <dd>{graph.slope_as_written}</dd>
                    </div>
                  )}
                </dl>
                {meaning !== null && (
                  <p className="gb-meaning" data-testid="graph-meaning">
                    {meaning}
                  </p>
                )}
              </section>
            )}
          </div>
        )}

        <div className="gb-viewport">
          <svg
            className="gb-svg"
            viewBox={`0 0 ${vb.w} ${vb.h}`}
            role="img"
            aria-label={`Graph paper, ${W} cm across and ${H} cm up, with ${graph.points.length} plotted ${graph.points.length === 1 ? "point" : "points"}`}
            style={{
              maxWidth: `calc(var(--gb-max-h, 76vh) * ${ratio})`,
            }}
          >
            <rect className="gb-sheet" x={sx(0)} y={sy(H)} width={W} height={H} />
            <path className="gb-g2" d={gridPath(W, H, 2, sx, sy)} />
            <path className="gb-g10" d={gridPath(W, H, 10, sx, sy)} />
            <path className="gb-g50" d={gridPath(W, H, 50, sx, sy)} />
            <rect className="gb-frame" x={sx(0)} y={sy(H)} width={W} height={H} />

            <Ticks graph={graph} X={sx} Y={sy} />

            {graph.x.label_as_written && (
              <text className="gb-axis-label" x={sx(W / 2)} y={sy(0) + 1.95} textAnchor="middle">
                {graph.x.label_as_written}
              </text>
            )}
            {graph.y.label_as_written && (
              <text
                className="gb-axis-label"
                transform={`translate(0.75 ${sy(H / 2)}) rotate(-90)`}
                textAnchor="middle"
              >
                {graph.y.label_as_written}
              </text>
            )}

            {graph.triangle && (
              <g className="gb-triangle" data-testid="graph-triangle">
                <polygon
                  points={[graph.triangle.p1, graph.triangle.p2, graph.triangle.p3]
                    .map((p) => `${sx(p.x_cm)},${sy(p.y_cm)}`)
                    .join(" ")}
                />
                <RightAngle
                  p={graph.triangle.p2}
                  a={graph.triangle.p1}
                  b={graph.triangle.p3}
                  X={sx}
                  Y={sy}
                />
              </g>
            )}

            {graph.line && (
              <line
                className="gb-line"
                data-testid="graph-line"
                pathLength={1}
                x1={sx(graph.line.p1.x_cm)}
                y1={sy(graph.line.p1.y_cm)}
                x2={sx(graph.line.p2.x_cm)}
                y2={sy(graph.line.p2.y_cm)}
              />
            )}

            {graph.points.map((p, i) => (
              <g
                // biome-ignore lint/suspicious/noArrayIndexKey: points are ordered by plot beat
                key={i}
                className="gb-point"
                data-testid={`graph-point-${i}`}
                data-latest={i === lastPointIndex ? "1" : undefined}
                transform={`translate(${sx(p.x_cm)} ${sy(p.y_cm)})`}
              >
                {i === lastPointIndex && <circle r={0.36} />}
                <path d="M-0.22 -0.22 L0.22 0.22 M-0.22 0.22 L0.22 -0.22" />
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}
