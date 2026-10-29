import { DIAGRAM_LEADS } from "@snaplab/engine";
import { describe, expect, it } from "vitest";
import { createOhmsLawBench } from "./bench";

// The bench supervisor (docs/plans/exam-redesign.md, "Where bench truth lives"). The values
// themselves are the engine's (displayedValue, effectiveXyOhm, tested there with sources); these
// tests check the controller's gating, logging and retention.

type Bench = ReturnType<typeof createOhmsLawBench>;

function wired(seed: number): Bench {
  const b = createOhmsLawBench(seed);
  for (const [a, c] of DIAGRAM_LEADS) {
    b.tapTerminal(a);
    b.tapTerminal(c);
  }
  return b;
}

function run(b: Bench, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) b.advance(1 / 60);
}

describe("bench supervisor", () => {
  it("shows no reading while the needle moves, then a 2 d.p. text once it settles", () => {
    const b = wired(11);
    b.togglePlug(0);
    run(b, 5);
    expect(b.supervisor.reading("ammeter")).toMatch(/^\d\.\d\d$/);
    b.toggleKey();
    run(b, 0.05);
    expect(b.supervisor.reading("ammeter")).toBeNull();
    run(b, 10);
    expect(b.supervisor.reading("ammeter")).toMatch(/^\d\.\d\d$/);
  });

  it("logs nothing while the key is open", () => {
    const b = wired(11);
    run(b, 5);
    expect(b.supervisor.log()).toHaveLength(0);
  });

  it("logs only settled pairs at the box setting, newest last, and keeps them across reset", () => {
    const b = wired(11);
    b.togglePlug(0);
    b.toggleKey();
    run(b, 60);
    const log = b.supervisor.log();
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((e) => e.boxOhm === b.boxSettingOhm)).toBe(true);
    const last = log[log.length - 1];
    expect(last?.iShown).toBe(b.supervisor.reading("ammeter"));
    expect(last?.vShown).toBe(b.supervisor.reading("voltmeter"));
    const n = log.length;
    b.reset();
    expect(b.supervisor.log()).toHaveLength(n);
  });

  it("logs nothing when the leads are not the diagram's circuit, key closed", () => {
    const b = createOhmsLawBench(11);
    b.tapTerminal("E+");
    b.tapTerminal("K1");
    b.toggleKey();
    run(b, 20);
    expect(b.comparison.matches).toBe(false);
    expect(b.supervisor.log()).toHaveLength(0);
  });

  it("reports the wire length to 1 d.p. and the engine's effective resistance", () => {
    const b = createOhmsLawBench(11);
    expect(b.supervisor.lengthText()).toBe(b.params.wire.lengthCm.toFixed(1));
    expect(b.supervisor.effectiveOhm()).toBeGreaterThan(0);
  });
});
