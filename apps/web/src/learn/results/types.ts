import type { MarkSheet, OhmsLawRecord } from "@snaplab/contracts";
import type { ReadingCheck } from "@snaplab/rules";

// The results after hand-in (docs/plans/exam-redesign.md, D1(b)–(d)). Only shown after she
// hands in; nothing here reaches the screen before. FROZEN for Waves 1–2; ask the lead.

export interface ResultsProps {
  mode: "practice" | "exam";
  /** markOhmsLaw(record, { teacherXyOhm: supervisor.effectiveOhm() }): 21 marks. */
  sheet: MarkSheet;
  /** checkReadingsAgainstBench(record, supervisor.log(), divisions), per row and column. */
  checks: readonly ReadingCheck[];
  /** Her record as handed in: her slope is read from her graph, as written. */
  record: OhmsLawRecord;
  /** The bench's resistance of XY (supervisor.effectiveOhm()), shown beside her slope. */
  benchOhm: number;
  onAgain(): void;
  onWatch(): void;
}
