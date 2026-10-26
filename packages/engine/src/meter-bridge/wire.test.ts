import { describe, expect, it } from "vitest";
import { WIRE_OHM_PER_CM } from "./constants";
import { balanceCm, bench, IDEAL_WIRE } from "./test-helpers";
import { scrapedLengthCm, wireOhm } from "./wire";

describe("bridge wire", () => {
  it("is about 0.025 Ω per cm for 0.50 mm constantan", () => {
    // ρ(constantan) = 4.9 × 10⁻⁷ Ω m (Kaye & Laby, NPL); R/cm = ρ/(πd²/4)/100 = 0.02495 Ω/cm.
    expect(WIRE_OHM_PER_CM).toBeCloseTo(0.025, 3);
  });

  it("gives 100·ρ for the whole unscraped wire, without end resistances", () => {
    // R = ρl/A, so a uniform wire's resistance is proportional to length (Nelkon & Parker).
    const wire = { ...IDEAL_WIRE, endAOhm: 1, endCOhm: 1 };
    expect(wireOhm(0, 100, wire)).toBeCloseTo(2.5, 12);
  });

  it("moves the R = X balance by a few millimetres after a 20 cm scrape", () => {
    // docs/07 §4.2: dragging raises ρ a few percent over the segment. With 3% over 0–20 cm,
    // ρ(l + 0.6) = ρ(100.6)/2 gives l = 49.7 cm, a 3 mm shift.
    const l = balanceCm(bench({ scrapesCm: [[0, 20]] }));
    expect(l).toBeCloseTo(49.7, 1);
  });

  it("counts overlapping scrapes once", () => {
    // A segment dragged twice is still one damaged length (docs/07 §4.2 scraping model).
    expect(
      scrapedLengthCm(0, 100, [
        [10, 30],
        [20, 40],
        [35, 25],
      ]),
    ).toBeCloseTo(30, 12);
    expect(
      wireOhm(0, 100, IDEAL_WIRE, [
        [10, 30],
        [20, 40],
      ]),
    ).toBeCloseTo(0.025 * (100 + 0.03 * 30), 12);
  });
});
