import { MarkSheet } from "@snaplab/contracts";
import { describe, expect, it } from "vitest";
import { G1_READINGS, G2_READINGS } from "./golden";
import { markMeterBridge } from "./meterBridge";
import { judgePrecaution } from "./precautions";
import { decimalPlaces, hasUnit, lastNumber, sigFigs } from "./text";

describe("reading what she wrote", () => {
  it("counts decimal places as written", () => {
    // WAEC Phys P3 2018 Q3A: lengths to 1 d.p. "57" fails, "57.0" passes (docs/15 §5).
    expect(decimalPlaces("57")).toBe(0);
    expect(decimalPlaces("57.0")).toBe(1);
    expect(decimalPlaces("25.3")).toBe(1);
    expect(decimalPlaces("0.0395")).toBe(4);
    expect(decimalPlaces("abc")).toBeNull();
  });

  it("counts significant figures as written", () => {
    // WAEC Phys P3 2018 Q3A: derived values to 3 s.f. "0.02" fails (docs/15 §5).
    expect(sigFigs("0.02")).toBe(1);
    expect(sigFigs("0.0200")).toBe(3);
    expect(sigFigs("0.0395")).toBe(3);
    expect(sigFigs("1.00")).toBe(3);
    expect(sigFigs("0.500")).toBe(3);
    expect(sigFigs("25.3")).toBe(3);
    expect(sigFigs("57")).toBe(2);
  });

  it("finds units and the last number on a working line", () => {
    // WAEC Phys P3 2018 Q3A and 2023 Q3B: units in headers and on axes; s and c read from her working.
    expect(hasUnit("l⁻¹")).toBe(false);
    expect(hasUnit("l⁻¹ (cm⁻¹)")).toBe(true);
    expect(hasUnit("l/cm")).toBe(true);
    expect(hasUnit("1/R")).toBe(false); // a quantity, not a unit
    expect(hasUnit("l⁻¹ (approx)")).toBe(false);
    expect(lastNumber("s = (0.0175 − 0.0160) ÷ (0.250 − 0.200) = 0.030")).toBeCloseTo(0.03, 12);
    expect(lastNumber("c = 0.0102 cm⁻¹")).toBeCloseTo(0.0102, 12);
    expect(lastNumber("c = 0.0102 cm-1")).toBeCloseTo(0.0102, 12);
    expect(lastNumber("c = .010")).toBeCloseTo(0.01, 12);
    expect(lastNumber("c = 1.02 × 10⁻² cm⁻¹")).toBeCloseTo(0.0102, 12);
  });

  it("reads standard form and ignores a unit written in the cell", () => {
    // Standard form is common in WAEC working; the rule counts the figures she wrote.
    expect(sigFigs("3.95×10⁻²")).toBe(3);
    expect(sigFigs("3.95 x 10^-2")).toBe(3);
    expect(sigFigs("+0.0395")).toBe(3);
    expect(decimalPlaces("57.0 cm")).toBe(1);
    expect(decimalPlaces(".5")).toBe(1);
    expect(decimalPlaces("57.")).toBe(0);
  });
});

describe("precautions in acceptable tense", () => {
  // WAEC Phys P3 2023 Q3B: precautions "in acceptable tense"; 2018 Q3A: "the jockey was not
  // dragged along the wire"; 2008: "in acceptable form of speech" (docs/15 §9).
  it.each([
    "The key was opened between readings.",
    "2. The jockey was not dragged along the wire.",
    "Parallax was avoided when reading the metre rule.",
    "Connections were tight and terminals clean.",
    "The jockey wasn't dragged along the wire.",
    "Jockey not allowed to scratch resistance wire", // WAEC 2008 expected answer, word for word
  ])("accepts %s", (p) => expect(judgePrecaution(p).accepted).toBe(true));

  it("refuses an instruction", () => {
    expect(judgePrecaution("1. Avoid parallax error when reading the metre rule.")).toMatchObject({
      accepted: false,
      reason: "instruction",
    });
    expect(judgePrecaution("Ensure tight connections").reason).toBe("instruction");
  });

  it.each([
    "The key should be opened between readings",
    "I will make sure the key is opened",
    "The key was not opened between readings",
    "Parallax error was not avoided",
    "The jockey was not pressed hard but dragged",
  ])("refuses %s (not something that was done)", (p) =>
    expect(judgePrecaution(p).accepted).toBe(false),
  );

  it("refuses the action WAEC penalises", () => {
    expect(
      judgePrecaution("2. I slid the jockey gently along the wire to find the balance point."),
    ).toMatchObject({ accepted: false, reason: "penalised_action" });
  });
});

