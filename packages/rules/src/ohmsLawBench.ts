import type { OhmsLawRecord } from "@snaplab/contracts";
import { parseNumber } from "./text";

// The reading check after hand-in on the simulated bench (docs/plans/exam-redesign.md, D1(c)):
// per row of her table, what she wrote beside what her own meters showed at that box setting.
// It awards no marks; the accuracy mark stays PHYS-ACCURACY in markOhmsLaw, given the bench's
// effective resistance as the supervisor's value (D1(d)). DRAFT: the one-division tolerance is
// the plan's choice, not a published WAEC figure.

/** One settled pair of readings the bench showed at a box setting while the key was closed. */
export interface BenchLogEntry {
  boxOhm: number;
  iShown: string;
  vShown: string;
}

export interface ReadingCheck {
  /** Index into record.rows, from 0. */
  row: number;
  /** The box setting she wrote for the row, as a number (NaN when it is not a number). */
  boxOhm: number;
  col: "I" | "V";
  wrote: string;
  /** What the meter showed at that setting; null when she never read the bench at it. */
  meterShowed: string | null;
  /** Within one scale division of what the meter showed. */
  ok: boolean;
}

// Floating-point slack, so a reading exactly one division away still counts as within it.
const EPS = 1e-9;

/**
 * Checks each I and V she wrote against the log of what the bench showed. The cells polarise
 * while the key is closed, so one setting can have several settled readings; the one nearest
 * to what she wrote is used, since she may have read the meter at any of those moments.
 */
export function checkReadingsAgainstBench(
  record: OhmsLawRecord,
  log: readonly BenchLogEntry[],
  divisions: { ammeterA: number; voltmeterV: number },
): ReadingCheck[] {
  const out: ReadingCheck[] = [];
  record.rows.forEach((r, row) => {
    const boxOhm = parseNumber(r.R.text_as_written) ?? Number.NaN;
    const atSetting = log.filter((e) => Math.abs(e.boxOhm - boxOhm) < EPS);
    for (const col of ["I", "V"] as const) {
      const wrote = r[col].text_as_written;
      const division = col === "I" ? divisions.ammeterA : divisions.voltmeterV;
      const shownOf = (e: BenchLogEntry) => (col === "I" ? e.iShown : e.vShown);
      const w = parseNumber(wrote);
      let best: { shown: string; gap: number } | null = null;
      for (const e of atSetting) {
        const shown = shownOf(e);
        const s = parseNumber(shown);
        const gap = w === null || s === null ? Number.POSITIVE_INFINITY : Math.abs(w - s);
        if (best === null || gap < best.gap) best = { shown, gap };
      }
      out.push({
        row,
        boxOhm,
        col,
        wrote,
        meterShowed: best?.shown ?? null,
        ok: best !== null && best.gap <= division + EPS,
      });
    }
  });
  return out;
}
