import { DIAGRAM_LEADS } from "@snaplab/engine";
import type { BenchState, LessonMode } from "../../types";

// Step checks for the V–I lesson. "Done" means she did the step (procedure), never that it is
// right: correctness comes only from packages/rules when she hands in. In exam mode a check
// must not confirm her wiring, so "connect" only asks that she made the leads.

const filled = (t: string | null | undefined) => (t ?? "").trim().length > 0;

/** A row of her table for this R with both meter readings written. */
const hasRow = (s: BenchState, rOhm: number) =>
  s.record.rows.some(
    (r) => r.R.value === rOhm && filled(r.I.text_as_written) && filled(r.V.text_as_written),
  );

export function ohmsLawStepDone(
  key: string,
  s: BenchState,
  mode: LessonMode,
  leadCount: number,
): boolean {
  switch (key) {
    case "identify":
      return s.identified.size >= 3;
    case "measure-xy":
      return filled(s.record.length_xy?.text_as_written);
    case "connect":
      return mode === "exam" ? leadCount >= DIAGRAM_LEADS.length : s.comparison.matches;
    case "r0":
      return hasRow(s, 0);
    case "r1":
      return hasRow(s, 1);
    case "repeat":
      return [5, 10, 20, 40, 60].every((r) => hasRow(s, r));
    case "plot":
      return (s.record.graph?.points.length ?? 0) >= 5;
    case "slope":
      return filled(s.record.graph?.slope_as_written);
    case "precautions":
      return s.record.precautions.filter(filled).length >= 2;
    case "law":
      return filled(s.record.law_as_written);
    case "length":
      return filled(s.record.length_calc_as_written);
    default:
      return false;
  }
}
