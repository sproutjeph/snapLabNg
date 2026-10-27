import { describe, expect, it } from "vitest";
import { type MarkItem, MarkSheet } from "./marks";

const box = { x0: 0.4, y0: 0.5, x1: 0.46, y1: 0.53 };

const item = (over: Partial<MarkItem> = {}): MarkItem => ({
  id: "PHYS-1DP:l:4",
  rule: "PHYS-1DP",
  outcome: "lost",
  marks_earned: 0,
  marks_available: 0.5,
  evidence: [{ box, text_as_written: "57" }],
  annotation: "circle",
  correction: "57.0",
  fix_en: "Record lengths to at least 1 d.p.: 57.0 cm.",
  fix_pcm: null,
  source: null,
  ...over,
});

const sheet = (items: MarkItem[], over: Partial<MarkSheet> = {}) => ({
  experiment: "meter_bridge",
  question_label: "Question 3",
  earned: items.reduce((t, i) => t + i.marks_earned, 0),
  available: items.reduce((t, i) => t + i.marks_available, 0),
  items,
  setup_issues: [{ description: "No key drawn in the circuit", box: null }],
  teacher_mode: false,
  ...over,
});

describe("MarkSheet", () => {
  it("accepts G1's '57' losing half a mark under PHYS-1DP", () => {
    // docs/15 §5: "57" is not to 1 d.p. → PHYS-1DP, ½ mark lost.
    expect(MarkSheet.safeParse(sheet([item()])).success).toBe(true);
  });

  it("rejects totals that do not add up to the items", () => {
    expect(MarkSheet.safeParse(sheet([item()], { available: 21 })).success).toBe(false);
  });

  it("rejects marks that are not whole or half marks", () => {
    // WAEC schemes award in halves (docs/07 §5.2: "½ per value").
    expect(
      MarkSheet.safeParse(sheet([item({ marks_available: 0.25, marks_earned: 0 })])).success,
    ).toBe(false);
  });

  it("rejects an item marked 'earned' that did not earn all its marks", () => {
    expect(MarkSheet.safeParse(sheet([item({ outcome: "earned" })])).success).toBe(false);
  });

  it("rejects PHYS-ACCURACY outside teacher mode", () => {
    // docs/15 §5: accuracy is only marked when a teacher enters a value.
    const acc = item({
      id: "PHYS-ACCURACY",
      rule: "PHYS-ACCURACY",
      outcome: "earned",
      marks_earned: 1,
      marks_available: 1,
      correction: null,
    });
    expect(MarkSheet.safeParse(sheet([acc])).success).toBe(false);
    expect(MarkSheet.safeParse(sheet([acc], { teacher_mode: true })).success).toBe(true);
  });
});
