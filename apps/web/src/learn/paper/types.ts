import type { PartId, PracticalMode } from "../types";
import type { VoiceGuide } from "../voice/types";

// The question paper (docs/plans/exam-redesign.md, "The experience"). FROZEN for Waves 1–2;
// ask the lead.

/** A practical's question, as printed on the paper. */
export interface PracticalQuestion {
  /** e.g. "WASSCE (SC) 2018, Physics Paper 3, Question 3B". */
  source: string;
  title: string;
  /** The apparatus list, one item per part, in the order the paper names them. */
  apparatus: readonly { part: PartId; text: string }[];
  /** The numbered instructions, word for word. */
  instructions: readonly { label: string; text: string }[];
}

export interface QuestionPaperProps {
  question: PracticalQuestion;
  voice: VoiceGuide;
  /** Called as the voice names each item, so the stage can land it on the bench. */
  onItemRead?(part: PartId): void;
  /** She chose how to go on. */
  onChoose(mode: PracticalMode): void;
  /**
   * Guided Watch (?mode=guided): the reading starts at once, the mode choices give way to Skip,
   * and the page goes on when the reading ends or she skips. Without it the paper is as before.
   */
  guided?:
    | {
        onDone(): void;
        onSkip(): void;
        /** Keep the bench empty (true) while the reading waits to be heard, or let it fill (false). */
        onHold?(held: boolean): void;
        /** She tapped to start: the reading starts over, so the parts go back up to drop again. */
        onRestart?(): void;
      }
    | undefined;
}
