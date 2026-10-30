import { DIAGRAM_LEADS, TERMINAL_IDS, type TerminalId } from "@snaplab/engine";
import { describe, expect, it } from "vitest";
import { emptyOhmsLawRecord } from "../../readings/record";
import type { BenchState } from "../../types";
import { correctionFor, hintLine, showMeAllowed, type WrongTap } from "./guide";
import { OHMS_LAW_SCRIPT, TERMINAL_WORDS } from "./script";

// The Practise guide (docs/plans/wave-2-lean.md, slice 2a-script tests): corrections,
// the hint ladder and Show me, all spoken with no digits.

const S = OHMS_LAW_SCRIPT;
const isDiagramLead = (a: TerminalId, b: TerminalId) =>
  DIAGRAM_LEADS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

describe("ohms-law guide", () => {
  it("each wrong tap yields a spoken correction with no digits in it", () => {
    let checked = 0;
    for (const from of TERMINAL_IDS) {
      for (const to of TERMINAL_IDS) {
        if (from === to || isDiagramLead(from, to)) continue;
        const tap: WrongTap = { from, to };
        for (const line of [correctionFor(tap), correctionFor(tap, DIAGRAM_LEADS[0])]) {
          expect(line.trim().length, `${from}>${to}`).toBeGreaterThan(0);
          expect(line, `${from}>${to}`).not.toMatch(/\d/);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("names the mistake she actually made", () => {
    expect(correctionFor({ from: "E+", to: "E-" })).toContain("short circuit");
    expect(correctionFor({ from: "K2", to: "A-" })).toContain("wrong way round");
    expect(correctionFor({ from: "V+", to: "R2" })).toContain("across the resistance wire alone");
    expect(correctionFor({ from: "V-", to: "X" })).toContain("positive terminal goes to the end X");
    expect(correctionFor({ from: "X", to: "X" })).toContain("same terminal twice");
    // With the expected lead known, she is pointed at the right partner, still in words.
    const pointed = correctionFor({ from: "E+", to: "A+" }, DIAGRAM_LEADS[0]);
    expect(pointed).toContain("goes to the first terminal of the plug key");
    expect(pointed).not.toMatch(/\d/);
  });

  it("every non-exam beat has done() or is narration-only", () => {
    for (const b of S.beats) {
      const kind = b.act?.kind;
      if (kind === "lead" || kind === "plug" || kind === "key") {
        // She performs these on the bench, so Practise waits for done().
        expect(b.done, b.id).toBeDefined();
      } else {
        // Narration-only beats carry no done(): the director says them and moves on.
        expect(b.done, b.id).toBeUndefined();
      }
      expect(b.say.trim().length, b.id).toBeGreaterThan(0);
      expect(b.instruct.trim().length, b.id).toBeGreaterThan(0);
    }
  });

  it("each done() predicate flips when her bench reaches the beat's state", () => {
    const state = (over: Partial<BenchState>): BenchState => ({
      comparison: { matches: false, missing: DIAGRAM_LEADS, extra: [], issues: [] },
      keyClosed: false,
      boxSettingOhm: 0,
      record: emptyOhmsLawRecord("practice"),
      identified: new Set(),
      ...over,
    });
    const withMissing = (n: number) =>
      state({
        comparison: {
          matches: n === 0,
          missing: DIAGRAM_LEADS.slice(DIAGRAM_LEADS.length - n),
          extra: [],
          issues: [],
        },
      });
    const leads = S.beats.filter((b) => b.act?.kind === "lead");
    leads.forEach((b, i) => {
      // Not yet done while more than i+1 leads are missing; done once this lead exists.
      expect(b.done?.(withMissing(DIAGRAM_LEADS.length - i)), b.id).toBe(false);
      expect(b.done?.(withMissing(DIAGRAM_LEADS.length - (i + 1))), b.id).toBe(true);
    });
    for (const b of S.beats) {
      if (b.act?.kind === "plug") {
        const ohm = b.act.ohm;
        expect(b.done?.(state({ boxSettingOhm: ohm === 0 ? 5 : 0 })), b.id).toBe(false);
        expect(b.done?.(state({ boxSettingOhm: ohm })), b.id).toBe(true);
      }
      if (b.act?.kind === "key") {
        expect(b.done?.(state({ keyClosed: !b.act.closed })), b.id).toBe(false);
        expect(b.done?.(state({ keyClosed: b.act.closed })), b.id).toBe(true);
      }
    }
  });

  it("Show me never covers readings or the graph", () => {
    for (const b of S.beats) {
      if (b.showMe) expect(showMeAllowed(b), b.id).toBe(true);
      const kind = b.act?.kind;
      if (kind === "write" || kind === "plot" || kind === "line" || kind === "triangle") {
        expect(b.showMe, b.id).not.toBe(true);
        expect(showMeAllowed(b), b.id).toBe(false);
      }
    }
    // And the beats it covers are exactly the setup beats: every lead, plug and key beat.
    const setupIds = S.beats
      .filter((b) => b.act?.kind === "lead" || b.act?.kind === "plug" || b.act?.kind === "key")
      .map((b) => b.id);
    expect(S.beats.filter(showMeAllowed).map((b) => b.id)).toEqual(setupIds);
  });

  it("the hint ladder repeats, then points, then shows, with no digits", () => {
    const lead = S.beats.find((b) => b.act?.kind === "lead");
    if (!lead) throw new Error("a lead beat exists");
    expect(hintLine(lead, 1)).toBe(lead.instruct);
    const pointed = hintLine(lead, 2);
    expect(pointed).toContain("positive terminal of the cells");
    expect(pointed).not.toMatch(/\d/);
    expect(hintLine(lead, 3)).toContain("Watch how this one is done");
    // Every lead beat's pointing hint names its own two terminals, in words.
    for (const b of S.beats) {
      if (b.act?.kind !== "lead") continue;
      const line = hintLine(b, 2);
      expect(line, b.id).toContain(TERMINAL_WORDS[b.act.from]);
      expect(line, b.id).toContain(TERMINAL_WORDS[b.act.to]);
    }
    // A reading or graph beat has no Show me line: level three stays silent there.
    const writing = S.beats.find((b) => b.act?.kind === "write");
    expect(writing && hintLine(writing, 3)).toBeNull();
    // Level one repeats the instruction (question numbers and all); the pointing and
    // showing lines the guide adds itself carry no digits.
    for (const b of S.beats) {
      for (const level of [2, 3] as const) {
        const line = hintLine(b, level);
        if (line !== null) expect(line, `${b.id}:${level}`).not.toMatch(/\d/);
      }
    }
  });
});
