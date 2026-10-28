// Tests for the DRAFT Ohm's-law (V–I) scheme (docs/07 §5.2, "Ohm's law (V–I) rows. DRAFT").
// The mark split is ours until the user supplies the official scheme, so the expected marks
// below are the DRAFT allocation in ohmsLaw.ts, not a published WAEC number. Where a WAEC
// source backs the behaviour it is cited; otherwise the comment says it is DRAFT.
import { MarkSheet, type OhmsLawRecord } from "@snaplab/contracts";
import { describe, expect, it } from "vitest";
import { examinerQuestionById, examinerQuestions, OHMS_LAW_QUESTIONS } from "./examiner";
import { G1_READINGS, G2_READINGS } from "./golden";
import { markMeterBridge } from "./meterBridge";
import {
  CALC_AREA_M2,
  CALC_LENGTH_M,
  markOhmsLaw,
  OHMS_LAW_QUESTION_LABEL,
  slopeHasOhmUnit,
} from "./ohmsLaw";
import {
  OHMS_AXES_SWAPPED,
  OHMS_CALC_NO_UNIT,
  OHMS_FOUR_ROWS,
  OHMS_GOOD,
  OHMS_LAW_NO_CONDITION,
  OHMS_POINTS_OFF,
  OHMS_SLIP_1DP,
  OHMS_SLIP_3X1DP,
  OHMS_SLOPE_NO_UNIT,
  OHMS_SMALL_TRIANGLE,
  OHMS_WRONG_TENSE,
} from "./ohmsLawGolden";
import { judgePrecaution } from "./precautions";

const mark = (r: OhmsLawRecord, opts?: Parameters<typeof markOhmsLaw>[1]) => {
  const sheet = markOhmsLaw(r, opts);
  // Every sheet satisfies the frozen contract: half marks, totals that add up.
  expect(MarkSheet.parse(sheet)).toBeTruthy();
  return sheet;
};

/** [item id, marks lost] for every lost item, in sheet order. */
const lostItems = (r: OhmsLawRecord) =>
  mark(r)
    .items.filter((i) => i.outcome === "lost")
    .map((i) => [i.id, i.marks_available - i.marks_earned]);

const item = (r: OhmsLawRecord, id: string) => mark(r).items.find((i) => i.id === id);

describe("(b)(ii) worked from the question's data", () => {
  it("gives A = 3.143×10⁻⁸ m² and L = 0.25 m", () => {
    // docs/07 §4.4: A = πd²/4 = (22/7)(0.2×10⁻³)²/4 = 3.143×10⁻⁸ m²; L = RA/ρ = 0.25 m.
    expect(CALC_AREA_M2).toBeCloseTo(3.143e-8, 11);
    expect(CALC_LENGTH_M).toBeCloseTo(0.25, 6);
  });
});

