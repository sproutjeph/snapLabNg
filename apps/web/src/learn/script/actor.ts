import type { OhmsLawGraph, OhmsLawRecord, SheetPoint } from "@snaplab/contracts";
import {
  addPoint,
  emptyGraph,
  labelUnit,
  setAxisLabel,
  setAxisScale,
  setDelta,
  setLine,
  setTriangle,
} from "../graph/model";
import {
  addRow,
  setCell,
  setHeader,
  setLaw,
  setLength,
  setLengthCalc,
  setPrecaution,
} from "../readings/record";
import type { RecordField } from "./types";

// What the Watch actor writes into the demonstration record. Every function is pure: it takes
// the record and returns the next one, through the same edit functions a student's typing and
// tapping use (readings/record.ts, graph/model.ts). Nothing here knows the bench: the numbers
// the actor writes come from the dials (the supervisor, in createDirector) or from what the
// actor itself has just drawn on the sheet, read on its own scales, as a candidate does.

/** Writes `text` into one field of the record, exactly as typed. */
export function writeField(r: OhmsLawRecord, field: RecordField, text: string): OhmsLawRecord {
  switch (field.kind) {
    case "length":
      return setLength(r, text);
    case "header":
      return setHeader(r, field.col, text);
    case "cell": {
      let next = r;
      while (next.rows.length <= field.row) next = addRow(next);
      return setCell(next, field.row, field.col, text);
    }
    case "precaution":
      return setPrecaution(r, field.index, text);
    case "law":
      return setLaw(r, text);
    case "lengthCalc":
      return setLengthCalc(r, text);
    case "graph": {
      const g = r.graph ?? emptyGraph();
      switch (field.part) {
        case "axisX":
          return { ...r, graph: setAxisLabel(g, "x", text) };
        case "axisY":
          return { ...r, graph: setAxisLabel(g, "y", text) };
        case "scaleX":
          return { ...r, graph: setAxisScale(g, "x", text) };
        case "scaleY":
          return { ...r, graph: setAxisScale(g, "y", text) };
        case "deltaY":
          return { ...r, graph: setDelta(g, "delta_y_as_written", text) };
        case "deltaX":
          return { ...r, graph: setDelta(g, "delta_x_as_written", text) };
        case "slope":
          return { ...r, graph: setDelta(g, "slope_as_written", text) };
      }
    }
  }
}

type Axis = OhmsLawGraph["x"];

/** 1e-3 for a milli unit (mA, mV), else 1: the same reading of a label as packages/rules. */
const milliOf = (label: string | null): number => {
  const unit = labelUnit(label);
  return unit !== null && /^m[AV]$/.test(unit) ? 1e-3 : 1;
};

/** A value on her axis, in sheet cm from the grid's corner, or null when she chose no scale. */
const toSheetCm = (value: number, axis: Axis): number | null => {
  const u = axis.units_per_cm;
  return u !== null && Number.isFinite(u) && u > 0 ? (value - axis.origin_value) / u : null;
};

/** The value at a place on her axis: the inverse of toSheetCm. */
const fromSheetCm = (cm: number, axis: Axis): number =>
  axis.origin_value + cm * (axis.units_per_cm ?? 0);

/**
 * Plots table row `row` as a point on her own scales (I across, V up, as her axis labels say).
 * Unchanged when the row is not complete or she has not yet chosen both scales.
 */
export function plotRow(r: OhmsLawRecord, row: number): OhmsLawRecord {
  const g = r.graph;
  const cells = r.rows[row];
  if (!g || !cells) return r;
  const i = cells.I.value;
  const v = cells.V.value;
  if (i === null || v === null) return r;
  // Her table is in the units of her headings, her axes in the units of her labels.
  const xCm = toSheetCm((i * milliOf(r.headers.I)) / milliOf(g.x.label_as_written), g.x);
  const yCm = toSheetCm((v * milliOf(r.headers.V)) / milliOf(g.y.label_as_written), g.y);
  if (xCm === null || yCm === null) return r;
  return { ...r, graph: addPoint(g, { x_cm: xCm, y_cm: yCm }) };
}

interface Fit {
  cx: number;
  cy: number;
  /** Unit direction along the line, pointing right (or up for a vertical line). */
  dx: number;
  dy: number;
}

/** The orthogonal (total least-squares) fit packages/rules compares her line with. */
function principalLine(points: readonly SheetPoint[]): Fit | null {
  if (points.length < 2) return null;
  const n = points.length;
  const cx = points.reduce((s, p) => s + p.x_cm, 0) / n;
  const cy = points.reduce((s, p) => s + p.y_cm, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x_cm - cx) ** 2;
    syy += (p.y_cm - cy) ** 2;
    sxy += (p.x_cm - cx) * (p.y_cm - cy);
  }
  if (sxx + syy === 0) return null;
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { cx, cy, dx: Math.cos(angle), dy: Math.sin(angle) };
}

/** How far past her outermost points her line runs, as a share of their spread. */
export const LINE_OVERRUN = 0.08;
/** Where on her line the triangle's two corners sit, as shares of its length: a large triangle. */
export const TRIANGLE_AT = [0.12, 0.88] as const;

