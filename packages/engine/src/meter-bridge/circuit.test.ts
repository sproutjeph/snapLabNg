import { describe, expect, it } from "vitest";
import { solveCircuit } from "./circuit";
import { DEFAULT_WIRE, PLUG_CONTACT_OHM } from "./constants";
import { balanceCm, bench, galvoA, IDEAL_WIRE } from "./test-helpers";

describe("metre bridge circuit solve", () => {
  it("has no galvanometer current at 50.0 cm when R = X", () => {
    // Wheatstone balance R/X = l/(100 − l), so R = X balances at l = 50.0 cm
    // (Nelkon & Parker, Advanced Level Physics, the metre bridge).
    expect(Math.abs(galvoA(bench({ rOhm: 3, xOhm: 3 }), 50))).toBeLessThan(1e-9);
  });

  it("balances at l = 100R/(R + X) for the golden X = 3.0 Ω and R = 1–5 Ω", () => {
    // docs/07 §4.2 golden values: ideal l = 25.0, 40.0, 50.0, 57.1, 62.5 cm.
    const expected: Array<[number, number]> = [
      [1, 25.0],
      [2, 40.0],
      [3, 50.0],
      [4, 400 / 7],
      [5, 62.5],
    ];
    for (const [rOhm, lCm] of expected) {
      const c = bench({ rOhm, xOhm: 3 });
      expect(Math.abs(galvoA(c, lCm))).toBeLessThan(1e-9);
      expect(balanceCm(c)).toBeCloseTo(lCm, 6);
    }
  });

  it("reverses the galvanometer current on either side of balance", () => {
    // Centre-zero deflection changes side as the jockey crosses the null point (docs/07 §4.2).
    const c = bench();
    expect(Math.sign(galvoA(c, 45))).toBe(-Math.sign(galvoA(c, 55)));
    expect(galvoA(c, 45)).not.toBe(0);
  });

  it("obeys Kirchhoff's current law at A, B and J", () => {
    // Kirchhoff's first law: the currents into each node sum to zero (Nelkon & Parker, d.c. networks).
    const s = solveCircuit(
      bench({
        rOhm: 2.2,
        xOhm: 4.7,
        jockeyCm: 31.4,
        scrapesCm: [[10, 40]],
        wire: { ...IDEAL_WIRE, endAOhm: 0.02, endCOhm: 0.03 },
      }),
    );
    const i = s.branchCurrentsA;
    expect(i.cell - i.rArm - i.wireAJ).toBeCloseTo(0, 12);
    expect(i.rArm - i.xArm - i.galvo).toBeCloseTo(0, 12);
    expect(i.wireAJ + i.galvo - i.wireJC).toBeCloseTo(0, 12);
  });

  it("follows R/X = (l + α₁)/(100 − l + α₂) with end resistances", () => {
    // End corrections (Nelkon & Parker, metre bridge; docs/07 §4.2): α = e/ρ in cm.
    const wire = { ...IDEAL_WIRE, endAOhm: 0.05, endCOhm: 0.08 };
    const a1 = 0.05 / 0.025;
    const a2 = 0.08 / 0.025;
    const l1 = balanceCm(bench({ wire, rOhm: 2, xOhm: 3 }));
    if (l1 === null) throw new Error("expected a balance point");
    expect(2 / 3).toBeCloseTo((l1 + a1) / (100 - l1 + a2), 9);
  });

  it("removes the unequal part of the end errors when R and X are interchanged and averaged", () => {
    // With k = R/X, l₁ = (100k + kα₂ − α₁)/(1 + k) and, after interchanging, 100 − l₂ =
    // (100k − α₂ + kα₁)/(1 + k). Their mean is 100k/(1 + k) + (k − 1)(α₁ + α₂)/(2(1 + k)):
    // α₂ − α₁ cancels exactly, and the rest vanishes at k = 1, which is why a balance near
    // the middle of the wire is preferred (docs/07 §4.2; derived from the relation above).
    const wire = { ...IDEAL_WIRE, endAOhm: 0.05, endCOhm: 0.08 };
    const a = 0.05 / 0.025 + 0.08 / 0.025;
    const mean = (r: number, x: number) => {
      const l1 = balanceCm(bench({ wire, rOhm: r, xOhm: x }));
      const l2 = balanceCm(bench({ wire, rOhm: x, xOhm: r }));
      if (l1 === null || l2 === null) throw new Error("expected a balance point");
      return { l1, mean: (l1 + (100 - l2)) / 2 };
    };
    const k = 2 / 3;
    expect(mean(2, 3).mean).toBeCloseTo((100 * k) / (1 + k) + ((k - 1) * a) / (2 * (1 + k)), 6);
    const even = mean(3, 3);
    expect(even.l1).not.toBeCloseTo(50.0, 1);
    expect(even.mean).toBeCloseTo(50.0, 6);
  });

  it("has no balance point on the wire when every plug is in (R ≈ 0)", () => {
    // docs/07 §4.2: B sits at A's potential, so the needle stays to one side everywhere.
    // That needs the plug contact resistance to be below the end-A resistance.
    expect(PLUG_CONTACT_OHM).toBeLessThan(DEFAULT_WIRE.endAOhm);
    const c = bench({ rOhm: PLUG_CONTACT_OHM, xOhm: 3, wire: DEFAULT_WIRE });
    const first = Math.sign(galvoA(c, 0.5));
    for (let l = 0.5; l <= 99.5; l += 0.5) expect(Math.sign(galvoA(c, l))).toBe(first);
    expect(balanceCm(c)).toBeNull();
  });

  it("carries no current anywhere with the key open", () => {
    // No emf in the network means no current in any branch (Kirchhoff's laws).
    const i = solveCircuit(bench({ keyClosed: false, jockeyCm: 30 })).branchCurrentsA;
    for (const v of Object.values(i)) expect(v).toBeCloseTo(0, 15);
  });

  it("solves with the jockey off the wire and passes no galvanometer current", () => {
    // With the jockey up the galvanometer branch is open, so I_g = 0 (docs/07 §4.2).
    const s = solveCircuit(bench({ jockeyCm: null }));
    expect(s.branchCurrentsA.galvo).toBe(0);
    expect(Number.isFinite(s.nodeV.J)).toBe(true);
    expect(s.branchCurrentsA.cell).toBeGreaterThan(0);
  });

  it("treats a non-finite jockey position as the jockey being up", () => {
    const s = solveCircuit(bench({ jockeyCm: Number.NaN }));
    expect(s.branchCurrentsA.galvo).toBe(0);
    for (const v of Object.values(s.branchCurrentsA)) expect(Number.isFinite(v)).toBe(true);
  });

  it("stays finite with R exactly 0 and with the jockey on either end of an ideal wire", () => {
    const cases = [
      bench({ rOhm: 0 }),
      bench({ xOhm: 0 }),
      bench({ jockeyCm: 0 }),
      bench({ jockeyCm: 100 }),
    ];
    for (const c of cases) {
      for (const v of Object.values(solveCircuit(c).branchCurrentsA)) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});
