import type { OhmsLawGraph, SheetPoint } from "@snaplab/contracts";

// The pure side of the graph sheet: sheet-cm geometry and the edits that write `OhmsLawGraph`.
// Nothing here knows the bench or the table: every number comes from where she tapped or what
// she typed. No slope, scale or point position is ever worked out for her.

export type Axis = "x" | "y";
export type DeltaField = "delta_y_as_written" | "delta_x_as_written" | "slope_as_written";
type Sheet = OhmsLawGraph["sheet"];

/** An 18 × 24 cm sheet of 2 mm graph paper, portrait. */
export const SHEET_WIDTH_CM = 18;
export const SHEET_HEIGHT_CM = 24;
/** Her marks land on whole millimetres: half a small square of 2 mm paper. */
export const SNAP_CM = 0.1;
/** A triangle corner within this distance (2 mm) of her line snaps onto it. */
export const LINE_SNAP_CM = 0.2;

export function emptyGraph(): OhmsLawGraph {
  const axis = () => ({
    label_as_written: null,
    scale_as_written: null,
    units_per_cm: null,
    origin_value: 0,
  });
  return {
    sheet: { width_cm: SHEET_WIDTH_CM, height_cm: SHEET_HEIGHT_CM },
    x: axis(),
    y: axis(),
    points: [],
    line: null,
    triangle: null,
    delta_y_as_written: null,
    delta_x_as_written: null,
    slope_as_written: null,
  };
}

/** Nearest whole millimetre. Dividing by ten (not multiplying by 0.1) keeps 3.3 as 3.3. */
export const snapMm = (cm: number): number => Math.round(cm * 10) / 10;

const round2 = (cm: number): number => Math.round(cm * 100) / 100;

export function insideSheet(p: SheetPoint, sheet: Sheet): boolean {
  return p.x_cm >= 0 && p.x_cm <= sheet.width_cm && p.y_cm >= 0 && p.y_cm <= sheet.height_cm;
}

/** Snap to 1 mm and keep it on the sheet. */
export function snapToGrid(p: SheetPoint, sheet: Sheet): SheetPoint {
  const clamp = (v: number, max: number) => Math.min(Math.max(snapMm(v), 0), max);
  return { x_cm: clamp(p.x_cm, sheet.width_cm), y_cm: clamp(p.y_cm, sheet.height_cm) };
}

/** The drawing area around the grid, in cm: room for the tick numbers and the axis labels. */
export const MARGIN = { left: 2.4, right: 0.8, top: 0.8, bottom: 2.4 } as const;

export interface ViewBox {
  w: number;
  h: number;
}

export const viewBoxFor = (sheet: Sheet): ViewBox => ({
  w: MARGIN.left + sheet.width_cm + MARGIN.right,
  h: MARGIN.top + sheet.height_cm + MARGIN.bottom,
});

/** A screen position inside the SVG's box to sheet cm from the grid's bottom-left corner. */
export function clientToSheet(
  rect: { left: number; top: number; width: number; height: number },
  vb: ViewBox,
  sheet: Sheet,
  clientX: number,
  clientY: number,
): SheetPoint {
  const vx = ((clientX - rect.left) / rect.width) * vb.w;
  const vy = ((clientY - rect.top) / rect.height) * vb.h;
  return { x_cm: vx - MARGIN.left, y_cm: MARGIN.top + sheet.height_cm - vy };
}

// ---- Her scale, as she writes it ----

export interface ParsedScale {
  /** Value per cm of sheet, in whatever unit she named. */
  unitsPerCm: number;
  unit: string | null;
}

const NUM = "(\\d+(?:[.,]\\d+)?|[.,]\\d+)";
const UNIT = "([^\\d\\s].*?)?";
const toNumber = (s: string): number => Number(s.replace(",", "."));
// "2 cm to 0.1 A", "2cm = 0.1A", "2 cm : 0.1"
const CM_TO_VALUE = new RegExp(
  `^\\s*${NUM}\\s*cm\\s*(?:to|=|:|represents?|for|stands\\s+for)\\s*${NUM}\\s*${UNIT}\\s*$`,
  "i",
);
// "0.05 A per cm", "0.05 A/cm"
const VALUE_PER_CM = new RegExp(`^\\s*${NUM}\\s*${UNIT}\\s*(?:per|/)\\s*(?:1\\s*)?cm\\s*$`, "i");
// "0.1 A to 2 cm" (value first)
const VALUE_TO_CM = new RegExp(`^\\s*${NUM}\\s*${UNIT}\\s*(?:to|=|:)\\s*${NUM}\\s*cm\\s*$`, "i");

