import type { Box, MarkItem, MarkSheet, Readings, RuleCode } from "@snaplab/contracts";
import { judgePrecaution } from "./precautions";
import { decimalPlaces, hasUnit, lastNumber, parseNumber, sigFigs } from "./text";

/** The sheet label of this form (also how the examiner tells the forms apart). */
export const L1L2_QUESTION_LABEL = "Metre bridge, l₁/l₂ form (SnapLab's mark split)";

// Marking for the other common metre bridge write-up (docs/plans/rules-meter-bridge-l1l2.md):
// for each R she finds l₁, writes l₂ = 100 − l₁, works out X = R·l₂/l₁, averages X, and may
// plot l₂ against l₁. The items follow the WAEC metre bridge expectations already used for
// the golden question (docs/15 §4, §9): lengths to at least 1 d.p. in cm, derived values to
// 3 s.f., a composite table with units, a labelled graph filling at least 1/3 of the page,
// a large slope triangle, and two precautions in acceptable tense. The mark split is ours:
// WAEC has not published a scheme for this exact form, and the sheet says so.
//
// A notebook often spreads one practical over two pages, so each section is marked only if
// it is on the page that was snapped; a missing section is reported, not penalised.

const SRC = {
  y2023: {
    label: "WAEC Physics P3 May/June 2023 Q3B",
    url: "https://waeconline.org.ng/E-Learning/Physics/Phys340mq3B.html",
  },
  y2018: {
    label: "WAEC Physics P3 May/June 2018 Q3A",
    url: "https://waeconline.org.ng/E-Learning/Physics/Phys327mq3A.html",
  },
  y2013: {
    label: "WAEC Physics P3 Nov/Dec metre bridge (standard resistor)",
    url: "https://waeconline.org.ng/E-Learning/Physics/Phys320nq3.html",
  },
} as const;

/** l₂ written must equal 100 − l₁ to within this (cm): one unit in the 1st decimal place. */
/** l₂ = 100 − l₁ is exact arithmetic on what she wrote: allow only float noise. */
const L2_TOLERANCE_CM = 0.005;
/** A row's X must equal R·l₂/l₁ from her own numbers within this share. */
const X_MATCH = 0.01;
/** Her mean must equal the mean of her own X values within this share. */
const MEAN_MATCH = 0.01;
/** A plotted point must satisfy l₁ + l₂ = 100 within this share of the axis span. */
const POINT_TOLERANCE = 0.02;
const LARGE_TRIANGLE = 0.5;
const GRAPH_PAGE_SHARE = 1 / 3;

type Cell = Readings["cells"][number];
type Col = "R" | "l1" | "l2" | "X";

export interface MarkL1L2Options {
  /** Teacher mode: the true X in ohms; null or absent in student mode. */
  teacherXOhm?: number | null;
  setupIssues?: MarkSheet["setup_issues"];
  graphSheetBox?: Box | null;
}

/** Which of our columns a cell belongs to, from its heading as written. */
export function columnOf(c: Cell): Col | null {
  const h = (c.column_header_as_written ?? "").replace(/\s+/g, "");
  if (/^(l|ℓ)(₁|1)/i.test(h)) return "l1";
  if (/^(l|ℓ)(₂|2)/i.test(h)) return "l2";
  if (/^X(?![⁻^])/i.test(h)) return "X";
  if (/^R(?![⁻^])/i.test(h) || c.column === "R") return "R";
  return null;
}

/** Whether a page's table is the l₁/l₂ form (an l₁ and an l₂ column). */
export function isL1L2Page(r: Readings): boolean {
  const cols = new Set(r.cells.map(columnOf));
  if (cols.has("l1") && cols.has("l2")) return true;
  // A graph-only page (the table is on the facing page): l₂ plotted against l₁.
  const q = (label: string | null | undefined) =>
    (label ?? "").replace(/\(.*\)/, "").replace(/\s+/g, "");
  return (
    /^(l|ℓ)(₁|1)$/i.test(q(r.graph?.x_label_as_written)) &&
    /^(l|ℓ)(₂|2)$/i.test(q(r.graph?.y_label_as_written))
  );
}

const isHeaderRow = (row: string) => /head/i.test(row);

function rel(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);
}

function fmt(x: number, dp: number): string {
  return (Math.round(x * 10 ** dp) / 10 ** dp).toFixed(dp);
}

class Sheet {
  items: MarkItem[] = [];
  add(
    id: string,
    rule: RuleCode,
    earned: number,
    available: number,
    evidence: MarkItem["evidence"],
    lost: MarkItem["annotation"],
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
      annotation: ok ? "tick" : lost,
      correction: ok ? null : correction,
      fix_en: fix,
      fix_pcm: null,
      source,
    });
  }
}