describe("markOhmsLaw on the golden tables (DRAFT scheme)", () => {
  it("gives the good table 20 / 20, labelled DRAFT", () => {
    // DRAFT allocation in ohmsLaw.ts: 20 marks in student mode, nothing lost.
    const sheet = mark(OHMS_GOOD);
    expect(sheet.experiment).toBe("ohms_law_vi");
    expect(sheet.question_label).toBe(OHMS_LAW_QUESTION_LABEL);
    expect(sheet.question_label).toContain("DRAFT");
    expect([sheet.earned, sheet.available]).toEqual([20, 20]);
    expect(sheet.teacher_mode).toBe(false);
    expect(sheet.items.some((i) => i.rule === "PHYS-ACCURACY")).toBe(false);
    for (const i of sheet.items) {
      expect(i.annotation).toBe("tick");
      expect(i.correction).toBeNull();
      for (const e of i.evidence) expect(e.box).toBeNull();
    }
  });

  it("uses only docs/07 rule ids and unique item ids", () => {
    // docs/07 §5.2 Ohm's law rows: PHYS-1DP, PHYS-2DP, PHYS-TREND, PHYS-TABLE, GRAPH-*,
    // PRECAUTIONS, PHYS-LAW, PHYS-CALC (+ PHYS-ACCURACY in teacher mode).
    const sheet = mark(OHMS_GOOD, { teacherXyOhm: 3.0 });
    expect(new Set(sheet.items.map((i) => i.rule))).toEqual(
      new Set([
        "PHYS-1DP",
        "PHYS-TABLE",
        "PHYS-2DP",
        "PHYS-TREND",
        "GRAPH-AXES",
        "GRAPH-SCALE",
        "GRAPH-POINTS",
        "GRAPH-LINE",
        "GRAPH-SLOPE",
        "PHYS-ACCURACY",
        "PRECAUTIONS",
        "PHYS-LAW",
        "PHYS-CALC",
      ]),
    );
    expect(new Set(sheet.items.map((i) => i.id)).size).toBe(sheet.items.length);
  });

  it("keeps PHYS-2DP for a single 1 d.p. slip, since six of seven rows still pass", () => {
    // DRAFT PHYS-2DP (docs/07 §5.2): earned when at least five rows pass; all rows checked.
    // "0.3" for I at R = 5 Ω leaves six passing rows, so the sheet is still 20 / 20.
    const sheet = mark(OHMS_SLIP_1DP);
    expect(sheet.items.find((i) => i.id === "PHYS-2DP:I")?.outcome).toBe("earned");
    expect(sheet.earned).toBe(20);
  });

  it("loses PHYS-2DP:I (1) when three I readings are to 1 d.p., and corrects her own value", () => {
    // DRAFT PHYS-2DP: four of seven pass < 5. Correction from her own "0.3" to 2 d.p.: "0.30".
    expect(lostItems(OHMS_SLIP_3X1DP)).toEqual([["PHYS-2DP:I", 1]]);
    const i = item(OHMS_SLIP_3X1DP, "PHYS-2DP:I");
    expect(i?.correction).toBe("0.30");
    expect(i?.evidence.map((e) => e.text_as_written)).toEqual(["0.3", "0.2", "0.1"]);
    expect(i?.annotation).toBe("circle");
  });

  it("loses GRAPH-AXES x and y (1) and the slope unit (½) when the axes are swapped: 18½", () => {
    // The question asks for V (vertical) against I (horizontal) (plan, step 6). Her points,
    // line and triangle are still checked on her own (swapped) scales and pass; her s is
    // ΔI/ΔV in A/V, which is not a resistance. DRAFT: 20 − 1½ = 18½.
    expect(lostItems(OHMS_AXES_SWAPPED)).toEqual([
      ["GRAPH-AXES:y", 0.5],
      ["GRAPH-AXES:x", 0.5],
      ["GRAPH-SLOPE:unit", 0.5],
    ]);
    expect(mark(OHMS_AXES_SWAPPED).earned).toBe(18.5);
  });

  it("loses GRAPH-SLOPE:large (1) for a small triangle: 19", () => {
    // WAEC Phys P3 reports: slope from a large triangle (docs/07 §5.2 GRAPH-SLOPE); DRAFT
    // "large" = each leg at least ½ of the line's extent. Her ΔV and ΔI are read correctly.
    expect(lostItems(OHMS_SMALL_TRIANGLE)).toEqual([["GRAPH-SLOPE:large", 1]]);
  });

  it("loses both precautions (2) when they are instructions: 18", () => {
    // WAEC Phys P3 2023 Q3B: precautions in acceptable (reported) tense.
    expect(lostItems(OHMS_WRONG_TENSE)).toEqual([
      ["PRECAUTIONS:1", 1],
      ["PRECAUTIONS:2", 1],
    ]);
    const p = item(OHMS_WRONG_TENSE, "PRECAUTIONS:1");
    expect(p?.evidence[0]?.text_as_written).toBe("Avoid parallax error when reading the meters.");
    expect(p?.correction).toBe("Parallax was avoided when reading the meters.");
    expect(item(OHMS_WRONG_TENSE, "PRECAUTIONS:2")?.correction).toBe(
      "The key was opened between readings.",
    );
  });

  it("loses the table (1), both PHYS-2DP items (2) and ½ of GRAPH-POINTS with four rows: 16½", () => {
    // DRAFT "at least five rows" items (plan, "Rows"); GRAPH-POINTS 4 matched → 1 of 1½,
    // as the metre bridge's partial points (docs/15 §4). The trend still shows in 4 rows.
    expect(lostItems(OHMS_FOUR_ROWS)).toEqual([
      ["PHYS-TABLE:composite", 1],
      ["PHYS-2DP:I", 1],
      ["PHYS-2DP:V", 1],
      ["GRAPH-POINTS", 0.5],
    ]);
    expect(mark(OHMS_FOUR_ROWS).earned).toBe(16.5);
  });

  it("loses GRAPH-SLOPE:unit (½) when s has no unit, and adds Ω to her own s", () => {
    // DRAFT GRAPH-SLOPE: s evaluated with the unit Ω (docs/07 §5.2). 19½.
    expect(lostItems(OHMS_SLOPE_NO_UNIT)).toEqual([["GRAPH-SLOPE:unit", 0.5]]);
    expect(item(OHMS_SLOPE_NO_UNIT, "GRAPH-SLOPE:unit")?.correction).toBe(
      "s = ΔV/ΔI = 1.80/0.60 = 3.0 Ω",
    );
  });

  it("loses ½ of GRAPH-POINTS when three points are off her own table by 1½ small squares", () => {
    // WAEC Phys P3 2023 Q3B: points checked against her own table; DRAFT tolerance half a
    // small square (0.1 cm). 4 of 7 within it → 1 of 1½. 19½.
    expect(lostItems(OHMS_POINTS_OFF)).toEqual([["GRAPH-POINTS", 0.5]]);
  });

  it("loses 1 of PHYS-LAW:statement when the law has no condition, and offers it", () => {
    // Textbook statement (docs/07 §4.4 (b)(i)): "...provided the temperature and other
    // physical conditions remain constant." DRAFT split: name ½, statement 1 + condition 1.
    expect(lostItems(OHMS_LAW_NO_CONDITION)).toEqual([["PHYS-LAW:statement", 1]]);
    expect(item(OHMS_LAW_NO_CONDITION, "PHYS-LAW:statement")?.correction).toContain("temperature");
  });

  it("loses ½ of PHYS-CALC:answer when 0.25 has no unit, and writes the unit in", () => {
    // docs/07 §4.4 (b)(ii): L = 0.25 m. DRAFT: value ½ + unit ½. 19½.
    expect(lostItems(OHMS_CALC_NO_UNIT)).toEqual([["PHYS-CALC:answer", 0.5]]);
    expect(item(OHMS_CALC_NO_UNIT, "PHYS-CALC:answer")?.correction).toBe("0.25 m");
  });

  it("gives the same sheet for the same record", () => {
    // docs/07 §1: deterministic, same page → same score.
    expect(markOhmsLaw(OHMS_GOOD)).toEqual(markOhmsLaw(structuredClone(OHMS_GOOD)));
  });
});

