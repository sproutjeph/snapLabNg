import type { QuestionRead } from "@snaplab/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { getSnappedPaper, setSnappedPaper } from "../../snapq/store";
import { alignToQ3B, similarity, toPracticalQuestion, watchPlan } from "./fromSnap";
import { OHMS_LAW_QUESTION } from "./ohmsLawQuestion";
import { itemTriggers } from "./readAloud";
import { COPY_NOTE, demoSnappedPaper, LOST_NOTE, paperContextFrom } from "./snapContext";

function readOf(
  instructions: { label: string; text: string }[],
  apparatus: QuestionRead["apparatus"] = [],
): QuestionRead {
  return {
    experiment: "ohms_law_vi",
    confidence: "high",
    source_as_printed: null,
    title_as_printed: null,
    apparatus,
    instructions,
    diagram: { present: true, photo: 1, parts: [] },
  };
}

const Q3B = demoSnappedPaper().question;

describe("toPracticalQuestion", () => {
  it("keeps her instructions word for word and her source and title", () => {
    const q = toPracticalQuestion(Q3B);
    expect(q.instructions).toEqual(OHMS_LAW_QUESTION.instructions);
    expect(q.source).toBe(OHMS_LAW_QUESTION.source);
    expect(q.title).toBe(OHMS_LAW_QUESTION.title);
    expect(q.apparatus.map((a) => a.part).sort()).toEqual(
      OHMS_LAW_QUESTION.apparatus.map((a) => a.part).sort(),
    );
  });

  it("falls back to 'Your question' and the Ohm's law title when none is printed", () => {
    const q = toPracticalQuestion(readOf([{ label: "1", text: "Connect the circuit." }]));
    expect(q.source).toBe("Your question");
    expect(q.title).toBe("Ohm's law (V–I)");
  });

  it("maps kinds to bench parts, drops the rest, and every text occurs in an instruction", () => {
    const q = toPracticalQuestion(
      readOf(
        [
          { label: "1", text: "Use the ammeters, the rheostat and a galvanometer." },
          { label: "2", text: "Connect A to the cell E and the key K." },
        ],
        [
          { kind: "ammeter", text_as_printed: "ammeters" },
          { kind: "rheostat", text_as_printed: "the rheostat" },
          { kind: "galvanometer", text_as_printed: "a galvanometer" },
          { kind: "other", text_as_printed: "key K" },
        ],
      ),
    );
    const parts = q.apparatus.map((a) => a.part);
    expect(parts).not.toContain("rheostat" as never);
    expect(q.apparatus.find((a) => a.part === "ammeter")?.text).toBe("ammeters");
    // Q3B's "key K" and the letters "E" and "A" are found as whole words.
    expect(q.apparatus.find((a) => a.part === "key")?.text).toBe("key K");
    expect(q.apparatus.find((a) => a.part === "cells")?.text).toBe("E");
    for (const a of q.apparatus) {
      expect(q.instructions.some((i) => i.text.includes(a.text))).toBe(true);
    }
    // Never a letter inside a word: "A" is not found in "Connect".
    expect(itemTriggers(q).every((t) => t.at >= 0)).toBe(true);
  });

  it("leaves out a part the paper never names (the stage drops it after the reading)", () => {
    const q = toPracticalQuestion(readOf([{ label: "1", text: "Do the experiment." }]));
    expect(q.apparatus).toEqual([]);
  });
});

