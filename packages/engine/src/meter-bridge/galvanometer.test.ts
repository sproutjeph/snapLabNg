import { describe, expect, it } from "vitest";
import { DEFAULT_GALVO, DT_S } from "./constants";
import { NEEDLE_AT_REST, type NeedleState, stepNeedle } from "./galvanometer";

function run(currentA: number, seconds: number): NeedleState[] {
  const out: NeedleState[] = [];
  let n = NEEDLE_AT_REST;
  for (let i = 0; i < Math.round(seconds / DT_S); i++) {
    n = stepNeedle(n, currentA, DEFAULT_GALVO, DT_S);
    out.push(n);
  }
  return out;
}

describe("centre-zero galvanometer needle", () => {
  it("settles at θ = S·I for a steady current, after overshooting", () => {
    // Damped oscillator θ'' + 2ζω₀θ' + ω₀²θ = ω₀²SI (docs/07 §4.2): steady state θ = S·I;
    // with ζ = 0.35 < 1 it overshoots before settling.
    const currentA = 0.001; // 24.4° steady
    const steps = run(currentA, 3);
    const target = DEFAULT_GALVO.degPerA * currentA;
    const last = steps.at(-1);
    expect(last?.thetaDeg).toBeCloseTo(target, 1);
    expect(Math.abs((last?.thetaDeg ?? 0) - target) / target).toBeLessThan(0.005);
    expect(Math.max(...steps.map((s) => s.thetaDeg))).toBeGreaterThan(target);
  });

  it("clamps at full scale and slams when driven to 4× full scale", () => {
    // docs/07 §4.2: clamped at full scale, so a far-from-balance tap slams the needle.
    const currentA = (4 * DEFAULT_GALVO.fullScaleDeg) / DEFAULT_GALVO.degPerA;
    const steps = run(currentA, 2);
    expect(steps.some((s) => s.slammed)).toBe(true);
    expect(Math.max(...steps.map((s) => s.thetaDeg))).toBeLessThanOrEqual(
      DEFAULT_GALVO.fullScaleDeg,
    );
    expect(steps.at(-1)?.thetaDeg).toBeCloseTo(DEFAULT_GALVO.fullScaleDeg, 9);
  });

  it("deflects the other way for current J→B", () => {
    // A centre-zero galvanometer deflects to either side with the current direction (docs/07 §4.2).
    expect(run(-0.0005, 3).at(-1)?.thetaDeg).toBeLessThan(0);
  });

  it("is deterministic over 360 steps", () => {
    expect(run(0.0007, 3)).toEqual(run(0.0007, 3));
  });
});
