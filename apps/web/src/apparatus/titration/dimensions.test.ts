import { describe, expect, it } from "vitest";
import { BURETTE_DIMS, FLASK_DIMS, flaskLiquidHeight, volumeToY, yToVolume } from "./dimensions";

describe("titration dimensions", () => {
  it("maps 0 cm³ to the top graduation and 50 cm³ to the bottom graduation (increasing downwards)", () => {
    // 50 cm³ burette graduated over 0.50 m with 0 at top and 50 at bottom (docs/plans/titration-kit.md)
    expect(volumeToY(0)).toBe(BURETTE_DIMS.gradTopY);
    expect(volumeToY(50)).toBe(BURETTE_DIMS.gradBottomY);
    expect(volumeToY(0)).toBeGreaterThan(volumeToY(50));
  });

  it("inverts volumeToY with yToVolume within 1e-9", () => {
    // Round-trip accuracy for a representative WAEC burette reading (24.35 cm³)
    expect(Math.abs(yToVolume(volumeToY(24.35)) - 24.35)).toBeLessThan(1e-9);
  });

  it("clamps out-of-range volumes and heights to [0, 50] cm³", () => {
    expect(volumeToY(-1)).toBe(volumeToY(0));
    expect(volumeToY(60)).toBe(volumeToY(50));
    expect(yToVolume(BURETTE_DIMS.gradTopY + 0.2)).toBe(0);
    expect(yToVolume(BURETTE_DIMS.gradBottomY - 0.2)).toBe(50);
  });

  it("computes conical flask liquid height from frustum geometry", () => {
    expect(flaskLiquidHeight(0)).toBe(0);

    const h10 = flaskLiquidHeight(10);
    const h50 = flaskLiquidHeight(50);
    const h100 = flaskLiquidHeight(100);
    const h250 = flaskLiquidHeight(250);

    expect(h10).toBeGreaterThan(0);
    expect(h50).toBeGreaterThan(h10);
    expect(h100).toBeGreaterThan(h50);
    expect(h250).toBeGreaterThan(h100);
    expect(h250).toBeLessThan(FLASK_DIMS.bodyHeight);
  });
});
