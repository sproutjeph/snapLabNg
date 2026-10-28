// Golden Ohm's-law (V–I) records for the DRAFT scheme's tests (docs/07 §5.2,
// docs/plans/ohms-law-vi.md "Golden tables"). Each is exactly what a student typed or drew.
//
// No textbook gives this table: the values are illustrative and self-consistent, made for
// the tests. A run-down pair of cells (E = 2.61 V) with r + R_A = 0.7 Ω drives a 3.0 Ω wire
// XY (SWG 28, 4.41 Ω/m, at 68.0 cm), I = E/(R + 3.7 Ω), V = I × 3.0 Ω, each rounded to the
// 2 d.p. a half-division reading gives (0.02 A and 0.05 V divisions, docs/07 §4.4).
// Expected marks for every variant are stated in ohmsLaw.test.ts.
import type { Measured, OhmsLawGraph, OhmsLawRecord } from "@snaplab/contracts";

const m = (text: string): Measured => ({
  value: text.trim() !== "" && Number.isFinite(Number(text)) ? Number(text) : null,
  unit_as_written: null,
  text_as_written: text,
});

/** R, I, V as she wrote them (R in Ω, I in A, V in V). */
const GOOD_ROWS: Array<[string, string, string]> = [
  ["0", "0.71", "2.12"],
  ["1", "0.56", "1.67"],
  ["5", "0.30", "0.90"],
  ["10", "0.19", "0.57"],
  ["20", "0.11", "0.33"],
  ["40", "0.06", "0.18"],
  ["60", "0.04", "0.12"],
];

const rows = (t: Array<[string, string, string]>): OhmsLawRecord["rows"] =>
  t.map(([R, I, V]) => ({ R: m(R), I: m(I), V: m(V) }));

/** Her points on 2 cm to 0.1 A across and 1 cm to 0.1 V up: (I/0.05, V/0.1) in sheet cm. */
const pointsFor = (t: Array<[string, string, string]>) =>
  t.map(([, I, V]) => ({ x_cm: Number(I) / 0.05, y_cm: Number(V) / 0.1 }));

const GOOD_GRAPH: OhmsLawGraph = {
  sheet: { width_cm: 18, height_cm: 25 },
  x: {
    label_as_written: "I/A",
    scale_as_written: "2 cm to 0.1 A",
    units_per_cm: 0.05,
    origin_value: 0,
  },
  y: {
    label_as_written: "V/V",
    scale_as_written: "1 cm to 0.1 V",
    units_per_cm: 0.1,
    origin_value: 0,
  },
  points: pointsFor(GOOD_ROWS),
  // Her best-fit line through the origin, y_cm = 1.5 x_cm.
  line: { p1: { x_cm: 0, y_cm: 0 }, p2: { x_cm: 15, y_cm: 22.5 } },
  // Legs 12 cm across (0.60 A) and 18 cm up (1.80 V): more than half the line each way.
  triangle: {
    p1: { x_cm: 2, y_cm: 3 },
    p2: { x_cm: 14, y_cm: 3 },
    p3: { x_cm: 14, y_cm: 21 },
  },
  delta_y_as_written: "ΔV = 2.10 − 0.30 = 1.80 V",
  delta_x_as_written: "ΔI = 0.70 − 0.10 = 0.60 A",
  slope_as_written: "s = ΔV/ΔI = 1.80/0.60 = 3.0 Ω",
};

/** Good: every DRAFT item earned, 20 / 20 (21 / 21 in teacher mode with 3.0 Ω). */
export const OHMS_GOOD: OhmsLawRecord = {
  experiment: "ohms_law_vi",
  mode: "practice",
  length_xy: { value: 68, unit_as_written: "cm", text_as_written: "68.0" },
  headers: { R: "R/Ω", I: "I/A", V: "V/V" },
  rows: rows(GOOD_ROWS),
  graph: GOOD_GRAPH,
  precautions: [
    "The key was opened between readings.",
    "Parallax was avoided by reading each meter with the pointer over its image in the mirror.",
  ],
  law_as_written:
    "Ohm's law: the current flowing through a metallic conductor is directly proportional to the potential difference across its ends, provided the temperature and other physical conditions remain constant.",
  length_calc_as_written:
    "A = πd²/4 = (22/7 × (0.2 × 10⁻³)²)/4 = 3.143 × 10⁻⁸ m²\nL = RA/ρ = (7 × 3.143 × 10⁻⁸)/(8.8 × 10⁻⁷) = 0.25 m",
};

const withGraph = (g: Partial<OhmsLawGraph>): OhmsLawRecord => ({
  ...OHMS_GOOD,
  graph: { ...GOOD_GRAPH, ...g },
});

/** A 1 d.p. slip: I at R = 5 Ω written "0.3". Six of seven rows still pass PHYS-2DP. */
export const OHMS_SLIP_1DP: OhmsLawRecord = {
  ...OHMS_GOOD,
  rows: rows(GOOD_ROWS.map((r) => (r[0] === "5" ? ["5", "0.3", r[2]] : r))),
};

