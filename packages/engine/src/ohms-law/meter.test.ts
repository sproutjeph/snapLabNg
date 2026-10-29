import { describe, expect, it } from "vitest";
import { createOhmsLaw } from "./bench";
import { displayedValue, meterTargetDeg } from "./meter";
import { paramsFromSeed } from "./params";
import { diagramLeads, inputs, noZeroError, plugsFor, run } from "./test-helpers";
import { METER_FULL_DEG, METER_STOP_DEG, METER_ZERO_DEG } from "./types";

describe("the value a candidate reads off a dial", () => {
  const p = paramsFromSeed(3);

  it("reads 0 at the zero mark, half scale mid-dial and full scale at the end", () => {
    // docs/07 §4.4: ammeter 0–1 A, voltmeter 0–3 V; the dial runs −40° (zero) to +40° (full).
    expect(displayedValue(p.ammeter, METER_ZERO_DEG)).toBeCloseTo(0, 12);
    expect(displayedValue(p.ammeter, 0)).toBeCloseTo(0.5, 12);
    expect(displayedValue(p.voltmeter, METER_FULL_DEG)).toBeCloseTo(3, 12);
  });

  it("undoes meterTargetDeg, with the zero error still in what she sees", () => {
    // A zero error of +1 division (0.02 A, docs/07 §4.4) adds 0.02 A to every reading on the
    // dial: 0.30 A through the meter shows 0.32 A.
    const m = { ...p.ammeter, zeroError: 0.02 };
    expect(displayedValue(m, meterTargetDeg(m, 0.3, 0))).toBeCloseTo(0.32, 12);
    expect(displayedValue(p.voltmeter, meterTargetDeg(p.voltmeter, 1.35, 0))).toBeCloseTo(1.35, 12);
  });

  it("includes the zero-adjust trim, since the trim moves the needle", () => {
    // Trimming by −1 division (−0.8° on the 80° span of a 0–1 A dial in 0.02 A divisions)
    // cancels a +0.02 A zero error: 0.30 A then shows 0.30 A.
    const m = { ...p.ammeter, zeroError: 0.02 };
    const trimDeg = (-80 * 0.02) / 1;
    expect(displayedValue(m, meterTargetDeg(m, 0.3, trimDeg))).toBeCloseTo(0.3, 12);
  });

  it("gives an off-scale value for a needle on a stop, unclamped", () => {
    // 5° past full scale on a 0–3 V dial is 5/80 × 3 = 0.1875 V beyond 3 V.
    expect(displayedValue(p.voltmeter, METER_STOP_DEG)).toBeCloseTo(3.1875, 12);
    expect(displayedValue(p.voltmeter, -METER_STOP_DEG)).toBeCloseTo(-0.1875, 12);
  });

  it("matches the current through the settled ammeter on the diagram's circuit", () => {
    // R = 5 Ω from the box, key closed, 10 s to settle (near-critical needle, f₀ = 1.5 Hz).
    const q = noZeroError(p);
    const s = run(createOhmsLaw(q), inputs(diagramLeads(), { plugsIn: plugsFor(5) }), 10);
    const iA = s.readout.partCurrentsA.ammeter;
    expect(iA).toBeGreaterThan(0.1);
    expect(displayedValue(q.ammeter, s.readout.ammeterDeg)).toBeCloseTo(iA, 3);
  });
});
