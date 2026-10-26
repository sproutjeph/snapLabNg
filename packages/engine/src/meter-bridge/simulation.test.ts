import { describe, expect, it } from "vitest";
import { DEFAULT_WIRE, DT_S } from "./constants";
import {
  addScrape,
  createMeterBridge,
  type MeterBridgeInputs,
  type MeterBridgeState,
  stepMeterBridge,
} from "./simulation";

// R = 1 Ω (only the "1" plug out), X = 3 Ω: balance near 25 cm.
const farTap: MeterBridgeInputs = {
  plugsIn: [false, true, true, true, true],
  boxValuesOhm: [1, 2, 2, 5, 10],
  xOhm: 3,
  keyClosed: true,
  jockeyCm: 90,
};

function runFor(s0: MeterBridgeState, inputs: MeterBridgeInputs, seconds: number) {
  let s = s0;
  let slammed = false;
  for (let i = 0; i < Math.round(seconds / DT_S); i++) {
    s = stepMeterBridge(s, inputs);
    slammed ||= s.needle.slammed;
  }
  return { s, slammed };
}

describe("metre bridge simulation", () => {
  it("slams the needle on a tap far from balance with no protective resistor", () => {
    // docs/15 §2: a far tap with no protective resistor slams the needle against its stop.
    expect(runFor(createMeterBridge(), farTap, 0.5).slammed).toBe(true);
  });

  it("keeps the needle on scale for the same tap with a 1 kΩ protective resistor", () => {
    // A series protective resistor limits I_g = V_Th / (R_Th + r_g + r_protect) (docs/07 §4.2).
    const { s, slammed } = runFor(createMeterBridge({ protectOhm: 1000 }), farTap, 0.5);
    expect(slammed).toBe(false);
    expect(Math.abs(s.needle.thetaDeg)).toBeLessThan(s.params.galvo.fullScaleDeg);
  });

  it("does not re-solve when nothing changed and the key is open", () => {
    const open = { ...farTap, keyClosed: false };
    const a = stepMeterBridge(createMeterBridge(), open);
    const b = stepMeterBridge(a, { ...open, plugsIn: [...open.plugsIn] });
    expect(b.solution).toBe(a.solution);
  });

  it("unbalances an R = X bench at 50 cm once the wire has been scraped", () => {
    // docs/07 §4.2: scraping raises ρ over the dragged segment, so the old null point no
    // longer balances. Ideal ends so the unscraped null is exactly 50.0 cm.
    const atMiddle: MeterBridgeInputs = {
      ...farTap,
      plugsIn: [true, true, false, true, true],
      boxValuesOhm: [1, 2, 3, 5, 10],
      jockeyCm: 50,
    };
    const params = { wire: { ...DEFAULT_WIRE, endAOhm: 0, endCOhm: 0 }, plugContactOhm: 0 };
    const a = stepMeterBridge(createMeterBridge(params), atMiddle);
    expect(Math.abs(a.solution.branchCurrentsA.galvo)).toBeLessThan(1e-9);
    const b = stepMeterBridge(addScrape(a, 0, 20), atMiddle);
    expect(b.scrapesCm).toEqual([[0, 20]]);
    expect(Math.abs(b.solution.branchCurrentsA.galvo)).toBeGreaterThan(1e-6);
  });

  it("re-solves when the caller mutates the same inputs object in place", () => {
    const inputs: MeterBridgeInputs = { ...farTap, keyClosed: false };
    const a = stepMeterBridge(createMeterBridge(), inputs);
    expect(a.solution.branchCurrentsA.cell).toBe(0);
    (inputs as { keyClosed: boolean }).keyClosed = true;
    const b = stepMeterBridge(a, inputs);
    expect(b.solution.branchCurrentsA.cell).toBeGreaterThan(0);
  });
});