// The unit she wrote, and the one on her axis label, read the way packages/rules reads them
// (rules/ohmsLaw.ts: AMPERE, VOLT, isMilli, milliFactor).
const AMPERE = /^(m?A|amps?|amperes?|milliamps?|milliamperes?)$/i;
const VOLT = /^(m?V|volts?|millivolts?)$/i;
const isMilli = (unit: string) => /^(m[AV]|milli)/.test(unit);
const milliFactor = (unit: string | null) => (unit !== null && isMilli(unit) ? 1e-3 : 1);
const baseOf = (unit: string | null): "A" | "V" | null =>
  unit === null ? null : AMPERE.test(unit) ? "A" : VOLT.test(unit) ? "V" : null;

/** The unit part of an axis label: "I (A)" gives "A", "V/mV" gives "mV". */
export function labelUnit(label: string | null): string | null {
  if (!label) return null;
  const bracket = label.match(/\(([^)]*)\)/)?.[1];
  if (bracket !== undefined) return bracket.trim() || null;
  const afterSlash = label.match(/\/\s*(.+)$/)?.[1];
  return afterSlash !== undefined ? afterSlash.trim() : null;
}

/**
 * Reads "2 cm to 0.1 A" as 0.05 A per cm, in the unit of her axis label (the unit the marker
 * reads `units_per_cm` in): "2 cm to 100 mA" on an "I/A" axis is 0.05 A per cm. Returns null
 * when it can't be read, isn't a positive finite scale, or its unit can't be reconciled with
 * the axis (a volt scale on an ampere axis, or a unit that is neither). The text she typed is
 * kept as it is; this only fills `units_per_cm`.
 */
export function parseScale(text: string, axisLabel: string | null = null): ParsedScale | null {
  const clean = (unit: string | undefined) => {
    const u = unit?.trim();
    return u ? u : null;
  };
  let cm: number;
  let value: number;
  let unit: string | null;
  const a = CM_TO_VALUE.exec(text);
  const b = VALUE_PER_CM.exec(text);
  const c = VALUE_TO_CM.exec(text);
  if (a?.[1] && a[2]) {
    cm = toNumber(a[1]);
    value = toNumber(a[2]);
    unit = clean(a[3]);
  } else if (b?.[1]) {
    cm = 1;
    value = toNumber(b[1]);
    unit = clean(b[2]);
  } else if (c?.[1] && c[3]) {
    value = toNumber(c[1]);
    cm = toNumber(c[3]);
    unit = clean(c[2]);
  } else {
    return null;
  }
  if (!(cm > 0) || !(value > 0)) return null;
  let perCm = value / cm;
  if (unit !== null) {
    const base = baseOf(unit);
    if (base === null) return null;
    const axisBase = baseOf(labelUnit(axisLabel));
    if (axisBase !== null && axisBase !== base) return null;
    perCm = (perCm * milliFactor(unit)) / milliFactor(labelUnit(axisLabel));
  }
  return Number.isFinite(perCm) ? { unitsPerCm: Number(perCm.toPrecision(12)), unit } : null;
}

// ---- Edits (each returns the whole next graph) ----

export const orNull = (text: string): string | null => (text === "" ? null : text);

/** Her scale is read against her label's unit, so a new label re-reads the scale she wrote. */
export function setAxisLabel(g: OhmsLawGraph, axis: Axis, text: string): OhmsLawGraph {
  const label = orNull(text);
  const scale = g[axis].scale_as_written;
  const parsed = scale === null ? null : parseScale(scale, label);
  return {
    ...g,
    [axis]: { ...g[axis], label_as_written: label, units_per_cm: parsed?.unitsPerCm ?? null },
  };
}

export function setAxisScale(g: OhmsLawGraph, axis: Axis, text: string): OhmsLawGraph {
  const parsed = text === "" ? null : parseScale(text, g[axis].label_as_written);
  return {
    ...g,
    [axis]: {
      ...g[axis],
      scale_as_written: orNull(text),
      units_per_cm: parsed?.unitsPerCm ?? null,
    },
  };
}

export function setAxisOrigin(g: OhmsLawGraph, axis: Axis, value: number): OhmsLawGraph {
  return { ...g, [axis]: { ...g[axis], origin_value: value } };
}

export function setDelta(g: OhmsLawGraph, field: DeltaField, text: string): OhmsLawGraph {
  return { ...g, [field]: orNull(text) };
}