describe("PHYS-1DP and table units", () => {
  const withXy = (text: string, unit: string | null = null): OhmsLawRecord => ({
    ...OHMS_GOOD,
    length_xy: { value: null, unit_as_written: unit, text_as_written: text },
  });

  it("fails XY written as a whole number and corrects it from her value", () => {
    // WAEC Phys P3 2018 Q3A: lengths in cm to at least 1 d.p. ("68" fails, "68.0" passes).
    const i = item(withXy("68", "cm"), "PHYS-1DP:xy");
    expect(i?.outcome).toBe("lost");
    expect(i?.correction).toBe("68.0");
    expect(item(withXy("68.0 cm"), "PHYS-1DP:xy")?.outcome).toBe("earned");
    expect(item(withXy("XY = 68.0 cm"), "PHYS-1DP:xy-unit")?.outcome).toBe("earned");
  });

  it("loses the XY unit when no cm is written", () => {
    // DRAFT PHYS-1DP (docs/07 §5.2): XY recorded in cm.
    const i = item(withXy("68.0"), "PHYS-1DP:xy-unit");
    expect(i?.outcome).toBe("lost");
    expect(i?.correction).toBe("68.0 cm");
  });

  it("needs Ω on R and A and V on the I and V headings", () => {
    // WAEC Phys P3 2018 Q3A: units in the column headings (docs/07 §5.2 PHYS-TABLE).
    const h = (R: string | null, I: string | null, V: string | null): OhmsLawRecord => ({
      ...OHMS_GOOD,
      headers: { R, I, V },
    });
    expect(item(h("R", "I/A", "V/V"), "PHYS-TABLE:units-R")?.outcome).toBe("lost");
    expect(item(h("R (ohms)", "I (A)", "V (V)"), "PHYS-TABLE:units-R")?.outcome).toBe("earned");
    expect(item(h("R/Ω", "I", "V/V"), "PHYS-2DP:units")?.correction).toBe("I (A)");
    expect(item(h("R/Ω", "I/A", "V"), "PHYS-2DP:units")?.correction).toBe("V (V)");
    expect(item(h("R/Ω", "I/mA", "V (volts)"), "PHYS-2DP:units")?.outcome).toBe("earned");
  });

  it("loses the table, the 2 d.p. items and the graph when there are no rows", () => {
    // DRAFT: every "at least five rows" item needs rows; the sheet still parses.
    const sheet = mark({ ...OHMS_GOOD, rows: [] });
    expect(sheet.items.find((i) => i.id === "PHYS-TABLE:composite")?.outcome).toBe("lost");
    expect(sheet.items.find((i) => i.id === "GRAPH-POINTS")?.marks_earned).toBe(0);
  });
});

