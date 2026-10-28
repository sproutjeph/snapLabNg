import { afterEach, describe, expect, it, vi } from "vitest";
import { PLUG_CONTACT_OHM } from "../meter-bridge";
import { createOhmsLaw, stepOhmsLaw } from "./bench";
import { METER_SPAN_DEG, meterTargetDeg, stepMeter } from "./meter";
import { JOINT_GOOD_OHM, KEY_CONTACT_OHM, LEAD_OHM } from "./netlist";
import { paramsFromSeed } from "./params";
import {
  bench,
  diagramLeads,
  dialReading,
  inputs,
  lead,
  noZeroError,
  plugsFor,
  run,
} from "./test-helpers";
import { METER_FULL_DEG, METER_STOP_DEG, METER_ZERO_DEG, type OhmsLawState } from "./types";

const R_VALUES = [0, 1, 5, 10, 20, 40, 60];
const P = noZeroError(paramsFromSeed(3));
const leadOhm = LEAD_OHM + 2 * JOINT_GOOD_OHM;
const par = (a: number, b: number) => (a * b) / (a + b);

/** The question's diagram with A+ and A− swapped. */
const reversedAmmeter = () =>
  diagramLeads().map((l) =>
    l.b === "A+" ? { ...l, b: "A-" as const } : l.a === "A-" ? { ...l, a: "A+" as const } : l,
  );

/** The usual slip: meters swapped, so the voltmeter is in the loop and the ammeter across XY. */
const swappedMeters = () => [
  lead("S1", "E+", "K1"),
  lead("S2", "K2", "V+"),
  lead("S3", "V-", "R1"),
  lead("S4", "R2", "X"),
  lead("S5", "Y", "E-"),
  lead("S6", "A+", "X"),
  lead("S7", "A-", "Y"),
];

/** Ammeter across XY, the gap it left in the loop closed by a lead, and V across XY. */
const ammeterAcrossWire = () => [
  lead("M1", "E+", "K1"),
  lead("M2", "K2", "R1"),
  lead("M3", "R2", "X"),
  lead("M4", "Y", "E-"),
  lead("M5", "A+", "X"),
  lead("M6", "A-", "Y"),
  lead("M7", "V+", "X"),
  lead("M8", "V-", "Y"),
];

