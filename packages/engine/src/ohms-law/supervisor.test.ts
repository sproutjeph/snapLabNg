import { describe, expect, it } from "vitest";
import { paramsFromSeed } from "./params";
import { effectiveXyOhm } from "./supervisor";

describe("the supervisor's resistance of XY", () => {
  it("is XY in parallel with the 3 kΩ voltmeter: 3.50 Ω gives 3.4959 Ω", () => {
    // Resistors in parallel, 1/R = 1/R₁ + 1/R₂ (Nelkon & Parker): 3.5 × 3000 / 3003.5 = 3.49592 Ω.
    // R_V = 3 kΩ: a 0–3 V moving-coil voltmeter at 1000 Ω/V (docs/07 §4.4).
    const p = paramsFromSeed(3);
    const q = { ...p, wire: { ...p.wire, ohm: 3.5 } };
    expect(q.voltmeter.ohm).toBeCloseTo(3000, 9);
    expect(effectiveXyOhm(q)).toBeCloseTo(3.49592, 5);
  });

  it("sits within 0.2% below the wire's own resistance on every bench", () => {
    // R_XY ≤ 4.5 Ω against 3000 Ω: the parallel drop is at most 4.5/3004.5 ≈ 0.15%.
    for (let seed = 0; seed < 2000; seed++) {
      const p = paramsFromSeed(seed);
      const e = effectiveXyOhm(p);
      expect(e).toBeLessThan(p.wire.ohm);
      expect((p.wire.ohm - e) / p.wire.ohm).toBeLessThan(0.002);
    }
  });
});