describe("PHYS-TREND, on her own rows", () => {
  it("loses I's trend when a current rises with R, citing her entry", () => {
    // DRAFT PHYS-TREND (docs/07 §5.2): I and V both fall as R rises. No textbook value;
    // behaviour only. Her R = 20 Ω current written larger than at R = 10 Ω.
    const rows = OHMS_GOOD.rows.map((r) =>
      r.R.text_as_written === "20" ? { ...r, I: { ...r.I, text_as_written: "0.25" } } : r,
    );
    const sheet = mark({ ...OHMS_GOOD, rows });
    const i = sheet.items.find((x) => x.id === "PHYS-TREND:I");
    expect(i?.outcome).toBe("lost");
    expect(i?.evidence[0]?.text_as_written).toBe("0.25");
    expect(sheet.items.find((x) => x.id === "PHYS-TREND:V")?.outcome).toBe("earned");
  });

  it("reads the trend in R order even when her rows are not in order", () => {
    // Behaviour only (no source): the trend is about R, not the order she wrote the rows.
    expect(
      item({ ...OHMS_GOOD, rows: [...OHMS_GOOD.rows].reverse() }, "PHYS-TREND:V")?.outcome,
    ).toBe("earned");
  });
});

describe("graph items against her own scales", () => {
  const g = OHMS_GOOD.graph;
  if (!g) throw new Error("the good table has a graph");

  it("loses every graph mark when there is no graph", () => {
    // docs/15 §4 pattern: graph, slope and points marks all need a graph. DRAFT graph marks:
    // axes 1½ + scale 1 + points 1½ + line 1 + slope 2½ = 7½.
    const sheet = mark({ ...OHMS_GOOD, graph: null });
    const graph = sheet.items.filter((i) => i.rule.startsWith("GRAPH"));
    expect(graph.reduce((t, i) => t + i.marks_earned, 0)).toBe(0);
    expect(graph.reduce((t, i) => t + i.marks_available, 0)).toBe(7.5);
  });

  it("loses GRAPH-SCALE when the points cover less than a third of the sheet", () => {
    // WAEC Phys P3 Nov/Dec 2013: the graph occupies at least 1/3 of the page (docs/07 §5.2).
    // Her points span 13.4 cm across on an 18 cm sheet; on a 45 cm sheet that is under ⅓.
    const big = { ...OHMS_GOOD, graph: { ...g, sheet: { width_cm: 45, height_cm: 25 } } };
    expect(item(big, "GRAPH-SCALE:x")?.outcome).toBe("lost");
    expect(item(big, "GRAPH-SCALE:y")?.outcome).toBe("earned");
    const noScale = { ...OHMS_GOOD, graph: { ...g, y: { ...g.y, units_per_cm: null } } };
    expect(item(noScale, "GRAPH-SCALE:y")?.outcome).toBe("lost");
    expect(item(noScale, "GRAPH-POINTS")?.marks_earned).toBe(0);
  });

  it("counts a point within half a small square (0.1 cm) and not one 0.15 cm off", () => {
    // DRAFT GRAPH-POINTS tolerance: half a small square of 2 mm paper.
    const shift = (dy: number) => ({
      ...OHMS_GOOD,
      graph: { ...g, points: g.points.map((p, i) => (i < 3 ? { ...p, y_cm: p.y_cm + dy } : p)) },
    });
    expect(item(shift(0.09), "GRAPH-POINTS")?.marks_earned).toBe(1.5);
    // Three of seven moved 0.15 cm: four still match → 1.
    expect(item(shift(0.15), "GRAPH-POINTS")?.marks_earned).toBe(1);
  });

  it("checks points against her table, not against a true value", () => {
    // docs/07 §5.2 GRAPH-POINTS: "checked against her own table". If her table says 0.40 A
    // at R = 5 Ω and she plots 0.40 A, the point is correct.
    const rows = OHMS_GOOD.rows.map((r) =>
      r.R.text_as_written === "5" ? { ...r, I: { ...r.I, text_as_written: "0.40" } } : r,
    );
    const points = g.points.map((p, i) => (i === 2 ? { ...p, x_cm: 8 } : p));
    expect(item({ ...OHMS_GOOD, rows, graph: { ...g, points } }, "GRAPH-POINTS")?.outcome).toBe(
      "earned",
    );
  });

  it("loses GRAPH-LINE when no line is drawn or the line is far off her points", () => {
    // WAEC Phys P3 2011, 2018, 2023: line of best fit. DRAFT: within 3° of the fit to her
    // points and 0.4 cm of their centroid.
    expect(item({ ...OHMS_GOOD, graph: { ...g, line: null } }, "GRAPH-LINE")?.outcome).toBe("lost");
    const steep = { ...g, line: { p1: { x_cm: 0, y_cm: 0 }, p2: { x_cm: 12, y_cm: 22.5 } } };
    expect(item({ ...OHMS_GOOD, graph: steep }, "GRAPH-LINE")?.outcome).toBe("lost");
    const shifted = { ...g, line: { p1: { x_cm: 0, y_cm: 1 }, p2: { x_cm: 15, y_cm: 23.5 } } };
    expect(item({ ...OHMS_GOOD, graph: shifted }, "GRAPH-LINE")?.outcome).toBe("lost");
  });

  it("loses GRAPH-SLOPE:read when her ΔV disagrees with her triangle on her scale", () => {
    // DRAFT: ΔV and ΔI read from her triangle within one small square (0.2 cm). Her triangle
    // is 18 cm up at 0.1 V/cm = 1.80 V; she wrote 1.50 V, and so s = 2.5 follows from it.
    const sheet = mark({
      ...OHMS_GOOD,
      graph: { ...g, delta_y_as_written: "ΔV = 1.50 V", slope_as_written: "s = 1.50/0.60 = 2.5 Ω" },
    });
    expect(sheet.items.find((i) => i.id === "GRAPH-SLOPE:read")?.outcome).toBe("lost");
    // Her s follows from her own ΔV and ΔI, so the value is still earned.
    expect(sheet.items.find((i) => i.id === "GRAPH-SLOPE:value")?.outcome).toBe("earned");
  });

  it("loses GRAPH-SLOPE:value when s does not follow from her own ΔV ÷ ΔI", () => {
    // DRAFT: s consistent with her own ΔV/ΔI within 2%. 1.80/0.60 = 3.0, not 3.5.
    const r = { ...OHMS_GOOD, graph: { ...g, slope_as_written: "s = 3.5 Ω" } };
    expect(item(r, "GRAPH-SLOPE:value")?.outcome).toBe("lost");
    expect(item(r, "GRAPH-SLOPE:unit")?.outcome).toBe("earned");
  });

  it("reads Ω, ohms and V/A as the slope's unit, but not Ω⁻¹ or A/V", () => {
    // V/I is a resistance: 1 Ω = 1 V A⁻¹ (SI). Behaviour of the unit check.
    expect(slopeHasOhmUnit("s = 3.0 Ω")).toBe(true);
    expect(slopeHasOhmUnit("s = 3.0 ohms")).toBe(true);
    expect(slopeHasOhmUnit("s = 3.0 V/A")).toBe(true);
    expect(slopeHasOhmUnit("s = 3.0 VA⁻¹")).toBe(true);
    expect(slopeHasOhmUnit("s = ΔV/ΔI = 3.0")).toBe(false);
    expect(slopeHasOhmUnit("s = 0.33 A/V")).toBe(false);
    expect(slopeHasOhmUnit("s = 0.33 Ω⁻¹")).toBe(false);
  });
});

