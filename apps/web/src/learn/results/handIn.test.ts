import type { OhmsLawRecord } from "@snaplab/contracts";
import { DIAGRAM_LEADS, demoSeedFor, effectiveXyOhm, paramsFromSeed } from "@snaplab/engine";
import { markOhmsLaw } from "@snaplab/rules";
import { describe, expect, it } from "vitest";
import { emptyOhmsLawRecord, toMeasured } from "../readings/record";
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
    // ammeter has a zero error (±1 division of 0.02 A: docs/plans/ohms-law-vi.md, the
    // paramsFromSeed line; packages/engine/src/ohms-law/params.ts, paramsFromSeed's zero-error
    // block), she corrects by hand and slips one more division the same way: two divisions from
    // the dial, one from the corrected value, so ok only if handIn passes the zero error through.
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

/** The question's box settings (docs/07 §4.4), as which coils (1, 2, 2, 5, 10, 20, 20, 50 Ω) to unplug. */
const SETTINGS: ReadonlyArray<readonly [number, readonly number[]]> = [
  [0, []],
  [1, [0]],
  [5, [3]],
  [10, [4]],
  [20, [5]],
  [40, [5, 6]],
  [60, [4, 7]],
];

/**
 * The demonstration table, as a candidate copying the Watch bench would write it: each R, then
 * the settled I and V off that bench's own meters, and a slope ΔV/ΔI from her first and last rows.
 */
function demoRecord(demoSeed: number): OhmsLawRecord {
  const b = createOhmsLawBench(demoSeed);
  for (const [a, c] of DIAGRAM_LEADS) {
    b.tapTerminal(a);
    b.tapTerminal(c);
  }
  const advance = (s: number) => {
    for (let i = 0; i < s * 60; i++) b.advance(1 / 60);
  };
  const rows = SETTINGS.map(([ohm, coils]) => {
    for (const c of coils) b.togglePlug(c);
    expect(b.boxSettingOhm).toBe(ohm);
    b.toggleKey();
    advance(3);
    const I = b.supervisor.reading("ammeter") ?? "";
    const V = b.supervisor.reading("voltmeter") ?? "";
    b.toggleKey();
    for (const c of coils) b.togglePlug(c);
    advance(2);
    return { R: toMeasured(String(ohm)), I: toMeasured(I), V: toMeasured(V) };
  });
  const first = rows[0];
  const last = rows[rows.length - 1];
  const dV = Number(first?.V.text_as_written) - Number(last?.V.text_as_written);
  const dI = Number(first?.I.text_as_written) - Number(last?.I.text_as_written);
  const empty = emptyOhmsLawRecord("practice");
  return {
    ...empty,
    rows,
    graph: {
      sheet: { width_cm: 18, height_cm: 25 },
      x: { label_as_written: "I/A", scale_as_written: null, units_per_cm: 0.05, origin_value: 0 },
      y: { label_as_written: "V/V", scale_as_written: null, units_per_cm: 0.1, origin_value: 0 },
      points: [],
      line: null,
      triangle: null,
      delta_y_as_written: `ΔV = ${dV.toFixed(2)} V`,
      delta_x_as_written: `ΔI = ${dI.toFixed(2)} A`,
      slope_as_written: `s = ΔV/ΔI = ${(dV / dI).toFixed(2)} Ω`,
    },
  };
}

describe("the demonstration bench", () => {
  it("copying the demonstration table loses the accuracy mark", () => {
    // DRAFT scheme. PHYS-ACCURACY: her slope within ±10% of the bench's R_XY ∥ R_V (docs/07 §5.2;
    // docs/plans/exam-redesign.md D1(a), D1(d)). demoSeedFor puts the demonstration wire at least
    // 20% from hers (DEMO_MIN_OHM_DIFFERENCE, packages/engine/src/ohms-law/params.ts), so the
    // demonstration table's slope misses her bench. Expected: PHYS-ACCURACY lost against her
    // bench, earned against the demonstration bench itself (the copied table is not otherwise bad).
    for (const seed of [1, 7, 11, 42]) {
      const record = demoRecord(demoSeedFor(seed));
      const accuracy = (teacherXyOhm: number) =>
        markOhmsLaw(record, { teacherXyOhm }).items.find((i) => i.rule === "PHYS-ACCURACY")
          ?.outcome;
      expect(accuracy(effectiveXyOhm(paramsFromSeed(seed)))).toBe("lost");
      expect(accuracy(effectiveXyOhm(paramsFromSeed(demoSeedFor(seed))))).toBe("earned");
    }
  });
});