const same = (a: SheetPoint, b: SheetPoint) => a.x_cm === b.x_cm && a.y_cm === b.y_cm;

/** Adds a point at the tapped place, on the 1 mm grid. A second mark in the same place is ignored. */
export function addPoint(g: OhmsLawGraph, at: SheetPoint): OhmsLawGraph {
  const p = snapToGrid(at, g.sheet);
  return g.points.some((q) => same(q, p)) ? g : { ...g, points: [...g.points, p] };
}

export function removePoint(g: OhmsLawGraph, index: number): OhmsLawGraph {
  return { ...g, points: g.points.filter((_, i) => i !== index) };
}

export function setLine(g: OhmsLawGraph, p1: SheetPoint, p2: SheetPoint): OhmsLawGraph {
  return { ...g, line: { p1: snapToGrid(p1, g.sheet), p2: snapToGrid(p2, g.sheet) } };
}

export function moveLineEnd(g: OhmsLawGraph, end: "p1" | "p2", to: SheetPoint): OhmsLawGraph {
  if (!g.line) return g;
  return { ...g, line: { ...g.line, [end]: snapToGrid(to, g.sheet) } };
}

export const clearLine = (g: OhmsLawGraph): OhmsLawGraph => ({ ...g, line: null });

/** The nearest spot on her drawn line to p, when p is within 2 mm of it; otherwise p itself. */
export function snapToLine(
  p: SheetPoint,
  line: OhmsLawGraph["line"],
  tol: number = LINE_SNAP_CM,
): SheetPoint {
  if (!line) return p;
  const dx = line.p2.x_cm - line.p1.x_cm;
  const dy = line.p2.y_cm - line.p1.y_cm;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return p;
  const t = Math.min(
    Math.max(((p.x_cm - line.p1.x_cm) * dx + (p.y_cm - line.p1.y_cm) * dy) / len2, 0),
    1,
  );
  const foot = { x_cm: line.p1.x_cm + t * dx, y_cm: line.p1.y_cm + t * dy };
  const dist = Math.hypot(p.x_cm - foot.x_cm, p.y_cm - foot.y_cm);
  return dist <= tol + 1e-9 ? { x_cm: round2(foot.x_cm), y_cm: round2(foot.y_cm) } : p;
}

/**
 * Her triangle from its two hypotenuse corners: the third corner sits level with the first and
 * straight below (or above) the second, so the legs are horizontal and vertical. Each
 * hypotenuse corner snaps onto her line when it is within 2 mm of it.
 */
export function setTriangle(g: OhmsLawGraph, a: SheetPoint, b: SheetPoint): OhmsLawGraph {
  const place = (p: SheetPoint) => snapToLine(snapToGrid(p, g.sheet), g.line);
  const p1 = place(a);
  const p3 = place(b);
  return { ...g, triangle: { p1, p2: { x_cm: p3.x_cm, y_cm: p1.y_cm }, p3 } };
}

export function moveTriangleCorner(
  g: OhmsLawGraph,
  which: "a" | "b",
  to: SheetPoint,
): OhmsLawGraph {
  if (!g.triangle) return g;
  return which === "a" ? setTriangle(g, to, g.triangle.p3) : setTriangle(g, g.triangle.p1, to);
}

export const clearTriangle = (g: OhmsLawGraph): OhmsLawGraph => ({ ...g, triangle: null });

// ---- Typed positions (the keyboard path) ----

/** A number of cm typed by her; null when it isn't one. Accepts a decimal comma. */
export function parseCm(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** A typed x and y, or why not. The point must lie on the sheet. */
export function parseTypedPoint(
  xText: string,
  yText: string,
  sheet: Sheet,
): { ok: true; point: SheetPoint } | { ok: false; reason: string } {
  const x = parseCm(xText);
  const y = parseCm(yText);
  if (x === null || y === null) {
    return { ok: false, reason: "Type both positions as numbers in cm." };
  }
  const point = { x_cm: x, y_cm: y };
  if (!insideSheet(point, sheet)) {
    return {
      ok: false,
      reason: `Keep inside the grid: 0 to ${sheet.width_cm} cm across, 0 to ${sheet.height_cm} cm up.`,
    };
  }
  return { ok: true, point: snapToGrid(point, sheet) };
}

/** Centimetres for display: 3 not 3.0000000000000004. */
export const fmtCm = (cm: number): string => String(Math.round(cm * 100) / 100);

/** A tick number on her own scale, free of float noise (0.3 not 0.30000000000000004). */
export const fmtTick = (v: number): string => String(Number(v.toPrecision(6)));