describe("alignToQ3B", () => {
  it("aligns Q3B itself perfectly", () => {
    const a = alignToQ3B(Q3B);
    expect(a.aligned).toBe(true);
    expect(a.match).toEqual(OHMS_LAW_QUESTION.instructions.map((_, k) => k));
    expect(watchPlan(Q3B).script).not.toBeNull();
  });

  it("stays aligned with OCR-ish differences, and Watch then reads her words", () => {
    const noisy = readOf(
      OHMS_LAW_QUESTION.instructions.map((i) => ({
        label: i.label,
        text: i.text
          .replace("length", "lenqth")
          .replace("Plot", "Plot,")
          .replace("the law", "the iaw"),
      })),
    );
    const a = alignToQ3B(noisy);
    expect(a.aligned).toBe(true);
    const plan = watchPlan(noisy);
    expect(plan.aligned).toBe(true);
    expect(plan.question.instructions[1]?.text).toContain("lenqth");
    const spoken = plan.script?.beats.find((b) => b.id === "q2")?.spoken ?? "";
    expect(spoken).toContain("lenqth");
  });

  it("aligns with no printed labels, by text", () => {
    const a = alignToQ3B(
      readOf(OHMS_LAW_QUESTION.instructions.map((i, k) => ({ label: `x${k}`, text: i.text }))),
    );
    expect(a.aligned).toBe(true);
  });

  it("does not align a different question; Watch then reads the app's copy", () => {
    const other = readOf([
      { label: "1", text: "You are provided with a metre bridge, a galvanometer and a cell." },
      { label: "2", text: "Connect the circuit as shown." },
      { label: "3", text: "Find the balance point for R = 2 Ω." },
      { label: "4", text: "Repeat for other values of R." },
    ]);
    expect(alignToQ3B(other).aligned).toBe(false);
    const plan = watchPlan(other);
    expect(plan.aligned).toBe(false);
    expect(plan.question).toBe(OHMS_LAW_QUESTION);
    expect(plan.script).toBeNull();
  });

  const withText = (k: number, text: string) =>
    readOf(
      OHMS_LAW_QUESTION.instructions.map((i, n) => ({
        label: i.label,
        text: n === k ? text : i.text,
      })),
    );

  it("does not align when a step's numbers differ from Q3B's", () => {
    const r2 = alignToQ3B(
      withText(
        3,
        "With R = 2 Ω, close the key K. Read and record the current I and the corresponding voltage drop V across the wire.",
      ),
    );
    expect(r2.match.every((m) => m !== null)).toBe(true);
    expect(r2.aligned).toBe(false);
    expect(
      alignToQ3B(withText(5, "Repeat for five other values of R = 4, 6, 8, 10 and 12 Ω. Tabulate."))
        .aligned,
    ).toBe(false);
  });

  it("does not align when the plot is I against V", () => {
    const a = alignToQ3B(withText(6, "Plot I (vertical) against V (horizontal)."));
    expect(a.match[6]).toBe(6);
    expect(a.aligned).toBe(false);
  });

  it("trusts a label only when its text is also the step's best match", () => {
    // Labels 4 and 5 swapped: each step still finds its own words, so Watch reads the right ones.
    const swapped = readOf(
      OHMS_LAW_QUESTION.instructions.map((i) => ({
        label: i.label === "4" ? "5" : i.label === "5" ? "4" : i.label,
        text: i.text,
      })),
    );
    const a = alignToQ3B(swapped);
    expect(a.match[3]).toBe(3);
    expect(a.match[4]).toBe(4);
    expect(a.aligned).toBe(true);
    // Step 5's words filed under label 4, with step 4's words gone: not aligned (R = 0 is missing).
    const lost = readOf(
      OHMS_LAW_QUESTION.instructions
        .filter((_, k) => k !== 3)
        .map((i) => ({ label: i.label === "5" ? "4" : i.label, text: i.text })),
    );
    const b = alignToQ3B(lost);
    expect(b.aligned).toBe(false);
  });

  it("does not align when a step Watch drives is missing", () => {
    const missing = readOf(OHMS_LAW_QUESTION.instructions.slice(0, 8));
    expect(alignToQ3B(missing).aligned).toBe(false);
  });

  it("scores identical text 1 and unrelated text low", () => {
    expect(similarity("Determine the slope s.", "Determine the slope s.")).toBe(1);
    expect(similarity("Determine the slope s.", "Find the balance point")).toBeLessThan(0.4);
  });
});

describe("paperContextFrom", () => {
  afterEach(() => setSnappedPaper(null));
  const params = (s: string) => new URLSearchParams(s);

  it("changes nothing without question=snapped", () => {
    const c = paperContextFrom(params("practical=ohms-law"));
    expect(c.question).toBe(OHMS_LAW_QUESTION);
    expect(c.snapped).toBe(false);
    expect(c.note).toBeNull();
  });

  it("uses the app's copy with a note when the snapped paper is gone", () => {
    const c = paperContextFrom(params("practical=ohms-law&question=snapped"));
    expect(c.lost).toBe(true);
    expect(c.question).toBe(OHMS_LAW_QUESTION);
    expect(c.note).toBe(LOST_NOTE);
  });

  it("uses her question and photo, and notes a copy only when not aligned", () => {
    const snap = demoSnappedPaper();
    setSnappedPaper(snap);
    const c = paperContextFrom(params("practical=ohms-law&question=snapped"));
    expect(c.lost).toBe(false);
    expect(c.photo).toBe(snap.photos[1]);
    expect(c.note).toBeNull();
    setSnappedPaper({
      ...snap,
      question: readOf([{ label: "1", text: "A metre bridge." }]),
    });
    const d = paperContextFrom(params("practical=ohms-law&question=snapped"));
    expect(d.note).toBe(COPY_NOTE);
    expect(d.watchQuestion).toBe(OHMS_LAW_QUESTION);
    expect(d.question.instructions).toHaveLength(1);
  });

  it("seeds the demo paper only with snapdemo=1 (dev)", () => {
    expect(getSnappedPaper()).toBeNull();
    const c = paperContextFrom(params("question=snapped&snapdemo=1"));
    expect(c.lost).toBe(false);
    expect(c.watchScript).not.toBeNull();
  });
});
