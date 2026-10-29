import { describe, expect, it } from "vitest";
import { emptyOhmsLawRecord } from "../readings/record";
import type { OhmsLawBench } from "../types";
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

  it("passes the ammeter's zero error, so a hand-corrected current is accepted", () => {
    // Wiring only (the DRAFT one-division tolerance is tested in packages/rules). On a seed whose
    // ammeter has a zero error (±1 division of 0.02 A, docs/07 §4.4), she corrects by hand and
    // slips one more division the same way: two divisions from the dial, one from the corrected
    // value, so ok only if handIn passes the zero error through.
    let seed = 1;
    while (createOhmsLawBench(seed).params.ammeter.zeroError === 0) seed++;
    const real = createOhmsLawBench(seed);
    const { zeroError, division } = real.params.ammeter;
    const log = [{ boxOhm: 5, iShown: "0.40", vShown: "1.20" }];
    const bench: OhmsLawBench = { ...real, supervisor: { ...real.supervisor, log: () => log } };
    const cell = (text: string) => ({ value: null, unit_as_written: null, text_as_written: text });
    const wroteA = 0.4 - zeroError - Math.sign(zeroError) * division;
    const empty = emptyOhmsLawRecord("practice");
    const rows = empty.rows.map((r, i) =>
      i === 0 ? { R: cell("5"), I: cell(wroteA.toFixed(2)), V: cell("1.20") } : r,
    );
    const out = handIn({ ...empty, rows }, bench, "practice");
    expect(out.checks.find((c) => c.row === 0 && c.col === "I")).toMatchObject({
      meterShowed: "0.40",
      ok: true,
    });
  });
});
