import {
  DIAGRAM_LEADS,
  DT_S,
  MAX_LEADS_PER_TERMINAL,
  METER_ZERO_DEG,
  paramsFromSeed,
  type TerminalId,
} from "@snaplab/engine";
import { describe, expect, it } from "vitest";
import type { ProcedureNote } from "../types";
import { createOhmsLawBench, KEY_LEFT_CLOSED_S, MAX_STEPS_PER_ADVANCE, NOTE_TEXT } from "./bench";

// The V–I bench controller (docs/plans/ohms-law-vi.md, "Wave 2 → Wiring"). These tests check
// controller behaviour: lead rules, undo, hints, notes and the fixed step. The physics itself is
// tested in packages/engine (with its sources); here a reading is only ever compared with
// another reading or with the dial's zero, never with a textbook value, so no source applies.

type Bench = ReturnType<typeof createOhmsLawBench>;

function wire(b: Bench, pairs: ReadonlyArray<readonly [TerminalId, TerminalId]>): void {
  for (const [a, c] of pairs) {
    b.tapTerminal(a);
    b.tapTerminal(c);
  }
}

/** Runs `seconds` of real time in 60 Hz frames. */
function run(b: Bench, seconds: number): void {
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) b.advance(1 / 60);
}

const kinds = (b: Bench) => b.notes.map((n: ProcedureNote) => n.kind);
const count = (b: Bench, k: ProcedureNote["kind"]) => kinds(b).filter((x) => x === k).length;

/** The diagram with the ammeter's two leads swapped at its terminals. */
const REVERSED_AMMETER: ReadonlyArray<readonly [TerminalId, TerminalId]> = [
  ["E+", "K1"],
  ["K2", "A-"],
  ["A+", "R1"],
  ["R2", "X"],
  ["Y", "E-"],
  ["V+", "X"],
  ["V-", "Y"],
];

/** Ammeter across XY, the gap it left in the loop closed by a lead (the engine's own case). */
const AMMETER_ACROSS_XY: ReadonlyArray<readonly [TerminalId, TerminalId]> = [
  ["E+", "K1"],
  ["K2", "R1"],
  ["R2", "X"],
  ["Y", "E-"],
  ["A+", "X"],
  ["A-", "Y"],
  ["V+", "X"],
  ["V-", "Y"],
];

