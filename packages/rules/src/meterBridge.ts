import type { Annotation, Box, MarkItem, MarkSheet, Readings, RuleCode } from "@snaplab/contracts";
import { judgePrecaution, type PrecautionJudgement } from "./precautions";
import { decimalPlaces, hasUnit, lastNumber, parseNumber, sigFigs } from "./text";

// The metre bridge scheme, docs/15 §4 (structure from WAEC May/June 2023 Q3, wording from
// the 2011, 2014, 2018 and 2023 expected answers). Marks are positive and come only from
// what she wrote. 21 marks in student mode, 22 in teacher mode.

const SRC = {
  y2023: {
    label: "WAEC Physics P3 May/June 2023 Q3B",
    url: "https://waeconline.org.ng/E-Learning/Physics/Phys340mq3B.html",
  },
  y2018: {
    label: "WAEC Physics P3 May/June 2018 Q3A",
    url: "https://waeconline.org.ng/E-Learning/Physics/Phys327mq3A.html",
  },
  y2011: {
    label: "WAEC Physics P3 Nov/Dec 2011 Q3",
    url: "https://waeconline.org.ng/E-Learning/Physics/Phys320nq3.html",
  },
} as const;

/** WAEC's ±10% accuracy band (docs/15 §4, May/June 2023 Q3B). */
const ACCURACY_BAND = 0.1;
/** A plotted point counts as correct within this share of each axis's span. */
const POINT_TOLERANCE = 0.02;
/** "Large" triangle: its horizontal leg covers at least this share of her points' span. */
const LARGE_TRIANGLE = 0.5;
/** Her slope must match her own triangle within this share. */
const SLOPE_MATCH = 0.05;
/** Her intercept must lie within this share of the least-squares intercept of her points. */
const INTERCEPT_MATCH = 0.1;
/** X = s/c must match her own s and c within this share. */
const EVAL_MATCH = 0.02;
/** The graph must cover at least this share of the page (WAEC: "at least 1/3"). */
const GRAPH_PAGE_SHARE = 1 / 3;

type Cell = Readings["cells"][number];

export interface MarkOptions {
  /** Teacher mode: the true X in ohms. Null in student mode (accuracy is not marked). */
  teacherXOhm: number | null;
  /** Drawing problems from the blueprint, circled but carrying no mark (e.g. no key drawn). */
  setupIssues?: MarkSheet["setup_issues"];
  /**
   * The graph sheet's box in the same page coordinates, when the graph is on its own sheet
   * photographed beside the page (docs/11 §1). GRAPH-SCALE measures against it; default: the page.
   */
  graphSheetBox?: Box | null;
}

const isHeader = (c: Cell) => /head/i.test(c.row);

/** Data cells of one column, one per row (the first wins if Wonder repeats a row). */
function column(r: Readings, col: Cell["column"]): Cell[] {
  const seen = new Set<string>();
  return r.cells.filter((c) => {
    if (c.column !== col || isHeader(c) || seen.has(c.row)) return false;
    seen.add(c.row);
    return true;
  });
}

/** A cell's number as she wrote it (the model's parse is only a fallback). */
function num(c: Cell | undefined): number | null {
  if (!c) return null;
  const v = parseNumber(c.text_as_written) ?? c.value;
  return v !== null && Number.isFinite(v) ? v : null;
}

function header(r: Readings, col: Cell["column"]): { text: string | null; box: Box | null } {
  const h = r.cells.find((c) => c.column === col && isHeader(c));
  const anyCell = r.cells.find((c) => c.column === col);
  return {
    text: h?.text_as_written ?? anyCell?.column_header_as_written ?? null,
    box: h?.box ?? null,
  };
}

function rel(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);
}

/** Least-squares line through her plotted points. */
function fit(points: Array<{ x: number; y: number }>): { slope: number; intercept: number } | null {
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const slope = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx;
  return { slope, intercept: my - slope * mx };
}

