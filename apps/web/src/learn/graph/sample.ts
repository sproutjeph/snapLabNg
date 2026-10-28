import type { OhmsLawGraph, OhmsLawRecord } from "@snaplab/contracts";
import {
  emptyOhmsLawRecord,
  setCell,
  setHeader,
  setLaw,
  setLength,
  setPrecaution,
} from "../readings/record";
import type { LessonMode } from "../types";
import {
  addPoint,
  emptyGraph,
  setAxisLabel,
  setAxisScale,
  setDelta,
  setLine,
  setTriangle,
} from "./model";

// A worked example for the preview and the tests: a table typed as a student would, and a
// sheet drawn through the same edits the component makes. Illustrative numbers only (the same
// self-consistent table as packages/rules' golden "good" record); the sheet component never
// sees them.

const ROWS: Array<[string, string, string]> = [
  ["0", "0.71", "2.12"],
  ["1", "0.56", "1.67"],
  ["5", "0.30", "0.90"],
  ["10", "0.19", "0.57"],
  ["20", "0.11", "0.33"],
  ["40", "0.06", "0.18"],
  ["60", "0.04", "0.12"],
];

/** Her table, typed. Readings and headers only; no graph. */
export function sampleTable(mode: LessonMode): OhmsLawRecord {
  let r = emptyOhmsLawRecord(mode);
  r = setLength(r, "68.0 cm");
  r = setHeader(setHeader(setHeader(r, "R", "R/Ω"), "I", "I/A"), "V", "V/V");
  ROWS.forEach(([R, I, V], i) => {
    r = setCell(setCell(setCell(r, i, "R", R), i, "I", I), i, "V", V);
  });
  r = setPrecaution(r, 0, "The key was opened between readings.");
  r = setLaw(r, "Current is proportional to p.d. at constant temperature.");
  return r;
}

/**
 * A correctly drawn sheet for that table: 2 cm to 0.1 A across, 1 cm to 0.1 V up, every row
 * plotted, a line through them, and a large triangle on the line with its sides read off.
 */
export function sampleGraph(): OhmsLawGraph {
  let g = emptyGraph();
  g = setAxisLabel(setAxisLabel(g, "x", "I/A"), "y", "V/V");
  g = setAxisScale(setAxisScale(g, "x", "2 cm to 0.1 A"), "y", "1 cm to 0.1 V");
  for (const [, I, V] of ROWS) {
    g = addPoint(g, { x_cm: Number(I) / 0.05, y_cm: Number(V) / 0.1 });
  }
  g = setLine(g, { x_cm: 0, y_cm: 0 }, { x_cm: 15, y_cm: 22.5 });
  g = setTriangle(g, { x_cm: 2, y_cm: 3 }, { x_cm: 14, y_cm: 21 });
  g = setDelta(g, "delta_y_as_written", "ΔV = 2.10 − 0.30 = 1.80 V");
  g = setDelta(g, "delta_x_as_written", "ΔI = 0.70 − 0.10 = 0.60 A");
  g = setDelta(g, "slope_as_written", "s = ΔV/ΔI = 1.80/0.60 = 3.0 Ω");
  return g;
}

export function sampleRecord(mode: LessonMode): OhmsLawRecord {
  return { ...sampleTable(mode), graph: sampleGraph() };
}
