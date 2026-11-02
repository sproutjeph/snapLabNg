import type { Box, QuestionRead } from "@snaplab/contracts";

// Placeholder for Gemini's overlay (gemini/found-overlay, docs/plans/snap-question.md,
// "Gemini: found overlay"). Same props; replace the body.

export interface FoundOverlayProps {
  /** Object URL of the photo the diagram is on. */
  photo: string;
  /** The parts Spark found on that photo, in the order found; grows as they arrive. */
  parts: QuestionRead["diagram"]["parts"];
  /** SAM's box per part index, when SAM found one; otherwise the part's own Spark box is drawn. */
  outlines: ReadonlyMap<number, Box>;
  /** The part to emphasise (index into `parts`), or null. */
  highlight: number | null;
}

export function FoundOverlay({ photo }: FoundOverlayProps) {
  return <img src={photo} alt="Your diagram" data-testid="found-overlay" />;
}

export default FoundOverlay;
