import type { MarkItem, MarkSheet, OhmsLawRecord } from "@snaplab/contracts";
import { lastNumber, type ReadingCheck } from "@snaplab/rules";
import { halves, RULE_LABEL } from "../marking";

// What the results screen shows, shaped for the page. Nothing here is a mark or a science value:
// marks are packages/rules' (the MarkSheet), the readings check is checkReadingsAgainstBench's
// output, and the bench's resistance comes from the hand-in. These helpers only group and format.

export interface RuleLine {
  rule: MarkItem["rule"];
  label: string;
  /** Marks, in whole numbers and halves: "2½". */
  earned: string;
  available: string;
  /** Some of this rule's marks were lost. */
  lost: boolean;
  /** What she can do about each lost mark, in the examiner's words. */
  fixes: string[];
}

/** One line per scheme rule (its sub-items summed), in the order the sheet lists them. */
export function ruleLines(sheet: MarkSheet): RuleLine[] {
  const groups = new Map<
    MarkItem["rule"],
    { earned: number; available: number; fixes: string[]; lost: boolean }
  >();
  for (const item of sheet.items) {
    const g = groups.get(item.rule) ?? { earned: 0, available: 0, fixes: [], lost: false };
    g.earned += item.marks_earned;
    g.available += item.marks_available;
    if (item.outcome === "lost") {
      g.lost = true;
      const fix = item.correction ? `${item.fix_en} For example: ${item.correction}` : item.fix_en;
      if (!g.fixes.includes(fix)) g.fixes.push(fix);
    }
    groups.set(item.rule, g);
  }
  return [...groups.entries()].map(([rule, g]) => ({
    rule,
    label: RULE_LABEL[rule] ?? rule,
    earned: halves(g.earned),
    available: halves(g.available),
    lost: g.lost,
    fixes: g.fixes,
  }));
}

export interface CheckCell {
  /** What she wrote; "" when the cell was empty. */
  wrote: string;
  /** What her meter showed at that box setting; null when she never read the meters at it. */
  showed: string | null;
  ok: boolean;
}

export interface CheckRow {
  /** Index into her table. */
  row: number;
  /** The box setting as she wrote it ("" when she left it empty). */
  box: string;
  I: CheckCell;
  V: CheckCell;
  /** Both cells within one division of the meter. */
  ok: boolean;
}

/** The per-row view of the readings check. A row she left wholly empty is left out. */
export function checkRows(record: OhmsLawRecord, checks: readonly ReadingCheck[]): CheckRow[] {
  const rows: CheckRow[] = [];
  const cell = (c: ReadingCheck | undefined): CheckCell => ({
    wrote: c?.wrote.trim() ?? "",
    showed: c?.meterShowed ?? null,
    ok: c?.ok ?? false,
  });
  const indexes = [...new Set(checks.map((c) => c.row))].sort((a, b) => a - b);
  for (const row of indexes) {
    const I = cell(checks.find((c) => c.row === row && c.col === "I"));
    const V = cell(checks.find((c) => c.row === row && c.col === "V"));
    const box = record.rows[row]?.R.text_as_written.trim() ?? "";
    if (box === "" && I.wrote === "" && V.wrote === "") continue;
    rows.push({ row, box, I, V, ok: I.ok && V.ok });
  }
  return rows;
}

/** The box settings she wrote that she never read the meters at. */
export function unreadSettings(rows: readonly CheckRow[]): string[] {
  return rows
    .filter(
      (r) => (r.I.wrote !== "" || r.V.wrote !== "") && (r.I.showed === null || r.V.showed === null),
    )
    .map((r) => r.box || "?");
}

/** Whether to remind her about parallax: some reading was read at a setting but is off. */
export function parallaxHint(rows: readonly CheckRow[]): boolean {
  return rows.some((r) => (!r.I.ok && r.I.showed !== null) || (!r.V.ok && r.V.showed !== null));
}

export interface SlopeLine {
  /** Her slope as a number to 1 d.p., or null when she wrote none. */
  yours: string | null;
  /** The wire's resistance (the bench's R_XY ∥ R_V) to 1 d.p. */
  wire: string;
}

/** Her slope (read from what she wrote on her graph) beside the wire's resistance (D1(c)). */
export function slopeLine(record: OhmsLawRecord, benchOhm: number): SlopeLine {
  const s = lastNumber(record.graph?.slope_as_written ?? null);
  return { yours: s === null ? null : s.toFixed(1), wire: benchOhm.toFixed(1) };
}