function fmtSig(x: number, sf: number): string {
  return Number(x.toPrecision(sf)).toPrecision(sf);
}

class Sheet {
  items: MarkItem[] = [];
  add(
    id: string,
    rule: RuleCode,
    earned: number,
    available: number,
    evidence: MarkItem["evidence"],
    lostAnnotation: Annotation,
    fix: string,
    source: MarkItem["source"],
    correction: string | null = null,
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

/** Marks a metre bridge page (docs/15 §4). Pure: the same readings always give the same sheet. */
export function markMeterBridge(r: Readings, opts: MarkOptions): MarkSheet {
  const s = new Sheet();
  const g = r.graph;

  // PHYS-1DP: five values of l, each to at least 1 d.p. in cm (½ each).
  const ls = column(r, "l").slice(0, 5);
  for (let i = 0; i < 5; i++) {
    const c = ls[i];
    const ok = c ? (decimalPlaces(c.text_as_written) ?? 0) >= 1 : false;
    s.add(
      `PHYS-1DP:l:${c?.row ?? `missing${i + 1}`}`,
      "PHYS-1DP",
      ok ? 0.5 : 0,
      0.5,
      c ? [{ box: c.box, text_as_written: c.text_as_written }] : [],
      "circle",
      "Record lengths in cm to at least 1 decimal place.",
      SRC.y2018,
      num(c)?.toFixed(1) ?? null,
    );
  }

  // PHYS-3SF: five R⁻¹ and five l⁻¹ values, each to at least 3 s.f. (½ each, 5 in all).
  const lByRow = new Map(ls.map((c) => [c.row, num(c)]));
  const rByRow = new Map(column(r, "R").map((c) => [c.row, num(c)]));
  for (const col of ["R_inv", "l_inv"] as const) {
    const cells = column(r, col).slice(0, 5);
    for (let i = 0; i < 5; i++) {
      const c = cells[i];
      const ok = c ? (sigFigs(c.text_as_written) ?? 0) >= 3 : false;
      // The correction comes from her own measured value: l⁻¹ = 1/l, R⁻¹ = 1/R.
      const base = c ? (col === "l_inv" ? lByRow.get(c.row) : rByRow.get(c.row)) : null;
      const correction = base ? fmtSig(1 / base, 3) : null;
      s.add(
        `PHYS-3SF:${col}:${c?.row ?? `missing${i + 1}`}`,
        "PHYS-3SF",
        ok ? 0.5 : 0,
        0.5,
        c ? [{ box: c.box, text_as_written: c.text_as_written }] : [],
        "circle",
        "Give derived values such as R⁻¹ and l⁻¹ to at least 3 significant figures.",
        SRC.y2018,
        correction,
      );
    }
  }

  // PHYS-TABLE (1½): composite table with R, l, R⁻¹, l⁻¹ (½), units on R and l (½),
  // units on R⁻¹ and l⁻¹ (½).
  const h = {
    R: header(r, "R"),
    l: header(r, "l"),
    R_inv: header(r, "R_inv"),
    l_inv: header(r, "l_inv"),
  };
  const allColumns = (["R", "l", "R_inv", "l_inv"] as const).every((k) => column(r, k).length > 0);
  s.add(
    "PHYS-TABLE:columns",
    "PHYS-TABLE",
    allColumns ? 0.5 : 0,
    0.5,
    [],
    "box",
    "Tabulate R, l, R⁻¹ and l⁻¹ together in one composite table.",
    SRC.y2018,
  );
  const measuredUnits = hasUnit(h.R.text) && hasUnit(h.l.text);
  s.add(
    "PHYS-TABLE:units-measured",
    "PHYS-TABLE",
    measuredUnits ? 0.5 : 0,
    0.5,
    [h.R, h.l].map((x) => ({ box: x.box, text_as_written: x.text })),
    "underline",
    "Put the unit in every column heading, e.g. R (Ω), l (cm).",
    SRC.y2018,
  );
  const derivedUnits = hasUnit(h.R_inv.text) && hasUnit(h.l_inv.text);
  const missing = [h.R_inv, h.l_inv].filter((x) => !hasUnit(x.text));
  s.add(
    "PHYS-TABLE:units-derived",
    "PHYS-TABLE",
    derivedUnits ? 0.5 : 0,
    0.5,
    (derivedUnits ? [h.R_inv, h.l_inv] : missing).map((x) => ({
      box: x.box,
      text_as_written: x.text,
    })),
    "underline",
    "Derived columns need units too: R⁻¹ (Ω⁻¹), l⁻¹ (cm⁻¹).",
    SRC.y2018,
    !hasUnit(h.l_inv.text) ? "l⁻¹ (cm⁻¹)" : !hasUnit(h.R_inv.text) ? "R⁻¹ (Ω⁻¹)" : null,
  );

  // Graph items. With no graph on the page every graph mark is lost.
  const gEvidence = g ? [{ box: g.box, text_as_written: null }] : [];

  // GRAPH-AXES (1½): each axis labelled with its quantity (½ each), both with units (½).
  const xLabel = g?.x_label_as_written ?? null;
  const yLabel = g?.y_label_as_written ?? null;
  // The question asks for l⁻¹ on the vertical axis against R⁻¹ (docs/15 §4); swapped axes miss.
  // The quantity, without its bracketed unit, must be the reciprocal: R⁻¹, R^-1, 1/R.
  const quantity = (label: string | null) => (label ?? "").replace(/\(.*\)/, "").trim();
  const reciprocalOf = (q: string, letter: RegExp) =>
    new RegExp(
      String.raw`^(${letter.source})\s*(⁻¹|\^?\s*-\s*1)$|^1\s*\/\s*(${letter.source})$`,
      "i",
    ).test(q);
  const xIsR = reciprocalOf(quantity(xLabel), /r/);
  const yIsL = reciprocalOf(quantity(yLabel), /l|ℓ/);
  s.add(
    "GRAPH-AXES:x",
    "GRAPH-AXES",
    xIsR ? 0.5 : 0,
    0.5,
    gEvidence,
    "box",
    "Label the horizontal axis with its quantity, R⁻¹.",
    SRC.y2023,
  );
  s.add(
    "GRAPH-AXES:y",
    "GRAPH-AXES",
    yIsL ? 0.5 : 0,
    0.5,
    gEvidence,
    "box",
    "Label the vertical axis with its quantity, l⁻¹.",
    SRC.y2023,
  );
  const axisUnits = hasUnit(xLabel) && hasUnit(yLabel);
  s.add(
    "GRAPH-AXES:units",
    "GRAPH-AXES",
    axisUnits ? 0.5 : 0,
    0.5,
    [{ box: g?.box ?? null, text_as_written: !hasUnit(yLabel) ? yLabel : xLabel }],
    "underline",
    "Both axis labels need units: R⁻¹ (Ω⁻¹) and l⁻¹ (cm⁻¹).",
    SRC.y2023,
    !hasUnit(yLabel) ? "l⁻¹ (cm⁻¹)" : !hasUnit(xLabel) ? "R⁻¹ (Ω⁻¹)" : null,
  );

  // GRAPH-SCALE (1½): the graph covers at least 1/3 of the page (½); reasonable scales and
  // origin (1), which Wonder cannot read yet, so it is earned whenever a graph is drawn.
  const boxArea = (b: Box) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
  const sheet = opts.graphSheetBox ?? { x0: 0, y0: 0, x1: 1, y1: 1 };
  const area = g ? boxArea(g.box) / Math.max(boxArea(sheet), 1e-9) : 0;
  s.add(
    "GRAPH-SCALE:size",
    "GRAPH-SCALE",
    area >= GRAPH_PAGE_SHARE ? 0.5 : 0,
    0.5,
    gEvidence,
    "box",
    "Choose scales so the graph fills at least one third of the page.",
    SRC.y2023,
  );
  s.add(
    "GRAPH-SCALE:scales",
    "GRAPH-SCALE",
    g && (g.points?.length ?? 0) > 0 ? 1 : 0,
    1,
    gEvidence,
    "box",
    "Use simple scales (1, 2, 5 or 10 per large square, never 3) and start the axes from the origin. (Scale choice is not checked automatically yet; a graph with plotted points earns this.)",
    SRC.y2023,
  );

  // GRAPH-POINTS (1½): her points against her own table (as written), within 2% of each span.
  const lInv = column(r, "l_inv");
  const tableRows = column(r, "R_inv")
    .slice(0, 5)
    .map((c) => ({
      row: c.row,
      x: num(c),
      y: num(lInv.find((d) => d.row === c.row)),
    }))
    .filter((p): p is { row: string; x: number; y: number } => p.x !== null && p.y !== null);
  const pts = g?.points ?? [];
  const spanX =
    Math.max(1e-9, ...tableRows.map((p) => p.x)) - Math.min(...tableRows.map((p) => p.x), 0);
  const spanY =
    Math.max(1e-9, ...tableRows.map((p) => p.y)) - Math.min(...tableRows.map((p) => p.y), 0);
  // Each plotted point can stand for only one row.
  const unused = [...pts];
  let matched = 0;
  for (const t of tableRows) {
    const k = unused.findIndex(
      (p) =>
        Math.abs(p.x - t.x) <= POINT_TOLERANCE * spanX &&
        Math.abs(p.y - t.y) <= POINT_TOLERANCE * spanY,
    );
    if (k !== -1) {
      unused.splice(k, 1);
      matched += 1;
    }
  }
  const pointMarks = matched >= 5 ? 1.5 : matched === 4 ? 1 : matched === 3 ? 0.5 : 0;
  s.add(
    "GRAPH-POINTS",
    "GRAPH-POINTS",
    pointMarks,
    1.5,
    gEvidence,
    "box",
    "Plot every point from your own table carefully.",
    SRC.y2023,
  );

  // GRAPH-LINE (1½).
  s.add(
    "GRAPH-LINE",
    "GRAPH-LINE",
    g?.line_drawn ? 1.5 : 0,
    1.5,
    gEvidence,
    "box",
    "Draw one straight line of best fit through the points.",
    SRC.y2011,
  );

  // GRAPH-SLOPE (2): a large triangle (1); slope worked out correctly from it (1).
  const tri = g?.triangle ?? null;
  const triXs = tri ? [tri.p1.x, tri.p2.x, tri.p3.x] : [];
  const triYs = tri ? [tri.p1.y, tri.p2.y, tri.p3.y] : [];
  const leg = tri ? Math.max(...triXs) - Math.min(...triXs) : 0;
  const pointSpan = pts.length
    ? Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x))
    : 0;
  const large = tri !== null && pointSpan > 0 && leg >= LARGE_TRIANGLE * pointSpan;
  s.add(
    "GRAPH-SLOPE:large",
    "GRAPH-SLOPE",
    large ? 1 : 0,
    1,
    gEvidence,
    "box",
    "Draw a large right-angled triangle on the line, covering at least half of it.",
    SRC.y2023,
  );
  const sWritten = lastNumber(g?.slope_as_written ?? null);
  const sTriangle = tri && leg > 0 ? (Math.max(...triYs) - Math.min(...triYs)) / leg : null;
  const slopeOk =
    sWritten !== null && sTriangle !== null && rel(sWritten, sTriangle) <= SLOPE_MATCH;
  s.add(
    "GRAPH-SLOPE:value",
    "GRAPH-SLOPE",
    slopeOk ? 1 : 0,
    1,
    [{ box: g?.box ?? null, text_as_written: g?.slope_as_written ?? null }],
    "circle",
    "Show Δ(l⁻¹) and Δ(R⁻¹) from your triangle and divide them.",
    SRC.y2023,
  );

