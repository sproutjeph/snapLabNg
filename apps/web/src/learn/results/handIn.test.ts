import { describe, expect, it } from "vitest";
import { emptyOhmsLawRecord } from "../readings/record";
import { createOhmsLawBench } from "../wiring/bench";
import { handIn } from "./handIn";

// The marks are the rules' own (packages/rules tests carry the textbook values); this checks the
// hand-in wiring only: 21 marks available (docs/plans/exam-redesign.md, D1(d)).

describe("handIn", () => {
  it("marks out of 21 on a settled bench and carries the bench's resistance", () => {
    const bench = createOhmsLawBench(7);
    for (let i = 0; i < 120; i++) bench.advance(1 / 60);
    const out = handIn(emptyOhmsLawRecord("practice"), bench, "practice");
    expect(out.sheet.available).toBe(21);
    expect(out.benchOhm).toBe(bench.supervisor.effectiveOhm());
    expect(out.mode).toBe("practice");
  });
});
