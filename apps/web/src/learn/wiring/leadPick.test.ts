import { DIAGRAM_LEADS } from "@snaplab/engine";
import { describe, expect, it, vi } from "vitest";
import { LEAD_HIT_PX, leadHitRadius, leadHitRange } from "../../apparatus/ohms-law/Lead";
import { WRONG_LEAD_TAIL } from "../LearnPage";
import { createOhmsLawBench } from "./bench";
import {
  CHIP_LINGER_S,
  chipTarget,
  createLeadPicks,
  HINT_TEXT,
  hintFirstLead,
  hoverLead,
  leadLit,
  REMOVE_TEXT,
  tapLead,
} from "./leadPick";
import { watchWrongTaps } from "./wrongTap";

// Taking a lead off, made easy to find (the user, PR #100: "can it be clear?"). No textbook
// source: interaction, not science.

// Where each nut is in plan, metres (apparatus/ohms-law/kitParams.test.ts NUT_M).
const NUT: Readonly<Record<string, readonly [number, number]>> = {
  "E+": [0.3318, -0.06],
  "E-": [0.4682, -0.06],
  K1: [0.031, -0.06],
  K2: [-0.031, -0.06],
  "A+": [-0.115, 0.185],
  "A-": [-0.185, 0.185],
  "V+": [0.185, 0.185],
  "V-": [0.115, 0.185],
  R1: [-0.25, -0.066],
  R2: [-0.51, -0.066],
  X: [-0.256, -0.265],
  Y: [0.2803, -0.265],
};

describe("a lead's tap target", () => {
  it("a lead hit target exists along each lead and removing it calls the bench's remove", () => {
    // Along the middle of every diagram lead (and a short circuit across the cells), never empty.
    const pairs = [...DIAGRAM_LEADS, ["E+", "E-"] as const];
    for (const [a, b] of pairs) {
      const [ax, az] = NUT[a] ?? [0, 0];
      const [bx, bz] = NUT[b] ?? [0, 0];
      const [t0, t1] = leadHitRange(Math.hypot(bx - ax, bz - az));
      expect(t0, `${a}-${b}`).toBeLessThan(0.5);
      expect(t1, `${a}-${b}`).toBeGreaterThan(0.5);
      expect(t1 - t0, `${a}-${b}`).toBeGreaterThanOrEqual(0.2);
    }
    // Fat enough to hit: 32 px across on a laptop's bench shot; on a phone's, as fat as it may be
    // without reaching the nuts (2 cm), which is still bigger than the old 7 mm.
    const laptop = 0.0008;
    expect((2 * leadHitRadius(laptop)) / laptop).toBeGreaterThanOrEqual(LEAD_HIT_PX - 1);
    expect(leadHitRadius(0.0026)).toBeCloseTo(0.02, 9);
    expect(leadHitRadius(0.0026)).toBeGreaterThan(0.007);
    // A click on it removes the lead through the bench's own remove.
    const bench = { removeLead: vi.fn() };
    const picks = createLeadPicks();
    expect(tapLead(bench, picks, "L1", "mouse")).toBe("remove");
    expect(bench.removeLead).toHaveBeenCalledWith("L1");
    // A finger's first tap selects (lit, with the Remove chip), the second removes.
    expect(tapLead(bench, picks, "L2", "touch")).toBe("select");
    expect(bench.removeLead).toHaveBeenCalledTimes(1);
    expect(leadLit(picks, "L2", 0)).toBe(true);
    expect(chipTarget(picks, 0)).toEqual({ id: "L2", label: REMOVE_TEXT, removes: true });
    expect(tapLead(bench, picks, "L2", "touch")).toBe("remove");
    expect(bench.removeLead).toHaveBeenLastCalledWith("L2");
    expect(chipTarget(picks, 0)).toBeNull();
  });

  it("lights a hovered lead with its Remove chip, which lingers long enough to reach", () => {
    const p = createLeadPicks();
    hoverLead(p, "L1", true, 10);
    expect(leadLit(p, "L1", 10)).toBe(true);
    hoverLead(p, "L1", false, 10);
    expect(chipTarget(p, 10 + CHIP_LINGER_S / 2)?.id).toBe("L1");
    expect(chipTarget(p, 10 + CHIP_LINGER_S + 0.01)).toBeNull();
    p.overChip = true;
    expect(chipTarget(p, 99)?.id).toBe("L1");
  });

  it("shows 'Tap a wire to remove it' on her first lead, once", () => {
    const p = createLeadPicks();
    hintFirstLead(p, "L1", 0);
    expect(chipTarget(p, 1)).toEqual({ id: "L1", label: HINT_TEXT, removes: false });
    expect(leadLit(p, "L1", 1)).toBe(false);
    expect(chipTarget(p, 5)).toBeNull();
    hintFirstLead(p, "L2", 6);
    expect(chipTarget(p, 6)).toBeNull();
  });
});

describe("a wrong lead", () => {
  it("after a wrong lead, a tap on that lead removes it", () => {
    const bench = createOhmsLawBench(7);
    const picks = createLeadPicks();
    const said: string[] = [];
    // As the page wires it (LearnPage): the wrong lead is selected and the line ends with the tail.
    const off = watchWrongTaps(bench, {
      expected: () => ["E+", "K1"],
      onWrong: (line, _ends, id) => {
        picks.selected = id;
        said.push(`${line} ${WRONG_LEAD_TAIL}`);
      },
    });
    bench.tapTerminal("E+");
    bench.tapTerminal("E-");
    expect(bench.visual.current.leads.length).toBe(1);
    expect(said[0]?.endsWith("Tap the wire to remove it.")).toBe(true);
    const id = bench.visual.current.leads[0]?.id ?? "";
    expect(picks.selected).toBe(id);
    // One tap, even a finger's: it is already picked.
    expect(tapLead(bench, picks, id, "touch")).toBe("remove");
    expect(bench.visual.current.leads.length).toBe(0);
    off();
  });
});
