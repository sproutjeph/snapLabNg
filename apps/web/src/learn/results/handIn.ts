import type { OhmsLawRecord } from "@snaplab/contracts";
import { checkReadingsAgainstBench, markOhmsLaw } from "@snaplab/rules";
import type { OhmsLawBench } from "../types";
import type { ResultsProps } from "./types";

// Hand-in (docs/plans/exam-redesign.md, D1(b)–(d)): the real rules mark what she wrote, and her
// readings are checked against what the bench's own meters showed. On a simulated bench the
// engine's meters are the supervisor's values (AGENTS.md, hard rules; docs/plans/integration.md,
// I1), so no teacher's resistance is passed and the accuracy mark is not in play: 20 marks.
// Nothing is computed here; every value comes from the supervisor and rules.

/**
 * For the E2E hook only (learn/e2e.ts, present only with ?e2e=1): what the meters show now, as
 * numbers (NaN while a needle moves or is off scale), and the wire's resistance for the no-leak
 * check. Nothing on the page reads these.
 */
export function benchTruthForE2E(bench: Pick<OhmsLawBench, "supervisor">) {
  const { supervisor } = bench;
  const num = (text: string | null) => (text === null ? Number.NaN : Number(text));
  return {
    meters: () => ({
      i: num(supervisor.reading("ammeter")),
      v: num(supervisor.reading("voltmeter")),
    }),
    wireOhm: () => supervisor.effectiveOhm(),
  };
}

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
    sheet: markOhmsLaw(record),
    checks: checkReadingsAgainstBench(record, supervisor.log(), {
      ammeterA: params.ammeter.division,
      voltmeterV: params.voltmeter.division,
      // Once a zero-adjust trim exists, pass the zero error left after the trim.
      ammeterZeroErrorA: params.ammeter.zeroError,
    }),
    record,
    benchOhm,
  };
}