/** Three 1 d.p. slips in I ("0.3", "0.2", "0.1"): only four rows pass PHYS-2DP:I. */
export const OHMS_SLIP_3X1DP: OhmsLawRecord = {
  ...OHMS_GOOD,
  rows: rows(
    GOOD_ROWS.map((r) =>
      r[0] === "5"
        ? ["5", "0.3", r[2]]
        : r[0] === "10"
          ? ["10", "0.2", r[2]]
          : r[0] === "20"
            ? ["20", "0.1", r[2]]
            : r,
    ),
  ),
};

/** Axes swapped: I up, V across, on a landscape sheet; slope ΔI/ΔV in A/V. */
export const OHMS_AXES_SWAPPED: OhmsLawRecord = withGraph({
  sheet: { width_cm: 25, height_cm: 18 },
  x: { ...GOOD_GRAPH.y },
  y: { ...GOOD_GRAPH.x },
  points: GOOD_GRAPH.points.map((p) => ({ x_cm: p.y_cm, y_cm: p.x_cm })),
  line: { p1: { x_cm: 0, y_cm: 0 }, p2: { x_cm: 22.5, y_cm: 15 } },
  triangle: {
    p1: { x_cm: 3, y_cm: 2 },
    p2: { x_cm: 21, y_cm: 2 },
    p3: { x_cm: 21, y_cm: 14 },
  },
  delta_y_as_written: "ΔI = 0.70 − 0.10 = 0.60 A",
  delta_x_as_written: "ΔV = 2.10 − 0.30 = 1.80 V",
  slope_as_written: "s = ΔI/ΔV = 0.60/1.80 = 0.33 A/V",
});

/** A small triangle: legs 2 cm across (0.10 A) and 3 cm up (0.30 V), read correctly. */
export const OHMS_SMALL_TRIANGLE: OhmsLawRecord = withGraph({
  triangle: {
    p1: { x_cm: 6, y_cm: 9 },
    p2: { x_cm: 8, y_cm: 9 },
    p3: { x_cm: 8, y_cm: 12 },
  },
  delta_y_as_written: "ΔV = 1.20 − 0.90 = 0.30 V",
  delta_x_as_written: "ΔI = 0.40 − 0.30 = 0.10 A",
  slope_as_written: "s = 0.30/0.10 = 3.0 Ω",
});

/** Precautions written as instructions, not as things done. */
export const OHMS_WRONG_TENSE: OhmsLawRecord = {
  ...OHMS_GOOD,
  precautions: ["Avoid parallax error when reading the meters.", "Open the key between readings."],
};

/** Only four rows (R = 0, 1, 5, 10 Ω), each plotted. */
export const OHMS_FOUR_ROWS: OhmsLawRecord = {
  ...withGraph({ points: pointsFor(GOOD_ROWS.slice(0, 4)) }),
  rows: rows(GOOD_ROWS.slice(0, 4)),
};

/** s written without its unit. */
export const OHMS_SLOPE_NO_UNIT: OhmsLawRecord = withGraph({
  slope_as_written: "s = ΔV/ΔI = 1.80/0.60 = 3.0",
});

/** Three points plotted 0.3 cm (1½ small squares) above where her rows fall. */
export const OHMS_POINTS_OFF: OhmsLawRecord = withGraph({
  points: GOOD_GRAPH.points.map((p, i) => (i >= 3 && i <= 5 ? { ...p, y_cm: p.y_cm + 0.3 } : p)),
});

/** The law stated without its condition. */
export const OHMS_LAW_NO_CONDITION: OhmsLawRecord = {
  ...OHMS_GOOD,
  law_as_written:
    "Ohm's law states that the current through a conductor is directly proportional to the potential difference across it.",
};

/** (b)(ii) worked correctly but the answer has no unit. */
export const OHMS_CALC_NO_UNIT: OhmsLawRecord = {
  ...OHMS_GOOD,
  length_calc_as_written:
    "A = πd²/4 = (22/7 × (0.2 × 10⁻³)²)/4 = 3.143 × 10⁻⁸ m²\nL = RA/ρ = (7 × 3.143 × 10⁻⁸)/(8.8 × 10⁻⁷) = 0.25",
};

/**
 * The good triangle moved 3 cm up, off her line (its hypotenuse corners are 1.7 cm from it).
 * Its legs are still 12 cm and 18 cm, read correctly as 0.60 A and 1.80 V.
 */
export const OHMS_TRIANGLE_OFF_LINE: OhmsLawRecord = withGraph({
  triangle: {
    p1: { x_cm: 2, y_cm: 6 },
    p2: { x_cm: 14, y_cm: 6 },
    p3: { x_cm: 14, y_cm: 24 },
  },
});

/** Five complete rows (R = 0 to 20 Ω) and two rows with R written but I and V left blank. */
export const OHMS_FIVE_PLUS_BLANK: OhmsLawRecord = {
  ...withGraph({ points: pointsFor(GOOD_ROWS.slice(0, 5)) }),
  rows: rows([...GOOD_ROWS.slice(0, 5), ["40", "", ""], ["60", "", ""]]),
};