describe("createOhmsLawBench: leads", () => {
  it("starts a lead on the first tap and finishes it on a second nut", () => {
    const b = createOhmsLawBench(1);
    b.tapTerminal("E+");
    expect(b.visual.current.pendingFrom).toBe("E+");
    expect(b.visual.current.leads).toHaveLength(0);
    b.tapTerminal("K1");
    expect(b.visual.current.pendingFrom).toBeNull();
    const [l] = b.visual.current.leads;
    expect(l).toMatchObject({ a: "E+", b: "K1", colour: "red" });
    expect(l?.jointA).toEqual({ tightened: true, clean: true });
    expect(l?.jointB).toEqual({ tightened: true, clean: true });
  });

  it("cancels the pending lead when the same nut is tapped again", () => {
    const b = createOhmsLawBench(1);
    b.tapTerminal("A+");
    b.tapTerminal("A+");
    expect(b.visual.current.pendingFrom).toBeNull();
    expect(b.visual.current.leads).toHaveLength(0);
  });

  it("cycles the lead colours red, black, yellow", () => {
    const b = createOhmsLawBench(1);
    wire(b, DIAGRAM_LEADS.slice(0, 4));
    expect(b.visual.current.leads.map((l) => l.colour)).toEqual(["red", "black", "yellow", "red"]);
    expect(b.nextColour).toBe("black");
  });

  it(`takes at most ${MAX_LEADS_PER_TERMINAL} lead ends at a nut and ignores taps on a full one`, () => {
    const b = createOhmsLawBench(1);
    wire(b, [
      ["X", "R2"],
      ["X", "V+"],
      ["X", "A+"],
    ]);
    expect(b.visual.current.leads).toHaveLength(3);
    // Starting at the full nut does nothing.
    b.tapTerminal("X");
    expect(b.visual.current.pendingFrom).toBeNull();
    // Finishing at the full nut does nothing: the lead stays pending.
    b.tapTerminal("Y");
    b.tapTerminal("X");
    expect(b.visual.current.pendingFrom).toBe("Y");
    expect(b.visual.current.leads).toHaveLength(3);
  });

  it("removes a lead when it is tapped, and undo brings it back in place", () => {
    const b = createOhmsLawBench(1);
    wire(b, DIAGRAM_LEADS.slice(0, 3));
    const ids = b.visual.current.leads.map((l) => l.id);
    b.removeLead(ids[1] ?? "");
    expect(b.visual.current.leads.map((l) => l.id)).toEqual([ids[0], ids[2]]);
    b.undo();
    expect(b.visual.current.leads.map((l) => l.id)).toEqual(ids);
    b.undo(); // takes back the third add
    expect(b.visual.current.leads.map((l) => l.id)).toEqual(ids.slice(0, 2));
    b.undo();
    b.undo();
    b.undo(); // nothing left to undo
    expect(b.visual.current.leads).toHaveLength(0);
  });

  it("resets to no leads, the key open and every plug in", () => {
    const b = createOhmsLawBench(1);
    wire(b, DIAGRAM_LEADS);
    b.toggleKey();
    b.togglePlug(2);
    b.tapTerminal("E+");
    b.reset();
    const v = b.visual.current;
    expect(v.leads).toHaveLength(0);
    expect(v.keyClosed).toBe(false);
    expect(v.pendingFrom).toBeNull();
    expect(v.plugsIn.every((p) => p)).toBe(true);
    expect(b.boxSettingOhm).toBe(0);
    b.undo(); // reset clears the history
    expect(v.leads).toHaveLength(0);
  });

  it("recomputes the diagram comparison on every lead change", () => {
    const b = createOhmsLawBench(1);
    expect(b.comparison.matches).toBe(false);
    wire(b, DIAGRAM_LEADS);
    expect(b.comparison.matches).toBe(true);
    const last = b.visual.current.leads.at(-1);
    b.removeLead(last?.id ?? "");
    expect(b.comparison.matches).toBe(false);
    expect(b.comparison.missing).toEqual([["V-", "Y"]]);
    b.undo();
    expect(b.comparison.matches).toBe(true);
  });

  it("notifies subscribers after each discrete change, and stops after unsubscribe", () => {
    const b = createOhmsLawBench(1);
    let calls = 0;
    const off = b.subscribe(() => calls++);
    b.tapTerminal("E+");
    b.tapTerminal("K1");
    b.toggleKey();
    b.togglePlug(0);
    b.undo();
    b.setMode("exam");
    expect(calls).toBe(6);
    b.setPointer(0.1, 0, 0.2); // per-frame, not discrete
    b.advance(1 / 60);
    expect(calls).toBe(6);
    off();
    b.reset();
    expect(calls).toBe(6);
  });
});

describe("createOhmsLawBench: box, key and hints", () => {
  it("reads the box setting as the sum of the unplugged coils", () => {
    // Coils 1, 2, 2, 5, 10, 20, 20, 50 Ω in plug order (docs/07 §4.4): unplug 10 and 50 → 60 Ω.
    const b = createOhmsLawBench(1);
    expect(b.params.boxCoilsOhm).toEqual([1, 2, 2, 5, 10, 20, 20, 50]);
    b.togglePlug(4);
    b.togglePlug(7);
    expect(b.boxSettingOhm).toBe(60);
    b.togglePlug(7);
    expect(b.boxSettingOhm).toBe(10);
    b.togglePlug(99); // out of range: ignored
    expect(b.boxSettingOhm).toBe(10);
  });

  it("counts the seconds the key stays closed, and zeroes them when it opens", () => {
    const b = createOhmsLawBench(1);
    b.toggleKey();
    run(b, 2);
    expect(b.keyClosedForS).toBeCloseTo(2, 6);
    b.toggleKey();
    b.advance(1 / 60);
    expect(b.keyClosedForS).toBe(0);
  });

  it("shows the missing and extra leads as hints in practice mode, and none in exam mode", () => {
    const b = createOhmsLawBench(1);
    wire(b, [
      ["E+", "K1"],
      ["E+", "E-"],
    ]);
    const v = b.visual.current;
    expect(v.hintMissing).toHaveLength(DIAGRAM_LEADS.length - 1);
    expect(v.hintExtra).toEqual([v.leads[1]?.id]);
    v.ring = "E+";
    b.setMode("exam");
    expect(b.mode).toBe("exam");
    expect(v.hintMissing).toEqual([]);
    expect(v.hintExtra).toEqual([]);
    expect(v.ring).toBeNull();
    b.tapTerminal("K2");
    b.tapTerminal("A+");
    expect(v.hintMissing).toEqual([]);
    b.setMode("practice");
    expect(v.hintMissing).toHaveLength(DIAGRAM_LEADS.length - 2);
  });

  it("starts in exam mode when asked, with no hints", () => {
    const b = createOhmsLawBench(1, { mode: "exam" });
    expect(b.mode).toBe("exam");
    expect(b.visual.current.hintMissing).toEqual([]);
  });
});

