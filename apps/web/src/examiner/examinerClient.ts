import { ExaminerTurnResponse } from "@snaplab/contracts";
import type { PickedQuestion } from "@snaplab/rules";
import type { ExaminerConsoleProps } from "./types";

/**
 * The console's `ask`, backed by POST /api/examiner. The question list comes from
 * `examinerQuestions(sheet)` in packages/rules; the server only judges her answer.
 */
export function makeAsk(
  list: PickedQuestion[],
  fetchImpl: typeof fetch = fetch,
): ExaminerConsoleProps["ask"] {
  return async ({ question, answer, language }, signal) => {
    const i = list.findIndex((p) => p.question.id === question.id);
    if (i === -1) throw new Error(`question ${question.id} is not in this list`);
    const res = await fetchImpl("/api/examiner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question_id: question.id,
        answer,
        language,
        her_mistake: list[i]?.her_mistake ?? null,
      }),
      signal,
    });
    if (!res.ok) throw new Error(`examiner answered HTTP ${res.status}`);
    const r = ExaminerTurnResponse.parse(await res.json());
    return {
      verdict: r.verdict,
      reply: r.reply,
      modelAnswer: r.model_answer,
      next: list[i + 1]?.question ?? null,
    };
  };
}