describe("markMeterBridge on the golden pages", () => {
  it("gives G1 exactly 15½ / 21 with the docs/11 answer key", () => {
    // docs/15 §5 and docs/11 §2: 15½/21 in student mode.
    const sheet = markMeterBridge(G1_READINGS, { teacherXOhm: null });
    expect(MarkSheet.parse(sheet)).toBeTruthy();
    expect(sheet.earned).toBe(15.5);
    expect(sheet.available).toBe(21);
    const lost = sheet.items
      .filter((i) => i.outcome === "lost")
      .map((i) => [
        i.rule,
        i.marks_available - i.marks_earned,
        i.evidence[0]?.text_as_written ?? null,
      ]);
    expect(lost).toEqual([
      ["PHYS-1DP", 0.5, "57"],
      ["PHYS-3SF", 0.5, "0.02"],
      ["PHYS-TABLE", 0.5, "l⁻¹"],
      ["GRAPH-AXES", 0.5, "l⁻¹"],
      ["GRAPH-SCALE", 0.5, null],
      ["GRAPH-SLOPE", 1, null],
      ["PRECAUTIONS", 1, "1. Avoid parallax error when reading the metre rule."],
      ["PRECAUTIONS", 1, "2. I slid the jockey gently along the wire to find the balance point."],
    ]);
    // docs/11 §2: her X = 3.0 Ω follows from her own s and c, so PHYS-EVAL is earned.
    expect(sheet.items.find((i) => i.rule === "PHYS-EVAL")?.outcome).toBe("earned");
  });

  it("suggests the corrections the red ink writes", () => {
    const sheet = markMeterBridge(G1_READINGS, { teacherXOhm: null });
    const byText = (t: string) => sheet.items.find((i) => i.evidence[0]?.text_as_written === t);
    expect(byText("57")?.correction).toBe("57.0");
    // 1 / 50.2 cm = 0.0199 cm⁻¹ to 3 s.f.
    expect(byText("0.02")?.correction).toBe("0.0199");
  });

  it("gives G2 21 / 21, and 22 / 22 in teacher mode with 3.0 Ω", () => {
    // docs/11 §3: 2.88 Ω is within ±10% of 3.0 Ω (WAEC Phys P3 2023 Q3B accuracy band).
    const student = markMeterBridge(G2_READINGS, { teacherXOhm: null });
    expect([student.earned, student.available]).toEqual([21, 21]);
    const teacher = markMeterBridge(G2_READINGS, { teacherXOhm: 3.0 });
    expect(MarkSheet.parse(teacher)).toBeTruthy();
    expect([teacher.earned, teacher.available]).toEqual([22, 22]);
  });

  it("loses accuracy when the teacher's value is 2.5 Ω (2.88 is 15% off)", () => {
    // WAEC Phys P3 2023 Q3B: accuracy within ±10%.
    const sheet = markMeterBridge(G2_READINGS, { teacherXOhm: 2.5 });
    expect(sheet.items.find((i) => i.rule === "PHYS-ACCURACY")?.outcome).toBe("lost");
    expect(sheet.earned).toBe(21);
  });

  it("counts a precaution topic once", () => {
    // "Any two correct precautions" (docs/15 §4): the same precaution twice earns 1, not 2.
    const sheet = markMeterBridge(
      {
        ...G2_READINGS,
        precautions: [
          "The key was opened between readings.",
          "The key was opened after each reading.",
        ],
      },
      { teacherXOhm: null },
    );
    expect(sheet.items.filter((i) => i.rule === "PRECAUTIONS").map((i) => i.marks_earned)).toEqual([
      1, 0,
    ]);
  });

  it("gives the same sheet for the same page", () => {
    // docs/07 §1: deterministic, same page → same score.
    expect(markMeterBridge(G1_READINGS, { teacherXOhm: null })).toEqual(
      markMeterBridge(structuredClone(G1_READINGS), { teacherXOhm: null }),
    );
  });

  it("marks duplicate and missing rows without double counting", () => {
    // Wonder may repeat a row or miss one; the scheme still has five slots (docs/15 §4).
    const dup = {
      ...G2_READINGS,
      cells: [...G2_READINGS.cells, ...G2_READINGS.cells.filter((c) => c.row === "1")],
    };
    const sheet = markMeterBridge(dup, { teacherXOhm: null });
    expect(new Set(sheet.items.map((i) => i.id)).size).toBe(sheet.items.length);
    expect(sheet.earned).toBe(21);
    const short = markMeterBridge(
      { ...G2_READINGS, cells: G2_READINGS.cells.filter((c) => c.row !== "5") },
      { teacherXOhm: null },
    );
    expect(MarkSheet.parse(short)).toBeTruthy();
    // Row 5 missing: −½ for l, −½ each for R⁻¹ and l⁻¹ (−1½), and only 4 of her 5 plotted
    // points match a table row, so GRAPH-POINTS gives 1 instead of 1½ (−½).
    expect(short.earned).toBe(21 - 2);
  });

  it("does not take a 1/R header or swapped axes as correct", () => {
    // WAEC Phys P3 2023 Q3B: l⁻¹ on the vertical axis against R⁻¹, both with units.
    const swapped = markMeterBridge(
      {
        ...G2_READINGS,
        graph: G2_READINGS.graph && {
          ...G2_READINGS.graph,
          x_label_as_written: "l⁻¹ (cm⁻¹)",
          y_label_as_written: "R⁻¹ (Ω⁻¹)",
        },
      },
      { teacherXOhm: null },
    );
    expect(
      swapped.items
        .filter((i) => i.id.startsWith("GRAPH-AXES:") && i.outcome === "lost")
        .map((i) => i.id),
    ).toEqual(["GRAPH-AXES:x", "GRAPH-AXES:y"]);
    const noUnits = markMeterBridge(
      {
        ...G2_READINGS,
        cells: G2_READINGS.cells.map((c) =>
          c.column === "R_inv"
            ? {
                ...c,
                text_as_written: c.row === "header" ? "1/R" : c.text_as_written,
                column_header_as_written: "1/R",
              }
            : c,
        ),
      },
      { teacherXOhm: null },
    );
    expect(noUnits.items.find((i) => i.id === "PHYS-TABLE:units-derived")?.outcome).toBe("lost");
  });

  it("accepts an upper-case L⁻¹ axis but not R against l", () => {
    // The question plots l⁻¹ against R⁻¹ (docs/15 §4), not l against R.
    const g = G2_READINGS.graph;
    if (!g) throw new Error("G2 has a graph");
    const axes = (x: string, y: string) =>
      markMeterBridge(
        { ...G2_READINGS, graph: { ...g, x_label_as_written: x, y_label_as_written: y } },
        { teacherXOhm: null },
      )
        .items.filter((i) => i.id === "GRAPH-AXES:x" || i.id === "GRAPH-AXES:y")
        .map((i) => i.outcome);
    expect(axes("R⁻¹ (Ω⁻¹)", "L⁻¹ (cm⁻¹)")).toEqual(["earned", "earned"]);
    expect(axes("1/R (Ω⁻¹)", "1/l (cm⁻¹)")).toEqual(["earned", "earned"]);
    expect(axes("R (Ω)", "l (cm)")).toEqual(["lost", "lost"]);
    expect(hasUnit("t (min)")).toBe(false);
  });

  it("gives partial point marks: 4 of 5 → 1, 3 of 5 → ½", () => {
    // docs/15 §4 GRAPH-POINTS 1½, checked against her own table.
    const withPoints = (n: number) =>
      markMeterBridge(
        {
          ...G2_READINGS,
          graph: G2_READINGS.graph && {
            ...G2_READINGS.graph,
            points: G2_READINGS.graph.points.slice(0, n),
          },
        },
        { teacherXOhm: null },
      ).items.find((i) => i.rule === "GRAPH-POINTS")?.marks_earned;
    expect(withPoints(4)).toBe(1);
    expect(withPoints(3)).toBe(0.5);
  });

  it("loses the intercept and X when they don't follow from her own line and s/c", () => {
    // docs/15 §4: intercept read from her line; X = s/c from her own s and c.
    const g = G2_READINGS.graph;
    if (!g) throw new Error("G2 has a graph");
    const sheet = markMeterBridge(
      {
        ...G2_READINGS,
        graph: { ...g, intercept_as_written: "c = 0.0150", result_as_written: "X = 2.0 Ω" },
      },
      { teacherXOhm: null },
    );
    expect(sheet.items.find((i) => i.rule === "GRAPH-INTERCEPT")?.outcome).toBe("lost");
    expect(sheet.items.find((i) => i.rule === "PHYS-EVAL")?.outcome).toBe("lost");
  });

  it("measures graph size against its own sheet and loses the line when none is drawn", () => {
    // WAEC: the graph fills at least 1/3 of the page (docs/07 §5.2, GRAPH-SCALE).
    const g = G2_READINGS.graph;
    if (!g) throw new Error("G2 has a graph");
    const half = {
      ...G2_READINGS,
      graph: { ...g, box: { x0: 0.5, y0: 0.5, x1: 0.95, y1: 0.95 }, line_drawn: false },
    };
    const vsPage = markMeterBridge(half, { teacherXOhm: null });
    expect(vsPage.items.find((i) => i.id === "GRAPH-SCALE:size")?.outcome).toBe("lost");
    const vsSheet = markMeterBridge(half, {
      teacherXOhm: null,
      graphSheetBox: { x0: 0.5, y0: 0.3, x1: 1, y1: 1 },
    });
    expect(vsSheet.items.find((i) => i.id === "GRAPH-SCALE:size")?.outcome).toBe("earned");
    expect(vsSheet.items.find((i) => i.rule === "GRAPH-LINE")?.outcome).toBe("lost");
  });

  it("passes the blueprint's setup issues through without marks", () => {
    // docs/11 §2: "No key drawn" is circled but carries no mark.
    const sheet = markMeterBridge(G1_READINGS, {
      teacherXOhm: null,
      setupIssues: [{ description: "No key drawn in the circuit", box: null }],
    });
    expect(sheet.setup_issues).toHaveLength(1);
    expect(sheet.earned).toBe(15.5);
  });

  it("corrects R⁻¹ from her own R", () => {
    // R⁻¹ = 1/R to 3 s.f. (WAEC Phys P3 2018 Q3A): R = 3.0 Ω → 0.333.
    const sheet = markMeterBridge(
      {
        ...G2_READINGS,
        cells: G2_READINGS.cells.map((c) =>
          c.column === "R_inv" && c.row === "3" ? { ...c, text_as_written: "0.33" } : c,
        ),
      },
      { teacherXOhm: null },
    );
    expect(sheet.items.find((i) => i.id === "PHYS-3SF:R_inv:3")?.correction).toBe("0.333");
  });

  it("loses every graph mark when there is no graph", () => {
    // docs/15 §4: graph, slope, intercept and evaluation marks all need a graph.
    const sheet = markMeterBridge({ ...G2_READINGS, graph: null }, { teacherXOhm: null });
    const graphMarks = sheet.items
      .filter((i) => i.rule.startsWith("GRAPH") || i.rule === "PHYS-EVAL")
      .reduce((t, i) => t + i.marks_earned, 0);
    expect(graphMarks).toBe(0);
    expect(MarkSheet.parse(sheet)).toBeTruthy();
  });
});
