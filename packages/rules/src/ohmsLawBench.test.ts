// Tests for the reading check after hand-in (docs/plans/exam-redesign.md, D1(c)). DRAFT: the
// one-division tolerance is the plan's; the divisions are the bench's meters (docs/07 §4.4:
// ammeter 0–1 A in 0.02 A divisions, voltmeter 0–3 V in 0.05 V divisions).
import type { OhmsLawRecord } from "@snaplab/contracts";
import { describe, expect, it } from "vitest";
import { type BenchLogEntry, checkReadingsAgainstBench } from "./ohmsLawBench";
import { OHMS_GOOD } from "./ohmsLawGolden";

const DIVISIONS = { ammeterA: 0.02, voltmeterV: 0.05 };

/** A log that shows exactly what OHMS_GOOD wrote at each of its seven settings. */
const SAME_AS_GOOD: BenchLogEntry[] = OHMS_GOOD.rows.map((r) => ({
  boxOhm: Number(r.R.text_as_written),
  iShown: r.I.text_as_written,
  vShown: r.V.text_as_written,
}));

const withCell = (row: number, col: "R" | "I" | "V", text: string): OhmsLawRecord => ({
  ...OHMS_GOOD,
  rows: OHMS_GOOD.rows.map((r, i) =>
    i === row ? { ...r, [col]: { value: null, unit_as_written: null, text_as_written: text } } : r,
  ),
});

const find = (checks: ReturnType<typeof checkReadingsAgainstBench>, row: number, col: "I" | "V") =>
  checks.find((c) => c.row === row && c.col === col);

describe("her readings against her own bench", () => {
  it("passes every I and V of a table copied off the meters, two checks per row", () => {
    const checks = checkReadingsAgainstBench(OHMS_GOOD, SAME_AS_GOOD, DIVISIONS);
    expect(checks).toHaveLength(OHMS_GOOD.rows.length * 2);
    expect(checks.every((c) => c.ok)).toBe(true);
    expect(find(checks, 2, "I")).toEqual({
      row: 2,
      boxOhm: 5,
      col: "I",
      wrote: "0.30",
      meterShowed: "0.30",
      ok: true,
    });
  });

  it("allows one division either way and fails beyond it", () => {
    // Row 2 (R = 5 Ω) wrote I = 0.30 A and V = 0.90 V.
    const log = (iShown: string, vShown: string) =>
      SAME_AS_GOOD.map((e) => (e.boxOhm === 5 ? { ...e, iShown, vShown } : e));
    // 0.32 A is exactly one 0.02 A division away; 0.95 V exactly one 0.05 V division.
    const edge = checkReadingsAgainstBench(OHMS_GOOD, log("0.32", "0.95"), DIVISIONS);
    expect(find(edge, 2, "I")?.ok).toBe(true);
    expect(find(edge, 2, "V")?.ok).toBe(true);
    // 0.33 A is 1.5 divisions away; 0.84 V is 1.2 divisions away.
    const off = checkReadingsAgainstBench(OHMS_GOOD, log("0.33", "0.84"), DIVISIONS);
    expect(find(off, 2, "I")).toMatchObject({ ok: false, wrote: "0.30", meterShowed: "0.33" });
    expect(find(off, 2, "V")).toMatchObject({ ok: false, wrote: "0.90", meterShowed: "0.84" });
  });

  it("uses the settled reading nearest to hers when the cells drifted at one setting", () => {
    // R = 0: the cells polarise while the key is closed, so the bench logged 0.74 A, then 0.72 A.
    const log = [{ boxOhm: 0, iShown: "0.74", vShown: "2.12" }, ...SAME_AS_GOOD.slice(1)];
    log.push({ boxOhm: 0, iShown: "0.72", vShown: "2.10" });
    const checks = checkReadingsAgainstBench(OHMS_GOOD, log, DIVISIONS);
    expect(find(checks, 0, "I")).toMatchObject({ meterShowed: "0.72", ok: true });
    expect(find(checks, 0, "V")).toMatchObject({ meterShowed: "2.12", ok: true });
  });

  it("shows no meter value for a setting she never read on the bench", () => {
    // She wrote R = 40 Ω, but the log has no reading at 40 Ω.
    const log = SAME_AS_GOOD.filter((e) => e.boxOhm !== 40);
    const checks = checkReadingsAgainstBench(OHMS_GOOD, log, DIVISIONS);
    expect(find(checks, 5, "I")).toMatchObject({ boxOhm: 40, meterShowed: null, ok: false });
    expect(find(checks, 5, "V")).toMatchObject({ meterShowed: null, ok: false });
  });

  it("fails a blank cell and still shows what the meter read", () => {
    const checks = checkReadingsAgainstBench(withCell(3, "I", ""), SAME_AS_GOOD, DIVISIONS);
    expect(find(checks, 3, "I")).toMatchObject({ wrote: "", meterShowed: "0.19", ok: false });
    expect(find(checks, 3, "V")?.ok).toBe(true);
  });

  it("reads a value written with its unit, and gives NaN for an R that is not a number", () => {
    const unit = checkReadingsAgainstBench(withCell(2, "I", "0.30 A"), SAME_AS_GOOD, DIVISIONS);
    expect(find(unit, 2, "I")?.ok).toBe(true);
    const noR = checkReadingsAgainstBench(withCell(2, "R", "five"), SAME_AS_GOOD, DIVISIONS);
    expect(Number.isNaN(find(noR, 2, "I")?.boxOhm)).toBe(true);
    expect(find(noR, 2, "I")).toMatchObject({ meterShowed: null, ok: false });
  });
});
