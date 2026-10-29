import { describe, expect, it } from "vitest";
import { SAMPLE_SCRIPT } from "./sampleScript";
import {
  actDurationS,
  ENTER_DROP_S,
  ENTER_STAGGER_S,
  LEAD_S,
  LEAD_TAP_AT,
  leadPhase,
  NIB_TRAVEL_S,
  PLUG_EACH_S,
  partsEnteredBefore,
  voiceCapS,
} from "./timing";

// The numbers are screen choices (docs/plans/exam-redesign-brief.md, research report 2); these
// tests pin the behaviour the scene relies on.

describe("leadPhase", () => {
  it("heads for the first terminal, then the second, then draws the lead in", () => {
    expect(leadPhase(0)).toEqual({ nibAt: "from", tapped: 0, drawn: 0 });
    expect(leadPhase(LEAD_TAP_AT[0])).toEqual({ nibAt: "to", tapped: 1, drawn: 0 });
    expect(leadPhase(LEAD_TAP_AT[1])).toEqual({ nibAt: "to", tapped: 2, drawn: 0 });
    expect(leadPhase(1)).toEqual({ nibAt: "to", tapped: 2, drawn: 1 });
    const mid = leadPhase((LEAD_TAP_AT[1] + 1) / 2);
    expect(mid.drawn).toBeCloseTo(0.5, 10);
  });
});

describe("actDurationS", () => {
  it("a lead takes its fixed time, and several parts take one drop plus a stagger each", () => {
    expect(actDurationS({ kind: "lead", from: "E+", to: "K1" })).toBe(LEAD_S);
    const one = actDurationS({ kind: "enter", parts: ["cells"] });
    const six = actDurationS({
      kind: "enter",
      parts: ["cells", "key", "ammeter", "box", "wire", "voltmeter"],
    });
    expect(six - one).toBeCloseTo(5 * ENTER_STAGGER_S, 10);
    expect(one).toBeGreaterThanOrEqual(ENTER_DROP_S);
  });

  it("a plug action grows with the plugs it moves", () => {
    const act = { kind: "plug", ohm: 10 } as const;
    expect(actDurationS(act, 3) - actDurationS(act, 1)).toBeCloseTo(2 * PLUG_EACH_S, 10);
    expect(actDurationS(act, 0)).toBeCloseTo(NIB_TRAVEL_S + PLUG_EACH_S, 10);
  });

  it("writing takes longer for longer text, but never past the cap", () => {
    const act = { kind: "write", field: { kind: "law" }, value: { text: "" } } as const;
    expect(actDurationS(act, 1, 40)).toBeGreaterThan(actDurationS(act, 1, 4));
    expect(actDurationS(act, 1, 4000)).toBe(2.5);
  });

  it("a wait takes the seconds it names", () => {
    expect(actDurationS({ kind: "wait", s: 1.5 })).toBe(1.5);
  });
});

describe("voiceCapS", () => {
  it("is nothing for no words, and longer than the speech estimate for some", () => {
    expect(voiceCapS("  ")).toBe(0);
    expect(voiceCapS("Close the key.")).toBeGreaterThan(1);
    expect(voiceCapS("Close the key and read both meters, one after the other.")).toBeGreaterThan(
      voiceCapS("Close the key."),
    );
  });
});

describe("partsEnteredBefore", () => {
  it("lists the parts of every earlier enter action, and none from the current beat", () => {
    expect(partsEnteredBefore(SAMPLE_SCRIPT, 0).size).toBe(0);
    expect(partsEnteredBefore(SAMPLE_SCRIPT, 1).size).toBe(6);
    expect(partsEnteredBefore(SAMPLE_SCRIPT, 1000).has("box")).toBe(true);
  });
});
