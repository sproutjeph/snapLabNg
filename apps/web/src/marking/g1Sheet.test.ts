import { MarkSheet } from "@snaplab/contracts";
import { describe, expect, it } from "vitest";
import { g1Sheet } from "./g1Sheet";

describe("g1Sheet", () => {
  it("passes MarkSheet.parse with 15.5 earned out of 21 available in student mode", () => {
    // Source: docs/15_METRE_BRIDGE_HERO.md §4–§5 — G1 scores 15½ / 21 in student mode.
    const parsed = MarkSheet.parse(g1Sheet);
    expect(parsed.experiment).toBe("meter_bridge");
    expect(parsed.question_label).toBe("Question 3");
    expect(parsed.earned).toBe(15.5);
    expect(parsed.available).toBe(21);
    expect(parsed.teacher_mode).toBe(false);
  });

  it("matches the exact G1 lost items and marks lost from the answer key", () => {
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
        rule: item.rule,
        lost: item.marks_available - item.marks_earned,
      }));

    expect(lost).toEqual([
      { rule: "PHYS-TABLE", lost: 0.5 },
      { rule: "PHYS-3SF", lost: 0.5 },
      { rule: "PHYS-1DP", lost: 0.5 },
      { rule: "GRAPH-SCALE", lost: 0.5 },
      { rule: "GRAPH-AXES", lost: 0.5 },
      { rule: "GRAPH-SLOPE", lost: 1.0 },
      { rule: "PRECAUTIONS", lost: 1.0 },
      { rule: "PRECAUTIONS", lost: 1.0 },
    ]);

    for (const item of g1Sheet.items) {
      expect(item.evidence.length).toBeGreaterThanOrEqual(1);
      expect(item.evidence[0]?.box).not.toBeNull();
    }

    expect(g1Sheet.setup_issues).toEqual([
      {
        description: "No key drawn in the circuit",
        box: { x0: 0.54, y0: 0.092, x1: 0.68, y1: 0.125 },
      },
    ]);
  });
});
