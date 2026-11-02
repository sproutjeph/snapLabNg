import type { ApparatusKind, QuestionRead } from "@snaplab/contracts";
import { guidedScriptFor } from "../lessons/ohms-law/guidedScript";
import type { Script } from "../script/types";
import type { PartId } from "../types";
import { OHMS_LAW_QUESTION } from "./ohmsLawQuestion";
import type { PracticalQuestion } from "./types";

// Snap your question (docs/plans/snap-question.md): her snapped paper becomes a PracticalQuestion.
// The AI read the words; nothing here sets physics. The bench, the R steps and the script's values
// stay Q3B's. Pure and tested.

/** The bench parts a question can name (each one lands on the bench during the reading). */
type BenchPart = "ammeter" | "voltmeter" | "box" | "leads" | "cells" | "wire" | "key";

const PART_OF_KIND: Partial<Record<ApparatusKind, BenchPart>> = {
  ammeter: "ammeter",
  voltmeter: "voltmeter",
  resistance_box: "box",
  connecting_wires: "leads",
  cells: "cells",
  key: "key",
  wire_xy: "wire",
};

/** Last resorts: the part's letter on the diagram. Matched only as a whole word. */
const LETTER: Partial<Record<BenchPart, string>> = {
  ammeter: "A",
  voltmeter: "V",
  box: "R",
  cells: "E",
  key: "K",
  wire: "XY",
};

const BENCH_PARTS: readonly BenchPart[] = [
  "ammeter",
  "voltmeter",
  "box",
  "leads",
  "cells",
  "wire",
  "key",
];

const isLetter = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);

/** Whether `text` occurs word for word in some instruction (short texts only as whole words). */
function occurs(text: string, instructions: readonly { text: string }[]): boolean {
  if (text === "") return false;
  return instructions.some((ins) => {
    const at = ins.text.indexOf(text);
    if (at < 0) return false;
    if (text.length > 3) return true;
    return !isLetter(ins.text[at - 1]) && !isLetter(ins.text[at + text.length]);
  });
}

/**
 * The apparatus list for `instructions`: per bench part, the first text that occurs word for word
 * (her text for it, then Q3B's, then the part's letter). A part with no text that occurs is left
 * out: the paper never names it, so the stage drops it on its timed drop when the reading ends
 * (stage/stageMotion.ts entranceStopped), as Q3B's key and wire XY do after the first sentence.
 */
export function apparatusFor(
  read: QuestionRead,
  instructions: readonly { text: string }[],
): PracticalQuestion["apparatus"] {
  const out: { part: PartId; text: string }[] = [];
  for (const part of BENCH_PARTS) {
    const hers = read.apparatus
      .filter((a) => PART_OF_KIND[a.kind] === part)
      .map((a) => a.text_as_printed.trim());
    const q3b = OHMS_LAW_QUESTION.apparatus.filter((a) => a.part === part).map((a) => a.text);
    const letter = LETTER[part];
    const text = [...hers, ...q3b, ...(letter ? [letter] : [])].find((t) =>
      occurs(t, instructions),
    );
    if (text !== undefined) out.push({ part, text });
  }
  return out;
}

/** Her paper as the practical's question: her instructions word for word. */
export function toPracticalQuestion(read: QuestionRead): PracticalQuestion {
  const instructions = read.instructions.map((i) => ({ label: i.label, text: i.text }));
  return {
    source: read.source_as_printed?.trim() || "Your question",
    title: read.title_as_printed?.trim() || "Ohm's law (V–I)",
    apparatus: apparatusFor(read, instructions),
    instructions,
  };
}

// ---- Alignment with Q3B ----

/** A text match with the label agreeing needs this much similarity (0 to 1)... */
export const LABEL_SIMILARITY = 0.4;
/** ...and with no label to go on, this much. Q3B's steps 4 and 5 score about 0.6 against each other. */
export const TEXT_SIMILARITY = 0.7;