/** Marks an l₁/l₂ metre bridge page. Pure and deterministic. */
export function markMeterBridgeL1L2(r: Readings, opts: MarkL1L2Options = {}): MarkSheet {
  const s = new Sheet();
  const notes: MarkSheet["setup_issues"] = [...(opts.setupIssues ?? [])];

  // One cell per (row, column), first wins; rows in written order.
  const byRow = new Map<string, Partial<Record<Col, Cell>>>();
  const headers: Partial<Record<Col, Cell>> = {};
  for (const c of r.cells) {
    const col = columnOf(c);
    if (!col) continue;
    if (isHeaderRow(c.row)) {
      headers[col] ??= c;
      continue;
    }
    const row = byRow.get(c.row) ?? {};
    row[col] ??= c;
    byRow.set(c.row, row);
  }
  const rows = [...byRow.entries()].slice(0, 5);
  const v = (c: Cell | undefined) => (c ? (parseNumber(c.text_as_written) ?? c.value) : null);
  const ev = (c: Cell | undefined) =>
    c ? [{ box: c.box, text_as_written: c.text_as_written }] : [];
  const headerText = (col: Col) =>
    headers[col]?.text_as_written ??
    r.cells.find((c) => columnOf(c) === col)?.column_header_as_written ??
    null;

  const hasTable = r.table_found && rows.length > 0 && rows.some(([, x]) => x.l1);
  if (hasTable) {
    for (let i = 0; i < 5; i++) {
      const [rowName, row] = rows[i] ?? [`missing${i + 1}`, {}];
      const l1 = row.l1;
      const l2 = row.l2;
      const R = row.R;
      const X = row.X;
      const l1v = v(l1);
      const l2v = v(l2);
      const Rv = v(R);
      const Xv = v(X);

      // l₁ to at least 1 d.p. in cm (WAEC 2018 Q3A, 2011).
      s.add(
        `PHYS-1DP:l1:${rowName}`,
        "PHYS-1DP",
        l1 && (decimalPlaces(l1.text_as_written) ?? 0) >= 1 ? 0.5 : 0,
        0.5,
        ev(l1),
        "circle",
        "Record each balance length l₁ in cm to at least 1 decimal place.",
        SRC.y2018,
        l1v !== null ? fmt(l1v, 1) : null,
      );

      // l₂ = 100 − l₁, to at least 1 d.p.
      const l2Ok =
        l2 !== undefined &&
        l1v !== null &&
        l2v !== null &&
        (decimalPlaces(l2.text_as_written) ?? 0) >= 1 &&
        Math.abs(l2v - (100 - l1v)) <= L2_TOLERANCE_CM;
      s.add(
        `PHYS-1DP:l2:${rowName}`,
        "PHYS-1DP",
        l2Ok ? 0.5 : 0,
        0.5,
        ev(l2),
        "circle",
        "l₂ is the rest of the wire: l₂ = 100 − l₁, to at least 1 decimal place.",
        SRC.y2018,
        l1v !== null ? fmt(100 - l1v, 1) : null,
      );

      // X to 3 s.f., and X = R·l₂/l₁ from her own numbers.
      s.add(
        `PHYS-3SF:X:${rowName}`,
        "PHYS-3SF",
        X && (sigFigs(X.text_as_written) ?? 0) >= 3 ? 0.5 : 0,
        0.5,
        ev(X),
        "circle",
        "Give X to 3 significant figures.",
        SRC.y2018,
        Xv !== null ? Number(Xv.toPrecision(3)).toPrecision(3) : null,
      );
      const xFromRow = Rv !== null && l1v && l2v !== null ? (Rv * l2v) / l1v : null;
      s.add(
        `PHYS-EVAL:X:${rowName}`,
        "PHYS-EVAL",
        xFromRow !== null && Xv !== null && rel(Xv, xFromRow) <= X_MATCH ? 0.5 : 0,
        0.5,
        ev(X),
        "circle",
        "Work out X = R × l₂ ÷ l₁ from this row's own numbers.",
        SRC.y2013,
        xFromRow !== null ? Number(xFromRow.toPrecision(3)).toPrecision(3) : null,
      );
    }

    // Composite table: all four columns (½), units on R, l₁, l₂ (½), unit on X (½).
    const cols: Col[] = ["R", "l1", "l2", "X"];
    const allCols = cols.every((c) => rows.some(([, x]) => x[c]));
    s.add(
      "PHYS-TABLE:columns",
      "PHYS-TABLE",
      allCols ? 0.5 : 0,
      0.5,
      [],
      "box",
      "Tabulate R, l₁, l₂ and X together in one table.",
      SRC.y2018,
    );
    const measured = (["R", "l1", "l2"] as const).every(
      (c) => hasUnit(headerText(c)) || /ohm|Ω/i.test(headerText(c) ?? ""),
    );
    s.add(
      "PHYS-TABLE:units-measured",
      "PHYS-TABLE",
      measured ? 0.5 : 0,
      0.5,
      (["R", "l1", "l2"] as const).map((c) => ({
        box: headers[c]?.box ?? null,
        text_as_written: headerText(c),
      })),
      "underline",
      "Put the unit in each heading: R (Ω), l₁ (cm), l₂ (cm).",
      SRC.y2018,
    );
    const xUnit = hasUnit(headerText("X")) || /ohm|Ω/i.test(headerText("X") ?? "");
    s.add(
      "PHYS-TABLE:units-X",
      "PHYS-TABLE",
      xUnit ? 0.5 : 0,
      0.5,
      [{ box: headers.X?.box ?? null, text_as_written: headerText("X") }],
      "underline",
      "X is a resistance: give its column a unit, X (Ω).",
      SRC.y2018,
      "X (Ω)",
    );

    // Mean X from her own row values.
    const xs = rows.map(([, x]) => v(x.X)).filter((n): n is number => n !== null);
    const mean = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    // Wonder may report her "Mean X = …" line as an extra mark instead (Oct 27 live read).
    const meanMark = r.other_marks.find((m) =>
      /\b(mean|average)\b/i.test(`${m.description} ${m.text_as_written ?? ""}`),
    );
    const avg =
      r.average_as_written ??
      (meanMark?.text_as_written
        ? { text_as_written: meanMark.text_as_written, value: null, rows_averaged: [] }
        : null);
    const meanWritten = avg ? (avg.value ?? lastNumber(avg.text_as_written)) : null;
    s.add(
      "PHYS-EVAL:mean",
      "PHYS-EVAL",
      mean !== null && meanWritten !== null && rel(meanWritten, mean) <= MEAN_MATCH ? 1 : 0,
      1,
      [{ box: null, text_as_written: avg?.text_as_written ?? null }],
      "circle",
      "Average your X values: add them and divide by how many there are.",
      SRC.y2013,
      mean !== null ? `${Number(mean.toPrecision(3)).toPrecision(3)} Ω` : null,
    );
    // Teacher mode only: her mean within ±10% of the teacher's value (WAEC 2023 Q3B).
    if (opts.teacherXOhm != null) {
      s.add(
        "PHYS-ACCURACY",
        "PHYS-ACCURACY",
        meanWritten !== null && rel(meanWritten, opts.teacherXOhm) <= 0.1 ? 1 : 0,
        1,
        [{ box: null, text_as_written: avg?.text_as_written ?? null }],
        "circle",
        "Your X is more than 10% from the expected value: check the balance points.",
        SRC.y2023,
      );
    }
  } else {
    notes.push({
      description: "No results table on this page: snap the table page to mark it.",
      box: null,
    });
  }

  const g = r.graph;
  if (g) {
    const gEv = [{ box: g.box, text_as_written: null }];
    // Axes: l₂ (vertical) against l₁ (horizontal), each with its quantity (½ each) and units (½).
    const q = (label: string | null) => (label ?? "").replace(/\(.*\)/, "").replace(/\s+/g, "");
    const xOk = /^(l|ℓ)(₁|1)$/i.test(q(g.x_label_as_written));
    const yOk = /^(l|ℓ)(₂|2)$/i.test(q(g.y_label_as_written));
    s.add(
      "GRAPH-AXES:x",
      "GRAPH-AXES",
      xOk ? 0.5 : 0,
      0.5,
      gEv,
      "box",
      "Label the horizontal axis with its quantity, l₁.",
      SRC.y2023,
    );
    s.add(
      "GRAPH-AXES:y",
      "GRAPH-AXES",
      yOk ? 0.5 : 0,
      0.5,
      gEv,
      "box",
      "Label the vertical axis with its quantity, l₂.",
      SRC.y2023,
    );
    const units = hasUnit(g.x_label_as_written) && hasUnit(g.y_label_as_written);
    s.add(
      "GRAPH-AXES:units",
      "GRAPH-AXES",
      units ? 0.5 : 0,
      0.5,
      gEv,
      "underline",
      "Both axis labels need their unit: l₁ (cm), l₂ (cm).",
      SRC.y2023,
    );

    const boxArea = (b: Box) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
    const sheetBox = opts.graphSheetBox ?? { x0: 0, y0: 0, x1: 1, y1: 1 };
    const area = boxArea(g.box) / Math.max(boxArea(sheetBox), 1e-9);
    s.add(
      "GRAPH-SCALE:size",
      "GRAPH-SCALE",
      area >= GRAPH_PAGE_SHARE ? 0.5 : 0,
      0.5,
      gEv,
      "box",
      "Choose scales so the graph fills at least one third of the page.",
      SRC.y2023,
    );
    s.add(
      "GRAPH-SCALE:scales",
      "GRAPH-SCALE",
      g.points.length > 0 ? 1 : 0,
      1,
      gEv,
      "box",
      "Use simple scales (1, 2, 5 or 10 per large square, never 3). (Scale choice is not checked automatically yet; a graph with plotted points earns this.)",
      SRC.y2023,
    );

    // Points: against her own table when it is on this page; otherwise each must at least
    // lie on l₁ + l₂ = 100 (the wire is 100 cm). Within 2% of the span; one point per row.
    const span =
      Math.max(1e-9, ...g.points.flatMap((p) => [p.x, p.y])) -
      Math.min(0, ...g.points.flatMap((p) => [p.x, p.y]));
    const tableRows = rows
      .map(([, x]) => ({ x: v(x.l1), y: v(x.l2) }))
      .filter((p): p is { x: number; y: number } => p.x !== null && p.y !== null);
    let pts = 0;
    if (tableRows.length) {
      const unused = [...g.points];
      for (const t of tableRows) {
        const k = unused.findIndex(
          (p) =>
            Math.abs(p.x - t.x) <= POINT_TOLERANCE * span &&
            Math.abs(p.y - t.y) <= POINT_TOLERANCE * span,
        );
        if (k !== -1) {
          unused.splice(k, 1);
          pts += 1;
        }
      }
    } else {
      pts = g.points.filter((p) => Math.abs(p.x + p.y - 100) <= POINT_TOLERANCE * span).length;
    }
    pts = Math.min(pts, 5);
    s.add(
      "GRAPH-POINTS",
      "GRAPH-POINTS",
      pts >= 5 ? 1.5 : pts === 4 ? 1 : pts === 3 ? 0.5 : 0,
      1.5,
      gEv,
      "box",
      "Plot each (l₁, l₂) pair from your table; every point should have l₁ + l₂ = 100.",
      SRC.y2023,
    );
    s.add(
      "GRAPH-LINE",
      "GRAPH-LINE",
      g.line_drawn ? 1.5 : 0,
      1.5,
      gEv,
      "box",
      "Draw one straight line of best fit through the points.",
      SRC.y2013,
    );

    const tri = g.triangle;
    const tx = tri ? [tri.p1.x, tri.p2.x, tri.p3.x] : [];
    const leg = tri ? Math.max(...tx) - Math.min(...tx) : 0;
    const pSpan = g.points.length
      ? Math.max(...g.points.map((p) => p.x)) - Math.min(...g.points.map((p) => p.x))
      : 0;
    s.add(
      "GRAPH-SLOPE:large",
      "GRAPH-SLOPE",
      tri && pSpan > 0 && leg >= LARGE_TRIANGLE * pSpan ? 1 : 0,
      1,
      gEv,
      "box",
      "Use a large right-angled triangle, covering at least half of the line.",
      SRC.y2023,
    );
    // No mark for the slope's value: l₂ = 100 − l₁ by definition, so this graph always has
    // slope −1 and intercept 100 whatever X is. Say so instead of rewarding it.
    notes.push({
      description:
        "A graph of l₂ against l₁ always has slope −1, whatever X is, so it cannot give X. To find X from a graph, plot R against l₁/l₂: its slope is X.",
      box: null,
    });
  } else {
    notes.push({
      description: "No graph on this page: snap the graph page to mark it.",
      box: null,
    });
  }

  if (r.precautions.length) {
    const seen = new Set<string>();
    const judged = r.precautions.map((text) => ({ text, j: judgePrecaution(text) }));
    const accepted = judged.filter(
      (p) => p.j.accepted && p.j.matched && !seen.has(p.j.matched) && seen.add(p.j.matched),
    );
    const refused = judged.filter((p) => !p.j.accepted);
    for (let i = 0; i < 2; i++) {
      const a = accepted[i];
      const shown = a ?? refused[i - accepted.length] ?? null;
      s.add(
        `PRECAUTIONS:${i + 1}`,
        "PRECAUTIONS",
        a ? 1 : 0,
        1,
        shown ? [{ box: null, text_as_written: shown.text }] : [],
        "strike",
        "Give two precautions you took, in the past tense: e.g. “The key was opened between readings.”",
        SRC.y2023,
      );
    }
  } else {
    notes.push({
      description: "No precautions on this page: snap the page that has them to mark them.",
      box: null,
    });
  }

  return {
    experiment: "meter_bridge",
    question_label: L1L2_QUESTION_LABEL,
    earned: s.items.reduce((t, i) => t + i.marks_earned, 0),
    available: s.items.reduce((t, i) => t + i.marks_available, 0),
    items: s.items,
    setup_issues: notes,
    teacher_mode: opts.teacherXOhm != null,
  };
}
