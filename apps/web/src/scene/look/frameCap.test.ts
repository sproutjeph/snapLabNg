import { describe, expect, it } from "vitest";
import { MAX_FPS, nextFrameDelayMs } from "./frameCap";

describe("nextFrameDelayMs", () => {
  it("waits out the rest of a 1/60 s budget, less the margin", () => {
    expect(MAX_FPS).toBe(60);
    expect(nextFrameDelayMs(0)).toBeCloseTo(1000 / 60 - 4);
    expect(nextFrameDelayMs(5)).toBeCloseTo(1000 / 60 - 9);
  });
  it("asks at once when the frame already took its whole budget", () => {
    expect(nextFrameDelayMs(20)).toBe(0);
    expect(nextFrameDelayMs(-3)).toBeCloseTo(1000 / 60 - 4);
  });
});
