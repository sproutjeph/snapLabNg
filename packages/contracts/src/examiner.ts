import { z } from "zod";
import { RuleCode } from "./marks";

// Examiner questions (docs/04 §2 ⑥, docs/06 §5.5). The questions and their model answers
// come from a fixed bank in packages/rules; Spark only judges her answer. Marks never change.

export const AnswerLanguage = z.enum(["english", "pidgin", "mixed"]);
export type AnswerLanguage = z.infer<typeof AnswerLanguage>;

export const Verdict = z.enum(["correct", "partly", "needs_work"]);
export type Verdict = z.infer<typeof Verdict>;

/** One question from the bank, with its model answer in clear formal English. */
export const ExaminerQuestion = z.strictObject({
  id: z.string().min(1),
  text: z.string().min(1),
  /** The rule of her mistake it probes; null for a general bank question. */
  rule: RuleCode.nullable(),
  model_answer: z.string().min(1),
});
export type ExaminerQuestion = z.infer<typeof ExaminerQuestion>;

/** POST /api/examiner. Stateless: the client keeps the question list. */
export const ExaminerTurnRequest = z.strictObject({
  question_id: z.string().min(1).max(64),
  answer: z.string().trim().min(1).max(600),
  language: AnswerLanguage,
  /** Her own words for the mistake the question probes, exactly as written; null if none. */
  her_mistake: z.string().max(300).nullable(),
});
export type ExaminerTurnRequest = z.infer<typeof ExaminerTurnRequest>;

/**
 * What Spark returns (strict JSON Schema). No length keywords in the schema: the server
 * trims the reply and refuses an empty one.
 */
export const ExaminerJudgement = z.strictObject({
  verdict: Verdict,
  reply: z.string(),
});
export type ExaminerJudgement = z.infer<typeof ExaminerJudgement>;

export const ExaminerTurnResponse = z.strictObject({
  verdict: Verdict,
  reply: z.string().min(1),
  /** Always the bank's model answer, never the model's. */
  model_answer: z.string().min(1),
});
export type ExaminerTurnResponse = z.infer<typeof ExaminerTurnResponse>;
