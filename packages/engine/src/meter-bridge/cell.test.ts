import { describe, expect, it } from "vitest";
import { type CellState, restingCell, stepCell } from "./cell";
import { DEFAULT_CELL, DT_S } from "./constants";
import { createMeterBridge, type MeterBridgeInputs, stepMeterBridge } from "./simulation";

function hold(s: CellState, currentA: number, seconds: number): CellState {
  let c = s;
  for (let i = 0; i < Math.round(seconds / DT_S); i++)
    c = stepCell(c, currentA, DEFAULT_CELL, DT_S);
  return c;
}

describe("Leclanché cell", () => {
  it("rests at an emf of 1.5 V", () => {
    // Leclanché cell emf ≈ 1.5 V (Nelkon & Parker, Advanced Level Physics, cells).
    expect(restingCell(DEFAULT_CELL).emfV).toBeCloseTo(1.5, 9);
  });

  it("polarises while current flows and recovers when the key is open", () => {
    // docs/07 §4.2: E sags and r rises with the key closed; both recover with it open.
    const rest = restingCell(DEFAULT_CELL);
    const used = hold(rest, 0.5, 60);
    expect(used.emfV).toBeLessThan(rest.emfV);
    expect(used.internalOhm).toBeGreaterThan(rest.internalOhm);
    const back = hold(used, 0, 120);
    expect(Math.abs(back.emfV - rest.emfV) / rest.emfV).toBeLessThan(0.01);
    expect(Math.abs(back.internalOhm - rest.internalOhm) / rest.internalOhm).toBeLessThan(0.01);
  });

  it("lowers sensitivity but leaves the balance point where it was", () => {
    // docs/07 §4.2: polarisation drops sensitivity; the balance point does not move.
    const inputs = (jockeyCm: number | null): MeterBridgeInputs => ({
      plugsIn: [true, true, false, true, true],
      boxValuesOhm: [1, 2, 3, 5, 10],
      xOhm: 3,
      keyClosed: true,
      jockeyCm,
    });
    const params = {
      wire: { ohmPerCm: 0.025, endAOhm: 0, endCOhm: 0, scrapeFactor: 0.03 },
      plugContactOhm: 0,
    };
    let s = createMeterBridge(params);
    s = stepMeterBridge(s, inputs(45));
    const freshG = s.solution.branchCurrentsA.galvo;
    for (let i = 0; i < 60 / DT_S; i++) s = stepMeterBridge(s, inputs(null));
    s = stepMeterBridge(s, inputs(45));
    expect(Math.abs(s.solution.branchCurrentsA.galvo)).toBeLessThan(Math.abs(freshG));
    s = stepMeterBridge(s, inputs(50));
    expect(Math.abs(s.solution.branchCurrentsA.galvo)).toBeLessThan(1e-9);
  });
});
