import type { MarkItem, MarkSheet, OhmsLawAxis, OhmsLawRecord, RuleCode } from "@snaplab/contracts";
import { judgePrecaution, type PrecautionId, type PrecautionJudgement } from "./precautions";
import { decimalPlaces, hasUnit, lastNumber, parseNumber } from "./text";

// The hands-on Ohm's-law (V–I) practical, docs/07 §4.4 and the "Ohm's law (V–I) rows" of
// §5.2; question in docs/plans/ohms-law-vi.md.
//
// DRAFT: needs a physics teacher's check. The user will supply the official scheme; until
// then the mark split below is ours, modelled on the WAEC Physics P3 expected answers the
// metre bridge already follows (positive marking, half marks, what she wrote as written).
// When the official scheme arrives, only this file and its golden tests change.
//
// Mark allocation (20 in student mode, 21 in teacher mode):
//   PHYS-1DP      XY to at least 1 d.p. (½); XY in cm (½)                              1
//   PHYS-TABLE    composite table of R, I, V with at least 5 rows (1); R in Ω (½)      1½
//   PHYS-2DP      I to 2 d.p. in ≥ 5 rows (1); V to 2 d.p. in ≥ 5 rows (1);
//                 I and V headers carry their units (½)                                2½
//   PHYS-TREND    I falls as R rises (½); V falls as R rises (½)                       1
//   GRAPH-AXES    V on the vertical (½); I on the horizontal (½); both with units (½)  1½
//   GRAPH-SCALE   points span ≥ ⅓ of the sheet across (½) and up (½)                   1
//   GRAPH-POINTS  ≥ 5 points on her own table (1½; 4 → 1, 3 → ½)                      1½
//   GRAPH-LINE    a best-fit straight line through her points                          1
//   GRAPH-SLOPE   large triangle (1); ΔV and ΔI read off it (½); s = ΔV/ΔI (½);
//                 s with the unit Ω (½)                                                2½
//   PRECAUTIONS   any two, in the reported tense (1 each)                              2
//   PHYS-LAW      (b)(i) Ohm's law named (½); stated (1) with its condition (1)        2½
//   PHYS-CALC     (b)(ii) L = RA/ρ (½); A = πd²/4 (½); 0.25 m (½) with its unit (½)    2
//   PHYS-ACCURACY teacher mode only: s within ±10% of the teacher's R_XY               (1)

/** The sheet label. The UI shows it, so the DRAFT status is visible wherever marks are. */
export const OHMS_LAW_QUESTION_LABEL =
  "Ohm's law (V–I) — DRAFT scheme, needs a physics teacher's check";

const SRC = {
  draft: {
    label: "SnapLab DRAFT Ohm's-law scheme (docs/07 §5.2), modelled on WAEC Physics P3",
    url: "https://waeconline.org.ng/E-Learning/Physics/Phys340mq3B.html",
  },
  y2023: {
    label: "WAEC Physics P3 May/June 2023 Q3B",
    url: "https://waeconline.org.ng/E-Learning/Physics/Phys340mq3B.html",
  },
  y2018: {
    label: "WAEC Physics P3 May/June 2018 Q3A",
    url: "https://waeconline.org.ng/E-Learning/Physics/Phys327mq3A.html",
  },
} as const;

// ---- Config (DRAFT; each is a stated interpretation, not a published WAEC number) ----

/** The question asks for seven rows; the "at least five rows" items need this many to pass. */
const MIN_ROWS = 5;
/** PHYS-TREND needs this many complete rows before a trend can be seen at all. */
const MIN_TREND_ROWS = 3;
/** WAEC: the graph covers at least ⅓ of the sheet (docs/07 §5.2 GRAPH-SCALE). Each way. */
const GRAPH_SHEET_SHARE = 1 / 3;
/** Half a small square on 2 mm graph paper: a point this close to her row is correct. */
const POINT_TOLERANCE_CM = 0.1;
/** Her line may differ in direction from the best fit to her own points by this much. */
const LINE_ANGLE_TOLERANCE_DEG = 3;
/** Her line must pass this close to the centroid of her own points (two small squares). */
const LINE_CENTROID_TOLERANCE_CM = 0.4;
/** "Large" triangle: each leg spans at least this share of her line's extent that way. */
const LARGE_TRIANGLE_SHARE = 0.5;
/** A triangle leg counts as horizontal (or vertical) within half a small square. */
const TRIANGLE_AXIS_TOLERANCE_CM = 0.1;
/** Each hypotenuse corner must lie within one small square of her drawn line. */
const TRIANGLE_ON_LINE_TOLERANCE_CM = 0.2;
/** Her ΔV and ΔI may differ from her triangle's legs, read on her scales, by one small square. */
const SLOPE_READ_TOLERANCE_CM = 0.2;
/** s must equal her own ΔV ÷ ΔI within this share (rounding to 2–3 s.f.). */
const SLOPE_MATCH = 0.02;
/** WAEC's ±10% accuracy band (WAEC Phys P3 May/June 2023 Q3B, as the metre bridge uses). */
const ACCURACY_BAND = 0.1;
/** (b)(ii) answer tolerance: covers π = 3.14 or 22/7 and rounding to 2 s.f. */
const CALC_MATCH = 0.02;

// ---- (b)(ii), fixed data in the question (docs/plans/ohms-law-vi.md "The question") ----

