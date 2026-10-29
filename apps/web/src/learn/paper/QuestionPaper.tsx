import type { QuestionPaperProps } from "./types";

// STUB (Wave 0): the question paper arrives in W1-paper.
export function QuestionPaper({ question }: QuestionPaperProps) {
  return <p>{question.title}</p>;
}
