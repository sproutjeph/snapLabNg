import type { OhmsLawRecord } from "@snaplab/contracts";
import { checkReadingsAgainstBench, markOhmsLaw } from "@snaplab/rules";
import type { OhmsLawBench } from "../types";
import type { ResultsProps } from "./types";

// Hand-in (docs/plans/exam-redesign.md, D1(b)–(d)): the real rules mark her record against the
// bench's own truth. Nothing is computed here; every value comes from the supervisor and rules.

/** What the results screen shows, minus its two buttons. */
export function handIn(
  record: OhmsLawRecord,
  bench: OhmsLawBench,
  mode: "practice" | "exam",
): Omit<ResultsProps, "onAgain" | "onWatch"> {
  const { supervisor, params } = bench;
  const benchOhm = supervisor.effectiveOhm();
  return {
    mode,
    sheet: markOhmsLaw(record, { teacherXyOhm: benchOhm }),
    checks: checkReadingsAgainstBench(record, supervisor.log(), {
      ammeterA: params.ammeter.division,
      voltmeterV: params.voltmeter.division,
    }),
    record,
    benchOhm,
  };
}