describe("createOhmsLawBench: procedure notes", () => {
  it(`notes a key left closed past ${KEY_LEFT_CLOSED_S} s once per circuit`, () => {
    const b = createOhmsLawBench(1);
    wire(b, DIAGRAM_LEADS);
    b.toggleKey();
    run(b, KEY_LEFT_CLOSED_S - 1);
    expect(count(b, "key_left_closed")).toBe(0);
    run(b, 2);
    expect(count(b, "key_left_closed")).toBe(1);
    run(b, 20);
    expect(count(b, "key_left_closed")).toBe(1);
    // Reopened and closed on the same circuit: not repeated (lead's review, item 4).
    b.toggleKey();
    b.toggleKey();
    run(b, KEY_LEFT_CLOSED_S + 1);
    expect(count(b, "key_left_closed")).toBe(1);
    // A new box setting is a new circuit: left closed again, noted again.
    b.toggleKey();
    b.togglePlug(0);
    b.toggleKey();
    run(b, KEY_LEFT_CLOSED_S + 1);
    expect(count(b, "key_left_closed")).toBe(2);
    const note = b.notes.find((n) => n.kind === "key_left_closed");
    expect(note?.text).toBe(NOTE_TEXT.key_left_closed);
    expect(note?.atS).toBeGreaterThan(KEY_LEFT_CLOSED_S);
  });

  it("notes over range and the short circuit once each when the ammeter is across XY", () => {
    // The engine's case: ammeter across XY, loop closed by a lead, R = 0 (packages/engine
    // bench.test.ts): the needle slams the stop and the cells are short-circuited.
    const b = createOhmsLawBench(1);
    wire(b, AMMETER_ACROSS_XY);
    b.toggleKey();
    run(b, 3);
    expect(b.visual.current.readout.ammeterSlams).toBeGreaterThanOrEqual(1);
    expect(b.visual.current.readout.shortCircuit).toBe(true);
    expect(count(b, "over_range")).toBe(1);
    expect(count(b, "short_circuit")).toBe(1);
    run(b, 3);
    expect(count(b, "over_range")).toBe(1);
    expect(count(b, "short_circuit")).toBe(1);
  });

  it("notes a reversed meter once per circuit while the key is closed", () => {
    const b = createOhmsLawBench(1);
    wire(b, REVERSED_AMMETER);
    expect(b.comparison.issues).toContain("ammeter_reversed");
    run(b, 1);
    expect(count(b, "reversed_meter")).toBe(0); // key open
    b.toggleKey();
    run(b, 2);
    expect(count(b, "reversed_meter")).toBe(1);
    // The needle deflects below zero (the engine decides; Nelkon & Parker, moving-coil meter).
    expect(b.visual.current.readout.ammeterDeg).toBeLessThan(METER_ZERO_DEG);
    run(b, 2);
    expect(count(b, "reversed_meter")).toBe(1);
    b.toggleKey();
    run(b, 0.5);
    b.toggleKey();
    run(b, 0.5);
    expect(count(b, "reversed_meter")).toBe(1); // same circuit: not repeated
    b.toggleKey();
    b.togglePlug(7);
    run(b, 0.5);
    b.toggleKey();
    run(b, 0.5);
    expect(count(b, "reversed_meter")).toBe(2); // the circuit changed, then K closed again
  });

  it("does not repeat notes when K is opened and closed three times on a shorted circuit", () => {
    const b = createOhmsLawBench(1);
    wire(b, AMMETER_ACROSS_XY);
    for (let k = 0; k < 3; k++) {
      b.toggleKey();
      run(b, 2);
      b.toggleKey();
      run(b, 2);
    }
    expect(count(b, "short_circuit")).toBe(1);
    expect(count(b, "over_range")).toBe(1);
    expect(b.notes).toHaveLength(2);
    // Removing a lead and undoing it gives back the same circuit: still no repeat.
    const last = b.visual.current.leads.at(-1);
    b.removeLead(last?.id ?? "");
    b.undo();
    b.toggleKey();
    run(b, 2);
    expect(b.notes).toHaveLength(2);
  });

  it("notes the short again once the circuit changed and the short came back", () => {
    const b = createOhmsLawBench(1);
    wire(b, AMMETER_ACROSS_XY);
    b.toggleKey();
    run(b, 2);
    expect(count(b, "short_circuit")).toBe(1);
    // Cleared: K opened. Changed: the voltmeter's leads taken off. Then K closed again.
    b.toggleKey();
    run(b, 0.5);
    const v = b.visual.current.leads.filter((l) => l.a === "V+" || l.a === "V-");
    for (const l of v) b.removeLead(l.id);
    b.toggleKey();
    run(b, 2);
    expect(b.visual.current.readout.shortCircuit).toBe(true);
    expect(count(b, "short_circuit")).toBe(2);
  });

  it("writes no notes in exam mode, from the bench or from addNote", () => {
    const b = createOhmsLawBench(1, { mode: "exam" });
    wire(b, AMMETER_ACROSS_XY);
    b.toggleKey();
    run(b, KEY_LEFT_CLOSED_S + 2);
    b.addNote({ kind: "eye_off_mirror", text: NOTE_TEXT.eye_off_mirror });
    expect(b.notes).toHaveLength(0);
  });

  it("takes notes from other slices in practice mode, stamped with the bench time", () => {
    const b = createOhmsLawBench(1);
    run(b, 1);
    b.addNote({ kind: "eye_off_mirror", text: NOTE_TEXT.eye_off_mirror });
    expect(b.notes).toHaveLength(1);
    expect(b.notes[0]?.atS).toBeCloseTo(1, 6);
    expect(b.notes[0]?.id).toBeTruthy();
  });

  it("never puts a digit in a procedure note (no values)", () => {
    for (const text of Object.values(NOTE_TEXT)) expect(text).not.toMatch(/\d/);
  });
});

