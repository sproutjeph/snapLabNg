import { MarkSheet, type Readings } from "@snaplab/contracts";
import { describe, expect, it } from "vitest";
import { G1_READINGS } from "./golden";
import { markMeterBridgePage } from "./index";
import { isL1L2Page, markMeterBridgeL1L2 } from "./meterBridgeL1L2";
import { NOTE1_PAGE1_READINGS } from "./realNote1";

const lost = (s: MarkSheet) =>
  s.items
    .filter((i) => i.outcome === "lost")
    .map((i) => [i.id, i.marks_available - i.marks_earned, i.correction]);

/** Page 2 of the same notebook (graph and precautions), as on the photo in dataset/. */
const PAGE2: Readings = {
  table_found: false,
  cells: [],
  average_as_written: null,
  graph: {
    x_label_as_written: "l₁ (cm)",
    y_label_as_written: "l₂ (cm)",
    points: [
      { x: 33.3, y: 66.7 },
      { x: 50.0, y: 50.0 },
      { x: 60.0, y: 40.0 },
      { x: 66.7, y: 33.3 },
      { x: 71.4, y: 28.6 },
    ],
    line_drawn: true,
    // Her dashed triangle: Δl₁ = 74.0 − 28.0 = 46.0 cm, Δl₂ = 26.0 − 72.0 = −46.0 cm.
    triangle: { p1: { x: 28, y: 72 }, p2: { x: 28, y: 26 }, p3: { x: 74, y: 26 } },
    slope_as_written: "S = −46.0 / 46.0 = −1·00",
    intercept_as_written: null,
    result_as_written: null,
    box: { x0: 0.08, y0: 0.08, x1: 0.92, y1: 0.6 },
  },
  precautions: [
    "1. I ensured tight connections to avoid loose contacts.",
    "2. I tapped the jockey gently to avoid wear on the wire.",
    "3. I opened the key after reading to prevent cell polarization.",
  ],
  other_marks: [],
};

