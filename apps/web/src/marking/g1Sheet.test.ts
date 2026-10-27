import { MarkSheet, ReadingsSchema } from "@snaplab/contracts";
import { describe, expect, it } from "vitest";
import { findPageTextLocation } from "./g1Page";
import { g1Readings, g1Sheet } from "./g1Readings";

describe("g1Readings and g1Sheet (from markMeterBridge)", () => {
  it("passes ReadingsSchema.parse and MarkSheet.parse with 15.5 earned out of 21 available in student mode", () => {
    // Source: docs/15_METRE_BRIDGE_HERO.md §4–§5 — G1 scores 15½ / 21 in student mode.
    const parsedReadings = ReadingsSchema.parse(g1Readings);
    expect(parsedReadings.table_found).toBe(true);
    expect(parsedReadings.cells).toHaveLength(24);

    const parsedSheet = MarkSheet.parse(g1Sheet);
    expect(parsedSheet.experiment).toBe("meter_bridge");
    expect(parsedSheet.question_label).toBe("Question 3");
    expect(parsedSheet.earned).toBe(15.5);
    expect(parsedSheet.available).toBe(21);
    expect(parsedSheet.teacher_mode).toBe(false);
  });

  it("matches the exact G1 lost items and marks lost from markMeterBridge and the answer key", () => {
    // Source: docs/15_METRE_BRIDGE_HERO.md §5 and docs/11_GOLDEN_PAGES_GUIDE.md §2:
    // - PHYS-1DP ("57"): ½ mark lost
    // - PHYS-3SF ("0.02"): ½ mark lost
    // - PHYS-TABLE (l⁻¹ header unit): ½ mark lost
    // - GRAPH-AXES (vertical axis unit): ½ mark lost
    // - GRAPH-SCALE (graph ~¼ of page): ½ mark lost
    // - GRAPH-SLOPE (small triangle): 1 mark lost
    // - PRECAUTIONS #1 ("Avoid parallax error..."): 1 mark lost
    // - PRECAUTIONS #2 ("I slid the jockey..."): 1 mark lost
    // Total lost = 5.5 marks; 1 setup issue: "No key drawn in the circuit".
    const lost = g1Sheet.items
      .filter((item) => item.outcome === "lost")
      .map((item) => ({
        id: item.id,
        rule: item.rule,
        lost: item.marks_available - item.marks_earned,
      }));

    expect(lost).toEqual([
      { id: "PHYS-1DP:l:4", rule: "PHYS-1DP", lost: 0.5 },
      { id: "PHYS-3SF:l_inv:3", rule: "PHYS-3SF", lost: 0.5 },
      { id: "PHYS-TABLE:units-derived", rule: "PHYS-TABLE", lost: 0.5 },
      { id: "GRAPH-AXES:units", rule: "GRAPH-AXES", lost: 0.5 },
      { id: "GRAPH-SCALE:size", rule: "GRAPH-SCALE", lost: 0.5 },
      { id: "GRAPH-SLOPE:large", rule: "GRAPH-SLOPE", lost: 1.0 },
      { id: "PRECAUTIONS:1", rule: "PRECAUTIONS", lost: 1.0 },
      { id: "PRECAUTIONS:2", rule: "PRECAUTIONS", lost: 1.0 },
    ]);

    expect(g1Sheet.setup_issues).toEqual([
      {
        description: "No key drawn in the circuit",
        box: { x0: 0.54, y0: 0.094, x1: 0.68, y1: 0.122 },
      },
    ]);
  });

  it("resolves precaution lines via findPageTextLocation and identifies boxless margin items", () => {
    const precautions = g1Sheet.items.filter((item) => item.rule === "PRECAUTIONS");
    expect(precautions).toHaveLength(2);
    for (const item of precautions) {
      expect(item.evidence[0]?.box).toBeNull();
      const matchedBox = findPageTextLocation(item.evidence[0]?.text_as_written ?? null);
      expect(matchedBox).not.toBeNull();
    }

    const columnsItem = g1Sheet.items.find((item) => item.id === "PHYS-TABLE:columns");
    expect(columnsItem?.evidence).toEqual([]);
  });
});