describe("the V–I circuit", () => {
  it("gives the series-circuit current and the p.d. across XY (Ohm's law)", () => {
    // I = E/(r + R_A + R + R_key + leads + R_XY ∥ R_V'), V = I·(R_XY ∥ R_V'), with R_V' the voltmeter
    // and its two leads (Nelkon & Parker, Advanced Level Physics, Ohm's law and resistors in
    // series and parallel; Anyakoha, New School Physics, current electricity). The first step
    // solves with fresh cells, so E = 2 × restEmfV and r = 2 × restInternalOhm.
    for (const rOhm of [0, 10, 60]) {
      const s = stepOhmsLaw(createOhmsLaw(P), inputs(diagramLeads(), { plugsIn: plugsFor(rOhm) }));
      const xyOhm = par(P.wire.ohm, P.voltmeter.ohm + 2 * leadOhm);
      const totalOhm =
        2 * P.cell.restInternalOhm +
        KEY_CONTACT_OHM +
        P.ammeter.ohm +
        rOhm +
        PLUG_CONTACT_OHM +
        5 * leadOhm +
        xyOhm;
      const iA = (2 * P.cell.restEmfV) / totalOhm;
      const vV = (iA * xyOhm * P.voltmeter.ohm) / (P.voltmeter.ohm + 2 * leadOhm);
      expect(s.readout.partCurrentsA.ammeter).toBeCloseTo(iA, 9);
      expect(s.readout.partCurrentsA.voltmeter * P.voltmeter.ohm).toBeCloseTo(vV, 9);
      // Kirchhoff's first law: the ammeter current splits between XY and the voltmeter.
      expect(s.readout.partCurrentsA.wire + s.readout.partCurrentsA.voltmeter).toBeCloseTo(iA, 9);
    }
  });

  it("signs the currents: the meters read forward when wired as the diagram", () => {
    // Conventional current leaves E+ and enters A+ and V+ (Anyakoha, New School Physics, the
    // ammeter and voltmeter). Through the cells it runs E− → E+, so their body current is negative.
    const s = bench(P, inputs(diagramLeads(), { plugsIn: plugsFor(10) }), 2);
    const c = s.readout.partCurrentsA;
    expect(c.ammeter).toBeGreaterThan(0);
    expect(c.voltmeter).toBeGreaterThan(0);
    expect(c.wire).toBeGreaterThan(0);
    expect(c.cells).toBeLessThan(0);
    expect(s.readout.leadCurrentsA.L1).toBeCloseTo(c.ammeter, 9); // E+ → K1
    expect(s.readout.ammeterDeg).toBeGreaterThan(METER_ZERO_DEG);
    expect(s.readout.voltmeterDeg).toBeGreaterThan(METER_ZERO_DEG);
  });

  it("deflects a reversed ammeter below zero, to the stop only past 1/16 of full scale", () => {
    // A moving-coil meter wired backwards deflects the wrong way (Nelkon & Parker, the
    // moving-coil meter). The −45° stop sits 5° below zero on an 80° scale: 1/16 of full scale.
    // At R = 60 Ω, I ≈ 0.047 A < 0.0625 A, so it rests between zero and the stop; at R = 0 it
    // is pinned at the stop by the physics, not by a script.
    const at60 = bench(P, inputs(reversedAmmeter(), { plugsIn: plugsFor(60) }), 3);
    expect(at60.readout.partCurrentsA.ammeter).toBeLessThan(0);
    const expected60 = METER_ZERO_DEG + (METER_SPAN_DEG * at60.readout.partCurrentsA.ammeter) / 1;
    expect(at60.readout.ammeterDeg).toBeCloseTo(expected60, 2);
    expect(at60.readout.ammeterDeg).toBeLessThan(METER_ZERO_DEG);
    expect(at60.readout.ammeterDeg).toBeGreaterThan(-METER_STOP_DEG);

    const at0 = bench(P, inputs(reversedAmmeter()), 3);
    expect(at0.readout.ammeterDeg).toBeCloseTo(-METER_STOP_DEG, 6);
    // The voltmeter is still the right way round.
    expect(at0.readout.voltmeterDeg).toBeGreaterThan(METER_ZERO_DEG);
  });

  it("sends the ammeter over range, flags a short and drains the cells faster when it is across XY", () => {
    // An ammeter (≈ 0.1 Ω) across XY with R = 0 short-circuits the cells: I ≈ E/(r + 0.1 Ω) is
    // well over 1 A (Nelkon & Parker, internal resistance and short circuit). Polarisation is
    // faster at higher current (docs/07 §4.2). The over-range needle slams the top stop.
    let slams = 0;
    let monotonic = true;
    const across = run(createOhmsLaw(P), inputs(ammeterAcrossWire()), 10, (st) => {
      if (st.readout.ammeterSlams < slams) monotonic = false;
      slams = st.readout.ammeterSlams;
    });
    expect(across.readout.partCurrentsA.ammeter).toBeGreaterThan(P.ammeter.fullScale);
    expect(across.readout.ammeterDeg).toBeCloseTo(METER_STOP_DEG, 6);
    expect(across.readout.ammeterSlams).toBeGreaterThanOrEqual(1);
    expect(monotonic).toBe(true);
    expect(across.readout.shortCircuit).toBe(true);

    const proper = bench(P, inputs(diagramLeads()), 10);
    expect(proper.readout.shortCircuit).toBe(false);
    expect(proper.readout.ammeterSlams).toBe(0);
    expect(across.readout.cellDrain01).toBeGreaterThan(proper.readout.cellDrain01);
  });

  it("passes about 1.07 mA and the voltmeter reads ≈ the emf, at or past full scale, when the meters are swapped", () => {
    // The voltmeter (R_V = 1 kΩ/V × 3 V = 3 kΩ) in series limits I to E/R_V: 3.2 V / 3 kΩ ≈
    // 1.07 mA with two fresh 1.6 V cells, and it reads nearly the whole emf, 3.2 V > 3 V full
    // scale (docs/plans/ohms-law-vi.md, science check; Nelkon & Parker, voltmeter resistance).
    const fresh = { ...P, cell: { ...P.cell, restEmfV: 1.6, polarisedEmfV: 1.4 } };
    const s = bench(fresh, inputs(swappedMeters()), 3);
    expect(Math.abs(s.readout.partCurrentsA.cells) * 1000).toBeCloseTo(1.07, 1);
    expect(s.readout.voltmeterDeg).toBeGreaterThanOrEqual(METER_FULL_DEG);
    // The ammeter across XY shows almost nothing: about 1 mA, a twentieth of a division.
    expect(dialReading(fresh.ammeter, s.readout.ammeterDeg)).toBeLessThan(fresh.ammeter.division);

    // With the weakest fresh cells (1.5 V each) it still reads within 0.2° of full scale:
    // 3.0 V × 3000/3004 Ω ≈ 2.996 V. Behaviour across seeds.
    for (let seed = 0; seed < 50; seed++) {
      const p = paramsFromSeed(seed);
      expect(bench(p, inputs(swappedMeters()), 3).readout.voltmeterDeg).toBeGreaterThan(
        METER_FULL_DEG - 0.2,
      );
    }
  });

  it("reads zero everywhere with the loop open", () => {
    // No closed circuit, no current (Anyakoha, New School Physics, the simple circuit).
    const open = bench(P, inputs(diagramLeads(), { keyClosed: false }), 2);
    const broken = bench(P, inputs(diagramLeads().filter((l) => l.id !== "L3")), 2);
    for (const s of [open, broken]) {
      expect(Object.values(s.readout.partCurrentsA).every((i) => i === 0)).toBe(true);
      expect(Object.values(s.readout.leadCurrentsA).every((i) => i === 0)).toBe(true);
      expect(s.readout.ammeterDeg).toBeCloseTo(METER_ZERO_DEG, 9);
      expect(s.readout.voltmeterDeg).toBeCloseTo(METER_ZERO_DEG, 9);
      expect(s.readout.cellDrain01).toBe(0);
      expect(s.wireRiseK).toBe(0);
    }
  });

  it("flickers through a loose joint, the same way every run for one seed", () => {
    // A loose terminal adds a varying contact resistance (Anyakoha, New School Physics,
    // precautions: "terminals were tightened"). The flicker sizes are illustrative, not from a
    // textbook: behaviour only. The flicker is a function of (seed, t, lead id), not Math.random.
    const loose = diagramLeads().map((l) =>
      l.id === "L4" ? { ...l, jointB: { tightened: false, clean: true } } : l,
    );
    const trace = () => {
      const degs: number[] = [];
      run(bench(P, inputs(loose), 1), inputs(loose), 3, (st) => degs.push(st.readout.ammeterDeg));
      return degs;
    };
    const divisionDeg = (METER_SPAN_DEG * P.ammeter.division) / P.ammeter.fullScale;
    const biggestRise = (degs: number[]) =>
      degs.reduce((m, d, k) => Math.max(m, d - Math.min(...degs.slice(0, k + 1))), 0);
    const a = trace();
    expect(Math.max(...a) - Math.min(...a)).toBeGreaterThan(2 * divisionDeg);
    // It wanders up as well as down: the needle rises by over a division at some point.
    expect(biggestRise(a)).toBeGreaterThan(divisionDeg);
    expect(trace()).toEqual(a);

    // Tight joints: once settled the needle only creeps down as the cells polarise, never up.
    const steady: number[] = [];
    run(bench(P, inputs(diagramLeads()), 2), inputs(diagramLeads()), 3, (st) =>
      steady.push(st.readout.ammeterDeg),
    );
    expect(biggestRise(steady)).toBeLessThan(1e-6);
  });

  it("gives V/I = R_XY ∥ R_V within 1% for all seven R values, through a line near the origin", () => {
    // V/I = R_XY ∥ R_V ≈ R_XY for every R, so the V–I graph is a straight line through the origin
    // with slope ≈ R_XY (Ohm's law; docs/plans/ohms-law-vi.md "Physics of the bench"; Nelkon &
    // Parker). Readings off the settled dials, as a perfect eye would take them.
    const expected = par(P.wire.ohm, P.voltmeter.ohm);
    const pts = R_VALUES.map((rOhm) => {
      const s = bench(P, inputs(diagramLeads(), { plugsIn: plugsFor(rOhm) }), 3);
      return [
        dialReading(P.ammeter, s.readout.ammeterDeg),
        dialReading(P.voltmeter, s.readout.voltmeterDeg),
      ] as const;
    });
    for (const [iA, vV] of pts) expect(Math.abs(vV / iA / expected - 1)).toBeLessThan(0.01);
    // Least-squares line V = sI + c.
    const n = pts.length;
    const sx = pts.reduce((a, [x]) => a + x, 0);
    const sy = pts.reduce((a, [, y]) => a + y, 0);
    const sxx = pts.reduce((a, [x]) => a + x * x, 0);
    const sxy = pts.reduce((a, [x, y]) => a + x * y, 0);
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const intercept = (sy - slope * sx) / n;
    expect(slope / expected).toBeCloseTo(1, 2);
    expect(Math.abs(intercept)).toBeLessThan(P.voltmeter.division / 10);
    // The readings fall as R rises (both columns).
    for (let k = 1; k < n; k++) {
      expect(pts[k]?.[0] ?? 0).toBeLessThan(pts[k - 1]?.[0] ?? 0);
      expect(pts[k]?.[1] ?? 0).toBeLessThan(pts[k - 1]?.[1] ?? 0);
    }
  });

  it("keeps I(R=0) ≤ 0.95 A and V ≤ 2.9 V with fresh cells for 300 seeds", () => {
    // Range check from docs/plans/ohms-law-vi.md ("Ammeter range"): R_XY 2.8–4.5 Ω, E ≤ 3.2 V,
    // r ≥ 0.6 Ω for the pair keep the ammeter on its 0–1 A scale and the voltmeter on 0–3 V.
    for (let seed = 0; seed < 300; seed++) {
      const p = paramsFromSeed(seed);
      const s = stepOhmsLaw(createOhmsLaw(p), inputs(diagramLeads()));
      expect(s.readout.partCurrentsA.ammeter).toBeLessThanOrEqual(0.95);
      expect(s.readout.partCurrentsA.voltmeter * p.voltmeter.ohm).toBeLessThanOrEqual(2.9);
      // And closing K at R = 0 never slams either needle.
      const settled = run(s, inputs(diagramLeads()), 2);
      expect(settled.readout.ammeterSlams + settled.readout.voltmeterSlams).toBe(0);
    }
  });

  it("warms XY by tens of kelvin at R = 0 but changes R_XY by at most 0.1%", () => {
    // Constantan α = 8 × 10⁻⁶ K⁻¹ (docs/07 §4.2; Kaye & Laby): even 100 K changes R by 0.08%,
    // below a half-division of either meter. The rise size depends on the illustrative cooling
    // coefficient, so it is checked as behaviour: it warms, then cools with the key open.
    const hot = bench(P, inputs(diagramLeads()), 20);
    expect(hot.wireRiseK).toBeGreaterThan(10);
    expect(hot.params.wire.alphaPerK * hot.wireRiseK).toBeLessThanOrEqual(1e-3);
    const cooled = run(hot, inputs(diagramLeads(), { keyClosed: false }), 20);
    expect(cooled.wireRiseK).toBeLessThan(hot.wireRiseK / 10);
  });

  it("offsets the rest angle by the seeded zero error, and the zero-adjust trim cancels it", () => {
    // A zero error of one division (0.02 A) moves the rest by 80° × 0.02 = 1.6°. Behaviour only.
    let seed = 0;
    while (paramsFromSeed(seed).ammeter.zeroError === 0) seed++;
    const p = paramsFromSeed(seed);
    const errDeg = (METER_SPAN_DEG * p.ammeter.zeroError) / p.ammeter.fullScale;
    expect(Math.abs(errDeg)).toBeCloseTo(1.6, 9);
    const fresh = createOhmsLaw(p);
    expect(fresh.readout.ammeterDeg).toBeCloseTo(METER_ZERO_DEG + errDeg, 9);
    const trimmed = bench(
      p,
      inputs([], { keyClosed: false, zeroTrimDeg: { ammeter: -errDeg, voltmeter: 0 } }),
      3,
    );
    expect(trimmed.readout.ammeterDeg).toBeCloseTo(METER_ZERO_DEG, 4);
  });

  it("drifts I(R=0) by about 0.010 A in 8 s and about 0.06 A in a minute with K left closed", () => {
    // The polarisation constant (300 s at 0.5 A) is ILLUSTRATIVE: no WAEC or textbook figure
    // exists; it is reasoned from zinc–carbon cells at heavy drain falling ~0.1 V over minutes
    // (params.ts). The lead's science check gives, for seed 3 at R = 0, ≈ 0.010 A in 8 s (under
    // one 0.02 A division while she reads) and ≈ 0.061 A in 58 s. Pinned to ±0.005 A.
    const i = inputs(diagramLeads());
    const first = stepOhmsLaw(createOhmsLaw(P), i);
    const i0 = first.readout.partCurrentsA.ammeter;
    const at8 = run(first, i, 8);
    const at58 = run(at8, i, 50);
    expect(i0 - at8.readout.partCurrentsA.ammeter).toBeCloseTo(0.0105, 2);
    expect(i0 - at8.readout.partCurrentsA.ammeter).toBeLessThan(P.ammeter.division);
    expect(i0 - at58.readout.partCurrentsA.ammeter).toBeCloseTo(0.062, 2);
    expect(at58.readout.cellDrain01).toBeGreaterThan(0.15);
  });

  it("lets the cells recover once the key is opened", () => {
    // Dry cells depolarise on open circuit (docs/07 §4.2; Nelkon & Parker, the Leclanché cell).
    // Recovery time constant 20 s (illustrative, as for the metre bridge): behaviour only.
    const on = bench(P, inputs(diagramLeads()), 60);
    expect(on.cells[0].emfV).toBeLessThan(P.cell.restEmfV);
    const off = run(on, inputs(diagramLeads(), { keyClosed: false }), 60);
    expect(off.readout.cellDrain01).toBeLessThan(on.readout.cellDrain01 / 10);
    expect(off.cells[0].emfV).toBeCloseTo(P.cell.restEmfV, 2);
    expect(off.cells[1].internalOhm).toBeCloseTo(P.cell.restInternalOhm, 1);
    // Closing K again gives nearly the first reading back.
    const again = stepOhmsLaw(off, inputs(diagramLeads()));
    const fresh = stepOhmsLaw(createOhmsLaw(P), inputs(diagramLeads()));
    expect(again.readout.partCurrentsA.ammeter).toBeCloseTo(fresh.readout.partCurrentsA.ammeter, 2);
  });

  it("keeps a needle finite when the zero trim or the reading is not a number", () => {
    // Guard, not physics: a bad trim counts as 0 and the needle settles on the true reading.
    const bad = inputs(diagramLeads(), {
      plugsIn: plugsFor(10),
      zeroTrimDeg: { ammeter: Number.NaN, voltmeter: Number.POSITIVE_INFINITY },
    });
    const good = inputs(diagramLeads(), { plugsIn: plugsFor(10) });
    const a = bench(P, bad, 2);
    const b = bench(P, good, 2);
    expect(Number.isFinite(a.readout.ammeterDeg)).toBe(true);
    expect(Number.isFinite(a.readout.voltmeterDeg)).toBe(true);
    expect(a.readout.ammeterDeg).toBeCloseTo(b.readout.ammeterDeg, 9);
    expect(a.readout.voltmeterDeg).toBeCloseTo(b.readout.voltmeterDeg, 9);
    // A non-finite target sends the needle to the zero reading, not to NaN.
    let n = { thetaDeg: 10, omegaDegPerS: 0, slammed: false };
    for (let k = 0; k < 600; k++) n = stepMeter(n, Number.NaN, P.ammeter.needle, 1 / 120);
    expect(n.thetaDeg).toBeCloseTo(METER_ZERO_DEG, 6);
    expect(meterTargetDeg(P.ammeter, Number.NaN, Number.NaN)).toBeCloseTo(METER_ZERO_DEG, 12);
  });

  it("uses the first lead when two leads share an id", () => {
    // Lead ids are unique (types.ts); on a repeat the first wins in the netlist and the
    // currents, so a duplicate never overwrites a real lead's current. Behaviour only.
    const leads = [...diagramLeads(), lead("L1", "E+", "E-")];
    const s = bench(P, inputs(leads, { plugsIn: plugsFor(10) }), 2);
    const ref = bench(P, inputs(diagramLeads(), { plugsIn: plugsFor(10) }), 2);
    expect(Object.keys(s.readout.leadCurrentsA)).toHaveLength(7);
    expect(s.readout.leadCurrentsA.L1).toBeCloseTo(ref.readout.partCurrentsA.ammeter, 9);
    expect(s.readout.partCurrentsA.ammeter).toBeCloseTo(ref.readout.partCurrentsA.ammeter, 9);
    expect(s.readout.shortCircuit).toBe(false);
  });
});

describe("determinism", () => {
  afterEach(() => vi.restoreAllMocks());

  it("gives the same bench for the same seed and inputs, and never calls Math.random or Date.now", () => {
    // .claude/rules/science-engine.md: same input → same output; noise from the seed only.
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random called");
    });
    vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Date.now called");
    });
    const script = (seed: number) => {
      const p = paramsFromSeed(seed);
      const loose = diagramLeads().map((l) =>
        l.id === "L2" ? { ...l, jointA: { tightened: true, clean: false } } : l,
      );
      const out: OhmsLawState["readout"][] = [];
      let s = createOhmsLaw(p);
      s = run(s, inputs(loose), 1, (st) => out.push(st.readout));
      s = run(s, inputs(loose, { plugsIn: plugsFor(20) }), 1, (st) => out.push(st.readout));
      run(s, inputs(ammeterAcrossWire()), 1, (st) => out.push(st.readout));
      return { params: p, out };
    };
    const a = script(11);
    expect(paramsFromSeed(11)).toEqual(a.params);
    expect(script(11)).toEqual(a);
    expect(script(12).out).not.toEqual(a.out);
  });
});