const CALC_RESISTANCE_OHM = 7;
const CALC_DIAMETER_M = 0.2e-3;
const CALC_RESISTIVITY_OHM_M = 8.8e-7;
const CALC_PI = 22 / 7; // the question says π = 22/7
/** A = πd²/4 = 3.143×10⁻⁸ m² (docs/07 §4.4). */
export const CALC_AREA_M2 = (CALC_PI * CALC_DIAMETER_M ** 2) / 4;
/** L = RA/ρ = 7 × 3.143×10⁻⁸ / 8.8×10⁻⁷ = 0.25 m (docs/07 §4.4). */
export const CALC_LENGTH_M = (CALC_RESISTANCE_OHM * CALC_AREA_M2) / CALC_RESISTIVITY_OHM_M;

export interface OhmsLawMarkOptions {
  /** Teacher mode. Defaults to on when a teacher's value is given. */
  teacherMode?: boolean;
  /** Teacher mode: the teacher's resistance of XY in ohms. Accuracy is marked only with it. */
  teacherXyOhm?: number | null;
}

type Evidence = MarkItem["evidence"];
const ev = (text: string | null): Evidence[number] => ({ box: null, text_as_written: text });

function rel(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);
}

class Sheet {
  items: MarkItem[] = [];
  add(
    id: string,
    rule: RuleCode,
    earned: number,
    available: number,
    evidence: Evidence,
    lostAnnotation: MarkItem["annotation"],
    fix: string,
    correction: string | null = null,
    source: MarkItem["source"] = SRC.draft,
  ): void {
    const ok = earned === available;
    this.items.push({
      id,
      rule,
      outcome: ok ? "earned" : "lost",
      marks_earned: earned,
      marks_available: available,
      evidence,
      annotation: ok ? "tick" : lostAnnotation,
      correction: ok ? null : correction,
      fix_en: fix,
      fix_pcm: null,
      source,
    });
  }
}

// ---- Reading her labels ----

/** The unit part of a header or axis label: "I (A)" → "A", "V/V" → "V", "R/Ω" → "Ω". */
function unitPart(label: string | null): string | null {
  if (!label) return null;
  const bracket = label.match(/\(([^)]*)\)/)?.[1];
  if (bracket !== undefined) return bracket.trim();
  const afterSlash = label.match(/\/\s*(.+)$/)?.[1];
  return afterSlash !== undefined ? afterSlash.trim() : null;
}

const AMPERE = /^(m?A|amps?|amperes?|milliamps?|milliamperes?)$/i;
const VOLT = /^(m?V|volts?|millivolts?)$/i;
const hasAmpere = (label: string | null) => AMPERE.test(unitPart(label) ?? "");
const hasVolt = (label: string | null) => VOLT.test(unitPart(label) ?? "");
/** A milli- unit in her heading (mA, mV, milliamps…): 3 more decimal places in A or V. */
const isMilli = (label: string | null) => /^(m[AV]|milli)/.test(unitPart(label) ?? "");

/** The quantity on a label, without its unit: "V/V" → V, "Current (A)" → I. */
function quantityOf(label: string | null): "I" | "V" | null {
  if (!label) return null;
  const q = label
    .replace(/\(.*\)/, "")
    .replace(/\/.*$/, "")
    .trim()
    .toLowerCase();
  if (/^(i|current)$/.test(q)) return "I";
  if (/^(v|voltage|p\.?\s*d\.?|potential difference)$/.test(q)) return "V";
  return null;
}

/** A length "56.4 cm" or "XY = 56.4 cm", as written: the part after any "=". */
const afterEquals = (text: string) => text.replace(/^.*=\s*/, "");

// ---- Geometry on her sheet ----

interface Pt {
  x: number;
  y: number;
}

/** Orthogonal (total least-squares) fit: works for steep lines and swapped axes alike. */
function principalLine(pts: Pt[]): { cx: number; cy: number; angleRad: number } | null {
  if (pts.length < 2) return null;
  const n = pts.length;
  const cx = pts.reduce((s, p) => s + p.x, 0) / n;
  const cy = pts.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pts) {
    sxx += (p.x - cx) ** 2;
    syy += (p.y - cy) ** 2;
    sxy += (p.x - cx) * (p.y - cy);
  }
  if (sxx + syy === 0) return null;
  return { cx, cy, angleRad: 0.5 * Math.atan2(2 * sxy, sxx - syy) };
}

/** Angle between two undirected lines, in degrees, 0–90. */
function lineAngleDiffDeg(aRad: number, bRad: number): number {
  let d = Math.abs(aRad - bRad) % Math.PI;
  if (d > Math.PI / 2) d = Math.PI - d;
  return (d * 180) / Math.PI;
}

/** Her scale in units per cm, when she chose a usable one (finite and positive), else null. */
function scaleOf(axis: OhmsLawAxis | undefined): number | null {
  const u = axis?.units_per_cm ?? null;
  return u !== null && Number.isFinite(u) && u > 0 ? u : null;
}

/** Where a value falls on her axis, in sheet cm, or null when she chose no usable scale. */
function onAxis(value: number, axis: OhmsLawAxis): number | null {
  const u = scaleOf(axis);
  return u === null ? null : (value - axis.origin_value) / u;
}

/**
 * The most rows that can each be given their own plotted point (maximum bipartite matching,
 * by augmenting paths). Deterministic: rows and points are tried in the order she wrote them.
 */
