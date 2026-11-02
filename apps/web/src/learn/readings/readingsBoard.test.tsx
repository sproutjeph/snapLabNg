import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReadingsBoard, type ReadingsBoardProps } from "./ReadingsBoard";
import { emptyOhmsLawRecord, setCell, setHeader, setLength } from "./record";

function render(record: ReadingsBoardProps["record"], highlight: number | null = null): string {
  return renderToStaticMarkup(createElement(ReadingsBoard, { record, highlight }));
}

describe("ReadingsBoard", () => {
  it("shows rows one by one as the actor writes them and stays read-only", () => {
    let r = emptyOhmsLawRecord("practice");
    r = setHeader(setHeader(setHeader(r, "R", "R/Ω"), "I", "I/A"), "V", "V/V");

    // Initially all 7 slots are blank, so no tbody rows are rendered.
    const emptyHtml = render(r, null);
    expect(emptyHtml).toContain('data-testid="readings-board"');
    expect(emptyHtml).not.toContain('data-testid="readings-row-0"');
    expect(emptyHtml).not.toContain("<input");

    // Row 0 is written.
    r = setCell(setCell(setCell(r, 0, "R", "0"), 0, "I", "0.71"), 0, "V", "2.12");
    const oneRow = render(r, 0);
    expect(oneRow.match(/data-testid="readings-row-\d+"/g)).toHaveLength(1);
    expect(oneRow).toContain("0.71");
    expect(oneRow).toContain("2.12");

    // Row 1 is written.
    r = setCell(setCell(setCell(r, 1, "R", "1"), 1, "I", "0.56"), 1, "V", "1.67");
    const twoRows = render(r, 1);
    expect(twoRows.match(/data-testid="readings-row-\d+"/g)).toHaveLength(2);
    expect(twoRows).toContain("0.56");
    expect(twoRows).toContain("1.67");
  });

  it("highlights only the row matching the highlight index, or none when null", () => {
    let r = emptyOhmsLawRecord("practice");
    r = setCell(setCell(setCell(r, 0, "R", "0"), 0, "I", "0.71"), 0, "V", "2.12");
    r = setCell(setCell(setCell(r, 1, "R", "1"), 1, "I", "0.56"), 1, "V", "1.67");

    const row1Highlighted = render(r, 1);
    expect(row1Highlighted).toContain('class="rb-row" data-testid="readings-row-0"');
    expect(row1Highlighted).toContain(
      'class="rb-row is-highlighted" data-testid="readings-row-1" data-highlighted="1" aria-current="true"',
    );

    const noneHighlighted = render(r, null);
    expect(noneHighlighted).not.toContain("is-highlighted");
    expect(noneHighlighted).not.toContain('data-highlighted="1"');
  });

  it("shows length XY above the table when set and hides it when null", () => {
    const blank = emptyOhmsLawRecord("practice");
    expect(render(blank, null)).not.toContain('data-testid="readings-length"');

    const withLength = setLength(blank, "68.0 cm");
    const html = render(withLength, null);
    expect(html).toContain('data-testid="readings-length"');
    expect(html).toContain("68.0 cm");
  });
});
