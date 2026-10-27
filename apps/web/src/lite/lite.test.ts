import { describe, expect, it } from "vitest";
import { createBenchController } from "../apparatus/meter-bridge/benchController";
import { clientXToCm, cmToSvgX, isDrag, needleAngle, svgXToCm } from "./geometry";

const GOLDEN_SETUP = {
  boxValuesOhm: [1, 2, 2, 5, 10],
  plugsIn: [false, true, true, true, true],
  xOhm: 3,
};

describe("lite geometry", () => {
  it("converts cm to SVG x and round-trips correctly", () => {
    expect(cmToSvgX(0)).toBe(100);
    expect(cmToSvgX(100)).toBe(1100);
    expect(cmToSvgX(50)).toBe(600);
    expect(Math.abs(svgXToCm(cmToSvgX(37.5)) - 37.5)).toBeLessThan(1e-9);
  });

  it("clamps svgXToCm at 0 and 100 cm", () => {
    expect(svgXToCm(0)).toBe(0);
    expect(svgXToCm(1200)).toBe(100);
    expect(cmToSvgX(-10)).toBe(100);
    expect(cmToSvgX(150)).toBe(1100);
  });

  it("maps clientX to cm proportionally using rendered width and offset", () => {
    // With the SVG drawn 600 px wide starting at clientX 20, clientX 320 (middle) gives 50 cm.
    expect(clientXToCm(320, 20, 600)).toBe(50);
    // Left edge
    expect(clientXToCm(20, 20, 600)).toBe(0);
    // Right edge
    expect(clientXToCm(620, 20, 600)).toBe(100);
    // Zero or negative width guard
    expect(clientXToCm(320, 20, 0)).toBe(0);
  });

  it("clamps needle angle to ±45 degrees", () => {
    expect(needleAngle(80)).toBe(45);
    expect(needleAngle(-80)).toBe(-45);
    expect(needleAngle(25)).toBe(25);
    expect(needleAngle(-15)).toBe(-15);
    expect(needleAngle(0)).toBe(0);
  });

  it("detects drag only when travel exceeds 4 px threshold", () => {
    expect(isDrag(3)).toBe(false);
    expect(isDrag(-3)).toBe(false);
    expect(isDrag(4)).toBe(false);
    expect(isDrag(-4)).toBe(false);
    expect(isDrag(5)).toBe(true);
    expect(isDrag(-5)).toBe(true);
  });

  it("integrates with bench controller headlessly to deflect needle on closed key", () => {
    const controller = createBenchController(GOLDEN_SETUP);
    expect(controller.visual.needleDeg).toBe(0);

    controller.handlers.onKeyToggle();
    controller.handlers.onWireTap(10);
    for (let i = 0; i < 20; i++) {
      controller.advance(1 / 60);
    }

    expect(controller.visual.keyClosed).toBe(true);
    expect(controller.visual.needleDeg).not.toBe(0);
    expect(Math.abs(controller.visual.needleDeg)).toBeGreaterThan(1);
  });
});
