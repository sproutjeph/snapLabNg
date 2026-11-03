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

export interface CompletedTurn {
  id: string;
  question: ExaminerQuestion;
  answer: string;
  language: AnswerLanguage;
  reply: ExaminerReply;
}

export interface ExaminerSessionState {
  turns: CompletedTurn[];
  currentQuestion: ExaminerQuestion | null;
  answer: string;
  language: AnswerLanguage;
  isSubmitting: boolean;
  error: string | null;
}

export interface ExaminerConsoleProps {
  first: ExaminerQuestion;
  /** Optional full list of picked questions (up to 3) so all questions render on the sheet. */
  questions?: readonly ExaminerQuestion[];
  /** The lead wires this to the server; the console never calls a model itself. */
  ask(
    input: { question: ExaminerQuestion; answer: string; language: AnswerLanguage },
    signal: AbortSignal,
  ): Promise<ExaminerReply>;
  maxTurns?: number; // default 3
  voice?: boolean; // read examiner text aloud with speechSynthesis; default true
  /** Optional initial session state (used for deterministic rendering in tests). */
  initialState?: ExaminerSessionState;
  /** Optional voice error override (used for deterministic rendering in tests). */
  voiceError?: string | null;
}