  // GRAPH-INTERCEPT (1): read against the line through her own points.
  const line = fit(pts);
  const cWritten = lastNumber(g?.intercept_as_written ?? null);
  const interceptOk =
    cWritten !== null && line !== null && rel(cWritten, line.intercept) <= INTERCEPT_MATCH;
  s.add(
    "GRAPH-INTERCEPT",
    "GRAPH-INTERCEPT",
    interceptOk ? 1 : 0,
    1,
    [{ box: g?.box ?? null, text_as_written: g?.intercept_as_written ?? null }],
    "circle",
    "Extend the line to the vertical axis and read the intercept c there.",
    SRC.y2023,
  );

  // PHYS-EVAL (1): X = s/c from her own s and c.
  const xWritten = lastNumber(g?.result_as_written ?? null);
  const evalOk =
    xWritten !== null &&
    sWritten !== null &&
    cWritten !== null &&
    cWritten !== 0 &&
    rel(xWritten, sWritten / cWritten) <= EVAL_MATCH;
  s.add(
    "PHYS-EVAL",
    "PHYS-EVAL",
    evalOk ? 1 : 0,
    1,
    [{ box: g?.box ?? null, text_as_written: g?.result_as_written ?? null }],
    "circle",
    "Evaluate X = s ÷ c using your own s and c.",
    SRC.y2023,
  );

