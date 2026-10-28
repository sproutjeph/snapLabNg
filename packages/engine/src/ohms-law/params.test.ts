import { describe, expect, it } from "vitest";
import {
  CELL_EMF_RANGE_V,
  CELL_INTERNAL_RANGE_OHM,
  constantanOhmPerM,
  gaugeLengthRangeCm,
  paramsFromSeed,
  RULE_LENGTH_CM,
  RULE_MARGIN_CM,
  SWG_DIAMETER_MM,
} from "./params";

describe("bench parameters from a seed", () => {
  it("gives constantan of 4.41, 5.23 and 6.29 Ω/m for SWG 28, 29 and 30", () => {
    // ρ = 4.9 × 10⁻⁷ Ω m (Kaye & Laby), SWG 28/29/30 = 0.3759/0.3454/0.3150 mm (BS 3737):
    // R/L = ρ/(πd²/4) = 4.415, 5.229 and 6.288 Ω/m (docs/plans/ohms-law-vi.md: 4.41, ≈5.24, 6.29).
    expect(constantanOhmPerM(SWG_DIAMETER_MM[28])).toBeCloseTo(4.415, 2);
    expect(constantanOhmPerM(SWG_DIAMETER_MM[29])).toBeCloseTo(5.229, 2);
    expect(constantanOhmPerM(SWG_DIAMETER_MM[30])).toBeCloseTo(6.288, 2);
  });

  it("keeps each gauge's lengths inside its plan range and the 2.8–4.5 Ω band", () => {
    // docs/plans/ohms-law-vi.md "Ammeter range": SWG 28 63.5–100 cm, SWG 29 53–86 cm,
    // SWG 30 45–72 cm, clipped so R_XY stays in 2.8–4.5 Ω and the wire fits the rule.
    expect(gaugeLengthRangeCm(28)[0]).toBeCloseTo(63.5, 6);
    expect(gaugeLengthRangeCm(28)[1]).toBeCloseTo(98, 6);
    expect(gaugeLengthRangeCm(29)[0]).toBeCloseTo(2.8 / 0.05229, 1);
    expect(gaugeLengthRangeCm(29)[1]).toBeCloseTo(86, 6);
    expect(gaugeLengthRangeCm(30)[0]).toBeCloseTo(45, 6);
    expect(gaugeLengthRangeCm(30)[1]).toBeCloseTo(4.5 / 0.06288, 1);
  });

  it("chooses the gauge first, then a length, so R_XY agrees with the length she measures", () => {
    // R = ρL/A (Nelkon & Parker, resistivity); every seed lands in the plan's bands.
    const gauges = new Set<number>();
    for (let seed = 0; seed < 300; seed++) {
      const p = paramsFromSeed(seed);
      const w = p.wire;
      const swg = ([28, 29, 30] as const).find((g) => SWG_DIAMETER_MM[g] === w.diameterMm);
      expect(swg).toBeDefined();
      if (!swg) continue;
      gauges.add(swg);
      const [lo, hi] = gaugeLengthRangeCm(swg);
      expect(w.lengthCm).toBeGreaterThanOrEqual(lo);
      expect(w.lengthCm).toBeLessThanOrEqual(hi);
      expect(w.ohm).toBeCloseTo((constantanOhmPerM(w.diameterMm) * w.lengthCm) / 100, 9);
      expect(w.ohm).toBeGreaterThanOrEqual(2.8);
      expect(w.ohm).toBeLessThanOrEqual(4.5);
      // On the 0–100 cm rule with a margin at each end.
      expect(w.startCm).toBeGreaterThanOrEqual(RULE_MARGIN_CM);
      expect(w.startCm + w.lengthCm).toBeLessThanOrEqual(RULE_LENGTH_CM - RULE_MARGIN_CM);
      // Constantan α (docs/07 §4.2).
      expect(w.alphaPerK).toBeCloseTo(8e-6, 12);
      // Dry cells: 1.5–1.6 V and 0.3–0.6 Ω each (docs/plans/ohms-law-vi.md).
      expect(p.cell.restEmfV).toBeGreaterThanOrEqual(CELL_EMF_RANGE_V[0]);
      expect(p.cell.restEmfV).toBeLessThanOrEqual(CELL_EMF_RANGE_V[1]);
      expect(p.cell.restInternalOhm).toBeGreaterThanOrEqual(CELL_INTERNAL_RANGE_OHM[0]);
      expect(p.cell.restInternalOhm).toBeLessThanOrEqual(CELL_INTERNAL_RANGE_OHM[1]);
      // Ammeter zero error: none, or one 0.02 A division either way.
      expect([0, 0.02, -0.02].some((z) => Math.abs(p.ammeter.zeroError - z) < 1e-12)).toBe(true);
      expect(p.voltmeter.zeroError).toBe(0);
    }
    expect(gauges).toEqual(new Set([28, 29, 30]));
  });

  it("paints the dials and the box as docs/07 §4.4 sets them", () => {
    // 0–1 A in 0.02 A divisions, R_A ≈ 0.1 Ω; 0–3 V in 0.05 V divisions at 1 kΩ/V (3 kΩ);
    // box coils 1, 2, 2, 5, 10, 20, 20, 50 Ω (docs/07 §4.4).
    const p = paramsFromSeed(5);
    expect(p.ammeter.fullScale).toBeCloseTo(1, 12);
    expect(p.ammeter.division).toBeCloseTo(0.02, 12);
    expect(p.ammeter.ohm).toBeCloseTo(0.1, 12);
    expect(p.voltmeter.fullScale).toBeCloseTo(3, 12);
    expect(p.voltmeter.division).toBeCloseTo(0.05, 12);
    expect(p.voltmeter.ohm).toBeCloseTo(3000, 9);
    expect(p.boxCoilsOhm).toEqual([1, 2, 2, 5, 10, 20, 20, 50]);
  });

  it("gives the same parameters for the same seed and different ones for another", () => {
    // .claude/rules/science-engine.md: pure, seeded.
    expect(paramsFromSeed(42)).toEqual(paramsFromSeed(42));
    expect(paramsFromSeed(42)).not.toEqual(paramsFromSeed(43));
  });
});
