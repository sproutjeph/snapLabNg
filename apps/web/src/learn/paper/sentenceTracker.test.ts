import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { entranceOrder } from "../stage/motion";
import {
  createEntrance,
  DROP_SLOTS,
  entranceBeginReading,
  entranceFrame,
  entranceNamed,
  entranceOnJump,
  entranceReading,
  entranceRearm,
} from "../stage/stageMotion";
import type { PartId } from "../types";
import { OHMS_LAW_QUESTION } from "./ohmsLawQuestion";
import { toSpoken } from "./readAloud";
import { createSentenceTracker } from "./sentenceTracker";

// Guided Watch follows the director's voice one sentence (or clause) at a time
// (docs/plans/guided-demo.md, "Watch v2"). Page behaviour: which sentence and word the paper marks,
// and when each part is named so the stage drops it. Layout, not science.

const Q = OHMS_LAW_QUESTION.instructions;
const S1 = Q[0]?.text ?? "";

function setup(rate = 0.8) {
  const items: PartId[] = [];
  const views: Array<{ instr: number | null; word: readonly [number, number] | null }> = [];
  const tracker = createSentenceTracker({
    question: OHMS_LAW_QUESTION,
    rate: () => rate,
    onChange: (v) => views.push({ instr: v.instr, word: v.word }),
    onItemRead: (p) => items.push(p),
  });
  return { tracker, items, views };
}

describe("the sentence tracker", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("marks the sentence from the moment the voice begins it, and the word the voice reaches", () => {
    const { tracker } = setup();
    tracker.begin(1, 0, Q[1]?.text.length ?? 0);
    expect(tracker.view).toMatchObject({ instr: 1, word: null, reading: true });
    tracker.word(toSpoken(Q[1]?.text ?? "").spoken.indexOf("length"));
    const w = tracker.view.word;
    expect(Q[1]?.text.slice(w?.[0], w?.[1])).toBe("length");
  });

  it("keeps the sentence marked after it ends, and after the voice is cut off", () => {
    const { tracker } = setup();
    tracker.begin(2, 0, Q[2]?.text.length ?? 0);
    tracker.end();
    expect(tracker.view).toMatchObject({ instr: 2, word: null, reading: false });
    tracker.begin(2, 0, Q[2]?.text.length ?? 0);
    tracker.word(3);
    tracker.stop();
    expect(tracker.view).toMatchObject({ instr: 2, word: null, reading: false });
  });

  it("maps a clause's words back to the printed sentence", () => {
    const { tracker } = setup();
    const text = Q[3]?.text ?? "";
    const from = text.indexOf("close");
    const to = text.indexOf("Read");
    tracker.begin(3, from, to);
    // The voice is given "close the key K. ": index 4 is the "t" of "the".
    tracker.word(toSpoken(text.slice(from, to)).spoken.indexOf("key"));
    const w = tracker.view.word;
    expect(text.slice(w?.[0], w?.[1])).toBe("key");
  });

  it("names each part as the voice says it, once, and the rest when the sentence ends", () => {
    const { tracker, items } = setup();
    tracker.reset();
    tracker.begin(0, 0, S1.length);
    tracker.word(0);
    tracker.word(toSpoken(S1).spoken.indexOf("a voltmeter"));
    expect(items).toEqual(["ammeter", "voltmeter"]);
    tracker.word(toSpoken(S1).spoken.indexOf("a voltmeter") + 1);
    expect(items).toEqual(["ammeter", "voltmeter"]);
    tracker.end();
    expect(items).toEqual(["ammeter", "voltmeter", "box", "leads", "cells"]);
  });

  it("with no word events, names the parts in order on the estimated clock", () => {
    const { tracker, items } = setup();
    tracker.reset();
    tracker.begin(0, 0, S1.length);
    expect(items).toEqual([]);
    vi.advanceTimersByTime(30_000);
    expect(items).toEqual(["ammeter", "voltmeter", "box", "leads", "cells"]);
  });

  it("goes quiet when the voice is cut off: no estimate names a part after a stop", () => {
    const { tracker, items } = setup();
    tracker.reset();
    tracker.begin(0, 0, S1.length);
    tracker.stop();
    vi.advanceTimersByTime(30_000);
    expect(items).toEqual([]);
  });

  it("names the parts again after reset (a replay), but not after a pause and resume", () => {
    const { tracker, items } = setup();
    tracker.reset();
    tracker.begin(0, 0, S1.length);
    tracker.end();
    expect(items).toHaveLength(5);
    tracker.begin(0, 0, S1.length);
    tracker.end();
    expect(items).toHaveLength(5);
    tracker.reset();
    tracker.begin(0, 0, S1.length);
    tracker.end();
    expect(items).toHaveLength(10);
  });
});

describe("the entrance inside guided Watch", () => {
  it("arms again for a jump back to the first sentence: the parts go back up to be named", () => {
    const e = createEntrance();
    e.on = true;
    e.endsAtBeat = 0;
    entranceReading(e, true);
    expect(entranceNamed(e, "ammeter")).toBe(true);
    e.landed = true;
    e.on = false;
    entranceRearm(e);
    expect(e).toMatchObject({ on: true, landed: false, byVoice: false, partsDownS: null });
    expect(e.namedAtS).toEqual({});
    // A part is named only once the reading has begun again.
    expect(entranceNamed(e, "ammeter")).toBe(false);
    entranceReading(e, true);
    expect(entranceNamed(e, "ammeter")).toBe(true);
  });

  it("Replay (or Tap to start, or Back into step 1) still drops each part on its name", () => {
    const e = createEntrance();
    e.on = true;
    e.endsAtBeat = 0;
    const order = entranceOrder(DROP_SLOTS);
    const parts = Object.fromEntries(DROP_SLOTS.map((p) => [p, { heightM: 0, k: 1 }])) as Record<
      (typeof DROP_SLOTS)[number],
      { heightM: number; k: number }
    >;
    // The first run: named, landed, handed over to the director.
    entranceBeginReading(e);
    for (const p of DROP_SLOTS) entranceNamed(e, p);
    entranceFrame(e, order, 5, parts);
    entranceOnJump(e, 1);
    expect(e.on).toBe(false);
    // Replay: seek(0) bumps the epoch and play() starts the first sentence, which arms the
    // entrance; the stage's next frame sees the jump. That must not undo the arming.
    entranceBeginReading(e);
    entranceOnJump(e, 0);
    expect(e).toMatchObject({ on: true, byVoice: true, landed: false });
    expect(e.namedAtS).toEqual({});
    entranceFrame(e, order, 0.5, parts);
    expect(DROP_SLOTS.every((p) => parts[p].k === 0)).toBe(true);
    // Only the part the voice names comes down; the others wait above the bench.
    expect(entranceNamed(e, "ammeter")).toBe(true);
    entranceFrame(e, order, 0.5, parts);
    expect(parts.ammeter.k).toBeGreaterThan(0);
    expect(parts.voltmeter.k).toBe(0);
    // Paused on beat 0 (no reading started): a jump arms the entrance for the timed drop.
    entranceOnJump(e, 1);
    expect(e.on).toBe(false);
    entranceOnJump(e, 0);
    expect(e).toMatchObject({ on: true, byVoice: false });
  });

  it("keeps a hold that waits for the voice to be heard when the first sentence begins", () => {
    const e = createEntrance();
    e.on = true;
    e.held = true;
    entranceBeginReading(e);
    expect(e.held).toBe(true);
  });
});