function bigrams(s: string): Map<string, number> {
  const t = s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}Ω=]+/gu, " ")
    .trim();
  const m = new Map<string, number>();
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Sørensen–Dice similarity of two texts' character pairs: 1 identical, near 0 unrelated. */
export function similarity(a: string, b: string): number {
  const x = bigrams(a);
  const y = bigrams(b);
  let nx = 0;
  let ny = 0;
  let both = 0;
  for (const [g, n] of x) {
    nx += n;
    both += Math.min(n, y.get(g) ?? 0);
  }
  for (const n of y.values()) ny += n;
  return nx + ny === 0 ? 0 : (2 * both) / (nx + ny);
}

const normLabel = (l: string) => l.toLowerCase().replace(/[^a-z0-9]+/g, "");

export interface Alignment {
  /** Every Q3B step Watch drives has her sentence and Watch's clauses are found in it. */
  aligned: boolean;
  /** Per Q3B step, the index of her instruction that matches it (null: none did). */
  match: readonly (number | null)[];
  /** Per Q3B step, her words for it (Q3B's own where none matched). */
  texts: readonly string[];
}

/**
 * Maps her instructions onto Q3B's eleven steps: first by printed label (accepted when the text is
 * at least LABEL_SIMILARITY alike), then the rest by best text similarity (at least
 * TEXT_SIMILARITY). Aligned only when every step matched and the guided script can be built on
 * her words (each clause phrase of the script is in her sentence).
 */
export function alignToQ3B(read: QuestionRead): Alignment {
  const steps = OHMS_LAW_QUESTION.instructions;
  const hers = read.instructions;
  const match: (number | null)[] = steps.map(() => null);
  const used = new Set<number>();
  steps.forEach((step, k) => {
    const j = hers.findIndex(
      (h, idx) =>
        !used.has(idx) &&
        normLabel(h.label) === normLabel(step.label) &&
        similarity(h.text, step.text) >= LABEL_SIMILARITY,
    );
    if (j >= 0) {
      match[k] = j;
      used.add(j);
    }
  });
  const pairs: { k: number; j: number; s: number }[] = [];
  steps.forEach((step, k) => {
    if (match[k] !== null) return;
    hers.forEach((h, j) => {
      if (used.has(j)) return;
      const s = similarity(h.text, step.text);
      if (s >= TEXT_SIMILARITY) pairs.push({ k, j, s });
    });
  });
  pairs.sort((a, b) => b.s - a.s);
  for (const p of pairs) {
    if (match[p.k] !== null || used.has(p.j)) continue;
    match[p.k] = p.j;
    used.add(p.j);
  }
  const texts = steps.map((step, k) => {
    const j = match[k];
    return (j === null || j === undefined ? undefined : hers[j]?.text) ?? step.text;
  });
  let aligned = match.every((m) => m !== null);
  if (aligned) {
    try {
      guidedScriptFor(texts);
    } catch {
      aligned = false;
    }
  }
  return { aligned, match, texts };
}

export interface WatchPlan {
  /** Whether Watch reads and highlights her sentences. */
  aligned: boolean;
  /** What guided Watch's paper shows and its tracker follows: her words, or Q3B. */
  question: PracticalQuestion;
  /** The guided script that reads `question`. */
  script: Script | null;
}

/** What guided Watch reads for her paper: her words when they align with Q3B, else the app's. */
export function watchPlan(read: QuestionRead): WatchPlan {
  const a = alignToQ3B(read);
  if (!a.aligned) return { aligned: false, question: OHMS_LAW_QUESTION, script: null };
  const instructions = OHMS_LAW_QUESTION.instructions.map((step, k) => {
    const j = a.match[k];
    const label =
      (j === null || j === undefined ? undefined : read.instructions[j]?.label) ?? step.label;
    return { label, text: a.texts[k] ?? step.text };
  });
  return {
    aligned: true,
    question: {
      ...toPracticalQuestion(read),
      instructions,
      apparatus: apparatusFor(read, instructions),
    },
    script: guidedScriptFor(a.texts),
  };
}