describe("teacher mode", () => {
  it("marks PHYS-ACCURACY only in teacher mode: 21 / 21 with 3.0 Ω", () => {
    // WAEC Phys P3 2023 Q3B: accuracy within ±10% of the teacher's value (docs/07 §5.2).
    const sheet = mark(OHMS_GOOD, { teacherMode: true, teacherXyOhm: 3.0 });
    expect(sheet.teacher_mode).toBe(true);
    expect([sheet.earned, sheet.available]).toEqual([21, 21]);
    // A value alone turns teacher mode on, as the metre bridge's teacherXOhm does.
    expect(mark(OHMS_GOOD, { teacherXyOhm: 3.0 }).available).toBe(21);
  });

  it("loses PHYS-ACCURACY when s is 20% from the teacher's 2.5 Ω", () => {
    // ±10% band (WAEC Phys P3 2023 Q3B): 3.0 vs 2.5 is 20% off.
    const sheet = mark(OHMS_GOOD, { teacherXyOhm: 2.5 });
    expect(sheet.items.find((i) => i.rule === "PHYS-ACCURACY")?.outcome).toBe("lost");
    expect(sheet.earned).toBe(20);
  });

  it("never marks accuracy outside teacher mode, even with a value", () => {
    // docs/07 §5.2 PHYS-ACCURACY: teacher mode only; MarkSheet refuses it otherwise.
    const sheet = mark(OHMS_GOOD, { teacherMode: false, teacherXyOhm: 3.0 });
    expect(sheet.teacher_mode).toBe(false);
    expect(sheet.items.some((i) => i.rule === "PHYS-ACCURACY")).toBe(false);
  });
});

