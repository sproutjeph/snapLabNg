import type { Box, QuestionRead } from "@snaplab/contracts";

// Snap your question (docs/plans/snap-question.md): the paper she snapped, held for this page's
// life so the practical can read it after the client-side navigate(). A full page load drops it,
// and the practical then falls back to the app's own question. Lead-owned contract.

export interface SnappedPaper {
  /** Spark's reading of her paper, as validated from the `question` event. */
  question: QuestionRead;
  /** Object URLs of her photos, in the order sent (the diagram is `question.diagram.photo`). */
  photos: readonly string[];
  /** SAM's outline box per drawn part (index into `question.diagram.parts`), when SAM found one. */
  outlines: ReadonlyMap<number, Box>;
}

let current: SnappedPaper | null = null;

/** Keeps her paper for the practical (null forgets it). */
export function setSnappedPaper(p: SnappedPaper | null): void {
  current = p;
}

/** The paper she snapped this session, or null. */
export function getSnappedPaper(): SnappedPaper | null {
  return current;
}

/** Where Build the bench goes: the Ohm's law practical on her question. */
export const SNAPPED_PRACTICAL_URL = "/?practical=ohms-law&question=snapped";

/** Home's Snap your question button. */
export const SNAP_QUESTION_URL = "/?snap=question";

/** The sample pages (our own typeset Q3B, no WAEC scan) for Try a sample. */
export const SAMPLE_PHOTOS = ["/samples/q3b-question.jpg", "/samples/q3b-diagram.jpg"] as const;
