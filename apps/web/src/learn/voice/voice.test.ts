import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chunkSentences, estimateSpeechS, MAX_CHUNK_CHARS } from "./chunk";
import { createVoice } from "./createVoice";
import { createSfx } from "./sfx";

// The speech queue, with a fake speechSynthesis and fake timers: no real speech anywhere.
// The numbers (chunk length, words per second) are screen choices, not textbook values; the
// behaviours come from docs/plans/exam-redesign.md, Risks #2.

class FakeUtterance {
  text: string;
  rate = 1;
  lang = "";
  voice: { lang: string; name: string } | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onboundary: ((e: { name?: string; charIndex: number }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

class FakeSynth {
  spoken: FakeUtterance[] = [];
  cancelled = 0;
  voices: Array<{ lang: string; name: string }> = [];
  speak(u: FakeUtterance) {
    this.spoken.push(u);
  }
  cancel() {
    this.cancelled++;
  }
  getVoices() {
    return this.voices;
  }
}

let synth: FakeSynth;

beforeEach(() => {
  vi.useFakeTimers();
  synth = new FakeSynth();
  vi.stubGlobal("window", { speechSynthesis: synth });
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const QUESTION =
  "You are provided with an ammeter, a voltmeter, a resistance box, connecting wires, dry cells and other necessary materials. Measure and record the length XY of the resistance wire provided. Connect the circuit as shown in the diagram.";

describe("chunkSentences", () => {
  it("splits at the end of each sentence and keeps each chunk's offset in the text", () => {
    const chunks = chunkSentences(QUESTION);
    expect(chunks.map((c) => c.text)).toEqual([
      "You are provided with an ammeter, a voltmeter, a resistance box, connecting wires, dry cells and other necessary materials.",
      "Measure and record the length XY of the resistance wire provided.",
      "Connect the circuit as shown in the diagram.",
    ]);
    for (const c of chunks) expect(QUESTION.slice(c.offset, c.offset + c.text.length)).toBe(c.text);
  });

  it("does not end a sentence at a decimal point", () => {
    const text = "A wire of diameter 0.2 mm has resistivity 8.8 × 10⁻⁷ Ω m.";
    expect(chunkSentences(text)).toHaveLength(1);
  });

  it("cuts a very long sentence at a comma before the limit", () => {
    const long = `${"a word, ".repeat(60)}end.`;
    const chunks = chunkSentences(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
    expect(chunks.map((c) => c.text).join(" ")).toBe(long.trim().replace(/ +/g, " "));
  });

  it("gives nothing for blank text", () => {
    expect(chunkSentences("  \n ")).toEqual([]);
  });
});

describe("estimateSpeechS", () => {
  it("grows with the words and shrinks with a faster rate", () => {
    expect(estimateSpeechS("", 1)).toBe(0);
    expect(estimateSpeechS(QUESTION, 1)).toBeGreaterThan(estimateSpeechS("Open the key.", 1));
    expect(estimateSpeechS(QUESTION, 2)).toBeLessThan(estimateSpeechS(QUESTION, 1));
  });
});

describe("createVoice", () => {
  it("long text is chunked by sentence, one utterance at a time, in order", () => {
    const voice = createVoice();
    const onEnd = vi.fn();
    voice.say(QUESTION, { onEnd });
    // Only the first sentence is with the browser; the others wait their turn.
    expect(synth.spoken.map((u) => u.text)).toEqual([chunkSentences(QUESTION)[0]?.text]);
    synth.spoken[0]?.onend?.();
    expect(synth.spoken).toHaveLength(2);
    expect(onEnd).not.toHaveBeenCalled();
    synth.spoken[1]?.onend?.();
    synth.spoken[2]?.onend?.();
    expect(synth.spoken.map((u) => u.text)).toEqual(chunkSentences(QUESTION).map((c) => c.text));
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(voice.speaking).toBe(false);
  });

  it("starts the first utterance inside say(), so a tap handler's gesture counts", () => {
    const voice = createVoice();
    voice.say("Read it to me.");
    expect(synth.spoken).toHaveLength(1);
    expect(voice.speaking).toBe(true);
  });

  it("reports word positions in the full text, and the start of each sentence at least", () => {
    const voice = createVoice();
    const words: number[] = [];
    voice.say(QUESTION, { onWord: (i) => words.push(i) });
    const second = chunkSentences(QUESTION)[1];
    synth.spoken[0]?.onend?.();
    synth.spoken[1]?.onboundary?.({ name: "word", charIndex: 8 });
    synth.spoken[1]?.onboundary?.({ name: "sentence", charIndex: 3 });
    expect(words).toContain(0);
    expect(words).toContain(second?.offset);
    expect(words).toContain((second?.offset ?? 0) + 8);
    expect(words).not.toContain((second?.offset ?? 0) + 3);
  });

  it("charIndex is relative to the whole text of that say() call, in a later sentence and a later call", () => {
    const voice = createVoice();
    const full = "Close the key. Read the ammeter first.";
    const seen: number[] = [];
    voice.say(full, { onWord: (i) => seen.push(i) });
    // The browser reports the boundary of "ammeter" relative to its own utterance, the second sentence.
    const secondSentence = "Read the ammeter first.";
    synth.spoken[0]?.onend?.();
    synth.spoken[1]?.onboundary?.({ name: "word", charIndex: secondSentence.indexOf("ammeter") });
    expect(seen).toContain(full.indexOf("ammeter"));
    expect(full.indexOf("ammeter")).not.toBe(secondSentence.indexOf("ammeter"));
    synth.spoken[1]?.onend?.();

    // A later say() starts counting from 0 again: nothing carries over from the first.
    const later: number[] = [];
    voice.say("Open the key.", { onWord: (i) => later.push(i) });
    synth.spoken[2]?.onboundary?.({ name: "word", charIndex: "Open the ".length });
    expect(later).toContain("Open the ".length);
    expect(Math.max(...later)).toBeLessThan("Open the key.".length);
  });

  it("queues a second say() after the first", () => {
    const voice = createVoice();
    const order: string[] = [];
    voice.say("First.", { onEnd: () => order.push("first") });
    voice.say("Second.", { onEnd: () => order.push("second") });
    expect(synth.spoken).toHaveLength(1);
    synth.spoken[0]?.onend?.();
    synth.spoken[1]?.onend?.();
    expect(order).toEqual(["first", "second"]);
  });

  it("ends a stuck utterance on its fallback timer when onend never fires", () => {
    const voice = createVoice();
    const onEnd = vi.fn();
    voice.say("Close the key.", { onEnd });
    expect(onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(synth.cancelled).toBeGreaterThan(0);
  });

  it("ignores a late onend from a chunk the timer already gave up on", () => {
    const voice = createVoice();
    const onEnd = vi.fn();
    voice.say("One. Two.", { onEnd });
    const first = synth.spoken[0];
    vi.advanceTimersByTime(60_000);
    // The timer moved the queue on (and ended both chunks, since the second never reports either).
    expect(onEnd).toHaveBeenCalledTimes(1);
    first?.onend?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("muted speaks nothing but still ends beats, after the estimated time", () => {
    const voice = createVoice();
    voice.muted = true;
    const onEnd = vi.fn();
    voice.say(QUESTION, { onEnd });
    expect(synth.spoken).toHaveLength(0);
    expect(voice.speaking).toBe(false);
    expect(onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(estimateSpeechS(QUESTION, 0.95) * 1000 + 1000);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(synth.spoken).toHaveLength(0);
  });

  it("muting mid-speech silences it and the sentence still ends on time", () => {
    const voice = createVoice();
    const onEnd = vi.fn();
    voice.say("Close the key.", { onEnd });
    expect(voice.speaking).toBe(true);
    voice.muted = true;
    expect(voice.speaking).toBe(false);
    expect(synth.cancelled).toBeGreaterThan(0);
    vi.advanceTimersByTime(estimateSpeechS("Close the key.", 0.95) * 1000 + 100);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("with no speechSynthesis at all it still ends beats", () => {
    vi.stubGlobal("window", {});
    const voice = createVoice();
    const onEnd = vi.fn();
    voice.say("Open the key.", { onEnd });
    vi.advanceTimersByTime(10_000);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("stop() clears the queue and never reports the stopped text as ended", () => {
    const voice = createVoice();
    const onEnd = vi.fn();
    voice.say("One. Two. Three.", { onEnd });
    voice.stop();
    expect(synth.cancelled).toBeGreaterThan(0);
    synth.spoken[0]?.onend?.();
    vi.advanceTimersByTime(60_000);
    expect(onEnd).not.toHaveBeenCalled();
    expect(synth.spoken).toHaveLength(1);
    expect(voice.speaking).toBe(false);
  });

  it("stop() leaves other speakers alone when this queue is not speaking", () => {
    const voice = createVoice();
    voice.stop();
    expect(synth.cancelled).toBe(0);
    voice.muted = true;
    voice.say("Silent words.");
    voice.stop();
    expect(synth.cancelled).toBe(0);
    voice.muted = false;
    voice.say("Spoken words.");
    voice.stop();
    expect(synth.cancelled).toBe(1);
  });

  it("speaks again after stop()", () => {
    const voice = createVoice();
    voice.say("Old.");
    voice.stop();
    voice.say("New.");
    expect(synth.spoken.map((u) => u.text)).toEqual(["Old.", "New."]);
  });

  it("uses its rate (default 0.95), and a changed rate from the next sentence", () => {
    const voice = createVoice();
    expect(voice.rate).toBe(0.95);
    voice.say("One. Two.");
    voice.rate = 1.5;
    synth.spoken[0]?.onend?.();
    expect(synth.spoken[0]?.rate).toBeCloseTo(0.95, 10);
    expect(synth.spoken[1]?.rate).toBeCloseTo(1.5, 10);
  });

  it("prefers a Nigerian English voice, then British", () => {
    synth.voices = [
      { lang: "en-US", name: "US" },
      { lang: "en-GB", name: "GB" },
      { lang: "en-NG", name: "NG" },
    ];
    const voice = createVoice();
    voice.say("Hello.");
    expect(synth.spoken[0]?.voice?.name).toBe("NG");
  });

  it("ends an empty say() once what is queued ahead of it has ended", () => {
    const voice = createVoice();
    const order: string[] = [];
    voice.say("Ahead.", { onEnd: () => order.push("ahead") });
    voice.say("   ", { onEnd: () => order.push("empty") });
    expect(order).toEqual([]);
    synth.spoken[0]?.onend?.();
    expect(order).toEqual(["ahead", "empty"]);
  });
});

describe("createSfx", () => {
  class FakeParam {
    setValueAtTime = vi.fn();
    exponentialRampToValueAtTime = vi.fn();
    value = 0;
  }
  const node = () => {
    const n: Record<string, unknown> = {
      connect: vi.fn(() => n),
      start: vi.fn(),
      stop: vi.fn(),
      gain: new FakeParam(),
      frequency: new FakeParam(),
      Q: new FakeParam(),
    };
    return n;
  };
  let made = 0;
  class FakeAudioContext {
    state = "running";
    currentTime = 0;
    sampleRate = 100;
    destination = {};
    constructor() {
      made++;
    }
    createGain = vi.fn(node);
    createOscillator = vi.fn(node);
    createBufferSource = vi.fn(node);
    createBiquadFilter = vi.fn(node);
    createBuffer = vi.fn(() => ({ getChannelData: () => new Float32Array(100) }));
    resume = vi.fn(async () => {});
    close = vi.fn(async () => {});
  }

  beforeEach(() => {
    made = 0;
    vi.stubGlobal("window", { AudioContext: FakeAudioContext });
  });

  it("plays nothing, and makes no audio context, while muted", () => {
    const sfx = createSfx(() => true);
    sfx.leadSnap();
    sfx.plug();
    sfx.key();
    sfx.page();
    expect(made).toBe(0);
  });

  it("makes each of the four sounds from oscillators and noise, with one context", () => {
    const sfx = createSfx();
    sfx.leadSnap();
    sfx.plug();
    sfx.key();
    sfx.page();
    expect(made).toBe(1);
  });

  it("is silent after dispose and without WebAudio", () => {
    const sfx = createSfx();
    sfx.dispose();
    sfx.key();
    expect(made).toBe(0);
    vi.stubGlobal("window", {});
    expect(() => createSfx().page()).not.toThrow();
  });
});