function maxMatching(fits: boolean[][], pointCount: number): number {
  const owner: Array<number | null> = Array.from({ length: pointCount }, () => null);
  const tryRow = (row: number, seen: boolean[]): boolean => {
    for (let p = 0; p < pointCount; p++) {
      if (!fits[row]?.[p] || seen[p]) continue;
      seen[p] = true;
      const prev = owner[p] ?? null;
      if (prev === null || tryRow(prev, seen)) {
        owner[p] = row;
        return true;
      }
    }
    return false;
  };
  let n = 0;
  for (let row = 0; row < fits.length; row++) {
    if (
      tryRow(
        row,
        Array.from({ length: pointCount }, () => false),
      )
    )
      n += 1;
  }
  return n;
}

/**
 * Her triangle as a right-angled triangle with one horizontal and one vertical leg (each
 * within TRIANGLE_AXIS_TOLERANCE_CM), or null. Returns the legs and the two hypotenuse corners.
 */
function rightTriangle(corners: Pt[]): { legX: number; legY: number; hyp: [Pt, Pt] } | null {
  const tol = TRIANGLE_AXIS_TOLERANCE_CM + 1e-9;
  for (let c = 0; c < 3; c++) {
    const C = corners[c];
    const others = corners.filter((_, i) => i !== c);
    const [P, Q] = others;
    if (!C || !P || !Q) continue;
    for (const [A, B] of [
      [P, Q],
      [Q, P],
    ] as const) {
      // A along the horizontal leg from C, B along the vertical leg.
      if (Math.abs(A.y - C.y) <= tol && Math.abs(B.x - C.x) <= tol) {
        const legX = Math.abs(A.x - C.x);
        const legY = Math.abs(B.y - C.y);
        if (legX > tol && legY > tol) return { legX, legY, hyp: [A, B] };
      }
    }
  }
  return null;
}

/** Perpendicular distance from a point to the infinite line through p1 and p2 (sheet cm). */
function distanceToLine(p: Pt, p1: Pt, p2: Pt): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Number.POSITIVE_INFINITY;
  return Math.abs(dx * (p1.y - p.y) - dy * (p1.x - p.x)) / len;
}

