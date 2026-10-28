import { compareWithDiagram, DIAGRAM_LEADS, type Lead, PART_TERMINALS } from "@snaplab/engine";
import { describe, expect, it } from "vitest";
import { madeLeadKeys } from "./CircuitDiagram";
import { diagramLeadKey, OHMS_LAW_DIAGRAM_SVG } from "./diagram";

// The corrected diagram (docs/plans/ohms-law-vi.md, "The question": E → K → A → R → X–Y → E,
// V across X and Y). No textbook value applies; these check the drawing's structure only.

const good = { tightened: true, clean: true };
const lead = (id: string, a: Lead["a"], b: Lead["b"]): Lead => ({
  id,
  a,
  b,
  jointA: good,
  jointB: good,
});

describe("OHMS_LAW_DIAGRAM_SVG", () => {
  it("has one data-lead line for each diagram lead, the pair sorted", () => {
    const keys = [...OHMS_LAW_DIAGRAM_SVG.matchAll(/data-lead="([^"]+)"/g)].map((m) => m[1]);
    const want = DIAGRAM_LEADS.map(([a, b]) => diagramLeadKey(a, b));
    expect([...keys].sort()).toEqual([...want].sort());
    for (const k of keys) {
      const [a, b] = (k ?? "").split("|");
      expect((a ?? "") < (b ?? "")).toBe(true);
    }
  });

  it("has a data-part symbol for each part in the circuit", () => {
    const parts = [...OHMS_LAW_DIAGRAM_SVG.matchAll(/data-part="([^"]+)"/g)].map((m) => m[1]);
    expect([...parts].sort()).toEqual(Object.keys(PART_TERMINALS).sort());
  });

  it("labels E, K, A, R, X, Y and V and prints no value", () => {
    const labels = [...OHMS_LAW_DIAGRAM_SVG.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(
      (m) => m[1],
    );
    for (const l of ["E", "K", "A", "R", "X", "Y", "V"]) expect(labels).toContain(l);
    for (const l of labels) expect(l).not.toMatch(/\d|Ω/);
  });
});

describe("madeLeadKeys", () => {
  it("is empty with no comparison (the plain diagram)", () => {
    expect(madeLeadKeys(null).size).toBe(0);
  });

  it("marks the diagram leads she has made, and every lead once her circuit matches", () => {
    const two = compareWithDiagram([lead("L1", "K1", "E+"), lead("L2", "V+", "X")]);
    expect([...madeLeadKeys(two)].sort()).toEqual(["E+|K1", "V+|X"]);

    const all = compareWithDiagram(DIAGRAM_LEADS.map(([a, b], i) => lead(`L${i}`, a, b)));
    expect(all.matches).toBe(true);
    expect(madeLeadKeys(all).size).toBe(DIAGRAM_LEADS.length);
  });
});