  // PHYS-ACCURACY (1, teacher mode only): within ±10% of the teacher's value.
  if (opts.teacherXOhm !== null) {
    const ok = xWritten !== null && rel(xWritten, opts.teacherXOhm) <= ACCURACY_BAND;
    s.add(
      "PHYS-ACCURACY",
      "PHYS-ACCURACY",
      ok ? 1 : 0,
      1,
      [{ box: g?.box ?? null, text_as_written: g?.result_as_written ?? null }],
      "circle",
      "Your X is more than 10% from the expected value: check the balance points.",
      SRC.y2023,
    );
  }

  // PRECAUTIONS (2): any two accepted precautions, in acceptable tense, 1 each.
  const judged: Array<{ text: string; j: PrecautionJudgement }> = r.precautions.map((text) => ({
    text,
    j: judgePrecaution(text),
  }));
  const seen = new Set<string>();
  const accepted = judged.filter((p) => {
    if (!p.j.accepted || !p.j.matched || seen.has(p.j.matched)) return false;
    seen.add(p.j.matched);
    return true;
  });
  const refused = judged.filter((p) => !p.j.accepted);
  for (let i = 0; i < 2; i++) {
    const a = accepted[i];
    const shown = a ?? refused[i - accepted.length] ?? null;
    const reason = shown && !shown.j.accepted ? shown.j.reason : null;
    s.add(
      `PRECAUTIONS:${i + 1}`,
      "PRECAUTIONS",
      a ? 1 : 0,
      1,
      shown ? [{ box: null, text_as_written: shown.text }] : [],
      "strike",
      reason === "penalised_action"
        ? "Sliding the jockey scrapes the wire, which is the mistake WAEC penalises. Write: “The jockey was not dragged along the wire.”"
        : reason === "instruction"
          ? "State what you did, in the past tense: e.g. “Parallax was avoided when reading the metre rule.”"
          : "Give two precautions you actually took, e.g. “The key was opened between readings.”",
      SRC.y2023,
      reason === "instruction" && shown?.j.matched === "parallax_avoided"
        ? "Parallax was avoided when reading the metre rule."
        : reason === "penalised_action"
          ? "The jockey was not dragged along the wire."
          : null,
    );
  }

  const earned = s.items.reduce((t, i) => t + i.marks_earned, 0);
  const available = s.items.reduce((t, i) => t + i.marks_available, 0);
  return {
    experiment: "meter_bridge",
    question_label: "Question 3",
    earned,
    available,
    items: s.items,
    setup_issues: opts.setupIssues ?? [],
    teacher_mode: opts.teacherXOhm !== null,
  };
}