/** Marks her Ohm's-law record (DRAFT scheme). Pure: the same record always gives the same sheet. */
export function markOhmsLaw(record: OhmsLawRecord, opts: OhmsLawMarkOptions = {}): MarkSheet {
  const s = new Sheet();
  const teacherMode = opts.teacherMode ?? (opts.teacherXyOhm ?? null) !== null;
  // (teacherMode: false with a value given stays student mode: accuracy is never marked there.)

  // ---- PHYS-1DP: the length XY, to at least 1 d.p. (½), in cm (½). ----
  const xy = record.length_xy;
  const xyText = xy?.text_as_written ?? null;
  const xyDp = xyText !== null ? decimalPlaces(afterEquals(xyText)) : null;
  const xyValue = xyText !== null ? parseNumber(afterEquals(xyText)) : null;
  s.add(
    "PHYS-1DP:xy",
    "PHYS-1DP",
    xyDp !== null && xyDp >= 1 ? 0.5 : 0,
    0.5,
    [ev(xyText)],
    "circle",
    "Read the metre rule to the nearest millimetre and record the length in cm to at least 1 decimal place.",
    xyValue !== null ? xyValue.toFixed(1) : null,
    SRC.y2018,
  );
  const xyInCm =
    /(?<![a-z])cm\b/i.test(xy?.unit_as_written ?? "") || /(?<![a-z])cm\b/i.test(xyText ?? "");
  s.add(
    "PHYS-1DP:xy-unit",
    "PHYS-1DP",
    xyInCm ? 0.5 : 0,
    0.5,
    [ev(xyText)],
    "underline",
    "Write the unit with the length: XY in cm.",
    // Only a bare number gets "cm" added; "0.564 m" is rewritten by her, not by us.
    xyText !== null && xyValue !== null && !/[a-zµΩ]/i.test(afterEquals(xyText))
      ? `${afterEquals(xyText).trim()} cm`
      : null,
    SRC.y2018,
  );

  // ---- Her rows, as written. All rows she writes are checked (plan, "Rows"). ----
  const rows = record.rows.map((r) => ({
    r,
    R: parseNumber(r.R.text_as_written),
    I: parseNumber(r.I.text_as_written),
    V: parseNumber(r.V.text_as_written),
  }));
  const complete = rows.filter(
    (x): x is { r: (typeof rows)[number]["r"]; R: number; I: number; V: number } =>
      x.R !== null && x.I !== null && x.V !== null,
  );
  const h = record.headers;

  // ---- PHYS-TABLE: composite table of R, I and V with at least five rows (1); R in Ω (½). ----
  s.add(
    "PHYS-TABLE:composite",
    "PHYS-TABLE",
    complete.length >= MIN_ROWS ? 1 : 0,
    1,
    record.rows.map((r) => ev(r.R.text_as_written)),
    "box",
    `Tabulate R, I and V together in one table, with a row for every setting of R the question gives (at least ${MIN_ROWS}).`,
  );
  s.add(
    "PHYS-TABLE:units-R",
    "PHYS-TABLE",
    hasUnit(h.R) ? 0.5 : 0,
    0.5,
    [ev(h.R)],
    "underline",
    "Put the unit in the R heading: R (Ω) or R/Ω.",
    "R (Ω)",
    SRC.y2018,
  );

  // ---- PHYS-2DP: I and V each to at least 2 d.p. in at least five rows (1 each). ----
  // The d.p. are counted in A and V: with an mA (or mV) heading, "710" is 0.710 A, so the
  // d.p. in A are the d.p. she wrote plus 3. Her units stay as she wrote them.
  for (const q of ["I", "V"] as const) {
    const extraDp = isMilli(h[q]) ? 3 : 0;
    const fails = record.rows.filter((r) => {
      const dp = decimalPlaces(r[q].text_as_written);
      return dp === null || dp + extraDp < 2;
    });
    const passes = record.rows.length - fails.length;
    const ok = passes >= MIN_ROWS;
    const firstFail = fails[0];
    const firstValue = firstFail ? parseNumber(firstFail[q].text_as_written) : null;
    s.add(
      `PHYS-2DP:${q}`,
      "PHYS-2DP",
      ok ? 1 : 0,
      1,
      (ok ? record.rows : fails).map((r) => ev(r[q].text_as_written)),
      "circle",
      q === "I"
        ? "Read the ammeter to half of its smallest division and record every current to 2 decimal places."
        : "Read the voltmeter to half of its smallest division and record every p.d. to 2 decimal places.",
      firstValue !== null ? firstValue.toFixed(2) : null,
    );
  }
  const unitsIV = hasAmpere(h.I) && hasVolt(h.V);
  s.add(
    "PHYS-2DP:units",
    "PHYS-2DP",
    unitsIV ? 0.5 : 0,
    0.5,
    hasAmpere(h.I) ? [ev(h.V)] : hasVolt(h.V) ? [ev(h.I)] : [ev(h.I), ev(h.V)],
    "underline",
    "Put the unit in each heading: I (A) and V (V).",
    !hasAmpere(h.I) ? "I (A)" : !hasVolt(h.V) ? "V (V)" : null,
  );

  // ---- PHYS-TREND: in her own rows, I and V both fall as R rises (½ each). ----
  const byR = [...complete].sort((a, b) => a.R - b.R);
  const falls = (q: "I" | "V") => {
    if (byR.length < MIN_TREND_ROWS) return false;
    for (let i = 1; i < byR.length; i++) {
      const prev = byR[i - 1];
      const cur = byR[i];
      if (prev && cur && cur.R > prev.R && cur[q] > prev[q]) return false;
    }
    const first = byR[0];
    const last = byR[byR.length - 1];
    return first !== undefined && last !== undefined && last[q] < first[q];
  };
  for (const q of ["I", "V"] as const) {
    const ok = falls(q);
    // Evidence: her first reading that rises when R rises, or the whole column.
    const rise = byR.find((cur, i) => {
      const prev = byR[i - 1];
      return prev !== undefined && cur.R > prev.R && cur[q] > prev[q];
    });
    s.add(
      `PHYS-TREND:${q}`,
      "PHYS-TREND",
      ok ? 0.5 : 0,
      0.5,
      rise ? [ev(rise.r[q].text_as_written)] : byR.map((x) => ev(x.r[q].text_as_written)),
      "circle",
      "As R is increased, the total resistance of the circuit rises, so the current falls and the p.d. across XY falls with it. Re-take any reading that breaks this pattern.",
    );
  }

  // ---- Graph items, against HER table and HER scales. No graph: every graph mark is lost. ----
  const g = record.graph;
  const xLabel = g?.x.label_as_written ?? null;
  const yLabel = g?.y.label_as_written ?? null;

  // GRAPH-AXES (1½): V vertical (½), I horizontal (½), both labelled with units (½).
  s.add(
    "GRAPH-AXES:y",
    "GRAPH-AXES",
    quantityOf(yLabel) === "V" ? 0.5 : 0,
    0.5,
    [ev(yLabel)],
    "box",
    "Plot V on the vertical axis, as the question asks, and label it V (V).",
    "V (V)",
    SRC.y2023,
  );
  s.add(
    "GRAPH-AXES:x",
    "GRAPH-AXES",
    quantityOf(xLabel) === "I" ? 0.5 : 0,
    0.5,
    [ev(xLabel)],
    "box",
    "Plot I on the horizontal axis, as the question asks, and label it I (A).",
    "I (A)",
    SRC.y2023,
  );
  // Each unit belongs to its own quantity: the I axis needs an ampere unit, the V axis a volt
  // unit, and the two axes must be different quantities. An unlabelled quantity is taken as
  // the question's for that axis (I across, V up). "V/V" on both axes does not earn it.
  const qx = quantityOf(xLabel) ?? "I";
  const qy = quantityOf(yLabel) ?? "V";
  const unitFits = (label: string | null, q: "I" | "V") =>
    q === "I" ? hasAmpere(label) : hasVolt(label);
  const yUnitOk = unitFits(yLabel, qy);
  const xUnitOk = unitFits(xLabel, qx);
  const axisUnits = g !== null && qx !== qy && xUnitOk && yUnitOk;
  s.add(
    "GRAPH-AXES:units",
    "GRAPH-AXES",
    axisUnits ? 0.5 : 0,
    0.5,
    [ev(!yUnitOk ? yLabel : xLabel)],
    "underline",
    "Each axis label needs its own quantity's unit: V (V) and I (A).",
    !yUnitOk
      ? qy === "I"
        ? "I (A)"
        : "V (V)"
      : !xUnitOk
        ? qx === "V"
          ? "V (V)"
          : "I (A)"
        : null,
    SRC.y2023,
  );

  // GRAPH-SCALE (1): her plotted points span at least ⅓ of the sheet across (½) and up (½),
  // on a scale she chose.
  const pts = g?.points.map((p) => ({ x: p.x_cm, y: p.y_cm })) ?? [];
  const span = (vals: number[]) => (vals.length ? Math.max(...vals) - Math.min(...vals) : 0);
  const spanX = span(pts.map((p) => p.x));
  const spanY = span(pts.map((p) => p.y));
  const scaleOk = (axis: OhmsLawAxis | undefined, used: number, size: number) =>
    scaleOf(axis) !== null && used + 1e-9 >= GRAPH_SHEET_SHARE * size;
  s.add(
    "GRAPH-SCALE:x",
    "GRAPH-SCALE",
    g && scaleOk(g.x, spanX, g.sheet.width_cm) ? 0.5 : 0,
    0.5,
    [ev(g?.x.scale_as_written ?? null)],
    "box",
    "Choose a horizontal scale (1, 2 or 5 units per 2 cm) so your points spread across at least one third of the sheet.",
    null,
    SRC.y2023,
  );
  s.add(
    "GRAPH-SCALE:y",
    "GRAPH-SCALE",
    g && scaleOk(g.y, spanY, g.sheet.height_cm) ? 0.5 : 0,
    0.5,
    [ev(g?.y.scale_as_written ?? null)],
    "box",
    "Choose a vertical scale (1, 2 or 5 units per 2 cm) so your points spread up at least one third of the sheet.",
    null,
    SRC.y2023,
  );

  // GRAPH-POINTS (1½): each of her rows, placed on her own scales, has a plotted point within
  // half a small square. The axes she labelled decide which column goes where; unlabelled
  // axes are taken as the question's (I across, V up). Each point stands for one row only,
  // and rows are paired with points to match as many as possible (two close rows cannot
  // steal each other's point).
  const swapped = quantityOf(xLabel) === "V" && quantityOf(yLabel) === "I";
  let matched = 0;
  if (g) {
    const fits = complete.map((row) => {
      const ex = onAxis(swapped ? row.V : row.I, g.x);
      const ey = onAxis(swapped ? row.I : row.V, g.y);
      return pts.map(
        (p) =>
          ex !== null &&
          ey !== null &&
          Math.abs(p.x - ex) <= POINT_TOLERANCE_CM + 1e-9 &&
          Math.abs(p.y - ey) <= POINT_TOLERANCE_CM + 1e-9,
      );
    });
    matched = maxMatching(fits, pts.length);
  }
  const pointMarks = matched >= MIN_ROWS ? 1.5 : matched === 4 ? 1 : matched === 3 ? 0.5 : 0;
  s.add(
    "GRAPH-POINTS",
    "GRAPH-POINTS",
    pointMarks,
    1.5,
    [ev(null)],
    "box",
    "Plot every row of your own table carefully on the scales you chose.",
    null,
    SRC.y2023,
  );

  // GRAPH-LINE (1): a straight line close to the best fit through her own plotted points.
  const fitted = principalLine(pts);
  const line = g?.line ?? null;
  let lineOk = false;
  if (line && fitted) {
    const dx = line.p2.x_cm - line.p1.x_cm;
    const dy = line.p2.y_cm - line.p1.y_cm;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      const angleOk =
        lineAngleDiffDeg(Math.atan2(dy, dx), fitted.angleRad) <= LINE_ANGLE_TOLERANCE_DEG;
      // Perpendicular distance from the centroid of her points to her line.
      const dist =
        Math.abs(dx * (line.p1.y_cm - fitted.cy) - dy * (line.p1.x_cm - fitted.cx)) / len;
      lineOk = angleOk && dist <= LINE_CENTROID_TOLERANCE_CM;
    }
  }
  s.add(
    "GRAPH-LINE",
    "GRAPH-LINE",
    lineOk ? 1 : 0,
    1,
    [ev(null)],
    "box",
    "Draw one straight line of best fit, with the points spread evenly on both sides of it.",
    null,
    SRC.y2023,
  );

  // GRAPH-SLOPE (2½): a large triangle (1); her ΔV and ΔI agree with its legs on her scales
  // (½); s = her ΔV ÷ her ΔI (½); s carries the unit Ω (½).
  // "Large" needs a real right-angled triangle (one horizontal and one vertical leg, not
  // degenerate) whose two hypotenuse corners sit on her drawn line, and legs at least half
  // the line's extent each way. Reading and value are judged against the triangle she drew
  // wherever it is (error carried forward).
  const tri = g?.triangle ?? null;
  const corners: Pt[] = tri ? [tri.p1, tri.p2, tri.p3].map((p) => ({ x: p.x_cm, y: p.y_cm })) : [];
  const right = tri ? rightTriangle(corners) : null;
  const legX = right ? right.legX : span(corners.map((p) => p.x));
  const legY = right ? right.legY : span(corners.map((p) => p.y));
  const lineP1 = line ? { x: line.p1.x_cm, y: line.p1.y_cm } : null;
  const lineP2 = line ? { x: line.p2.x_cm, y: line.p2.y_cm } : null;
  const onLine =
    right !== null &&
    lineP1 !== null &&
    lineP2 !== null &&
    right.hyp.every(
      (p) => distanceToLine(p, lineP1, lineP2) <= TRIANGLE_ON_LINE_TOLERANCE_CM + 1e-9,
    );
  const lineSpanX = line ? Math.abs(line.p2.x_cm - line.p1.x_cm) : 0;
  const lineSpanY = line ? Math.abs(line.p2.y_cm - line.p1.y_cm) : 0;
  const large =
    onLine &&
    lineSpanX > 0 &&
    lineSpanY > 0 &&
    legX + 1e-9 >= LARGE_TRIANGLE_SHARE * lineSpanX &&
    legY + 1e-9 >= LARGE_TRIANGLE_SHARE * lineSpanY;
  s.add(
    "GRAPH-SLOPE:large",
    "GRAPH-SLOPE",
    large ? 1 : 0,
    1,
    [ev(null)],
    "box",
    "Draw a large right-angled triangle on your line, with each side covering at least half of the line.",
    null,
    SRC.y2023,
  );

  const dyWritten = g ? lastNumber(g.delta_y_as_written) : null;
  const dxWritten = g ? lastNumber(g.delta_x_as_written) : null;
  // Her Δ in her axis's own unit: "ΔI = 600 mA" on an axis in A is 0.600.
  const readOk = (
    written: number | null,
    deltaText: string | null,
    legCm: number,
    axis: OhmsLawAxis | undefined,
  ) => {
    const u = scaleOf(axis);
    if (written === null || u === null) return false;
    const axisFactor = isMilli(axis?.label_as_written ?? null) ? 1e-3 : 1;
    const inAxisUnits = (written * prefixFactor(deltaText)) / axisFactor;
    return Math.abs(Math.abs(inAxisUnits) - legCm * u) <= SLOPE_READ_TOLERANCE_CM * u + 1e-9;
  };
  const deltasOk =
    tri !== null &&
    g !== null &&
    readOk(dyWritten, g.delta_y_as_written, legY, g.y) &&
    readOk(dxWritten, g.delta_x_as_written, legX, g.x);
  s.add(
    "GRAPH-SLOPE:read",
    "GRAPH-SLOPE",
    deltasOk ? 0.5 : 0,
    0.5,
    [ev(g?.delta_y_as_written ?? null), ev(g?.delta_x_as_written ?? null)],
    "circle",
    "Read ΔV and ΔI from the sides of your triangle on your own scales, and write each with its unit.",
    null,
    SRC.y2023,
  );

  const slopeText = g?.slope_as_written ?? null;
  const sWritten = lastNumber(slopeText);
  // In SI units: "3.0 kΩ" is 3000 Ω; "ΔI = 600 mA" is 0.600 A.
  const sSi = sWritten !== null ? sWritten * prefixFactor(slopeText) : null;
  const dySi = dyWritten !== null ? dyWritten * prefixFactor(g?.delta_y_as_written ?? null) : null;
  const dxSi = dxWritten !== null ? dxWritten * prefixFactor(g?.delta_x_as_written ?? null) : null;
  const slopeOk =
    sSi !== null &&
    dySi !== null &&
    dxSi !== null &&
    dxSi !== 0 &&
    rel(Math.abs(sSi), Math.abs(dySi / dxSi)) <= SLOPE_MATCH;
  s.add(
    "GRAPH-SLOPE:value",
    "GRAPH-SLOPE",
    slopeOk ? 0.5 : 0,
    0.5,
    [ev(slopeText)],
    "circle",
    "Work out s = ΔV ÷ ΔI using your own ΔV and ΔI, and show the division.",
    null,
    SRC.y2023,
  );
  // With swapped axes her slope is ΔI/ΔV, so its unit is A/V or Ω⁻¹ (error carried forward:
  // the swap already cost the two GRAPH-AXES half marks).
  const slopeHasOhm = sWritten !== null && slopeHasOhmUnit(slopeText);
  const slopeUnitOk =
    sWritten !== null && (swapped ? slopeHasReciprocalOhmUnit(slopeText) : slopeHasOhm);
  const slopeTrim = (slopeText ?? "").trim();
  s.add(
    "GRAPH-SLOPE:unit",
    "GRAPH-SLOPE",
    slopeUnitOk ? 0.5 : 0,
    0.5,
    [ev(slopeText)],
    "underline",
    swapped
      ? "Your slope is ΔI ÷ ΔV, so give it with its unit, A/V."
      : "The slope of V against I is a resistance: give s with its unit, Ω.",
    // Only a bare number gets a unit added; a wrong unit she wrote is hers to rewrite.
    sWritten !== null && !slopeUnitOk && /\d\s*$/.test(slopeTrim)
      ? `${slopeTrim} ${swapped ? "A/V" : "Ω"}`
      : null,
    SRC.y2023,
  );

  // PHYS-ACCURACY (1), teacher mode only: her s (in Ω) within ±10% of the teacher's R_XY.
  const teacherXyOhm = opts.teacherXyOhm ?? null;
  if (teacherMode && teacherXyOhm !== null && Number.isFinite(teacherXyOhm) && teacherXyOhm > 0) {
    const ok = sSi !== null && slopeHasOhm && rel(sSi, teacherXyOhm) <= ACCURACY_BAND;
    s.add(
      "PHYS-ACCURACY",
      "PHYS-ACCURACY",
      ok ? 1 : 0,
      1,
      [ev(slopeText)],
      "circle",
      "Your slope is more than 10% from your teacher's value: check your meter readings and your triangle.",
      null,
      SRC.y2023,
    );
  }

  // ---- PRECAUTIONS (2): any two from the V–I list, in the reported tense, 1 each. ----
  // Tight, clean connections and firmly pushed-in plugs are one idea (good contact), so the
  // two together earn one mark (Oct 28 lesson review, P2/P7). Likewise "current was not
  // allowed to flow for long" is the purpose of opening the key, so it shares its mark.
  const idea = (id: PrecautionId): PrecautionId =>
    id === "plugs_firm" ? "tight_clean_connections" : id === "current_brief" ? "key_opened" : id;
  const judged: Array<{ text: string; j: PrecautionJudgement }> = record.precautions.map(
    (text) => ({ text, j: judgePrecaution(text, "ohms_law_vi") }),
  );
  const seen = new Set<PrecautionId>();
  const accepted = judged.filter((p) => {
    if (!p.j.accepted || !p.j.matched || seen.has(idea(p.j.matched))) return false;
    seen.add(idea(p.j.matched));
    return true;
  });
  const notCounted = judged.filter((p) => !accepted.includes(p));
  for (let i = 0; i < 2; i++) {
    const a = accepted[i];
    const shown = a ?? notCounted[i - accepted.length] ?? null;
    const reason = shown && !a ? shown.j.reason : null;
    const repeat = shown && !a && shown.j.accepted;
    s.add(
      `PRECAUTIONS:${i + 1}`,
      "PRECAUTIONS",
      a ? 1 : 0,
      1,
      shown ? [ev(shown.text)] : [],
      "strike",
      repeat
        ? "This is the same precaution as one you already gave. Give a different one, e.g. “The key was opened between readings.”"
        : reason === "instruction" || reason === "not_past_tense"
          ? "State what you did, in the past tense: e.g. “Parallax was avoided when reading the meters.”"
          : "Give two precautions you actually took, e.g. “The key was opened between readings.”",
      reason === "instruction" || reason === "not_past_tense"
        ? (REPORTED[shown?.j.matched ?? ""] ?? null)
        : null,
      SRC.y2023,
    );
  }

  // ---- PHYS-LAW (b)(i): named (½); stated (1) with its condition (1). ----
  const law = record.law_as_written;
  const lawT = (law ?? "").toLowerCase().replace(/[’`]/g, "'");
  const named = /\bohm'?s?\s+law\b/.test(lawT);
  const mentionsCurrent = /\bcurrent\b|\bi\b/.test(lawT);
  const mentionsPd = /\b(potential difference|p\.?\s*d\.?|voltage)\b|\bv\b/.test(lawT);
  // A direct proportion somewhere, and current and p.d. not said to be inversely proportional.
  // "…and inversely proportional to its resistance" is a true addition, not an error.
  const direct = /(?<!\binversely\s+)\bproportional\b|∝/.test(lawT);
  const CUR = "(?:current|i)";
  const PD = String.raw`(?:potential difference|p\.?\s*d\.?|voltage|v)`;
  const inverseIV = new RegExp(
    String.raw`\b${CUR}\b[^,;]*?\binversely\s+proportional\s+to\s+(?:the\s+)?${PD}(?![a-z])|\b${PD}(?![a-z])[^,;]*?\binversely\s+proportional\s+to\s+(?:the\s+)?${CUR}\b`,
  ).test(lawT);
  const stated = mentionsCurrent && mentionsPd && direct && !inverseIV;
  const condition =
    /\b(temperature|physical conditions?)\b/.test(lawT) &&
    /\b(constant|unchanged|the same|remains?|kept|fixed|steady)\b/.test(lawT);
  s.add(
    "PHYS-LAW:name",
    "PHYS-LAW",
    named ? 0.5 : 0,
    0.5,
    [ev(law)],
    "underline",
    "Name the law: Ohm's law.",
    "Ohm's law",
  );
  s.add(
    "PHYS-LAW:statement",
    "PHYS-LAW",
    stated ? (condition ? 2 : 1) : 0,
    2,
    [ev(law)],
    "underline",
    stated
      ? "Add the condition: the law holds only if the temperature and other physical conditions stay constant."
      : "State the law in full: the current through a metallic conductor is directly proportional to the potential difference across its ends, provided the temperature and other physical conditions stay constant.",
    stated && !condition
      ? "… provided the temperature and other physical conditions remain constant."
      : null,
  );

  // ---- PHYS-CALC (b)(ii): L = RA/ρ (½); A = πd²/4 (½); 0.25 m (½) with its unit (½). ----
  const calc = record.length_calc_as_written;
  const flat = (calc ?? "")
    // Keep line breaks, so "…m²" on one line does not run into "L = …" on the next.
    .replace(/[^\S\n]|[×*·()[\]{}]/g, "")
    .replace(/÷/g, "/")
    .toLowerCase();
  const RHO = "(?:ρ|rho|p)";
  const formulaOk = new RegExp(
    String.raw`(?:^|[^a-z])l=(?:ra|ar)\/${RHO}|(?:^|[^a-z])r=(?:${RHO}l|l${RHO})\/a|${RHO}=(?:ra|ar)\/l`,
    "m",
  ).test(flat);
  const PI = String.raw`(?:π|pi|22\/7)`;
  const areaFormula = new RegExp(
    String.raw`a=${PI}(?:d²|d\^2|d2)\/4|a=${PI}\/4(?:d²|d\^2|d2)|a=${PI}(?:r²|r\^2|r2)|a=${PI}d\/2(?:²|\^2)`,
  ).test(flat);
  const numbers = (calc ?? "")
    .split(/[=\n;]/)
    .map((seg) => lastNumber(seg))
    .filter((n): n is number => n !== null);
  const areaValue = numbers.some((n) => rel(n, CALC_AREA_M2) <= CALC_MATCH);
  s.add(
    "PHYS-CALC:formula",
    "PHYS-CALC",
    formulaOk ? 0.5 : 0,
    0.5,
    [ev(calc)],
    "underline",
    "Start from R = ρL/A and rearrange it: L = RA/ρ.",
    "L = RA/ρ",
  );
  s.add(
    "PHYS-CALC:area",
    "PHYS-CALC",
    areaFormula || areaValue ? 0.5 : 0,
    0.5,
    [ev(calc)],
    "underline",
    "Work out the cross-sectional area first: A = πd²/4, with d in metres.",
    "A = πd²/4",
  );
  // Her answer: the last non-empty "=" or line segment, without a trailing note in brackets
  // ("= 0.25 m (2 s.f.)") or a trailing line break.
  const finalSeg =
    (calc ?? "")
      .trimEnd()
      .split(/[=\n]/)
      .map((seg) => seg.trim())
      .filter((seg) => seg.length > 0)
      .at(-1)
      ?.replace(/\s*\([^()]*\)\s*$/, "")
      .trim() ?? "";
  const finalValue = lastNumber(finalSeg);
  const unitMatch = finalSeg.match(
    /(?<![a-zA-Z])(cm|mm|m|metres?|meters?|centimetres?|centimeters?|millimetres?|millimeters?)\.?\s*$/i,
  );
  const unit = unitMatch?.[1]?.toLowerCase() ?? null;
  const toMetres =
    unit === null
      ? null
      : unit.startsWith("c")
        ? 0.01
        : unit === "mm" || unit.startsWith("milli")
          ? 0.001
          : 1;
  const valueOk =
    finalValue !== null &&
    (toMetres !== null
      ? rel(finalValue * toMetres, CALC_LENGTH_M) <= CALC_MATCH
      : // No unit: the number is right if it is the length in m or in cm.
        rel(finalValue, CALC_LENGTH_M) <= CALC_MATCH ||
        rel(finalValue / 100, CALC_LENGTH_M) <= CALC_MATCH);
  const unitOk = valueOk && toMetres !== null;
  s.add(
    "PHYS-CALC:answer",
    "PHYS-CALC",
    (valueOk ? 0.5 : 0) + (unitOk ? 0.5 : 0),
    1,
    [ev(finalSeg || calc)],
    valueOk ? "underline" : "circle",
    valueOk
      ? "Write the unit with your answer: a length in m."
      : "Substitute R, A (in m²) and ρ into L = RA/ρ and give the length with its unit.",
    valueOk && !unitOk && finalValue !== null
      ? rel(finalValue, CALC_LENGTH_M) <= CALC_MATCH
        ? `${finalSeg} m`
        : `${finalSeg} cm`
      : null,
  );

  const earned = s.items.reduce((t, i) => t + i.marks_earned, 0);
  const available = s.items.reduce((t, i) => t + i.marks_available, 0);
  return {
    experiment: "ohms_law_vi",
    question_label: OHMS_LAW_QUESTION_LABEL,
    earned,
    available,
    items: s.items,
    setup_issues: [],
    teacher_mode: teacherMode,
  };
}

/** The reported-tense rewrite the red ink offers for an instruction, per topic. */
const REPORTED: Record<string, string> = {
  key_opened: "The key was opened between readings.",
  current_brief: "Current was not allowed to flow for long.",
  tight_clean_connections: "The connections were tight and the terminals clean.",
  plugs_firm: "The plugs of the resistance box were pushed in firmly.",
  wire_straight: "The wire XY was kept straight.",
  parallax_avoided: "Parallax was avoided when reading the meters.",
  zero_error: "The zero errors of the meters were checked and corrected.",
  repeated_readings: "The readings were repeated.",
};

/**
 * Whether her slope carries the unit Ω: "3.0 Ω", "3.0 ohms", "3.0 V/A", "3.0 VA⁻¹".
 * "Ω⁻¹" and "A/V" are the reciprocal, not a resistance.
 */
export function slopeHasOhmUnit(text: string | null): boolean {
  if (!text) return false;
  const t = text.trim();
  if (/(Ω|ohms?)\s*(⁻¹|\^?\s*-\s*1)/i.test(t)) return false;
  if (/(?<![a-z])k?(Ω|ohms?)(?![a-z])/i.test(t)) return true;
  return /(?<![a-z])V\s*(\/\s*A|A\s*(⁻¹|\^?\s*-\s*1))(?![a-z])/.test(t);
}

/** The reciprocal of a resistance, for a slope of I against V: "0.33 A/V", "0.33 Ω⁻¹". */
export function slopeHasReciprocalOhmUnit(text: string | null): boolean {
  if (!text) return false;
  const t = text.trim();
  return (
    /(Ω|ohms?)\s*(⁻¹|\^?\s*-\s*1)/i.test(t) ||
    /(?<![a-z])A\s*(\/\s*V|V\s*(⁻¹|\^?\s*-\s*1))(?![a-z])/.test(t)
  );
}

/**
 * The SI factor of the unit written after her last number: "kΩ" → 1000, "mA"/"mV" → 0.001,
 * anything else → 1.
 */
function prefixFactor(text: string | null): number {
  const t = (text ?? "").trim();
  if (/(?<![a-zA-Z])k(Ω|ohms?)\s*$/i.test(t)) return 1e3;
  if (/(?<![a-zA-Z])m[AV]\s*$/.test(t)) return 1e-3;
  return 1;
}
