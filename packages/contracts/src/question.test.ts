import { describe, expect, it } from "vitest";
import { QuestionEvent, QuestionRead } from "./question";

// A reading of WASSCE (SC) 2018 Physics Paper 3 Q3B, the question the app ships
// (apps/web/src/learn/paper/ohmsLawQuestion.ts), shaped as Spark returns it.
const q3b: QuestionRead = {
  experiment: "ohms_law_vi",
  confidence: "high",
  source_as_printed: null,
  title_as_printed: null,
  apparatus: [
    { kind: "ammeter", text_as_printed: "an ammeter" },
    { kind: "voltmeter", text_as_printed: "a voltmeter" },
    { kind: "resistance_box", text_as_printed: "a resistance box" },
    { kind: "connecting_wires", text_as_printed: "connecting wires" },
    { kind: "cells", text_as_printed: "dry cells" },
  ],
  instructions: [
    {
      label: "1",
      text: "You are provided with an ammeter, a voltmeter, a resistance box, connecting wires, dry cells and other necessary materials.",
    },
    { label: "3", text: "Connect the circuit as shown in the diagram." },
  ],
  diagram: {
    present: true,
    photo: 1,
    parts: [
      { kind: "cells", label_as_printed: "E", box: { x0: 0.1, y0: 0.1, x1: 0.3, y1: 0.2 } },
      { kind: "key", label_as_printed: "K", box: { x0: 0.4, y0: 0.1, x1: 0.5, y1: 0.2 } },
    ],
  },
};

describe("QuestionRead", () => {
  it("accepts a Q3B reading", () => {
    expect(QuestionRead.parse(q3b)).toEqual(q3b);
  });

  it("refuses a reading that carries a value the engine owns", () => {
    expect(QuestionRead.safeParse({ ...q3b, slope: 2.97 }).success).toBe(false);
  });

  it("refuses a diagram on a third photo", () => {
    expect(QuestionRead.safeParse({ ...q3b, diagram: { ...q3b.diagram, photo: 2 } }).success).toBe(
      false,
    );
  });
});

describe("QuestionEvent", () => {
  it("parses accepted, question, part_outline, done and error", () => {
    const events: QuestionEvent[] = [
      { type: "accepted", request_id: "r1", image_sha256: ["a", "b"] },
      { type: "question", question: q3b },
      { type: "part_outline", part: 0, box: { x0: 0, y0: 0, x1: 1, y1: 1 }, score: 0.9 },
      { type: "error", stage: "sam", message: "no match", fallback: "none" },
      { type: "done", total_ms: 4200 },
    ];
    for (const e of events) expect(QuestionEvent.parse(e)).toEqual(e);
  });

  it("refuses three photos", () => {
    expect(
      QuestionEvent.safeParse({ type: "accepted", request_id: "r", image_sha256: ["a", "b", "c"] })
        .success,
    ).toBe(false);
  });
});
