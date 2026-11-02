import { describe, expect, it } from "vitest";
import { canvasOpacity, posterOpacity, wakeOnResize } from "./HomeBench3D.logic";

describe("the card's poster and canvas", () => {
  it("shows the poster until the live canvas has drawn", () => {
    expect(posterOpacity(false, true)).toBe(1);
    expect(canvasOpacity(false, true)).toBe(0);
    expect(posterOpacity(true, true)).toBe(0);
    expect(canvasOpacity(true, true)).toBe(1);
  });

  it("brings the poster back when the canvas is gone after it was shown (context lost, guard)", () => {
    expect(posterOpacity(true, false)).toBe(1);
    expect(canvasOpacity(true, false)).toBe(0);
  });
});

describe("a resize of the card", () => {
  it("ignores the observer's first call", () => {
    expect(wakeOnResize(true, true)).toBe(false);
  });

  it("wakes a settled (stopped) view", () => {
    expect(wakeOnResize(true, false)).toBe(true);
  });

  it("leaves a running view alone", () => {
    expect(wakeOnResize(false, false)).toBe(false);
  });
});
