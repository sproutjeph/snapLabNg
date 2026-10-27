import { describe, expect, it } from "vitest";
import {
  G1_FIRST_QUESTION,
  mockAsk,
  Q1_JOCKEY_SLIDE,
  Q2_PRECAUTION_TENSE,
  Q3_CELL_WEAKENING,
} from "./mockExaminer";
import { pickVoice } from "./speak";

function makeVoice(lang: string, name: string): SpeechSynthesisVoice {
  return {
    lang,
    name,
    default: false,
    localService: true,
    voiceURI: name,
  };
}

describe("pickVoice", () => {
  it("picks en-NG over en-GB over en-US", () => {
    const ng = makeVoice("en-NG", "Nigerian English Voice");
    const gb = makeVoice("en-GB", "British English Voice");
    const us = makeVoice("en-US", "American English Voice");

    // All three present: prefers en-NG
    expect(pickVoice([us, gb, ng])).toBe(ng);
    expect(pickVoice([ng, us, gb])).toBe(ng);

    // Only GB and US: prefers en-GB
    expect(pickVoice([us, gb])).toBe(gb);

    // Only US: falls back to US
    expect(pickVoice([us])).toBe(us);
  });

  it("returns null for no English voice", () => {
    const fr = makeVoice("fr-FR", "Voix française");
    const de = makeVoice("de-DE", "Deutsche Stimme");

    expect(pickVoice([fr, de])).toBeNull();
    expect(pickVoice([])).toBeNull();
  });
});

describe("mockExaminer", () => {
  it("evaluates Pidgin jockey answer as correct or partly, not needs_work", async () => {
    const result = await mockAsk({
      question: Q1_JOCKEY_SLIDE,
      answer: "E go scratch am, the wire no go dey uniform",
      language: "pidgin",
    });

    expect(result.verdict).not.toBe("needs_work");
    expect(["correct", "partly"]).toContain(result.verdict);
    expect(result.reply.length).toBeGreaterThan(0);
    expect(result.next?.id).toBe(Q2_PRECAUTION_TENSE.id);
  });

  it("evaluates 'I don\\'t know' for jockey question as needs_work", async () => {
    const result = await mockAsk({
      question: Q1_JOCKEY_SLIDE,
      answer: "I don't know",
      language: "english",
    });

    expect(result.verdict).toBe("needs_work");
    expect(result.reply).toMatch(/thin resistance wire|thickness/i);
    expect(result.next?.id).toBe(Q2_PRECAUTION_TENSE.id);
  });

  it("returns an English model answer mentioning scratch/scraping or wire uniformity", async () => {
    const result = await mockAsk({
      question: Q1_JOCKEY_SLIDE,
      answer: "I am not sure",
      language: "english",
    });

    expect(result.modelAnswer).toMatch(/scratch|scrape/i);
    expect(result.modelAnswer).toMatch(/uniform/i);
  });

  it("evaluates a past passive precaution example as at least partly and asks why", async () => {
    const result = await mockAsk({
      question: Q2_PRECAUTION_TENSE,
      answer: "The key was opened between readings",
      language: "english",
    });

    expect(["correct", "partly"]).toContain(result.verdict);
    expect(result.reply).toMatch(/right tense|correct tense/i);
    expect(result.reply).toMatch(/why/i);
    expect(result.next?.id).toBe(Q3_CELL_WEAKENING.id);
  });

  it("handles the 3-question sequence and stops when next is null (max 3 turns)", async () => {
    // Turn 1
    const t1 = await mockAsk({
      question: G1_FIRST_QUESTION,
      answer: "Sliding scrapes the wire making the cross-sectional area non-uniform",
      language: "english",
    });
    expect(t1.verdict).toBe("correct");
    expect(t1.next?.id).toBe(Q2_PRECAUTION_TENSE.id);
    if (!t1.next) {
      throw new Error("expected next question after turn 1");
    }

    // Turn 2
    const t2 = await mockAsk({
      question: t1.next,
      answer: "Past passive tense because it was an action already done in the lab",
      language: "english",
    });
    expect(t2.verdict).toBe("correct");
    expect(t2.next?.id).toBe(Q3_CELL_WEAKENING.id);
    if (!t2.next) {
      throw new Error("expected next question after turn 2");
    }

    // Turn 3
    const t3 = await mockAsk({
      question: t2.next,
      answer: "No, the balance point depends only on the resistance ratio",
      language: "english",
    });
    expect(t3.verdict).toBe("correct");
    expect(t3.next).toBeNull();
  });

  it("aborts mockAsk when signal is aborted", async () => {
    const ac = new AbortController();
    ac.abort();

    await expect(
      mockAsk(
        {
          question: Q1_JOCKEY_SLIDE,
          answer: "test answer",
          language: "english",
        },
        ac.signal,
      ),
    ).rejects.toThrow();
  });
});
