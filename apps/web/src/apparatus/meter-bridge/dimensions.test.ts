import { describe, expect, it } from "vitest";
import { cmToX, PLUG_BOX_DIMS, plugPositions, xToCm } from "./dimensions";

describe("meter-bridge dimensions", () => {
  it("converts cm along the 100 cm wire to scene x coordinates in metres", () => {
    // 100 cm constantan bridge wire centered at x = 0 (docs/plans/meter-bridge-kit.md §Contracts)
    expect(cmToX(0)).toBe(-0.5);
    expect(cmToX(50)).toBe(0);
    expect(cmToX(100)).toBe(0.5);
  });

  it("inverts cmToX with xToCm within 1e-9", () => {
    // Round-trip accuracy for a representative reading (37.4 cm)
    expect(Math.abs(xToCm(cmToX(37.4)) - 37.4)).toBeLessThan(1e-9);
  });

  it("clamps out-of-range x coordinates to [0, 100] cm", () => {
    expect(xToCm(-1)).toBe(0);
    expect(xToCm(1)).toBe(100);
  });

  it("computes evenly spaced, non-overlapping plug x positions inside the box for n = 1, 5 and 8", () => {
    const halfBox = PLUG_BOX_DIMS.width / 2;
    const minSpacing = PLUG_BOX_DIMS.plugHeadRadius * 2;

    for (const n of [1, 5, 8]) {
      const xs = plugPositions(n);
      expect(xs).toHaveLength(n);

      for (const x of xs) {
        expect(x).toBeGreaterThan(-halfBox);
        expect(x).toBeLessThan(halfBox);
      }

      if (n > 1) {
        const first = xs[0] ?? 0;
        const last = xs[n - 1] ?? 0;
        const expectedStep = (last - first) / (n - 1);
        expect(expectedStep).toBeGreaterThan(minSpacing);
        for (let i = 1; i < n; i++) {
          const step = (xs[i] ?? 0) - (xs[i - 1] ?? 0);
          expect(step).toBeCloseTo(expectedStep, 9);
        }
      }
    }
  });
});
