import { OhmsLawRecord } from "@snaplab/contracts";
import { createOhmsLaw, paramsFromSeed } from "@snaplab/engine";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProcedureNote } from "../types";
import { OhmsLawNotebook } from "./OhmsLawNotebook";
import { createParallaxNote } from "./parallax";
import { emptyOhmsLawRecord, setCell, setHeader, setLength } from "./record";

describe("notebook record", () => {
  it("keeps the text exactly as typed and parses the number beside it", () => {
    const r = setCell(emptyOhmsLawRecord("practice"), 0, "I", "0.3");
    expect(r.rows[0]?.I).toEqual({ text_as_written: "0.3", value: 0.3, unit_as_written: null });
  });

  it("takes the unit she typed in the cell", () => {
    const r = setCell(emptyOhmsLawRecord("practice"), 2, "I", "0.30 A");
    expect(r.rows[2]?.I).toEqual({ text_as_written: "0.30 A", value: 0.3, unit_as_written: "A" });
  });

  it("keeps a trailing zero and a non-number as written", () => {
    const r = setCell(setCell(emptyOhmsLawRecord("exam"), 1, "V", "1.50"), 1, "R", "abc");
    expect(r.rows[1]?.V.text_as_written).toBe("1.50");
    expect(r.rows[1]?.R).toEqual({ text_as_written: "abc", value: null, unit_as_written: null });
  });

  it("always produces a valid OhmsLawRecord", () => {
    let r = setLength(emptyOhmsLawRecord("practice"), "62.5 cm");
    r = setHeader(r, "I", "I/A");
    expect(OhmsLawRecord.safeParse(r).success).toBe(true);
    expect(r.length_xy?.unit_as_written).toBe("cm");
  });

  it("never takes an engine value: only the typed cell changes", () => {
    const readout = createOhmsLaw(paramsFromSeed(1)).readout;
    const blank = emptyOhmsLawRecord("practice");
    const r = setCell(blank, 3, "V", "1.2");
    const text = JSON.stringify(r);
    for (const v of [readout.ammeterDeg, readout.voltmeterDeg]) {
      expect(text).not.toContain(String(v));
    }
    expect(r.rows.filter((_, i) => i !== 3)).toEqual(blank.rows.filter((_, i) => i !== 3));
    expect(r.length_xy).toBeNull();
    expect(r.law_as_written).toBeNull();
  });
});

describe("notebook markup", () => {
  const render = (mode: "practice" | "exam") =>
    renderToStaticMarkup(
      createElement(OhmsLawNotebook, {
        value: emptyOhmsLawRecord(mode),
        onChange: () => undefined,
        mode,
      }),
    );

  it("shows the form of an entry in practice mode only", () => {
    expect(render("practice")).toContain('placeholder="I/A"');
    expect(render("exam")).not.toContain("placeholder");
  });

  it("has 7 rows of three inputs, three headings and two precautions", () => {
    const html = render("practice");
    expect(html.match(/aria-label="Row \d+, (resistance R|current I|voltage V)"/g)).toHaveLength(
      21,
    );
    expect(html.match(/aria-label="Column heading/g)).toHaveLength(3);
    expect(html.match(/aria-label="Precaution/g)).toHaveLength(2);
  });
});

describe("parallax note", () => {
  const make = (mode: "practice" | "exam") => {
    const notes: Omit<ProcedureNote, "id" | "atS">[] = [];
    const p = createParallaxNote({ mode, addNote: (n) => notes.push(n) });
    return { p, notes };
  };

  it("fires when a reading is recorded more than 5 degrees off square", () => {
    const { p, notes } = make("practice");
    p.setEye(12);
    p.reading("0I");
    expect(notes).toHaveLength(1);
    expect(notes[0]?.kind).toBe("eye_off_mirror");
    expect(notes[0]?.text).not.toMatch(/\d/);
  });

  it("stays quiet when the eye is square (within 5 degrees)", () => {
    const { p, notes } = make("practice");
    p.setEye(5);
    p.reading("0I");
    p.setEye(-3);
    p.reading("1V");
    expect(notes).toHaveLength(0);
  });

  it("stays quiet in exam mode", () => {
    const { p, notes } = make("exam");
    p.setEye(25);
    p.reading("0I");
    expect(notes).toHaveLength(0);
  });

  it("tells her once per cell, not once per keystroke", () => {
    const { p, notes } = make("practice");
    p.setEye(-20);
    p.reading("0I");
    p.reading("0I");
    p.reading("0V");
    expect(notes).toHaveLength(2);
  });
});
