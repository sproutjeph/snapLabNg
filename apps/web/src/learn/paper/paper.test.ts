import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OHMS_LAW_LESSON } from "../lessons/ohms-law/lesson";
import type { PartId } from "../types";
import type { VoiceGuide } from "../voice/types";
import { OHMS_LAW_QUESTION } from "./ohmsLawQuestion";
import {
  createReadAloud,
  IDLE_VIEW,
  itemTriggers,
  type ReadView,
  toSpoken,
  wordAt,
} from "./readAloud";

type Say = {
  text: string;
  onWord?: ((i: number) => void) | undefined;
  onEnd?: (() => void) | undefined;
};

/** A voice that only records what it was asked to say; the test plays the events itself. */
function fakeVoice() {
  const said: Say[] = [];
  const voice: VoiceGuide = {
    say(text, o) {
      said.push({ text, onWord: o?.onWord, onEnd: o?.onEnd });
    },
    stop() {
      said.length = 0;
    },
    speaking: false,
    muted: false,
    rate: 1,
  };
  return { voice, said };
}

describe("the question paper", () => {
  it("prints the lesson's own words for each instruction", () => {
    const keys = [
      "identify",
      "measure-xy",
      "connect",
      "r0",
      "r1",
      "repeat",
      "plot",
      "slope",
      "precautions",
      "law",
      "length",
    ];
    const words = keys.map((k) => OHMS_LAW_LESSON.steps.find((s) => s.key === k)?.instruction);
    expect(OHMS_LAW_QUESTION.instructions.map((i) => i.text)).toEqual(words);
  });

  it("names every apparatus item somewhere in the instructions", () => {
    const parts = itemTriggers(OHMS_LAW_QUESTION).map((t) => t.part);
    expect(parts).toEqual(["ammeter", "voltmeter", "box", "leads", "cells", "key", "wire"]);
  });

  it("states no reading, current, voltage or wire resistance (only the question's own numbers)", () => {
    // The question's numbers: R = 0, 1, 5, 10, 20, 40, 60 Ω; 0.2 mm; 7 Ω; 8.8 × 10⁻⁷ Ω m; π = 22/7.
    const allowed = new Set(["0", "1", "5", "10", "20", "40", "60", "0.2", "7", "8.8", "22", "2"]);
    const numbers = OHMS_LAW_QUESTION.instructions
      .map((i) => i.text.replace(/10⁻⁷/g, ""))
      .join(" ")
      .match(/\d+(\.\d+)?/g);
    for (const n of numbers ?? []) expect(allowed.has(n)).toBe(true);
  });
});

describe("what the voice is given", () => {
  it("says Ω, ×, = and π in words, and maps each spoken character back to the printed one", () => {
    const text = "R = 0 Ω";
    const { spoken, from } = toSpoken(text);
    expect(spoken).toBe("R equals 0 ohms");
    expect(from).toHaveLength(spoken.length);
    expect(text[from[spoken.indexOf("0")] ?? -1]).toBe("0");
    expect(toSpoken("8.8 × 10⁻⁷ Ω m").spoken).toBe("8.8 times 10 to the minus 7 ohm metres");
  });

  it("finds the word an index falls in", () => {
    const text = "an ammeter, a voltmeter";
    expect(wordAt(text, 4)).toEqual([3, 11]);
    expect(wordAt(text, 0)).toEqual([0, 2]);
  });
});

describe("Read it to me", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const { voice, said } = fakeVoice();
    const views: ReadView[] = [];
    const items: PartId[] = [];
    const reader = createReadAloud({
      question: OHMS_LAW_QUESTION,
      voice,
      onChange: (v) => views.push(v),
      onItemRead: (p) => items.push(p),
    });
    return { reader, said, views, items };
  }

  it("queues one utterance per instruction, in order", () => {
    const { reader, said } = setup();
    reader.start();
    expect(said).toHaveLength(OHMS_LAW_QUESTION.instructions.length);
    expect(said[0]?.text.startsWith("You are provided with an ammeter")).toBe(true);
  });

  it("names each item as the voice reaches its word, and highlights that word", () => {
    const { reader, said, items } = setup();
    reader.start();
    const first = said[0];
    const text = OHMS_LAW_QUESTION.instructions[0]?.text ?? "";
    first?.onWord?.(text.indexOf("an ammeter"));
    expect(items).toEqual(["ammeter"]);
    expect(reader.view.reading).toBe(true);
    expect(reader.view.instr).toBe(0);
    expect(reader.view.word).toEqual([text.indexOf("an ammeter"), text.indexOf("an ammeter") + 2]);
    first?.onWord?.(text.indexOf("a voltmeter"));
    first?.onWord?.(text.indexOf("a resistance box"));
    expect(items).toEqual(["ammeter", "voltmeter", "box"]);
  });

  it("never names an item twice, and names the rest when the sentence ends", () => {
    const { reader, said, items } = setup();
    reader.start();
    const first = said[0];
    first?.onWord?.(0);
    first?.onEnd?.();
    first?.onEnd?.();
    expect(items).toEqual(["ammeter", "voltmeter", "box", "leads", "cells", "key"]);
    expect(reader.view.instr).toBe(1);
    // Instruction 2 names the wire as it is read.
    said[1]?.onEnd?.();
    expect(items.at(-1)).toBe("wire");
    expect(new Set(items).size).toBe(items.length);
  });

  it("falls back to an estimated clock when the browser sends no word events", () => {
    const { reader, items } = setup();
    reader.start();
    expect(items).toEqual([]);
    vi.advanceTimersByTime(1500); // the wait for a first word event
    vi.advanceTimersByTime(3000); // about 42 characters at 14 a second: through "a resistance box"
    expect(items).toContain("ammeter");
    expect(items).toContain("voltmeter");
    expect(reader.view.word).toBeNull();
    expect(reader.view.instr).toBe(0);
  });

  it("goes quiet and clears the highlight at the end, and on Stop", () => {
    const { reader, said } = setup();
    reader.start();
    for (const s of [...said]) s.onEnd?.();
    expect(reader.view).toEqual(IDLE_VIEW);
    reader.start();
    expect(reader.view.reading).toBe(true);
    reader.stop();
    expect(reader.view).toEqual(IDLE_VIEW);
  });

  it("does not cut off the shared voice when this reader is not reading", () => {
    // At unmount the paper stops its reader; the next mode may already be speaking.
    const { voice } = fakeVoice();
    const stop = vi.spyOn(voice, "stop");
    const reader = createReadAloud({
      question: OHMS_LAW_QUESTION,
      voice,
      onChange: () => {},
    });
    reader.stop();
    expect(stop).not.toHaveBeenCalled();
    reader.start();
    reader.stop();
    expect(stop).toHaveBeenCalledTimes(1);
    reader.stop();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("starts the estimated clock where the voice should be after the silent wait", () => {
    const { reader, items } = setup();
    reader.start();
    // The 1.5 s wait at 14 characters a second is 21 characters already spoken, so the first tick
    // passes "an ammeter" (at 22) and not yet "a voltmeter" (at 34).
    vi.advanceTimersByTime(1500 + 120);
    expect(items).toEqual(["ammeter"]);
  });

  it("ignores events from a reading she stopped", () => {
    const { reader, said, items } = setup();
    reader.start();
    const stale = said[0];
    reader.stop();
    stale?.onWord?.(0);
    stale?.onEnd?.();
    expect(items).toEqual([]);
    expect(reader.view).toEqual(IDLE_VIEW);
  });
});
