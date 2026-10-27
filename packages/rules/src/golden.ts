// Golden pages G1 (flawed) and G2 (clean) as Readings, exactly as written in
// docs/11 §2–3. Used by the tests and by previews; boxes are plausible page positions.
import type { Box, Readings } from "@snaplab/contracts";

type Col = "R" | "l" | "R_inv" | "l_inv";
const COLS: Col[] = ["R", "l", "R_inv", "l_inv"];

function box(x0: number, y0: number, w = 0.08, h = 0.025): Box {
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

function table(headers: Record<Col, string>, rows: string[][]): Readings["cells"] {
  const cells: Readings["cells"] = [];
  COLS.forEach((col, ci) => {
    cells.push({
      row: "header",
      column: col,
      column_header_as_written: headers[col],
      text_as_written: headers[col],
      value: null,
      unit_as_written: null,
      box: box(0.12 + ci * 0.18, 0.52),
      legibility: "clear",
    });
  });
  rows.forEach((r, ri) => {
    COLS.forEach((col, ci) => {
      const text = r[ci] ?? "";
      cells.push({
        row: String(ri + 1),
        column: col,
        column_header_as_written: headers[col],
        text_as_written: text,
        value: Number(text),
        unit_as_written: null,
        box: box(0.12 + ci * 0.18, 0.56 + ri * 0.035),
        legibility: "clear",
      });
    });
  });
  return cells;
}

const G1_ROWS = [
  ["1.0", "25.3", "1.00", "0.0395"],
  ["2.0", "39.8", "0.500", "0.0251"],
  ["3.0", "50.2", "0.333", "0.02"],
  ["4.0", "57", "0.250", "0.0175"],
  ["5.0", "62.4", "0.200", "0.0160"],
];

/** G1: Amina's flawed page (docs/11 §2). Expected 15½ / 21 (docs/15 §5). */
export const G1_READINGS: Readings = {
  table_found: true,
  cells: table({ R: "R (Ω)", l: "l (cm)", R_inv: "R⁻¹ (Ω⁻¹)", l_inv: "l⁻¹" }, G1_ROWS),
  average_as_written: null,
  graph: {
    x_label_as_written: "R⁻¹ (Ω⁻¹)",
    y_label_as_written: "l⁻¹",
    // Plotted from her table, the third at 0.020 as she wrote it.
    points: [
      { x: 1.0, y: 0.0395 },
      { x: 0.5, y: 0.0251 },
      { x: 0.333, y: 0.02 },
      { x: 0.25, y: 0.0175 },
      { x: 0.2, y: 0.016 },
    ],
    line_drawn: true,
    // The small triangle between the neighbouring points at R⁻¹ = 0.200 and 0.250.
    triangle: { p1: { x: 0.2, y: 0.016 }, p2: { x: 0.25, y: 0.016 }, p3: { x: 0.25, y: 0.0175 } },
    slope_as_written: "s = (0.0175 − 0.0160) ÷ (0.250 − 0.200) = 0.030",
    intercept_as_written: "c = 0.010",
    result_as_written: "X = s/c = 0.030 ÷ 0.010 = 3.0 Ω",
    // About a quarter of the sheet.
    box: { x0: 0.55, y0: 0.7, x1: 0.95, y1: 0.95 },
  },
  precautions: [
    "1. Avoid parallax error when reading the metre rule.",
    "2. I slid the jockey gently along the wire to find the balance point.",
  ],
  other_marks: [],
};

/** G2: the same page done correctly (docs/11 §3). Expected 21 / 21; 22 / 22 with a teacher value of 3.0 Ω. */
export const G2_READINGS: Readings = {
  table_found: true,
  cells: table(
    { R: "R (Ω)", l: "l (cm)", R_inv: "R⁻¹ (Ω⁻¹)", l_inv: "l⁻¹ (cm⁻¹)" },
    G1_ROWS.map((r, i) =>
      i === 2 ? [r[0], r[1], r[2], "0.0199"] : i === 3 ? [r[0], "57.0", r[2], r[3]] : r,
    ) as string[][],
  ),
  average_as_written: null,
  graph: {
    x_label_as_written: "R⁻¹ (Ω⁻¹)",
    y_label_as_written: "l⁻¹ (cm⁻¹)",
    points: [
      { x: 1.0, y: 0.0395 },
      { x: 0.5, y: 0.0251 },
      { x: 0.333, y: 0.0199 },
      { x: 0.25, y: 0.0175 },
      { x: 0.2, y: 0.016 },
    ],
    line_drawn: true,
    // Large triangle on the line from R⁻¹ = 0.15 to 1.00.
    triangle: { p1: { x: 0.15, y: 0.0146 }, p2: { x: 1.0, y: 0.0146 }, p3: { x: 1.0, y: 0.0396 } },
    slope_as_written: "s = (0.0396 − 0.0146) ÷ (1.00 − 0.15) = 0.0294 Ω cm⁻¹",
    intercept_as_written: "c = 0.0102 cm⁻¹",
    result_as_written: "X = s/c = 2.88 Ω",
    // At least half of the sheet.
    box: { x0: 0.05, y0: 0.3, x1: 0.95, y1: 0.95 },
  },
  precautions: [
    "1. The key was opened between readings.",
    "2. The jockey was not dragged along the wire.",
  ],
  other_marks: [],
};
