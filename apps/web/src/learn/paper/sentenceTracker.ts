import type { PartId } from "../types";
import {
  IDLE_VIEW,
  itemTriggers,
  type ReadView,
  type Trigger,
  toSpoken,
  wordAt,
  wordsBetween,
  wordsMs,
} from "./readAloud";
import type { PracticalQuestion } from "./types";

// Guided Watch reads the question one sentence (or clause) at a time, as director beats
// (docs/plans/guided-demo.md, "Watch v2"). The director owns the voice; this follows it. Given
// "the voice began characters [from, to) of instruction i", then each word the voice reaches, it
// keeps what the paper draws (the sentence, the word) and names each apparatus item as the voice
// says it (by the word event, or by the estimate at the voice's pace if the browser sends none:
// whichever comes first, as readAloud.ts does for the paper that reads the whole question).

export interface SentenceTrackerOptions {
  question: PracticalQuestion;
  /** The voice's rate now (the estimate's pace). */
  rate(): number;
  onChange(view: ReadView): void;
  /** Called once per item, as the voice names it. */
  onItemRead?(part: PartId): void;
}

export interface SentenceTracker {
  /** The voice begins characters [from, to) of instruction `instr`. */
  begin(instr: number, from: number, to: number): void;
  /** The voice reached spoken character `index` of what it was given. */
  word(index: number): void;
  /** The voice finished what it was given. The sentence stays marked. */
  end(): void;
  /** The voice was cut short. The sentence stays marked; no word and no estimate go on. */
  stop(): void;
  /** Forget which items were named (a replay from the start). */
  reset(): void;
  readonly view: ReadView;
}

export function createSentenceTracker(o: SentenceTrackerOptions): SentenceTracker {
  const { question } = o;
  const triggers: Trigger[] = itemTriggers(question);
  let view: ReadView = IDLE_VIEW;
  let fired = new Set<PartId>();
  let estimates: ReturnType<typeof setTimeout>[] = [];
  let gen = 0;
  /** What the voice is reading: the instruction, its printed range, and the spoken form of that. */
  let cur: {
    instr: number;
    from: number;
    to: number;
    spoken: string;
    map: number[];
  } | null = null;

  const set = (next: ReadView) => {
    view = next;
    o.onChange(next);
  };
  const clear = () => {
    for (const id of estimates) clearTimeout(id);
    estimates = [];
  };
  const reach = (instr: number, upTo: number): PartId | null => {
    let last: PartId | null = null;
    for (const t of triggers) {
      if (t.instr === instr && t.at <= upTo && !fired.has(t.part)) {
        fired.add(t.part);
        last = t.part;
        o.onItemRead?.(t.part);
      }
    }
    return last;
  };
  /** The spoken index of the printed character `at` (of the whole instruction) in `cur`. */
  const spokenIndexOf = (c: NonNullable<typeof cur>, at: number): number => {
    const k = c.map.findIndex((f) => f >= at);
    return k < 0 ? c.map.length : k;
  };
  const estimateFrom = (from: number, g: number) => {
    clear();
    const c = cur;
    if (!c) return;
    for (const t of triggers) {
      if (t.instr !== c.instr || fired.has(t.part) || t.at < c.from || t.at >= c.to) continue;
      const ms = wordsMs(wordsBetween(c.spoken, from, spokenIndexOf(c, t.at)), o.rate());
      estimates.push(
        setTimeout(() => {
          if (g !== gen) return;
          const named = reach(c.instr, t.at);
          if (named) set({ ...view, naming: named });
        }, ms),
      );
    }
  };

  return {
    get view() {
      return view;
    },
    begin(instr, from, to) {
      gen += 1;
      clear();
      const text = question.instructions[instr]?.text ?? "";
      const { spoken, from: map } = toSpoken(text.slice(from, to));
      cur = { instr, from, to, spoken, map: map.map((i) => i + from) };
      set({ instr, word: null, naming: view.naming, reading: true });
      estimateFrom(0, gen);
    },
    word(index) {
      const c = cur;
      if (!c) return;
      const si = Math.min(Math.max(index, 0), c.map.length - 1);
      const at = c.map[si] ?? c.from;
      const named = reach(c.instr, at);
      estimateFrom(si, gen);
      const text = question.instructions[c.instr]?.text ?? "";
      set({
        instr: c.instr,
        word: wordAt(text, at),
        naming: named ?? view.naming,
        reading: true,
      });
    },
    end() {
      const c = cur;
      gen += 1;
      clear();
      if (!c) return;
      const named = reach(c.instr, c.to);
      set({ instr: c.instr, word: null, naming: named ?? view.naming, reading: false });
    },
    stop() {
      gen += 1;
      clear();
      if (!cur) return;
      set({ ...view, word: null, reading: false });
    },
    reset() {
      fired = new Set();
    },
  };
}
