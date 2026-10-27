import { describe, expect, it } from "vitest";
import { createBenchController } from "./benchController";

// The golden bench (docs/15 §4): coils 1, 2, 2, 5, 10 Ω, only the 1 Ω plug out.
const SETUP = { boxValuesOhm: [1, 2, 2, 5, 10], plugsIn: [false, true, true, true, true], xOhm: 3 };

describe("bench controller", () => {
  it("lowers the jockey on a tap and lifts it about 0.6 s later", () => {
    const b = createBenchController(SETUP);
    b.handlers.onWireTap(40);
    b.advance(1 / 60);
    expect(b.visual.jockeyDown).toBe(true);
    expect(b.visual.jockeyCm).toBe(40);
    for (let i = 0; i < 60; i++) b.advance(1 / 60);
    expect(b.visual.jockeyDown).toBe(false);
  });

  it("swings the needle only once the key is closed", () => {
    const open = createBenchController(SETUP);
    open.handlers.onWireTap(10);
    for (let i = 0; i < 20; i++) open.advance(1 / 60);
    expect(open.visual.needleDeg).toBeCloseTo(0, 6);

    const closed = createBenchController(SETUP);
    closed.handlers.onKeyToggle();
    closed.handlers.onWireTap(10);
    for (let i = 0; i < 20; i++) closed.advance(1 / 60);
    expect(closed.visual.keyClosed).toBe(true);
    expect(Math.abs(closed.visual.needleDeg)).toBeGreaterThan(1);
  });

  it("records one drag as one scrape when the jockey lifts", () => {
    const b = createBenchController(SETUP);
    b.handlers.onWireDrag(30, 32);
    b.handlers.onWireDrag(32, 36);
    b.advance(1 / 60);
    expect(b.visual.scrapesCm).toEqual([]);
    for (let i = 0; i < 30; i++) b.advance(1 / 60);
    expect(b.visual.scrapesCm).toEqual([[30, 36]]);
  });

  it("toggles plugs and ignores an index outside the box", () => {
    const b = createBenchController(SETUP);
    b.handlers.onPlugToggle(1);
    b.handlers.onPlugToggle(9);
    b.advance(1 / 60);
    expect(b.visual.plugsIn).toEqual([false, false, true, true, true]);
  });
});
