import { describe, expect, it } from "vitest";
import { examinerQuestionById, examinerQuestions, METER_BRIDGE_QUESTIONS } from "./examiner";
import { G1_READINGS, G2_READINGS } from "./golden";
import { markMeterBridgePage } from "./index";
import { NOTE1_PAGE1_READINGS } from "./realNote1";

const ids = (r: typeof G1_READINGS, max?: number) =>
  examinerQuestions(markMeterBridgePage(r, { teacherXOhm: null }), max).map((p) => p.question.id);

describe("examiner questions", () => {
  it("asks G1 about her own mistakes first: the slid jockey, then the precaution tense", () => {
    // docs/11 G1: precautions "I slid the jockey gently…" (penalised, WAEC 2018 Q3A) and
    // "Avoid parallax error…" (an instruction, not a precaution taken).
    const picked = examinerQuestions(markMeterBridgePage(G1_READINGS, { teacherXOhm: null }));
    expect(picked.map((p) => p.question.id).slice(0, 2)).toEqual([
      "mb-jockey-slide",
      "mb-precaution-tense",
    ]);
    expect(picked[0]?.her_mistake).toBe(
      "2. I slid the jockey gently along the wire to find the balance point.",
    );
    expect(picked[1]?.her_mistake).toBe("1. Avoid parallax error when reading the metre rule.");
  });

  it("gives G2, which lost nothing, three general bank questions", () => {
    // docs/15 §5: G2 earns 21/21, so there is no mistake to ask about.
    expect(ids(G2_READINGS)).toEqual(["mb-weak-cell", "mb-centre-zero", "mb-key-open"]);
  });

  it("asks the real note 1 page about the unit missing from its X column first", () => {
    // Oct 27 live read: page 1 loses only PHYS-TABLE:units-X (meterBridgeL1L2.test.ts).
    expect(ids(NOTE1_PAGE1_READINGS)[0]).toBe("mb-table-units");
  });

  it("returns at most max questions, with no repeats", () => {
    for (const max of [0, 1, 3, 20]) {
      const got = ids(G1_READINGS, max);
      expect(got.length).toBeLessThanOrEqual(max);
      expect(new Set(got).size).toBe(got.length);
    }
  });

  it("has a model answer and a source for every bank question, and finds each by id", () => {
    for (const q of Object.values(METER_BRIDGE_QUESTIONS)) {
      expect(q.model_answer.length).toBeGreaterThan(40);
      expect(q.source.length).toBeGreaterThan(0);
      expect(examinerQuestionById(q.id)).toBe(q);
    }
    expect(examinerQuestionById("nope")).toBeNull();
  });

  it("asks G1 about its 1 d.p. length third, showing her own entry", () => {
    // docs/11 G1: one balance length written as "57" (fails PHYS-1DP, WAEC 2018 Q3A).
    const picked = examinerQuestions(markMeterBridgePage(G1_READINGS, { teacherXOhm: null }));
    expect(picked[2]?.question.id).toBe("mb-length-1dp");
    expect(picked[2]?.her_mistake).toBe("57");
  });

  it("treats 'Slide the jockey…' as the jockey mistake, not only as a tense slip", () => {
    // WAEC 2018 Q3A penalises sliding the jockey, however it is worded.
    const r = { ...G2_READINGS, precautions: ["Slide the jockey gently along the wire."] };
    expect(ids(r)[0]).toBe("mb-jockey-slide");
    expect(ids(r)).not.toContain("mb-precaution-tense");
  });

  it("shows the heading that lacks a unit as her mistake", () => {
    // PHYS-TABLE:units-measured lists both measured headings; only "l" lacks its unit.
    const r = {
      ...G2_READINGS,
      cells: G2_READINGS.cells.map((c) =>
        c.column !== "l"
          ? c
          : c.row === "header"
            ? { ...c, column_header_as_written: "l", text_as_written: "l" }
            : { ...c, column_header_as_written: "l" },
      ),
    };
    const units = examinerQuestions(markMeterBridgePage(r, { teacherXOhm: null })).find(
      (p) => p.question.id === "mb-table-units",
    );
    expect(units?.her_mistake).toBe("l");
  });

  it("asks about a lost slope triangle on the reciprocal form", () => {
    // docs/07 §5.1 GRAPH-SLOPE: a large triangle earns the first slope mark.
    const g = G2_READINGS.graph;
    if (!g) throw new Error("G2 has a graph");
    const small = {
      ...G2_READINGS,
      graph: {
        ...g,
        triangle: { p1: { x: 0.2, y: 0.03 }, p2: { x: 0.2, y: 0.031 }, p3: { x: 0.21, y: 0.031 } },
      },
    };
    const sheet = markMeterBridgePage(small, { teacherXOhm: null });
    expect(sheet.items.some((i) => i.rule === "GRAPH-SLOPE" && i.outcome === "lost")).toBe(true);
    expect(examinerQuestions(sheet).map((p) => p.question.id)).toContain("mb-slope-triangle");
  });

  it("gives the same questions for the same sheet, every time", () => {
    const sheet = markMeterBridgePage(G1_READINGS, { teacherXOhm: null });
    expect(examinerQuestions(sheet)).toEqual(examinerQuestions(sheet));
  });
});