/**
 * Draws one straight line of best fit through the points she has plotted: through their
 * centroid, along their principal direction, running a little past the outermost points and
 * kept on the sheet. Unchanged with fewer than two points.
 */
export function drawBestFitLine(r: OhmsLawRecord): OhmsLawRecord {
  const g = r.graph;
  if (!g) return r;
  const fit = principalLine(g.points);
  if (!fit) return r;
  const along = g.points.map((p) => (p.x_cm - fit.cx) * fit.dx + (p.y_cm - fit.cy) * fit.dy);
  const lo = Math.min(...along);
  const hi = Math.max(...along);
  const spread = hi - lo;
  let t0 = lo - LINE_OVERRUN * spread;
  let t1 = hi + LINE_OVERRUN * spread;
  // Keep both ends on the sheet.
  const clip = (c: number, d: number, size: number) => {
    if (Math.abs(d) < 1e-9) return;
    const a = (0 - c) / d;
    const b = (size - c) / d;
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
  };
  clip(fit.cx, fit.dx, g.sheet.width_cm);
  clip(fit.cy, fit.dy, g.sheet.height_cm);
  if (!(t1 > t0)) return r;
  return {
    ...r,
    graph: setLine(
      g,
      { x_cm: fit.cx + t0 * fit.dx, y_cm: fit.cy + t0 * fit.dy },
      { x_cm: fit.cx + t1 * fit.dx, y_cm: fit.cy + t1 * fit.dy },
    ),
  };
}

/** Draws the large right-angled triangle on her line (its hypotenuse corners on the line). */
export function drawTriangle(r: OhmsLawRecord): OhmsLawRecord {
  const g = r.graph;
  if (!g?.line) return r;
  const { p1, p2 } = g.line;
  const [a, b] = TRIANGLE_AT;
  const at = (k: number): SheetPoint => ({
    x_cm: p1.x_cm + (p2.x_cm - p1.x_cm) * k,
    y_cm: p1.y_cm + (p2.y_cm - p1.y_cm) * k,
  });
  return { ...r, graph: setTriangle(g, at(a), at(b)) };
}

const fmt = (n: number) => n.toFixed(2);

/**
 * What she writes for ΔV, ΔI or s once her triangle is drawn: read off the triangle's sides on
 * her own scales, with the unit of each axis label ("ΔV = 1.20 − 0.30 = 0.90 V"), and s as
 * ΔV ÷ ΔI in ohms. Null before the triangle and both scales exist.
 */
export function readTriangle(r: OhmsLawRecord, part: "deltaY" | "deltaX" | "slope"): string | null {
  const g = r.graph;
  const tri = g?.triangle;
  if (!g || !tri) return null;
  const upx = g.x.units_per_cm;
  const upy = g.y.units_per_cm;
  if (upx === null || upy === null || !(upx > 0) || !(upy > 0)) return null;
  const [x1, x2] = [fromSheetCm(tri.p1.x_cm, g.x), fromSheetCm(tri.p3.x_cm, g.x)];
  const [y1, y2] = [fromSheetCm(tri.p1.y_cm, g.y), fromSheetCm(tri.p3.y_cm, g.y)];
  const xLo = Math.min(x1, x2);
  const xHi = Math.max(x1, x2);
  const yLo = Math.min(y1, y2);
  const yHi = Math.max(y1, y2);
  const xUnit = labelUnit(g.x.label_as_written) ?? "A";
  const yUnit = labelUnit(g.y.label_as_written) ?? "V";
  const dV = `ΔV = ${fmt(yHi)} − ${fmt(yLo)} = ${fmt(yHi - yLo)} ${yUnit}`;
  const dI = `ΔI = ${fmt(xHi)} − ${fmt(xLo)} = ${fmt(xHi - xLo)} ${xUnit}`;
  if (part === "deltaY") return dV;
  if (part === "deltaX") return dI;
  const dx = (xHi - xLo) * milliOf(g.x.label_as_written);
  if (dx === 0) return null;
  const s = ((yHi - yLo) * milliOf(g.y.label_as_written)) / dx;
  return `s = ΔV/ΔI = ${fmt(yHi - yLo)}/${fmt(xHi - xLo)} = ${fmt(s)} Ω`;
}

/**
 * Which plugs to move so the box shows `ohm`: the indices of the plugs whose state must change,
 * the fewest of them. A plug that is out leaves its coil in the circuit, so the box shows the
 * sum of the coils whose plugs are out. Empty when `ohm` cannot be made (or is already shown).
 */
export function plugMoves(
  coilsOhm: readonly number[],
  plugsIn: readonly boolean[],
  ohm: number,
): number[] {
  const n = coilsOhm.length;
  let currentOut = 0;
  for (let i = 0; i < n; i++) if (!plugsIn[i]) currentOut |= 1 << i;
  let best: number | null = null;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 1 << n; mask++) {
    let sum = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) sum += coilsOhm[i] ?? 0;
    if (Math.abs(sum - ohm) > 1e-9) continue;
    let diff = mask ^ currentOut;
    let cost = 0;
    while (diff) {
      cost += diff & 1;
      diff >>= 1;
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = mask;
    }
  }
  if (best === null) return [];
  const moves: number[] = [];
  for (let i = 0; i < n; i++) if (((best ^ currentOut) >> i) & 1) moves.push(i);
  return moves;
}
