import type { OhmsLawRecord } from "@snaplab/contracts";
import { useId } from "react";
import type { LessonMode } from "../types";
import "./readings.css";
import {
  addPrecaution,
  addRow,
  COLUMNS,
  type Column,
  precautionSlots,
  removeRow,
  setCell,
  setHeader,
  setLaw,
  setLength,
  setLengthCalc,
  setPrecaution,
} from "./record";

export interface OhmsLawNotebookProps {
  value: OhmsLawRecord;
  onChange(next: OhmsLawRecord): void;
  mode: LessonMode;
  /** She edited a meter reading (an I or V cell); for the eye-off-mirror note. */
  onReadingEdit?(cell: { row: number; col: "I" | "V" }): void;
}

// Practice mode may show the form of an entry. Exam mode shows nothing.
const COLUMN_NAME: Record<Column, string> = {
  R: "resistance",
  I: "current",
  V: "voltage",
};
const FORM: Record<Column, string> = { R: "R/Ω", I: "I/A", V: "V/V" };

/**
 * Her page, typed: the length XY, the table, two precautions and part (b). Controlled. Every
 * entry is kept exactly as typed; nothing is ever filled in for her.
 */
export function OhmsLawNotebook({ value, onChange, mode, onReadingEdit }: OhmsLawNotebookProps) {
  const uid = useId();
  const hint = (text: string) => (mode === "practice" ? text : undefined);
  const precautions = precautionSlots(value);
  return (
    <div className="olr-book">
      <section className="olr-sec">
        <label className="olr-h" htmlFor={`${uid}-length`}>
          1. Length XY of the wire
        </label>
        <input
          id={`${uid}-length`}
          className="olr-input"
          type="text"
          autoComplete="off"
          value={value.length_xy?.text_as_written ?? ""}
          placeholder={hint("e.g. a length with its unit")}
          onChange={(e) => onChange(setLength(value, e.target.value))}
        />
      </section>

      <section className="olr-sec">
        <h3 className="olr-h">Table of results</h3>
        <div className="olr-scroll">
          <table className="olr-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c}>
                    <input
                      className="olr-input olr-head"
                      type="text"
                      aria-label={`Column heading ${c}`}
                      autoComplete="off"
                      value={value.headers[c] ?? ""}
                      placeholder={hint(FORM[c])}
                      onChange={(e) => onChange(setHeader(value, c, e.target.value))}
                    />
                  </th>
                ))}
                <td />
              </tr>
            </thead>
            <tbody>
              {value.rows.map((row, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity but their place
                <tr key={i}>
                  {COLUMNS.map((c) => (
                    <td key={c}>
                      <input
                        className="olr-input olr-cell"
                        type="text"
                        autoComplete="off"
                        aria-label={`Row ${i + 1}, ${COLUMN_NAME[c]} ${c}`}
                        value={row[c].text_as_written}
                        onChange={(e) => {
                          onChange(setCell(value, i, c, e.target.value));
                          if (c !== "R") onReadingEdit?.({ row: i, col: c });
                        }}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className="olr-btn olr-icon"
                      aria-label={`Remove row ${i + 1}`}
                      onClick={() => onChange(removeRow(value, i))}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="olr-btn" onClick={() => onChange(addRow(value))}>
          Add a row
        </button>
      </section>

      <section className="olr-sec">
        <h3 className="olr-h">Precautions</h3>
        {precautions.map((p, i) => (
          <textarea
            // biome-ignore lint/suspicious/noArrayIndexKey: precautions have no identity but their place
            key={i}
            className="olr-input olr-area"
            rows={2}
            aria-label={`Precaution ${i + 1}`}
            value={p}
            placeholder={hint("Write it in the reported tense")}
            onChange={(e) => onChange(setPrecaution(value, i, e.target.value))}
          />
        ))}
        <button type="button" className="olr-btn" onClick={() => onChange(addPrecaution(value))}>
          Add a precaution
        </button>
      </section>

      <section className="olr-sec">
        <label className="olr-h" htmlFor={`${uid}-law`}>
          (b)(i) The law
        </label>
        <textarea
          id={`${uid}-law`}
          className="olr-input olr-area"
          rows={3}
          value={value.law_as_written ?? ""}
          onChange={(e) => onChange(setLaw(value, e.target.value))}
        />
        <label className="olr-h" htmlFor={`${uid}-calc`}>
          (b)(ii) Length of the wire, with working
        </label>
        <textarea
          id={`${uid}-calc`}
          className="olr-input olr-area"
          rows={5}
          value={value.length_calc_as_written ?? ""}
          onChange={(e) => onChange(setLengthCalc(value, e.target.value))}
        />
      </section>
    </div>
  );
}
