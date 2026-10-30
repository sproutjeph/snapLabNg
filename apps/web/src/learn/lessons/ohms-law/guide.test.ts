import type { OhmsLawGraph } from "@snaplab/contracts";
import { DIAGRAM_LEADS, TERMINAL_IDS, type TerminalId } from "@snaplab/engine";
import { describe, expect, it } from "vitest";
import { emptyOhmsLawRecord, setCell, setHeader, setLength } from "../../readings/record";
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
    let corrected = 0;
    let accepted = 0;
    for (const from of TERMINAL_IDS) {
      for (const to of TERMINAL_IDS) {
        if (from === to || isDiagramLead(from, to)) continue;
        const tap: WrongTap = { from, to };
        for (const line of [correctionFor(tap), correctionFor(tap, { expected: ["E+", "K1"] })]) {
          // A lead in some circuit the engine accepts gets no correction at all.
          if (line === null) {
            accepted++;
            continue;
          }
          expect(line.trim().length, `${from}>${to}`).toBeGreaterThan(0);
          expect(line, `${from}>${to}`).not.toMatch(/\d/);
          corrected++;
        }
      }
    }
    expect(corrected).toBeGreaterThan(50);
    expect(accepted).toBeGreaterThan(0);
  });

  it("correctionFor on a valid alternative series order returns no correction", () => {
    // The engine accepts any series order (compare.ts): cells, key, box, ammeter, wire here.
    const alternative: ReadonlyArray<readonly [TerminalId, TerminalId]> = [
      ["E+", "K1"],
      ["K2", "R1"],
      ["R2", "A+"],
      ["A-", "X"],
      ["Y", "E-"],
      ["V+", "X"],
      ["V-", "Y"],
    ];
    for (const [from, to] of alternative) {
      expect(correctionFor({ from, to }), `${from}>${to}`).toBeNull();
    }
    for (const [from, to] of DIAGRAM_LEADS) {
      expect(correctionFor({ from, to }), `${from}>${to}`).toBeNull();
    }
  });

  it("judges polarity from the loop she has built, not from fixed pairs", () => {
    // Key then box, then a tap into the ammeter's negative terminal: reversed, in her loop.
    const reversed = correctionFor(
      { from: "R2", to: "A-" },
      {
        leads: [
          ["E+", "K1"],
          ["K2", "R1"],
        ],
      },
    );
    expect(reversed).toContain("wrong way round");
    expect(reversed).toContain("towards the positive terminal of the cells");
    expect(reversed).not.toMatch(/\d/);
    // The diagram's loop puts X on the high side; V- tapped there is a reversed voltmeter.
    const vReversed = correctionFor({ from: "V-", to: "X" }, { leads: DIAGRAM_LEADS.slice(0, 5) });
    expect(vReversed).toContain("voltmeter is the wrong way round");
    // Without that loop, the same tap is a valid alternative and earns no correction.
    expect(correctionFor({ from: "V-", to: "X" })).toBeNull();
  });

  it("names the mistake she actually made", () => {
    expect(correctionFor({ from: "E+", to: "E-" })).toContain("short circuit");
    expect(correctionFor({ from: "E+", to: "A-" })).toContain("wrong way round");
    expect(correctionFor({ from: "V+", to: "R2" })).toContain("across the resistance wire alone");
    expect(correctionFor({ from: "X", to: "X" })).toContain("same terminal twice");
    // With the expected lead known, she is pointed at the right partner, still in words.
    const pointed = correctionFor({ from: "R1", to: "R2" }, { expected: ["A-", "R1"] });
    expect(pointed).toContain("goes to the negative terminal of the ammeter");
    expect(pointed).not.toMatch(/\d/);
  });

  it("every non-exam beat has done() or is narration-only", () => {
    for (const b of S.beats) {
      const kind = b.act?.kind;
      if (
        kind === "lead" ||
        kind === "plug" ||
        kind === "key" ||
        kind === "write" ||
        kind === "plot" ||
        kind === "line" ||
        kind === "triangle"
      ) {
        // Bench and notebook beats alike: Practise waits for done(), never skips past her.
        expect(b.done, b.id).toBeDefined();
      } else {
        // Only the entrance and the loupe beats are narration-only.
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
    // Notebook beats flip on what she has written, rows matched by their R value.
    const beat = (id: string) => {
      const b = S.beats.find((x) => x.id === id);
      if (!b?.done) throw new Error(id);
      return b.done;
    };
    const withRecord = (record: BenchState["record"]) => state({ record });
    expect(beat("rule-write")(withRecord(emptyOhmsLawRecord("practice")))).toBe(false);
    expect(beat("rule-write")(withRecord(setLength(emptyOhmsLawRecord("practice"), "85.0")))).toBe(
      true,
    );
    expect(beat("head-I")(withRecord(setHeader(emptyOhmsLawRecord("practice"), "I", "I/A")))).toBe(
      true,
    );
    const rowWritten = setCell(
      setCell(emptyOhmsLawRecord("practice"), 0, "R", "0"),
      0,
      "I",
      "0.55",
    );
    expect(beat("row-1-i")(withRecord(emptyOhmsLawRecord("practice")))).toBe(false);
    expect(beat("row-1-i")(withRecord(rowWritten))).toBe(true);
    // The current alone, in a row whose R was never written, does not count.
    expect(
      beat("row-1-i")(withRecord(setCell(emptyOhmsLawRecord("practice"), 0, "I", "0.55"))),
    ).toBe(false);
    const graph = (over: Partial<OhmsLawGraph>): OhmsLawGraph => ({
      sheet: { width_cm: 26, height_cm: 18 },
      x: { label_as_written: "I/A", scale_as_written: null, units_per_cm: null, origin_value: 0 },
      y: { label_as_written: "V/V", scale_as_written: null, units_per_cm: null, origin_value: 0 },
      points: [],
      line: null,
      triangle: null,
      delta_y_as_written: null,
      delta_x_as_written: null,
      slope_as_written: null,
      ...over,
    });
    const withGraph = (g: OhmsLawGraph) =>
      withRecord({ ...emptyOhmsLawRecord("practice"), graph: g });
    expect(beat("plot-1")(withGraph(graph({})))).toBe(false);
    expect(beat("plot-1")(withGraph(graph({ points: [{ x_cm: 1, y_cm: 1 }] })))).toBe(true);
    expect(beat("line")(withGraph(graph({})))).toBe(false);
    expect(
      beat("line")(
        withGraph(graph({ line: { p1: { x_cm: 0, y_cm: 0 }, p2: { x_cm: 1, y_cm: 1 } } })),
      ),
    ).toBe(true);
    expect(beat("slope")(withGraph(graph({})))).toBe(false);
    expect(beat("slope")(withGraph(graph({ slope_as_written: "3.0 Ω" })))).toBe(true);
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

  it("the hint ladder stays silent, then points, then shows, with no digits", () => {
    const lead = S.beats.find((b) => b.act?.kind === "lead");
    if (!lead) throw new Error("a lead beat exists");
    // Level one adds nothing: the director already repeats the instruction there.
    expect(hintLine(lead, 1)).toBeNull();
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
    // Given the first lead she has not made, the hint names that lead, not this beat's.
    const third = S.beats.find((b) => b.id === "lead-3");
    if (!third) throw new Error("lead-3 exists");
    const redirected = hintLine(third, 2, ["E+", "K1"]);
    expect(redirected).toContain(TERMINAL_WORDS["E+"]);
    expect(redirected).toContain(TERMINAL_WORDS.K1);
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
