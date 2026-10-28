import type { Measured, OhmsLawRecord } from "@snaplab/contracts";
import { parseNumber } from "@snaplab/rules";
import type { LessonMode } from "../types";

// Turns what she types into the frozen OhmsLawRecord, exactly as typed. Nothing here knows the
// bench: no engine value can reach the record through this file.

export type Column = "R" | "I" | "V";
export const COLUMNS: readonly Column[] = ["R", "I", "V"];
export const START_ROWS = 7;
export const MIN_PRECAUTIONS = 2;

export const emptyMeasured = (): Measured => ({
  value: null,
  unit_as_written: null,
  text_as_written: "",
});

/** A blank page: seven empty rows, two blank precautions. */
export function emptyOhmsLawRecord(mode: LessonMode): OhmsLawRecord {
  return {
    experiment: "ohms_law_vi",
    mode,
    length_xy: null,
    headers: { R: null, I: null, V: null },
    rows: Array.from({ length: START_ROWS }, () => ({
      R: emptyMeasured(),
      I: emptyMeasured(),
      V: emptyMeasured(),
    })),
    graph: null,
    precautions: Array.from({ length: MIN_PRECAUTIONS }, () => ""),
    law_as_written: null,
    length_calc_as_written: null,
  };
}

// A leading number (plain or standard form), then whatever she wrote after it.
const LEADING_NUMBER =
  /^\s*[+\-−]?(?:\d+[.·]?\d*|[.·]\d+)(?:\s*[×xX*]\s*10\s*\^?\s*\(?\s*[+\-−⁻⁺]?\s*[0-9⁰¹²³⁴⁵⁶⁷⁸⁹]+\s*\)?|[eE][+-]?\d+)?\s*(.*?)\s*$/s;

/** The unit she typed in the cell ("0.30 A" gives "A"), or null when there is none. */
export function unitAsWritten(text: string): string | null {
  const rest = LEADING_NUMBER.exec(text)?.[1];
  return rest ? rest : null;
}

/** One typed cell: her exact text, its parsed number and the unit she wrote with it. */
export function toMeasured(text: string): Measured {
  return {
    text_as_written: text,
    value: parseNumber(text),
    unit_as_written: unitAsWritten(text),
  };
}

const orNull = (text: string): string | null => (text === "" ? null : text);

export function setLength(r: OhmsLawRecord, text: string): OhmsLawRecord {
  return { ...r, length_xy: text === "" ? null : toMeasured(text) };
}

export function setHeader(r: OhmsLawRecord, col: Column, text: string): OhmsLawRecord {
  return { ...r, headers: { ...r.headers, [col]: orNull(text) } };
}

export function setCell(r: OhmsLawRecord, row: number, col: Column, text: string): OhmsLawRecord {
  const rows = r.rows.map((x, i) => (i === row ? { ...x, [col]: toMeasured(text) } : x));
  return { ...r, rows };
}

export function addRow(r: OhmsLawRecord): OhmsLawRecord {
  return {
    ...r,
    rows: [...r.rows, { R: emptyMeasured(), I: emptyMeasured(), V: emptyMeasured() }],
  };
}

export function removeRow(r: OhmsLawRecord, row: number): OhmsLawRecord {
  return { ...r, rows: r.rows.filter((_, i) => i !== row) };
}

/** Precaution boxes shown: what she has written, but never fewer than two. */
export function precautionSlots(r: OhmsLawRecord): string[] {
  const out = [...r.precautions];
  while (out.length < MIN_PRECAUTIONS) out.push("");
  return out;
}

export function setPrecaution(r: OhmsLawRecord, index: number, text: string): OhmsLawRecord {
  const out = precautionSlots(r);
  while (out.length <= index) out.push("");
  out[index] = text;
  return { ...r, precautions: out };
}

export function addPrecaution(r: OhmsLawRecord): OhmsLawRecord {
  return { ...r, precautions: [...precautionSlots(r), ""] };
}

export function setLaw(r: OhmsLawRecord, text: string): OhmsLawRecord {
  return { ...r, law_as_written: orNull(text) };
}

export function setLengthCalc(r: OhmsLawRecord, text: string): OhmsLawRecord {
  return { ...r, length_calc_as_written: orNull(text) };
}
