import type { AnswerLanguage, ExaminerQuestion, ExaminerReply, Verdict } from "./types";

/**
 * STAND-IN ONLY:
 * This scripted examiner is a client-side mock and stand-in for the real model
 * (Muse Spark 1.3 via /api/examiner) used during local development, preview, and testing.
 * Questions and model answers are grounded in docs/07_SCIENCE_ENGINE.md §6 and Golden Page 1 (G1).
 */

export const Q1_JOCKEY_SLIDE: ExaminerQuestion = {
  id: "q-jockey-slide",
  text: "Why must you not slide the jockey along the wire?",
  rule: "PRECAUTIONS",
};

export const Q2_PRECAUTION_TENSE: ExaminerQuestion = {
  id: "q-precaution-tense",
  text: "In what tense should precautions be written in your WAEC report, and why?",
  rule: "PRECAUTIONS",
};

export const Q3_CELL_WEAKENING: ExaminerQuestion = {
  id: "q-cell-weakening",
  text: "Does a weakening cell change the balance point?",
  rule: null,
};

export const G1_FIRST_QUESTION: ExaminerQuestion = Q1_JOCKEY_SLIDE;

export async function mockAsk(
  input: { question: ExaminerQuestion; answer: string; language: AnswerLanguage },
  signal?: AbortSignal,
): Promise<ExaminerReply> {
  if (signal?.aborted) {
    throw new DOMException("The request was aborted", "AbortError");
  }

  // Small asynchronous pause to simulate model response time
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 150);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("The request was aborted", "AbortError"));
    });
  });

  const raw = input.answer.trim().toLowerCase();

  switch (input.question.id) {
    case "q-jockey-slide": {
      const mentionsScrape =
        raw.includes("scratch") ||
        raw.includes("scrape") ||
        raw.includes("scratch am") ||
        raw.includes("spoil") ||
        raw.includes("wear");
      const mentionsUniform =
        raw.includes("uniform") ||
        raw.includes("uneven") ||
        raw.includes("diameter") ||
        raw.includes("cross-section") ||
        raw.includes("cross section") ||
        raw.includes("no go dey uniform");

      let verdict: Verdict = "needs_work";
      let reply =
        "Not quite. Think about what dragging metal across a thin resistance wire does to its thickness and uniform resistance.";

      if (mentionsScrape && mentionsUniform) {
        verdict = "correct";
        reply =
          "Spot on. Sliding scratches the wire and alters its uniform cross-sectional area, which ruins resistance accuracy.";
      } else if (mentionsScrape || mentionsUniform) {
        verdict = "partly";
        reply =
          "You're on the right track. Specifically, sliding scrapes the wire so its cross-sectional area and resistance stop being uniform.";
      }

      return {
        verdict,
        reply,
        modelAnswer:
          "The jockey must not be slid along the wire because sliding scratches or scrapes the wire, making its cross-sectional area non-uniform and causing uneven resistance along its length. It should be tapped gently at contact points.",
        next: Q2_PRECAUTION_TENSE,
      };
    }

    case "q-precaution-tense": {
      const mentionsPast =
        raw.includes("past") ||
        raw.includes("passive") ||
        raw.includes("e don happen") ||
        raw.includes("done happen");
      const mentionsAction =
        raw.includes("done") ||
        raw.includes("was done") ||
        raw.includes("were done") ||
        raw.includes("action") ||
        raw.includes("report") ||
        raw.includes("carried out") ||
        raw.includes("wetin you do");
      const isPastPassiveExample = /\b(was|were)\s+\w+(ed|en)\b/i.test(raw);

      let verdict: Verdict = "needs_work";
      let reply =
        "Remember that WAEC examiners penalize imperative commands like 'Avoid parallax'. State precautions as actions completed, such as 'Parallax error was avoided'.";

      if ((mentionsPast || isPastPassiveExample) && (mentionsAction || raw.includes("tense"))) {
        verdict = "correct";
        reply =
          "Exactly right. WAEC expects the past passive tense because you are reporting specific actions you actually carried out.";
      } else if (isPastPassiveExample) {
        verdict = "partly";
        reply =
          "Your sentence is in the right tense (past passive). Why is this tense required instead of giving instructions?";
      } else if (mentionsPast || raw.includes("tense")) {
        verdict = "partly";
        reply =
          "Good. State precautions in the past passive tense to show what was actually done in the laboratory.";
      }

      return {
        verdict,
        reply,
        modelAnswer:
          "Precautions must be recorded in the past passive tense (for example, 'The key was opened between readings') because they report actual procedures carried out during the experiment, not generic instructions or rules.",
        next: Q3_CELL_WEAKENING,
      };
    }

    case "q-cell-weakening": {
      const isNegative =
        /\bno\b/.test(raw) ||
        raw.includes("does not") ||
        raw.includes("doesn't") ||
        raw.includes("won't") ||
        raw.includes("will not") ||
        raw.includes("e no go change") ||
        raw.includes("e no dey change") ||
        raw.includes("no change") ||
        raw.includes("independent");
      const isAffirmative =
        /\byes\b/.test(raw) || raw.includes("it will") || raw.includes("e go change");

      let verdict: Verdict = "needs_work";
      let reply =
        "Actually, it does not. The balance point is a null condition where no current flows through the galvanometer, depending only on the resistance ratio.";

      if (isNegative && !isAffirmative) {
        verdict = "correct";
        reply =
          "Correct! The balance point depends only on the ratio of resistances. A weakening cell drops galvanometer sensitivity, but does not shift the balance position.";
      } else if (raw.includes("sensitivity")) {
        verdict = "partly";
        reply =
          "You noted sensitivity, but the balance point itself does not change because it is a null measurement.";
      }

      return {
        verdict,
        reply,
        modelAnswer:
          "No, a weakening cell does not change the balance point. The balance condition depends solely on the ratio of resistances (R / X = l / (100 − l)) and is independent of the cell's EMF, although a weak cell reduces the sensitivity of the galvanometer.",
        next: null,
      };
    }

    default:
      return {
        verdict: "needs_work",
        reply: "Thank you for your response.",
        modelAnswer: "Be sure to consult standard WAEC practical guidelines for this question.",
        next: null,
      };
  }
}