describe("V–I precautions (DRAFT list)", () => {
  const vi = (p: string) => judgePrecaution(p, "ohms_law_vi");
  const marks = (precautions: string[]) =>
    mark({ ...OHMS_GOOD, precautions })
      .items.filter((i) => i.rule === "PRECAUTIONS")
      .map((i) => i.marks_earned);

  it.each([
    ["The key was opened between readings.", "key_opened"],
    ["The plugs of the resistance box were pushed in firmly.", "plugs_firm"],
    ["The wire XY was kept straight.", "wire_straight"],
    ["The zero errors of the meters were corrected.", "zero_error"],
    ["Readings were repeated.", "repeated_readings"],
    ["The connections were tight and the terminals clean.", "tight_clean_connections"],
    ["Parallax was avoided when reading the meters.", "parallax_avoided"],
  ])("accepts %s", (p, id) => {
    // docs/07 §5.2 V–I precautions row (DRAFT) and the Oct 28 lesson review (P1–P8).
    expect(vi(p)).toMatchObject({ accepted: true, matched: id });
  });

  it("does not score 'the meters were connected correctly' (procedure)", () => {
    // Oct 28 lesson review: meter connections are procedure, not a WAEC precaution.
    expect(vi("The meters were connected correctly.")).toMatchObject({
      accepted: false,
      reason: "not_a_listed_precaution",
    });
    expect(
      marks(["The meters were connected correctly.", "The key was opened between readings."]),
    ).toEqual([1, 0]);
  });

  it("counts tight connections and firm plugs once (one idea: good contact)", () => {
    // Oct 28 lesson review: P2 and P7 must not count as two. DRAFT decision.
    expect(
      marks([
        "The connections were tight and the terminals clean.",
        "The plugs of the resistance box were pushed in firmly.",
      ]),
    ).toEqual([1, 0]);
    expect(marks(["The plugs were pushed in firmly.", "The wire XY was kept straight."])).toEqual([
      1, 1,
    ]);
  });

  it("keeps the plug key as the key precaution, and refuses instructions", () => {
    // WAEC Phys P3 2023 Q3B: precautions in the reported tense.
    expect(vi("The plug key was removed between readings.").matched).toBe("key_opened");
    expect(vi("Keep the wire straight.").reason).toBe("instruction");
    expect(vi("The plugs should be pushed in firmly.").reason).toBe("not_past_tense");
  });

  it("keeps the metre bridge list unchanged by default", () => {
    // docs/15 §4: the metre bridge list has no plug or wire-straight topic; G1 15½/21 and
    // G2 21/21 (docs/11) are unchanged.
    expect(judgePrecaution("The wire XY was kept straight.").accepted).toBe(false);
    expect(judgePrecaution("The plugs were pushed in firmly.").accepted).toBe(false);
    expect(markMeterBridge(G1_READINGS, { teacherXOhm: null }).earned).toBe(15.5);
    expect(markMeterBridge(G2_READINGS, { teacherXOhm: null }).earned).toBe(21);
  });
});

