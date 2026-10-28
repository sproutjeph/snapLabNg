import { describe, expect, it } from "vitest";
import { compareWithDiagram, createOhmsLaw, paramsFromSeed } from "./api";
import { DIAGRAM_LEADS, type Lead, METER_ZERO_DEG } from "./types";

const joint = { tightened: true, clean: true };
const lead = (id: string, a: Lead["a"], b: Lead["b"]): Lead => ({
  id,
  a,
  b,
  jointA: joint,
  jointB: joint,
});

describe("diagram comparison", () => {
  it("matches when the seven leads of the diagram are made, in either direction", () => {
    const leads = DIAGRAM_LEADS.map(([a, b], i) =>
      i % 2 ? lead(`L${i}`, b, a) : lead(`L${i}`, a, b),
    );
    expect(compareWithDiagram(leads)).toMatchObject({ matches: true, missing: [], extra: [] });
  });

  it("lists the missing diagram leads and her extra ones", () => {
    const r = compareWithDiagram([lead("L1", "E+", "K1"), lead("L2", "E+", "E-")]);
    expect(r.matches).toBe(false);
    expect(r.missing).toHaveLength(6);
    expect(r.extra).toEqual(["L2"]);
  });
});

describe("a fresh bench", () => {
  it("rests both needles at the zero mark with no current anywhere", () => {
    const s = createOhmsLaw(paramsFromSeed(7));
    expect(s.readout.ammeterDeg).toBe(METER_ZERO_DEG);
    expect(s.readout.voltmeterDeg).toBe(METER_ZERO_DEG);
    expect(Object.values(s.readout.partCurrentsA).every((i) => i === 0)).toBe(true);
  });
});
