import { describe, expect, it } from "vitest";
import { adsr, makeNoise, scrapeParams, slamParams } from "./envelopes";

describe("envelopes helpers", () => {
  it("returns 0 at t=0, peaks at 1 at t=a, holds s, and returns 0 after release", () => {
    const a = 0.01;
    const d = 0.05;
    const s = 0.4;
    const r = 0.03;
    const holdS = 0.1;
    expect(adsr(0, a, d, s, r, holdS)).toBe(0);
    expect(adsr(a, a, d, s, r, holdS)).toBeCloseTo(1);
    expect(adsr(a + d + holdS / 2, a, d, s, r, holdS)).toBeCloseTo(s);
    expect(adsr(a + d + holdS + r, a, d, s, r, holdS)).toBe(0);
    expect(adsr(a + d + holdS + r + 0.5, a, d, s, r, holdS)).toBe(0);
  });

  it("never returns a gain below 0 or above 1", () => {
    for (let t = -0.05; t < 0.4; t += 0.005) {
      const v = adsr(t, 0.02, 0.06, 0.7, 0.04, 0.08);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(adsr(0.01, 0.02, 0.06, 2, 0.04, 0.08)).toBeLessThanOrEqual(1);
    expect(adsr(0.1, 0.02, 0.06, -1, 0.04, 0.08)).toBeGreaterThanOrEqual(0);
  });

  it("makes a harder slam louder, lower and longer, and clamps intensity", () => {
    const soft = slamParams(0.2);
    const hard = slamParams(0.9);
    expect(hard.gain).toBeGreaterThan(soft.gain);
    expect(hard.freqHz).toBeLessThan(soft.freqHz);
    expect(hard.decayS).toBeGreaterThan(soft.decayS);
    expect(slamParams(-1)).toEqual(slamParams(0));
    expect(slamParams(2)).toEqual(slamParams(1));
    expect(slamParams(Infinity)).toEqual(slamParams(1));
    expect(slamParams(-Infinity)).toEqual(slamParams(0));
    expect(slamParams(NaN)).toEqual(slamParams(0));
  });

  it("clamps scrape duration to 0.1-1.5 s", () => {
    expect(scrapeParams(0.01).durationS).toBeCloseTo(0.1);
    expect(scrapeParams(5).durationS).toBeCloseTo(1.5);
    expect(scrapeParams(0.6).durationS).toBeCloseTo(0.6);
  });

  it("returns identical noise for the same seed and different noise for another seed", () => {
    const first = makeNoise(1024, 7);
    const second = makeNoise(1024, 7);
    const other = makeNoise(1024, 8);
    expect(first).toEqual(second);
    expect(first).not.toEqual(other);
    for (const v of first) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