describe("PHYS-LAW and PHYS-CALC wording", () => {
  const law = (text: string | null) => ({ ...OHMS_GOOD, law_as_written: text });
  const calc = (text: string | null) => ({ ...OHMS_GOOD, length_calc_as_written: text });

  it("separates the name from the statement", () => {
    // DRAFT split: name ½; statement 1; condition 1 (textbook statement, docs/07 §4.4).
    const noName = law(
      "The current through a metallic conductor is directly proportional to the p.d. across it, provided the temperature remains constant.",
    );
    expect(item(noName, "PHYS-LAW:name")?.outcome).toBe("lost");
    expect(item(noName, "PHYS-LAW:statement")?.marks_earned).toBe(2);
    expect(item(law("Ohm's law"), "PHYS-LAW:statement")?.marks_earned).toBe(0);
    expect(item(law("Ohm's law: V = IR."), "PHYS-LAW:statement")?.marks_earned).toBe(0);
    expect(
      item(law("Ohm's law: current is inversely proportional to voltage."), "PHYS-LAW:statement")
        ?.marks_earned,
    ).toBe(0);
    expect(item(law(null), "PHYS-LAW:name")?.outcome).toBe("lost");
  });

  it("accepts 25 cm and R = ρL/A, and loses the answer for a wrong number", () => {
    // docs/07 §4.4 (b)(ii): L = 0.25 m = 25 cm; R = ρL/A is the same relation as L = RA/ρ.
    const cm = calc("R = ρL/A, A = πr² = 3.14 × 10⁻⁸ m²\nL = 7 × 3.14 × 10⁻⁸ / 8.8 × 10⁻⁷ = 25 cm");
    expect(
      mark(cm)
        .items.filter((i) => i.rule === "PHYS-CALC")
        .every((i) => i.outcome === "earned"),
    ).toBe(true);
    const wrong = calc("L = RA/ρ = 7 × 0.2 / 8.8 × 10⁻⁷ = 1.6 × 10⁶ m");
    expect(item(wrong, "PHYS-CALC:formula")?.outcome).toBe("earned");
    expect(item(wrong, "PHYS-CALC:area")?.outcome).toBe("lost");
    expect(item(wrong, "PHYS-CALC:answer")?.marks_earned).toBe(0);
    expect(item(wrong, "PHYS-CALC:answer")?.correction).toBeNull();
    expect(item(calc(null), "PHYS-CALC:answer")?.marks_earned).toBe(0);
  });
});

describe("examiner questions for V–I", () => {
  const ids = (r: OhmsLawRecord, max?: number) =>
    examinerQuestions(markOhmsLaw(r), max).map((p) => p.question.id);

  it("asks about her wrong-tense precaution first, with her own words", () => {
    // docs/07 §6: ask about her specific mistake first.
    const picked = examinerQuestions(markOhmsLaw(OHMS_WRONG_TENSE));
    expect(picked[0]?.question.id).toBe("vi-precaution-tense");
    expect(picked[0]?.her_mistake).toBe("Avoid parallax error when reading the meters.");
  });

  it("asks about the slope, the axes and the law when those are lost", () => {
    // docs/07 §6: questions come from her lost items.
    expect(ids(OHMS_SMALL_TRIANGLE)[0]).toBe("vi-slope-triangle");
    expect(ids(OHMS_AXES_SWAPPED).slice(0, 2)).toEqual(["vi-graph-axes", "vi-slope-triangle"]);
    expect(ids(OHMS_LAW_NO_CONDITION)[0]).toBe("vi-ohms-law");
    expect(ids(OHMS_SLIP_3X1DP)[0]).toBe("vi-meter-2dp");
  });

  it("gives the good table three general V–I questions, never metre bridge ones", () => {
    // DRAFT: nothing lost, so the general V–I bank fills up in order.
    expect(ids(OHMS_GOOD)).toEqual(["vi-key-open", "vi-meter-connections", "vi-constantan"]);
  });

  it("finds every V–I question by id, with a model answer and a source", () => {
    for (const q of Object.values(OHMS_LAW_QUESTIONS)) {
      expect(q.model_answer.length).toBeGreaterThan(40);
      expect(q.source.length).toBeGreaterThan(0);
      expect(examinerQuestionById(q.id)).toBe(q);
    }
  });

  it("never puts a reading, R_XY or slope value in a model answer", () => {
    // Plan: the engine decides; nothing shows I, V, R_XY or the slope. No decimal numbers.
    for (const q of Object.values(OHMS_LAW_QUESTIONS)) {
      expect(q.model_answer).not.toMatch(/\d\.\d/);
    }
  });
});
