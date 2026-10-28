import { describe, expect, it } from "vitest";
import { wireLengthFromResistanceM } from "./partB";

describe("part (b)(ii): length from resistance", () => {
  it("gives 0.25 m for d = 0.2 mm, R = 7 Ω, ρ = 8.8 × 10⁻⁷ Ω m and π = 22/7", () => {
    // A = πd²/4 = (22/7)(0.2 × 10⁻³)²/4 = 3.143 × 10⁻⁸ m²; L = RA/ρ = 7 × 3.143 × 10⁻⁸ / 8.8 × 10⁻⁷
    // = 0.25 m (the question's part (b)(ii); docs/07 §4.4; R = ρL/A, Nelkon & Parker).
    const lengthM = wireLengthFromResistanceM({
      resistanceOhm: 7,
      diameterM: 0.2e-3,
      resistivityOhmM: 8.8e-7,
      pi: 22 / 7,
    });
    expect(lengthM).toBeCloseTo(0.25, 9);
  });

  it("uses Math.PI when no π is given", () => {
    // Same data with π = 3.14159…: L = 7 × π(0.2 × 10⁻³)²/4 / 8.8 × 10⁻⁷ = 0.2499 m (R = ρL/A).
    const lengthM = wireLengthFromResistanceM({
      resistanceOhm: 7,
      diameterM: 0.2e-3,
      resistivityOhmM: 8.8e-7,
    });
    expect(lengthM).toBeCloseTo((7 * Math.PI * 4e-8) / 4 / 8.8e-7, 12);
    expect(lengthM).toBeCloseTo(0.2499, 4);
  });
});
