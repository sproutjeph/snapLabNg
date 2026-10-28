import { describe, expect, it } from "vitest";
import { addResistor, addSource, createMnaCircuit, resetMna, solveMna } from "./mna";

describe("nodal analysis solver", () => {
  it("gives I = E/(R + r) and terminal p.d. E − Ir for a cell driving a resistor", () => {
    // E = 3.0 V, r = 1.0 Ω, R = 5.0 Ω: I = 3/6 = 0.50 A, V = 3 − 0.5 × 1 = 2.50 V
    // (Nelkon & Parker, Advanced Level Physics, e.m.f. and internal resistance;
    // Anyakoha, New School Physics, current electricity).
    const c = createMnaCircuit(2, 0);
    const cell = addSource(c, 1, 0, 3, 1);
    const r = addResistor(c, 1, 0, 5);
    solveMna(c);
    expect(c.currentA[r]).toBeCloseTo(0.5, 12);
    expect(c.currentA[cell]).toBeCloseTo(-0.5, 12); // + to − through the cell: it delivers
    expect(c.nodeV[1]).toBeCloseTo(2.5, 12);
  });

  it("adds series resistances and splits current in parallel by conductance", () => {
    // 6 V (r ≈ 0), 2 Ω in series with (3 Ω ∥ 6 Ω = 2 Ω): I = 6/4 = 1.5 A, split 1.0 A and 0.5 A
    // (Nelkon & Parker, Advanced Level Physics, resistors in series and parallel).
    const c = createMnaCircuit(3, 0);
    addSource(c, 1, 0, 6, 0);
    const rs = addResistor(c, 1, 2, 2);
    const r3 = addResistor(c, 2, 0, 3);
    const r6 = addResistor(c, 2, 0, 6);
    solveMna(c);
    expect(c.currentA[rs]).toBeCloseTo(1.5, 5);
    expect(c.currentA[r3]).toBeCloseTo(1.0, 5);
    expect(c.currentA[r6]).toBeCloseTo(0.5, 5);
    // Kirchhoff's first law at node 2: what flows in flows out.
    expect((c.currentA[rs] ?? 0) - (c.currentA[r3] ?? 0) - (c.currentA[r6] ?? 0)).toBeCloseTo(
      0,
      12,
    );
  });

  it("reports floating nodes and carries no current through them", () => {
    // A network with no path to the cell carries no current. No textbook value: behaviour only.
    const c = createMnaCircuit(5, 0);
    addSource(c, 1, 0, 1.5, 0.5);
    addResistor(c, 1, 0, 10);
    const island = addResistor(c, 3, 4, 100);
    solveMna(c);
    expect(c.floatingCount).toBe(3); // nodes 2, 3 and 4
    expect(Array.from(c.floating)).toEqual([0, 0, 1, 1, 1]);
    expect(c.currentA[island]).toBeCloseTo(0, 15);
  });

  it("grows past its element capacity and reuses its matrix after a reset", () => {
    // Ten 10 Ω resistors in parallel across 1 V (r ≈ 0) draw 1.0 A in total
    // (Nelkon & Parker, resistors in parallel).
    const c = createMnaCircuit(2, 0, 2);
    const matrix = c.matrix;
    for (let pass = 0; pass < 2; pass++) {
      resetMna(c);
      const src = addSource(c, 1, 0, 1, 0);
      for (let i = 0; i < 10; i++) addResistor(c, 1, 0, 10);
      solveMna(c);
      expect(c.currentA[src]).toBeCloseTo(-1, 4);
    }
    expect(c.matrix).toBe(matrix);
  });
});
