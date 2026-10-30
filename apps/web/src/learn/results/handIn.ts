import type { OhmsLawRecord } from "@snaplab/contracts";
import { checkReadingsAgainstBench, markOhmsLaw } from "@snaplab/rules";
import type { OhmsLawBench } from "../types";
import type { ResultsProps } from "./types";

// Hand-in (docs/plans/exam-redesign.md, D1(b)–(d)): the real rules mark her record against the
// bench's own truth. Nothing is computed here; every value comes from the supervisor and rules.

/**
 * For the E2E hook only (learn/e2e.ts, present only with ?e2e=1): what the meters show now, as
 * numbers (NaN while a needle moves or is off scale), and the wire's resistance for the no-leak
 * check. Nothing on the page reads these.
 *
 * Just after a change (the key, a plug) the needle has not left its old place yet, so the dial
 * still reads the old value as settled. The hook answers NaN after any bench change until it has
 * seen a needle move, or for STILL_AFTER_CHANGE_MS when nothing moves, so "wait until meters()
 * is a number" waits for the new reading.
 */
export function benchTruthForE2E(bench: Pick<OhmsLawBench, "supervisor" | "subscribe">) {
  const { supervisor } = bench;
  const num = (text: string | null) => (text === null ? Number.NaN : Number(text));
  let changedAtMs = Number.NEGATIVE_INFINITY;
  let moved = true;
  bench.subscribe(() => {
    changedAtMs = performance.now();
    moved = false;
  });
  const read = (meter: "ammeter" | "voltmeter") => {
    const text = supervisor.reading(meter);
    if (text === null) moved = true;
    return text;
  };
  return {
    meters: () => {
      const i = read("ammeter");
      const v = read("voltmeter");
      const fresh = moved || performance.now() - changedAtMs > STILL_AFTER_CHANGE_MS;
      return fresh ? { i: num(i), v: num(v) } : { i: Number.NaN, v: Number.NaN };
    },
    wireOhm: () => supervisor.effectiveOhm(),
  };
}

/** How long after a change with no needle moving the E2E hook trusts the dials again. */
const STILL_AFTER_CHANGE_MS = 1500;

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
      // Once a zero-adjust trim exists, pass the zero error left after the trim.
      ammeterZeroErrorA: params.ammeter.zeroError,
    }),
    record,
    benchOhm,
  };
}
