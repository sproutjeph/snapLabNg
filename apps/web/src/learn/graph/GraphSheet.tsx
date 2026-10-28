import type { OhmsLawGraph, OhmsLawRecord, SheetPoint } from "@snaplab/contracts";
import {
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { LessonMode } from "../types";
import "./graph.css";
import {
  type Axis,
  addPoint,
  clearLine,
  clearTriangle,
  clientToSheet,
  type DeltaField,
  emptyGraph,
  fmtCm,
  fmtTick,
  MARGIN,
  moveLineEnd,
  moveTriangleCorner,
  parseCm,
  parseTypedPoint,
  removePoint,
  setAxisLabel,
  setAxisOrigin,
  setAxisScale,
  setDelta,
  setLine,
  setTriangle,
  snapToGrid,
  viewBoxFor,
} from "./model";

export interface GraphSheetProps {
  /** Her sheet so far; null before she has touched it. */
  value: OhmsLawGraph | null;
  onChange(next: OhmsLawGraph): void;
  mode: LessonMode;
  /** Her own table, shown as she typed it so she can read her values off it. Nothing auto-plots. */
  table: OhmsLawRecord;
}

type Tool = "plot" | "line" | "triangle";

const TOOLS: ReadonlyArray<{ id: Tool; name: string }> = [
  { id: "plot", name: "Mark points" },
  { id: "line", name: "Draw line" },
  { id: "triangle", name: "Slope triangle" },
];
const ZOOMS = [1, 1.5, 2, 3, 4] as const;
/** Finger-sized hit areas, in screen px. */
const HANDLE_HIT_PX = 24;
const POINT_HIT_PX = 18;

/**
 * Her sheet of 2 mm graph paper: she labels the axes, writes her scales, taps her points, lays
 * the ruler and sets the slope triangle. Controlled; everything is written as sheet cm from the
 * grid's bottom-left corner and her text is kept as typed. It never shows a slope, a "right"
 * scale or where a point belongs.
 */
export function GraphSheet({ value, onChange, mode, table }: GraphSheetProps) {
  const g = value ?? emptyGraph();
  const uid = useId();
  const [tool, setTool] = useState<Tool>("plot");
  const [zoomIx, setZoomIx] = useState(0);
  const [pending, setPending] = useState<SheetPoint | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [pxPerCm, setPxPerCm] = useState(18);

  const vb = viewBoxFor(g.sheet);
  const zoom = ZOOMS[zoomIx] ?? 1;
  const hint = (text: string) => (mode === "practice" ? text : undefined);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setPxPerCm(w / viewBoxFor(g.sheet).w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [g.sheet]);

  const toSheet = (clientX: number, clientY: number): SheetPoint | null => {
    const el = svgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return clientToSheet(rect, vb, g.sheet, clientX, clientY);
  };

  const pickTool = (next: Tool) => {
    setTool(next);
    setPending(null);
    setNote(null);
  };

  // ---- Taps on the paper ----
  const onPaperClick = (e: MouseEvent) => {
    const at = toSheet(e.clientX, e.clientY);
    if (!at) return;
    const p = snapToGrid(at, g.sheet);
    setNote(null);
    if (tool === "plot") {
      onChange(addPoint(g, p));
    } else if (tool === "line" && g.line === null) {
      if (pending === null) setPending(p);
      else {
        onChange(setLine(g, pending, p));
        setPending(null);
      }
    } else if (tool === "triangle" && g.triangle === null) {
      if (pending === null) setPending(p);
      else {
        onChange(setTriangle(g, pending, p));
        setPending(null);
      }
    }
  };

  // ---- Axis geometry in the drawing ----
  const sx = (x: number) => MARGIN.left + x;
  const sy = (y: number) => MARGIN.top + g.sheet.height_cm - y;
  const W = g.sheet.width_cm;
  const H = g.sheet.height_cm;

  const hitCm = HANDLE_HIT_PX / pxPerCm;
  const pointHitCm = POINT_HIT_PX / pxPerCm;

  const dragLineEnd = (end: "p1" | "p2") => (cx: number, cy: number) => {
    const at = toSheet(cx, cy);
    if (at) onChange(moveLineEnd(g, end, at));
  };
  const dragCorner = (which: "a" | "b") => (cx: number, cy: number) => {
    const at = toSheet(cx, cy);
    if (at) onChange(moveTriangleCorner(g, which, at));
  };
  const nudgeLineEnd = (end: "p1" | "p2") => (dx: number, dy: number) => {
    const from = g.line?.[end];
    if (from) onChange(moveLineEnd(g, end, { x_cm: from.x_cm + dx, y_cm: from.y_cm + dy }));
  };
  const nudgeCorner = (which: "a" | "b") => (dx: number, dy: number) => {
    const from = which === "a" ? g.triangle?.p1 : g.triangle?.p3;
    if (from) {
      onChange(moveTriangleCorner(g, which, { x_cm: from.x_cm + dx, y_cm: from.y_cm + dy }));
    }
  };

  const status = (() => {
    if (tool === "plot") {
      return g.points.length === 0
        ? "Tap the paper to mark a point. Tap a point again to rub it out."
        : `${g.points.length} ${g.points.length === 1 ? "point" : "points"} marked. Tap a point to rub it out.`;
    }
    if (tool === "line") {
      if (g.line) return "Drag either end of the ruler to lay your line.";
      return pending
        ? "Now tap where your line ends."
        : "Tap where your line starts, then where it ends.";
    }
    if (g.triangle)
      return "Drag either end of the slope on your line. The legs stay level and upright.";
    if (!g.line) return "Draw your line first, then set the triangle on it.";
    return pending
      ? "Now tap the other corner on your line."
      : "Tap one corner on your line, then the other.";
  })();

  const fit = zoom === 1;
  const ratio = vb.w / vb.h;

  return (
    <div className="gs-root">
      <div className="gs-axes">
        {(["x", "y"] as const).map((axis) => (
          <AxisFields
            key={axis}
            axis={axis}
            graph={g}
            idBase={`${uid}-${axis}`}
            hint={hint}
            onChange={onChange}
          />
        ))}
      </div>

      <div className="gs-main">
        <div className="gs-tools">
          <fieldset className="gs-seg">
            <legend className="gs-sr">What to do on the paper</legend>
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                className="gs-btn gs-seg-btn"
                aria-pressed={tool === t.id}
                onClick={() => pickTool(t.id)}
              >
                {t.name}
              </button>
            ))}
          </fieldset>
          <fieldset className="gs-zoom">
            <legend className="gs-sr">Zoom the paper</legend>
            <button
              type="button"
              className="gs-btn gs-icon"
              aria-label="Zoom out"
              disabled={zoomIx === 0}
              onClick={() => setZoomIx((i) => Math.max(0, i - 1))}
            >
              −
            </button>
            <button
              type="button"
              className="gs-btn gs-fit"
              aria-label="Fit the sheet to the screen"
              disabled={zoomIx === 0}
              onClick={() => setZoomIx(0)}
            >
              {fit ? "Fit" : `${zoom}×`}
            </button>
            <button
              type="button"
              className="gs-btn gs-icon"
              aria-label="Zoom in"
              disabled={zoomIx === ZOOMS.length - 1}
              onClick={() => setZoomIx((i) => Math.min(ZOOMS.length - 1, i + 1))}
            >
              +
            </button>
          </fieldset>
        </div>

        <p className="gs-status" aria-live="polite">
          {status}
        </p>

        <section
          className="gs-viewport"
          aria-label="Graph paper, scroll to move around"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must be reachable by keyboard
          tabIndex={0}
        >
          <svg
            ref={svgRef}
            className="gs-svg"
            viewBox={`0 0 ${vb.w} ${vb.h}`}
            aria-label={`Graph paper, ${W} cm across and ${H} cm up, in 2 mm squares`}
            style={{
              width: `${zoom * 100}%`,
              maxWidth: fit ? `calc(var(--gs-max-h, 78vh) * ${ratio})` : "none",
            }}
          >
            <rect className="gs-sheet" x={sx(0)} y={sy(H)} width={W} height={H} />
            <path className="gs-g2" d={gridPath(W, H, 2, sx, sy)} />
            <path className="gs-g10" d={gridPath(W, H, 10, sx, sy)} />
            <path className="gs-g50" d={gridPath(W, H, 50, sx, sy)} />
            {/* biome-ignore lint/a11y/noStaticElementInteractions: a tap on the paper; the typed-position form is the keyboard path */}
            <rect
              className="gs-frame"
              x={sx(0)}
              y={sy(H)}
              width={W}
              height={H}
              fill="transparent"
              onClick={onPaperClick}
              data-testid="paper"
            />

            <Ticks graph={g} X={sx} Y={sy} />

            {g.x.label_as_written && (
              <text className="gs-axis-label" x={sx(W / 2)} y={sy(0) + 1.95} textAnchor="middle">
                {g.x.label_as_written}
              </text>
            )}
            {g.y.label_as_written && (
              <text
                className="gs-axis-label"
                transform={`translate(0.75 ${sy(H / 2)}) rotate(-90)`}
                textAnchor="middle"
              >
                {g.y.label_as_written}
              </text>
            )}

            {tool === "line" && g.line && <Ruler line={g.line} X={sx} Y={sy} />}

            {g.triangle && (
              <g className="gs-triangle">
                <polygon
                  points={[g.triangle.p1, g.triangle.p2, g.triangle.p3]
                    .map((p) => `${sx(p.x_cm)},${sy(p.y_cm)}`)
                    .join(" ")}
                />
                <RightAngle p={g.triangle.p2} a={g.triangle.p1} b={g.triangle.p3} X={sx} Y={sy} />
              </g>
            )}

            {g.line && (
              <line
                className="gs-line"
                x1={sx(g.line.p1.x_cm)}
                y1={sy(g.line.p1.y_cm)}
                x2={sx(g.line.p2.x_cm)}
                y2={sy(g.line.p2.y_cm)}
              />
            )}

            {g.points.map((p, i) => (
              <g
                // biome-ignore lint/suspicious/noArrayIndexKey: points have no identity but their place
                key={i}
                className={`gs-point${tool === "plot" ? " gs-live" : ""}`}
                transform={`translate(${sx(p.x_cm)} ${sy(p.y_cm)})`}
              >
                <path d="M-0.22 -0.22 L0.22 0.22 M-0.22 0.22 L0.22 -0.22" />
                {tool === "plot" && (
                  // biome-ignore lint/a11y/noStaticElementInteractions: a tap rubs out a point; the points list has a Remove button for the keyboard
                  <circle
                    r={pointHitCm}
                    className="gs-hit"
                    data-testid={`point-${i}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(removePoint(g, i));
                    }}
                  />
                )}
              </g>
            ))}

            {pending && (
              <g
                className="gs-pending"
                transform={`translate(${sx(pending.x_cm)} ${sy(pending.y_cm)})`}
              >
                <circle r={0.35} />
              </g>
            )}

            {tool === "line" && g.line && (
              <>
                <Handle
                  name="Ruler start"
                  at={g.line.p1}
                  hit={hitCm}
                  X={sx}
                  Y={sy}
                  onDrag={dragLineEnd("p1")}
                  onNudge={nudgeLineEnd("p1")}
                />
                <Handle
                  name="Ruler end"
                  at={g.line.p2}
                  hit={hitCm}
                  X={sx}
                  Y={sy}
                  onDrag={dragLineEnd("p2")}
                  onNudge={nudgeLineEnd("p2")}
                />
              </>
            )}
            {tool === "triangle" && g.triangle && (
              <>
                <Handle
                  name="Triangle corner A"
                  at={g.triangle.p1}
                  hit={hitCm}
                  X={sx}
                  Y={sy}
                  onDrag={dragCorner("a")}
                  onNudge={nudgeCorner("a")}
                />
                <Handle
                  name="Triangle corner B"
                  at={g.triangle.p3}
                  hit={hitCm}
                  X={sx}
                  Y={sy}
                  onDrag={dragCorner("b")}
                  onNudge={nudgeCorner("b")}
                />
              </>
            )}
          </svg>
        </section>

        <div className="gs-clear">
          {g.line && (
            <button
              type="button"
              className="gs-btn"
              onClick={() => {
                onChange(clearLine(g));
                setPending(null);
              }}
            >
              Rub out line
            </button>
          )}
          {g.triangle && (
            <button
              type="button"
              className="gs-btn"
              onClick={() => {
                onChange(clearTriangle(g));
                setPending(null);
              }}
            >
              Rub out triangle
            </button>
          )}
        </div>
      </div>

      <div className="gs-rest">
        <TypeIn
          graph={g}
          tool={tool}
          onChange={onChange}
          note={note}
          setNote={setNote}
          idBase={`${uid}-type`}
        />

        <section className="gs-sec" aria-label="Slope">
          <DeltaInput
            id={`${uid}-dy`}
            label="ΔV (vertical side)"
            field="delta_y_as_written"
            graph={g}
            placeholder={hint("e.g. ΔV = V₂ − V₁ = … V")}
            onChange={onChange}
          />
          <DeltaInput
            id={`${uid}-dx`}
            label="ΔI (horizontal side)"
            field="delta_x_as_written"
            graph={g}
            placeholder={hint("e.g. ΔI = I₂ − I₁ = … A")}
            onChange={onChange}
          />
          <DeltaInput
            id={`${uid}-s`}
            label="Slope s"
            field="slope_as_written"
            graph={g}
            placeholder={hint("e.g. s = ΔV/ΔI = …")}
            onChange={onChange}
          />
        </section>

        <TableRef table={table} />
      </div>
    </div>
  );
}

// ---- Pieces ----

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

interface Mapper {
  X(x: number): number;
  Y(y: number): number;
}

/** Her own scale written along the axes, every 2 cm: only once she has chosen one. */
function Ticks({ graph, X, Y }: { graph: OhmsLawGraph } & Mapper) {
  const { x, y, sheet } = graph;
  const out: ReactNode[] = [];
  if (x.units_per_cm !== null) {
    for (let cm = 0; cm <= sheet.width_cm; cm += 2) {
      out.push(
        <text key={`x${cm}`} className="gs-tick" x={X(cm)} y={Y(0) + 0.85} textAnchor="middle">
          {fmtTick(x.origin_value + cm * x.units_per_cm)}
        </text>,
      );
    }
  }
  if (y.units_per_cm !== null) {
    for (let cm = 0; cm <= sheet.height_cm; cm += 2) {
      out.push(
        <text key={`y${cm}`} className="gs-tick" x={X(0) - 0.25} y={Y(cm) + 0.18} textAnchor="end">
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

/** The transparent ruler: a thin outlined strip along her line, with its edge on the line. */
function Ruler({ line, X, Y }: { line: NonNullable<OhmsLawGraph["line"]> } & Mapper) {
  const dx = line.p2.x_cm - line.p1.x_cm;
  const dy = line.p2.y_cm - line.p1.y_cm;
  const len = Math.hypot(dx, dy);
  const angle = (Math.atan2(-dy, dx) * 180) / Math.PI;
  const ticks: string[] = [];
  for (let t = -1; t <= len + 1; t += 0.5) {
    const tall = Number.isInteger(t) ? 0.5 : 0.28;
    ticks.push(`M${t} 0V${-tall}`);
  }
  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: a plain SVG group, not focusable
    <g
      className="gs-ruler"
      aria-hidden="true"
      transform={`translate(${X(line.p1.x_cm)} ${Y(line.p1.y_cm)}) rotate(${angle})`}
    >
      <rect x={-1.5} y={-2.6} width={len + 3} height={2.6} />
      <path d={ticks.join("")} />
    </g>
  );
}

function RightAngle({ p, a, b, X, Y }: { p: SheetPoint; a: SheetPoint; b: SheetPoint } & Mapper) {
  const s = 0.45;
  const sx = Math.sign(a.x_cm - p.x_cm) || 1;
  const sy = Math.sign(b.y_cm - p.y_cm) || 1;
  return (
    <path
      className="gs-square"
      d={`M${X(p.x_cm + sx * s)} ${Y(p.y_cm)}L${X(p.x_cm + sx * s)} ${Y(p.y_cm + sy * s)}L${X(p.x_cm)} ${Y(p.y_cm + sy * s)}`}
    />
  );
}

interface HandleProps extends Mapper {
  name: string;
  at: SheetPoint;
  /** Hit radius in sheet cm. */
  hit: number;
  onDrag(clientX: number, clientY: number): void;
  onNudge(dxCm: number, dyCm: number): void;
}

/** A draggable end: pointer drag, or the arrow keys (1 mm; with Shift, 1 cm). */
function Handle({ name, at, hit, X, Y, onDrag, onNudge }: HandleProps) {
  const dragging = useRef(false);
  const down = (e: PointerEvent<SVGGElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const move = (e: PointerEvent<SVGGElement>) => {
    if (dragging.current) onDrag(e.clientX, e.clientY);
  };
  const up = (e: PointerEvent<SVGGElement>) => {
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };
  const step = (e: KeyboardEvent) => (e.shiftKey ? 1 : 0.1);
  const key = (e: KeyboardEvent<SVGGElement>) => {
    const s = step(e);
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-s, 0],
      ArrowRight: [s, 0],
      ArrowUp: [0, s],
      ArrowDown: [0, -s],
    };
    const v = d[e.key];
    if (!v) return;
    e.preventDefault();
    onNudge(v[0], v[1]);
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be a <button>
    <g
      className="gs-handle"
      role="button"
      tabIndex={0}
      aria-label={`${name}, ${fmtCm(at.x_cm)} cm across, ${fmtCm(at.y_cm)} cm up. Arrow keys move it.`}
      transform={`translate(${X(at.x_cm)} ${Y(at.y_cm)})`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    >
      <circle r={hit} className="gs-hit" />
      <circle r={0.32} className="gs-knob" />
      <path d="M-0.55 0H0.55M0 -0.55V0.55" className="gs-cross" />
    </g>
  );
}

function ScaleState({ axis }: { axis: OhmsLawGraph["x"] }) {
  if (axis.scale_as_written === null) return null;
  const ok = axis.units_per_cm !== null;
  return (
    <span className={`gs-scale-state ${ok ? "gs-ok" : "gs-bad"}`} role="status">
      {ok ? "✓ Scale read" : "✕ Not read: write it like 2 cm to 0.1 A"}
    </span>
  );
}

function AxisFields({
  axis,
  graph,
  idBase,
  hint,
  onChange,
}: {
  axis: Axis;
  graph: OhmsLawGraph;
  idBase: string;
  hint(text: string): string | undefined;
  onChange(next: OhmsLawGraph): void;
}) {
  const a = graph[axis];
  return (
    <fieldset className="gs-axis">
      <legend className="gs-h">{axis === "x" ? "Horizontal axis" : "Vertical axis"}</legend>
      <div className="gs-axis-grid">
        <div className="gs-cell">
          <label className="gs-lab" htmlFor={`${idBase}-label`}>
            Label
          </label>
          <input
            id={`${idBase}-label`}
            className="gs-input"
            type="text"
            autoComplete="off"
            value={a.label_as_written ?? ""}
            placeholder={hint("quantity/unit")}
            onChange={(e) => onChange(setAxisLabel(graph, axis, e.target.value))}
          />
        </div>
        <div className="gs-cell">
          <label className="gs-lab" htmlFor={`${idBase}-origin`}>
            Value at corner
          </label>
          <NumberInput
            id={`${idBase}-origin`}
            value={a.origin_value}
            onCommit={(n) => onChange(setAxisOrigin(graph, axis, n))}
          />
        </div>
        <div className="gs-cell gs-wide">
          <label className="gs-lab" htmlFor={`${idBase}-scale`}>
            Scale
          </label>
          <input
            id={`${idBase}-scale`}
            className="gs-input"
            type="text"
            autoComplete="off"
            value={a.scale_as_written ?? ""}
            placeholder={hint("e.g. 2 cm to 0.1 A")}
            onChange={(e) => onChange(setAxisScale(graph, axis, e.target.value))}
          />
          <ScaleState axis={a} />
        </div>
      </div>
    </fieldset>
  );
}

/** A number she types: the box keeps her text while it is half-typed ("0." or "-"). */
function NumberInput({
  id,
  value,
  onCommit,
}: {
  id: string;
  value: number;
  onCommit(n: number): void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText((t) => (parseCm(t) === value ? t : String(value)));
  }, [value]);
  return (
    <input
      id={id}
      className="gs-input"
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseCm(e.target.value);
        if (n !== null) onCommit(n);
      }}
    />
  );
}

function DeltaInput({
  id,
  label,
  field,
  graph,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  field: DeltaField;
  graph: OhmsLawGraph;
  placeholder: string | undefined;
  onChange(next: OhmsLawGraph): void;
}) {
  return (
    <div className="gs-delta">
      <label className="gs-lab" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="gs-input"
        type="text"
        autoComplete="off"
        value={graph[field] ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(setDelta(graph, field, e.target.value))}
      />
    </div>
  );
}

/** The keyboard path: type positions in cm instead of tapping. */
function TypeIn({
  graph,
  tool,
  onChange,
  note,
  setNote,
  idBase,
}: {
  graph: OhmsLawGraph;
  tool: Tool;
  onChange(next: OhmsLawGraph): void;
  note: string | null;
  setNote(n: string | null): void;
  idBase: string;
}) {
  const [f, setF] = useState({ x1: "", y1: "", x2: "", y2: "" });
  const field = (k: keyof typeof f, label: string) => (
    <div className="gs-pos">
      <label className="gs-lab" htmlFor={`${idBase}-${k}`}>
        {label}
      </label>
      <input
        id={`${idBase}-${k}`}
        className="gs-input"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
      />
    </div>
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const a = parseTypedPoint(f.x1, f.y1, graph.sheet);
    if (!a.ok) return setNote(a.reason);
    if (tool === "plot") {
      onChange(addPoint(graph, a.point));
      setNote(null);
      setF({ x1: "", y1: "", x2: "", y2: "" });
      return;
    }
    const b = parseTypedPoint(f.x2, f.y2, graph.sheet);
    if (!b.ok) return setNote(b.reason);
    if (a.point.x_cm === b.point.x_cm && a.point.y_cm === b.point.y_cm) {
      return setNote("The two ends must be in different places.");
    }
    setNote(null);
    onChange(
      tool === "line" ? setLine(graph, a.point, b.point) : setTriangle(graph, a.point, b.point),
    );
  };
  return (
    <details className="gs-type">
      <summary className="gs-summary">Type positions instead of tapping</summary>
      <form className="gs-form" onSubmit={submit} noValidate>
        <p className="gs-small">
          Positions are in cm from the bottom-left corner of the grid, to the nearest millimetre.
        </p>
        <div className="gs-row">
          {field("x1", tool === "plot" ? "Across (cm)" : "First end, across (cm)")}
          {field("y1", tool === "plot" ? "Up (cm)" : "First end, up (cm)")}
        </div>
        {tool !== "plot" && (
          <div className="gs-row">
            {field("x2", "Second end, across (cm)")}
            {field("y2", "Second end, up (cm)")}
          </div>
        )}
        <button type="submit" className="gs-btn">
          {tool === "plot" ? "Add point" : tool === "line" ? "Set line" : "Set triangle"}
        </button>
        {note && (
          <p className="gs-note" role="alert">
            ✕ {note}
          </p>
        )}
      </form>
      {tool === "plot" && graph.points.length > 0 && (
        <ul className="gs-points" aria-label="Points on the paper">
          {graph.points.map((p, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: points have no identity but their place
            <li key={i}>
              <span>
                {fmtCm(p.x_cm)} cm across, {fmtCm(p.y_cm)} cm up
              </span>
              <button
                type="button"
                className="gs-btn gs-icon"
                aria-label={`Remove point ${i + 1}`}
                onClick={() => onChange(removePoint(graph, i))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

/** Her table as she typed it, read-only, so she can read her values off it. */
function TableRef({ table }: { table: OhmsLawRecord }) {
  const rows = table.rows.filter(
    (r) => r.R.text_as_written || r.I.text_as_written || r.V.text_as_written,
  );
  return (
    <details className="gs-type">
      <summary className="gs-summary">My table</summary>
      {rows.length === 0 ? (
        <p className="gs-small">Nothing in your table yet.</p>
      ) : (
        <table className="gs-table">
          <thead>
            <tr>
              <th>{table.headers.R ?? "R"}</th>
              <th>{table.headers.I ?? "I"}</th>
              <th>{table.headers.V ?? "V"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity but their place
              <tr key={i}>
                <td>{r.R.text_as_written}</td>
                <td>{r.I.text_as_written}</td>
                <td>{r.V.text_as_written}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </details>
  );
}
