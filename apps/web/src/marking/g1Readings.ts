import type { Box, MarkSheet, Readings } from "@snaplab/contracts";
import { markMeterBridge } from "@snaplab/rules";

type Col = "R" | "l" | "R_inv" | "l_inv";

const COLS: readonly Col[] = ["R", "l", "R_inv", "l_inv"];

/**
 * Horizontal cell bounds per column matching `g1Page.ts` (`colX = [0.06, 0.20, 0.44, 0.64, 0.84]`).
 * Column `l` sits at `0.23..0.30` so row 4's `"−½ 57.0"` correction fits inside `0.31..0.43`
 * without touching Column `R_inv` (`0.485..0.575`).
 */
const COL_BOX_X: Record<Col, readonly [number, number]> = {
  R: [0.095, 0.165],
  l: [0.23, 0.3],
  R_inv: [0.485, 0.575],
  l_inv: [0.68, 0.77],
};

const ROW_BOX_Y: ReadonlyArray<readonly [number, number]> = [
  [0.306, 0.334], // header
  [0.346, 0.374], // row 1
  [0.386, 0.414], // row 2
  [0.426, 0.454], // row 3
  [0.466, 0.494], // row 4
  [0.506, 0.534], // row 5
];

function cellBox(col: Col, rowIndex: number): Box {
  const [x0, x1] = COL_BOX_X[col];
  const [y0, y1] = ROW_BOX_Y[rowIndex] ?? [0.506, 0.534];
  return { x0, y0, x1, y1 };
}

const G1_HEADERS: Record<Col, string> = {
  R: "R (Ω)",
  l: "l (cm)",
  R_inv: "R⁻¹ (Ω⁻¹)",
  l_inv: "l⁻¹",
};

const G1_ROWS: ReadonlyArray<readonly [string, string, string, string]> = [
  ["1.0", "25.3", "1.00", "0.0395"],
  ["2.0", "39.8", "0.500", "0.0251"],
  ["3.0", "50.2", "0.333", "0.02"],
  ["4.0", "57", "0.250", "0.0175"],
  ["5.0", "62.4", "0.200", "0.0160"],
];

function buildG1Cells(): Readings["cells"] {
  const cells: Readings["cells"] = [];
  for (const col of COLS) {
    cells.push({
      row: "header",
      column: col,
      column_header_as_written: G1_HEADERS[col],
      text_as_written: G1_HEADERS[col],
      value: null,
      unit_as_written: null,
      box: cellBox(col, 0),
      legibility: "clear",
    });
  }
  G1_ROWS.forEach((row, ri) => {
    COLS.forEach((col, ci) => {
      const text = row[ci] ?? "";
      cells.push({
        row: String(ri + 1),
        column: col,
        column_header_as_written: G1_HEADERS[col],
        text_as_written: text,
        value: Number(text),
        unit_as_written: null,
        box: cellBox(col, ri + 1),
        legibility: "clear",
      });
    });
  });
  return cells;
}

/**
 * Golden G1 flawed metre-bridge readings (docs/11 §2, docs/15 §5) with evidence boxes
 * aligned to the synthetic exercise-book page drawn by `g1Page.ts`.
 */
export const g1Readings = {
  table_found: true,
  cells: buildG1Cells(),
  average_as_written: null,
  graph: {
    x_label_as_written: "R⁻¹ (Ω⁻¹)",
    y_label_as_written: "l⁻¹",
    points: [
      { x: 1.0, y: 0.0395 },
      { x: 0.5, y: 0.0251 },
      { x: 0.333, y: 0.02 },
      { x: 0.25, y: 0.0175 },
      { x: 0.2, y: 0.016 },
    ],
    line_drawn: true,
    triangle: {
      p1: { x: 0.2, y: 0.016 },
      p2: { x: 0.25, y: 0.016 },
      p3: { x: 0.25, y: 0.0175 },
    },
    slope_as_written: "s = (0.0175 − 0.0160) ÷ (0.250 − 0.200) = 0.030",
    intercept_as_written: "c = 0.010",
    result_as_written: "X = s/c = 0.030 ÷ 0.010 = 3.0 Ω",
    // Small graph (~¼ of the page) in the lower right.
    box: { x0: 0.5, y0: 0.57, x1: 0.79, y1: 0.8 },
  },
  precautions: [
    "1. Avoid parallax error when reading the metre rule.",
    "2. I slid the jockey gently along the wire to find the balance point.",
  ],
  other_marks: [],
} satisfies Readings;

export const G1_KEY_SETUP_BOX: Box = {
  x0: 0.54,
  y0: 0.094,
  x1: 0.68,
  y1: 0.122,
};

/**
 * G1 MarkSheet produced deterministically by `markMeterBridge` from `@snaplab/rules`.
 */
export const g1Sheet: MarkSheet = markMeterBridge(g1Readings, {
  teacherXOhm: null,
  setupIssues: [
    {
      description: "No key drawn in the circuit",
      box: G1_KEY_SETUP_BOX,
    },
  ],
});