describe("createOhmsLawBench: the fixed 120 Hz step", () => {
  it("runs whole steps only and keeps the remainder for the next call", () => {
    const b = createOhmsLawBench(1);
    b.toggleKey();
    b.advance(DT_S * 0.5);
    expect(b.keyClosedForS).toBe(0);
    b.advance(DT_S * 0.5);
    expect(b.keyClosedForS).toBeCloseTo(DT_S, 9);
    b.advance(DT_S * 2.5);
    expect(b.keyClosedForS).toBeCloseTo(3 * DT_S, 9);
  });

  it(`runs at most ${MAX_STEPS_PER_ADVANCE} steps per call after a stall`, () => {
    const b = createOhmsLawBench(1);
    b.toggleKey();
    b.advance(5);
    expect(b.keyClosedForS).toBeCloseTo(MAX_STEPS_PER_ADVANCE * DT_S, 9);
    b.advance(-1);
    b.advance(Number.NaN);
    expect(b.keyClosedForS).toBeCloseTo(MAX_STEPS_PER_ADVANCE * DT_S, 9);
  });

  it("gives the same readout for the same seed and the same calls", () => {
    const go = () => {
      const b = createOhmsLawBench(7);
      wire(b, DIAGRAM_LEADS);
      b.toggleKey();
      for (let i = 0; i < 200; i++) b.advance(i % 3 === 0 ? 1 / 30 : 1 / 90);
      return b.visual.current.readout;
    };
    const a = go();
    const c = go();
    expect(c.ammeterDeg).toBe(a.ammeterDeg);
    expect(c.voltmeterDeg).toBe(a.voltmeterDeg);
    expect(c.leadCurrentsA).toEqual(a.leadCurrentsA);
    expect(a.ammeterDeg).toBeGreaterThan(METER_ZERO_DEG);
  });

  it("drives the engine with the seed's params", () => {
    expect(createOhmsLawBench(3).params).toEqual(paramsFromSeed(3));
  });

  it("does nothing with the loop open: needles stay at zero, no current in any lead", () => {
    // No closed circuit, no current (Anyakoha, New School Physics, the simple circuit).
    const b = createOhmsLawBench(1);
    wire(b, DIAGRAM_LEADS);
    run(b, 2); // key open
    const before = b.visual.current.readout.ammeterDeg;
    run(b, 1);
    const r = b.visual.current.readout;
    expect(Object.values(r.leadCurrentsA).every((i) => i === 0)).toBe(true);
    // The ammeter rests where its (seeded) zero error puts it; it does not move.
    expect(r.ammeterDeg).toBeCloseTo(before, 9);
    expect(r.voltmeterDeg).toBeCloseTo(METER_ZERO_DEG, 6);
  });
});