describe("l₁/l₂ metre bridge marking", () => {
  it("recognises the l₁/l₂ form and leaves the golden reciprocal form alone", () => {
    expect(isL1L2Page(NOTE1_PAGE1_READINGS)).toBe(true);
    expect(isL1L2Page(G1_READINGS)).toBe(false);
    // docs/15 §5: the golden page still marks 15½ / 21 through the dispatcher.
    expect(markMeterBridgePage(G1_READINGS, { teacherXOhm: null }).earned).toBe(15.5);
  });

  it("marks the real page 1 table: 12 / 12½, losing only the missing unit on X", () => {
    // Oct 27 live read. Every row is consistent: l₂ = 100 − l₁, X = R·l₂/l₁ to 3 s.f.
    // (2·00 × 66·70 / 33·30 = 4·01), mean of her X values 4·002 → "4·00 ohms". "66·7" is
    // to 1 d.p., which WAEC accepts ("at least 1 d.p.", Phys P3 2018 Q3A).
    const sheet = markMeterBridgeL1L2(NOTE1_PAGE1_READINGS);
    expect(MarkSheet.parse(sheet)).toBeTruthy();
    expect([sheet.earned, sheet.available]).toEqual([12, 12.5]);
    expect(lost(sheet)).toEqual([["PHYS-TABLE:units-X", 0.5, "X (Ω)"]]);
    // Graph and precautions are on page 2: reported, not penalised.
    expect(sheet.setup_issues.map((i) => i.description)).toEqual([
      "No graph on this page: snap the graph page to mark it.",
      "No precautions on this page: snap the page that has them to mark them.",
    ]);
  });

  it("marks page 2 (graph and precautions) in full, through the page dispatcher: 9 / 9", () => {
    // All points satisfy l₁ + l₂ = 100; a large triangle (Δl₁ = 46 of a 38 cm point span);
    // three past-tense precautions, two counted (WAEC: "any two"). The slope's value earns
    // nothing: this graph always has slope −1, and the sheet says so.
    const sheet = markMeterBridgePage(PAGE2, { teacherXOhm: null });
    expect(sheet.question_label).toContain("l₁/l₂");
    expect(MarkSheet.parse(sheet)).toBeTruthy();
    expect([sheet.earned, sheet.available]).toEqual([9, 9]);
    expect(sheet.setup_issues.map((i) => i.description).join(" ")).toContain("slope −1");
  });

  it("catches a 1 d.p. failure and a 3 s.f. failure in this form", () => {
    // WAEC Phys P3 2018 Q3A: lengths to at least 1 d.p.; derived values to 3 s.f.
    const flawed: Readings = {
      ...NOTE1_PAGE1_READINGS,
      cells: NOTE1_PAGE1_READINGS.cells.map((c) =>
        c.row === "4" && /l1/.test(c.column_header_as_written ?? "")
          ? { ...c, text_as_written: "67", value: 67 }
          : c.row === "2" && /^X/.test(c.column_header_as_written ?? "")
            ? { ...c, text_as_written: "4·0", value: 4 }
            : c,
      ),
    };
    const ids = lost(markMeterBridgeL1L2(flawed)).map((l) => l[0]);
    expect(ids).toContain("PHYS-1DP:l1:4");
    expect(ids).toContain("PHYS-3SF:X:2");
  });

  it("only accepts l₂ that is exactly 100 − l₁", () => {
    // l₂ = 100 − l₁ is arithmetic, not a measurement: 66·70 is right for 33·30, 66·80 is not.
    const withL2 = (t: string) =>
      markMeterBridgeL1L2({
        ...NOTE1_PAGE1_READINGS,
        cells: NOTE1_PAGE1_READINGS.cells.map((c) =>
          c.row === "1" && /l2/.test(c.column_header_as_written ?? "")
            ? { ...c, text_as_written: t }
            : c,
        ),
      }).items.find((i) => i.id === "PHYS-1DP:l2:1")?.outcome;
    expect(withL2("66·70")).toBe("earned");
    expect(withL2("66·80")).toBe("lost");
  });

  it("catches a wrong l₂, a wrong X and a wrong mean", () => {
    // l₂ must be 100 − l₁; X = R·l₂/l₁ from her own row; mean of her own X values.
    const broken: Readings = {
      ...NOTE1_PAGE1_READINGS,
      cells: NOTE1_PAGE1_READINGS.cells.map((c) =>
        c.row === "1" && /l2/.test(c.column_header_as_written ?? "")
          ? { ...c, text_as_written: "67·70", value: 67.7 }
          : c.row === "2" && /^X/.test(c.column_header_as_written ?? "")
            ? { ...c, text_as_written: "4·40", value: 4.4 }
            : c,
      ),
      average_as_written: { text_as_written: "Mean X = 4·50 ohms", value: 4.5, rows_averaged: [] },
    };
    const ids = lost(markMeterBridgeL1L2(broken)).map((l) => l[0]);
    expect(ids).toContain("PHYS-1DP:l2:1");
    expect(ids).toContain("PHYS-EVAL:X:2");
    expect(ids).toContain("PHYS-EVAL:mean");
  });

  it("marks accuracy only in teacher mode, within ±10%", () => {
    // WAEC Phys P3 2023 Q3B: accuracy within ±10% of the expected value.
    expect(
      markMeterBridgeL1L2(NOTE1_PAGE1_READINGS).items.some((i) => i.rule === "PHYS-ACCURACY"),
    ).toBe(false);
    const ok = markMeterBridgeL1L2(NOTE1_PAGE1_READINGS, { teacherXOhm: 4.2 });
    expect(ok.items.find((i) => i.rule === "PHYS-ACCURACY")?.outcome).toBe("earned");
    const off = markMeterBridgeL1L2(NOTE1_PAGE1_READINGS, { teacherXOhm: 5 });
    expect(off.items.find((i) => i.rule === "PHYS-ACCURACY")?.outcome).toBe("lost");
  });
});
