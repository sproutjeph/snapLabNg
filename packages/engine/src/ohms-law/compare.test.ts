import { describe, expect, it } from "vitest";
import { compareWithDiagram } from "./compare";
import { diagramLeads, lead } from "./test-helpers";
import type { Lead } from "./types";

// Electrical equivalence with the corrected diagram (docs/plans/ohms-law-vi.md, slot 1): one
// series loop E, K, A, R, XY in any order, V across XY, A+ towards E+ and V+ on the high side.
// The rules here are circuit topology (Anyakoha, New School Physics: an ammeter is connected
// in series, a voltmeter in parallel, + terminal to the + side of the supply).

const ids = (leads: Lead[]) => leads.map((l) => l.id);

describe("compareWithDiagram", () => {
  it("matches a different series order with the ammeter on the return side", () => {
    // E+ → K → R → X–Y → A → E−: the same single loop, A+ still faces E+ along it.
    const leads = [
      lead("a", "E+", "K1"),
      lead("b", "K2", "R1"),
      lead("c", "R2", "X"),
      lead("d", "Y", "A+"),
      lead("e", "A-", "E-"),
      lead("f", "V+", "X"),
      lead("g", "V-", "Y"),
    ];
    expect(compareWithDiagram(leads)).toEqual({
      matches: true,
      missing: [],
      extra: [],
      issues: [],
    });
  });

  it("matches the wire turned round with V+ on Y, and a box turned round", () => {
    // XY and the box are non-polar; the voltmeter's + must be on the end nearer E+.
    const leads = [
      lead("a", "E+", "A+"),
      lead("b", "A-", "K2"),
      lead("c", "K1", "R2"),
      lead("d", "R1", "Y"),
      lead("e", "X", "E-"),
      lead("f", "V+", "Y"),
      lead("g", "V-", "X"),
    ];
    expect(compareWithDiagram(leads).matches).toBe(true);
  });

  it("matches V+ taken from R2 instead of X, since R2 and X are one node", () => {
    const leads = diagramLeads().map((l) => (l.a === "V+" ? { ...l, b: "R2" as const } : l));
    expect(compareWithDiagram(leads).matches).toBe(true);
  });

  it("names a reversed ammeter", () => {
    const leads = diagramLeads().map((l) =>
      l.b === "A+" ? { ...l, b: "A-" as const } : l.a === "A-" ? { ...l, a: "A+" as const } : l,
    );
    const r = compareWithDiagram(leads);
    expect(r.matches).toBe(false);
    expect(r.issues).toEqual(["ammeter_reversed"]);
    expect(ids(leads).filter((id) => r.extra.includes(id))).toEqual(["L2", "L3"]);
    expect(r.missing).toHaveLength(2);
  });

  it("names a reversed voltmeter", () => {
    const leads = [
      ...diagramLeads().filter((l) => !l.a.startsWith("V")),
      lead("V1", "V+", "Y"),
      lead("V2", "V-", "X"),
    ];
    expect(compareWithDiagram(leads).issues).toEqual(["voltmeter_reversed"]);
  });

  it("names swapped meters: the voltmeter in series and the ammeter in parallel", () => {
    const leads = [
      lead("a", "E+", "K1"),
      lead("b", "K2", "V+"),
      lead("c", "V-", "R1"),
      lead("d", "R2", "X"),
      lead("e", "Y", "E-"),
      lead("f", "A+", "X"),
      lead("g", "A-", "Y"),
    ];
    const r = compareWithDiagram(leads);
    expect(r.matches).toBe(false);
    expect(r.issues).toEqual(["ammeter_in_parallel", "voltmeter_in_series"]);
  });

  it("names an open loop when a lead is missing", () => {
    const r = compareWithDiagram(diagramLeads().filter((l) => l.id !== "L4"));
    expect(r.matches).toBe(false);
    expect(r.issues).toContain("open_loop");
    expect(r.missing).toEqual([["R2", "X"]]);
  });

  it("names a voltmeter across the box instead of the wire", () => {
    const leads = [
      ...diagramLeads().filter((l) => !l.a.startsWith("V")),
      lead("V1", "V+", "R1"),
      lead("V2", "V-", "R2"),
    ];
    expect(compareWithDiagram(leads).issues).toEqual(["voltmeter_not_across_wire"]);
  });

  it("names a short circuit for a lead straight across the cells", () => {
    const r = compareWithDiagram([...diagramLeads(), lead("S", "E+", "E-")]);
    expect(r.matches).toBe(false);
    expect(r.issues).toContain("short_circuit");
    expect(r.extra).toEqual(["S"]);
  });

  it("does not match when a lead bypasses the box, though no named issue applies", () => {
    // The box is shorted out of the loop: the meters read, but R cannot be set.
    const r = compareWithDiagram([...diagramLeads(), lead("B", "R1", "R2")]);
    expect(r.matches).toBe(false);
    expect(r.extra).toEqual(["B"]);
  });
});
