export type AnswerLanguage = "english" | "pidgin" | "mixed";
export type Verdict = "correct" | "partly" | "needs_work";

export interface ExaminerQuestion {
  id: string;
  text: string;
  /** e.g. "PRECAUTIONS" – which of her mistakes it probes */
  rule: string | null;
}

export interface ExaminerReply {
  verdict: Verdict;
  reply: string;
  modelAnswer: string;
  next: ExaminerQuestion | null;
}

export interface ExaminerConsoleProps {
  first: ExaminerQuestion;
  /** The lead wires this to the server; the console never calls a model itself. */
  ask(
    input: { question: ExaminerQuestion; answer: string; language: AnswerLanguage },
    signal: AbortSignal,
  ): Promise<ExaminerReply>;
  maxTurns?: number; // default 3
  voice?: boolean; // read examiner text aloud with speechSynthesis; default true
}
