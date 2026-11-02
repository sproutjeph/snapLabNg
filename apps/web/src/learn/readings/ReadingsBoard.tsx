import type { OhmsLawRecord } from "@snaplab/contracts";
import { COLUMNS, type Column } from "./record";
import "./readingsBoard.css";

export interface ReadingsBoardProps {
  /** Headers and rows as the actor wrote them; shows `text_as_written` of each cell. */
  record: Pick<OhmsLawRecord, "headers" | "rows" | "length_xy">;
  /** Row index to highlight (the newest); null for none. */
  highlight: number | null;
}

const DEFAULT_HEADER: Record<Column, string> = {
  R: "R/Ω",
  I: "I/A",
  V: "V/V",
};

/**
 * Read-only exercise-book table for the Watch demonstration. Shows `length_xy` above the table
 * when set, column headers R/Ω, I/A, V/V, and rows appearing one by one as the actor writes
 * them, with the `highlight` row inked.
 */
export function ReadingsBoard({ record, highlight }: ReadingsBoardProps) {
  const lengthText = record.length_xy?.text_as_written?.trim() ?? "";
  const visibleRows = record.rows
    .map((row, index) => ({ row, index }))
    .filter(({ row, index }) =>
      Boolean(
        row.R.text_as_written ||
          row.I.text_as_written ||
          row.V.text_as_written ||
          index === highlight,
      ),
    );

  return (
    <section className="rb-book" data-testid="readings-board" aria-label="Table of results">
      <div className="rb-head">
        <h3 className="rb-h">Table of results</h3>
      </div>

      {lengthText.length > 0 && (
        <p className="rb-length" data-testid="readings-length">
          <span className="rb-length-label">Length XY:</span>
          <span>{record.length_xy?.text_as_written}</span>
        </p>
      )}

      <div className="rb-scroll">
        <table className="rb-table">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c} scope="col">
                  {record.headers[c] ?? DEFAULT_HEADER[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ row, index }) => {
              const isHighlighted = index === highlight;
              return (
                <tr
                  key={index}
                  className={isHighlighted ? "rb-row is-highlighted" : "rb-row"}
                  data-testid={`readings-row-${index}`}
                  data-highlighted={isHighlighted ? "1" : undefined}
                  aria-current={isHighlighted ? "true" : undefined}
                >
                  {COLUMNS.map((c) => (
                    <td key={c}>{row[c].text_as_written}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
