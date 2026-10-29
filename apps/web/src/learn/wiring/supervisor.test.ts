import { DIAGRAM_LEADS, DT_S, displayedValue } from "@snaplab/engine";
import { describe, expect, it } from "vitest";
import { createOhmsLawBench, NEEDLE_SETTLED_DEG_PER_S, NEEDLE_SETTLED_HOLD_S } from "./bench";

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

  it("never reads or logs the overshoot's turning point: the needle must stay still 0.25 s", () => {
    // No textbook figure: behaviour only. The needle (ζ = 0.7) overshoots once; at its turning
    // point |ω| dips below NEEDLE_SETTLED_DEG_PER_S for a step or two, then it swings back. ω is
    // read off the readout as Δθ/Δt, exact for the engine's semi-implicit Euler step.
    const holdSteps = Math.round(NEEDLE_SETTLED_HOLD_S / DT_S);
    const b = wired(1);
    b.togglePlug(0);
    run(b, 1);
    b.toggleKey();
    const deg = () => [b.visual.current.readout.ammeterDeg, b.visual.current.readout.voltmeterDeg];
    let prev = deg();
    let stillRun = 0; // consecutive steps with both needles below the settled speed
    let turningText: string | null = null;
    for (let i = 0; i < 5 * 120; i++) {
      const before = b.supervisor.log().length;
      b.advance(DT_S);
      const now = deg();
      const still = now.every(
        (d, k) => Math.abs((d - (prev[k] ?? d)) / DT_S) < NEEDLE_SETTLED_DEG_PER_S,
      );
      prev = now;
      if (!still && stillRun > 0 && stillRun < holdSteps && turningText === null) {
        // It was still for under the hold, then moved again: that was the overshoot's turn.
        turningText = displayedValue(b.params.ammeter, now[0] ?? 0).toFixed(2);
      }
      stillRun = still ? stillRun + 1 : 0;
      if (stillRun < holdSteps) {
        expect(b.supervisor.reading("ammeter")).toBeNull();
        expect(b.supervisor.reading("voltmeter")).toBeNull();
        expect(b.supervisor.log().length).toBe(before);
      }
    }
    // The run did pass a turning point, and nothing near what the dial showed there was logged.
    expect(turningText).not.toBeNull();
    const logged = b.supervisor.log().map((e) => e.iShown);
    expect(logged.length).toBeGreaterThan(0);
    expect(logged).not.toContain(turningText);
  });

  it("reads a −1 division ammeter zero error at rest as -0.02", () => {
    // paramsFromSeed seeds an ammeter zero error of 0 or ±1 division of 0.02 A
    // (docs/plans/ohms-law-vi.md, the paramsFromSeed line; packages/engine/src/ohms-law/params.ts).
    // At rest the needle sits on −0.02 A, which she must be able to read and correct for.
    let seed = 1;
    while (createOhmsLawBench(seed).params.ammeter.zeroError >= 0) seed++;
    const b = createOhmsLawBench(seed);
    expect(b.params.ammeter.zeroError).toBeCloseTo(-0.02, 12);
    run(b, 1);
    expect(b.supervisor.reading("ammeter")).toBe("-0.02");
    expect(b.supervisor.reading("voltmeter")).toBe("0.00");
  });
});
