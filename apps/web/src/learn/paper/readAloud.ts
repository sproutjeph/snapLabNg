import type { PartId } from "../types";
import type { VoiceGuide } from "../voice/types";
import type { PracticalQuestion } from "./types";

// "Read it to me": the question read aloud, one utterance per instruction. A pure controller (no
// DOM), so it is tested with a fake voice. It reports which instruction and which word the voice
// is on, and when it names each apparatus item, so the stage can land the item on the bench.
// Where the browser gives no word events (iOS) or the voice is muted, an estimated clock drives
// the same highlight by sentence, so the entrance still plays and a beat never waits on `onend`.

/** The words the browser would mis-say, with what to say instead. Longest first. */
const SPOKEN: ReadonlyArray<readonly [string, string]> = [
  ["Ω m", "ohm metres"],
  ["Ω", "ohms"],
  ["⁻⁷", " to the minus 7"],
  ["×", "times"],
  ["π", "pi"],
  ["22/7", "22 over 7"],
  ["=", "equals"],
];

/** What the voice is given for `text`, and for each spoken character the index it came from. */
export function toSpoken(text: string): { spoken: string; from: number[] } {
  let spoken = "";
  const from: number[] = [];
  let i = 0;
  while (i < text.length) {
    const hit = SPOKEN.find(([k]) => text.startsWith(k, i));
    if (hit) {
      for (const ch of hit[1]) {
        spoken += ch;
        from.push(i);
      }
      i += hit[0].length;
    } else {
      spoken += text[i];
      from.push(i);
      i += 1;
    }
  }
  return { spoken, from };
}

/** The word in `text` that starts at or contains `index`: [start, end). */
export function wordAt(text: string, index: number): [number, number] {
  const n = text.length;
  let s = Math.max(0, Math.min(index, n - 1));
  while (s > 0 && !/\s/.test(text.charAt(s - 1))) s -= 1;
  let e = s;
  while (e < n && !/\s/.test(text.charAt(e))) e += 1;
  if (e === s) e = Math.min(n, s + 1);
  return [s, e];
}

export interface Trigger {
  part: PartId;
  /** Index of the instruction that names it. */
  instr: number;
  /** Character index (in the printed text) where the name begins. */
  at: number;
}

/** Where the paper first names each apparatus item, in the order the paper says them. */
export function itemTriggers(q: PracticalQuestion): Trigger[] {
  const out: Trigger[] = [];
  for (const item of q.apparatus) {
    for (let i = 0; i < q.instructions.length; i++) {
      const at = q.instructions[i]?.text.indexOf(item.text) ?? -1;
      if (at >= 0) {
        out.push({ part: item.part, instr: i, at });
        break;
      }
    }
  }
  return out.sort((a, b) => a.instr - b.instr || a.at - b.at);
}

/** What the page draws while she listens. */
export interface ReadView {
  /** The instruction being read; null when nothing is. */
  instr: number | null;
  /** The word being said, [start, end) in the printed text; null when only the sentence is known. */
  word: readonly [number, number] | null;
  /** The apparatus item named last, so the diagram can light it; null when none. */
  naming: PartId | null;
  reading: boolean;
}

export const IDLE_VIEW: ReadView = { instr: null, word: null, naming: null, reading: false };

/** Speech runs at about 14 characters a second at rate 1. */
export const CHARS_PER_SECOND = 14;
/** How long to wait for a word event before the estimated clock takes over. */
export const WORD_EVENT_WAIT_MS = 1500;
const TICK_MS = 120;

export interface ReadAloud {
  start(): void;
  stop(): void;
  readonly view: ReadView;
}

export interface ReadAloudOptions {
  question: PracticalQuestion;
  voice: VoiceGuide;
  onChange(view: ReadView): void;
  /** Called once per item, as the voice names it. */
  onItemRead?(part: PartId): void;
}

export function createReadAloud(opts: ReadAloudOptions): ReadAloud {
  const { question, voice } = opts;
  const triggers = itemTriggers(question);
  let gen = 0;
  let view: ReadView = IDLE_VIEW;
  let fired = new Set<PartId>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let wait: ReturnType<typeof setTimeout> | null = null;

  const set = (next: ReadView) => {
    view = next;
    opts.onChange(next);
  };
  const clearClocks = () => {
    if (timer !== null) clearInterval(timer);
    if (wait !== null) clearTimeout(wait);
    timer = null;
    wait = null;
  };
  /** Fires every item of instruction `i` named at or before character `upTo`. */
  const reach = (i: number, upTo: number): PartId | null => {
    let last: PartId | null = null;
    for (const t of triggers) {
      if (t.instr === i && t.at <= upTo && !fired.has(t.part)) {
        fired.add(t.part);
        last = t.part;
        opts.onItemRead?.(t.part);
      }
    }
    return last;
  };

  const begin = (i: number, g: number) => {
    clearClocks();
    const text = question.instructions[i]?.text ?? "";
    set({ instr: i, word: null, naming: view.naming, reading: true });
    // No word event soon: estimate the position by the clock, sentence by sentence.
    wait = setTimeout(() => {
      if (g !== gen || view.instr !== i || view.word !== null) return;
      // The wait has already passed in silence: start the clock where the voice should be by now.
      let at = (WORD_EVENT_WAIT_MS / 1000) * CHARS_PER_SECOND * voice.rate;
      timer = setInterval(() => {
        if (g !== gen) return;
        at += ((CHARS_PER_SECOND * voice.rate) / 1000) * TICK_MS;
        const named = reach(i, Math.min(at, text.length));
        if (named) set({ ...view, naming: named });
      }, TICK_MS);
    }, WORD_EVENT_WAIT_MS);
  };

  return {
    get view() {
      return view;
    },
    start() {
      this.stop();
      const g = gen;
      fired = new Set();
      const n = question.instructions.length;
      // First, so a voice that ends synchronously still finds the view in place.
      begin(0, g);
      question.instructions.forEach((ins, i) => {
        const { spoken, from } = toSpoken(ins.text);
        voice.say(spoken, {
          onWord(ci) {
            if (g !== gen) return;
            const at = from[Math.min(Math.max(ci, 0), from.length - 1)] ?? 0;
            // Word events are real: the estimated clock is not needed.
            clearClocks();
            const named = reach(i, at);
            set({
              instr: i,
              word: wordAt(ins.text, at),
              naming: named ?? view.naming,
              reading: true,
            });
          },
          onEnd() {
            if (g !== gen) return;
            clearClocks();
            const named = reach(i, ins.text.length);
            if (i === n - 1) {
              set({ instr: null, word: null, naming: null, reading: false });
            } else {
              begin(i + 1, g);
              if (named) set({ ...view, naming: named });
            }
          },
        });
      });
    },
    stop() {
      const mine = view.reading || view.instr !== null;
      gen += 1;
      clearClocks();
      // The voice is shared: only cut it off if this reader is the one speaking. A reader that
      // is idle (for example, one unmounting as the next mode starts its own speech) leaves it.
      if (!mine) return;
      voice.stop();
      set(IDLE_VIEW);
    },
  };
}
