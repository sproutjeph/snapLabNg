import { describe, expect, it } from "vitest";
import { benchSetupFrom, PLUG_BOX_COILS, plugsInFor } from "./benchSetup";
import { flowRate } from "./flow";
import { REVEAL_S, revealAt } from "./reveal";

const pulled = (plugsIn: boolean[] | null) =>
  (plugsIn ?? []).reduce((t, inPlug, i) => t + (inPlug ? 0 : (PLUG_BOX_COILS[i] ?? 0)), 0);

describe("bench setup", () => {
  it("pulls one 2 Ω plug for 2 Ω and coils adding to 8 for 8 Ω", () => {
    const two = plugsInFor(2);
    expect(two?.filter((p) => !p)).toHaveLength(1);
    expect(pulled(two)).toBe(2);
    expect(pulled(plugsInFor(8))).toBe(8);
  });

  it("makes every whole value from 1 to 40 Ω, and nothing else", () => {
    for (let r = 1; r <= 40; r++) expect(pulled(plugsInFor(r))).toBe(r);
    expect(plugsInFor(41)).toBeNull();
    expect(plugsInFor(2.5)).toBeNull();
    expect(plugsInFor(0)).toBeNull();
  });

  it("uses the teacher's X, else her own mean, else a default", () => {
    const base = { resistancesOhm: [2, 4, 6], teacherXOhm: null, herMeanXOhm: null };
    expect(benchSetupFrom({ ...base, teacherXOhm: 4.2, herMeanXOhm: 4 }).setup.xOhm).toBe(4.2);
    expect(benchSetupFrom({ ...base, herMeanXOhm: 4 }).setup.xOhm).toBe(4);
    expect(benchSetupFrom({ ...base, herMeanXOhm: 900 }).setup.xOhm).toBe(4);
  });

  it("starts with her first R pulled out and labels the coils", () => {
    // Real note 1 page: R = 2·00, 4·00, 6·00 … ohms (Oct 27 live read).
    const { setup, plugLabels } = benchSetupFrom({
      resistancesOhm: [null, 2, 4],
      teacherXOhm: null,
      herMeanXOhm: null,
    });
    expect(pulled(setup.plugsIn)).toBe(2);
    expect(setup.boxValuesOhm).toEqual([...PLUG_BOX_COILS]);
    expect(plugLabels).toEqual(["1", "2", "2", "5", "10", "20"]);
  });
});

describe("reveal timeline", () => {
  it("keeps every phase in 0–1, never decreasing, and finishes at REVEAL_S", () => {
    let prev = revealAt(0);
    for (let t = 0; t <= REVEAL_S + 0.5; t += 0.05) {
      const p = revealAt(t);
      for (const k of ["glow", "sparks", "rise", "camera"] as const) {
        expect(p[k]).toBeGreaterThanOrEqual(0);
        expect(p[k]).toBeLessThanOrEqual(1);
        expect(p[k]).toBeGreaterThanOrEqual(prev[k]);
      }
      prev = p;
    }
    expect(revealAt(REVEAL_S)).toEqual({ glow: 1, sparks: 1, rise: 1, camera: 1 });
  });

  it("glows before the sparks, and sparks before the kit rises", () => {
    expect(revealAt(0.5).glow).toBeGreaterThan(0);
    expect(revealAt(0.5).sparks).toBe(0);
    expect(revealAt(1.5).sparks).toBeGreaterThan(0);
    expect(revealAt(1.5).rise).toBe(0);
  });

  it("ends at once with reduced motion", () => {
    expect(revealAt(0, true)).toEqual({ glow: 1, sparks: 1, rise: 1, camera: 1 });
  });
});

describe("current-flow rate", () => {
  it("is still at balance and full for the cell's current, either direction", () => {
    expect(flowRate(0)).toBe(0);
    expect(flowRate(5e-6)).toBe(0); // micro-amps through the galvanometer near balance
    expect(flowRate(0.1)).toBe(1);
    expect(flowRate(-0.3)).toBe(1);
    expect(flowRate(1e-3)).toBeCloseTo(0.5, 6); // half-way on the log scale
    expect(flowRate(Number.NaN)).toBe(0);
  });
});
