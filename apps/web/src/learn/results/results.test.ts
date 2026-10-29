import { checkReadingsAgainstBench, markOhmsLaw } from "@snaplab/rules";
import { describe, expect, it } from "vitest";
import { sampleGraph, sampleTable } from "../graph/sample";
import { emptyOhmsLawRecord } from "../readings/record";
import { checkRows, parallaxHint, ruleLines, slopeLine, unreadSettings } from "./resultsModel";

// The results page only groups and formats. Marks are packages/rules' (its tests carry the
// textbook values); these check the shaping, with the rules doing the marking.

const record = { ...sampleTable("practice"), graph: sampleGraph() };
const log = record.rows
  .filter((r) => r.R.text_as_written !== "")
  .map((r) => ({
    boxOhm: Number(r.R.text_as_written),
    iShown: r.I.text_as_written,
    vShown: r.V.text_as_written,
  }));
const divisions = { ammeterA: 0.02, voltmeterV: 0.05 };

describe("the marks by rule", () => {
  it("lists each rule once, with its sub-items summed, and the marks add up to the sheet's", () => {
    const sheet = markOhmsLaw(record, { teacherXyOhm: 3.1 });
    const lines = ruleLines(sheet);
    expect(new Set(lines.map((l) => l.rule)).size).toBe(lines.length);
    const total = lines.reduce((n, l) => n + Number(l.available.replace("½", ".5")), 0);
    // "2½" is written without a digit before ½ only for 0½; every sum here has a whole part.
    expect(total).toBe(sheet.available);
    expect(lines.every((l) => l.label.length > 0)).toBe(true);
  });

  it("marks a rule lost when any of its marks were lost, and keeps the examiner's fix", () => {
    const sheet = markOhmsLaw({ ...record, precautions: ["", ""] }, { teacherXyOhm: 3.1 });
    const precautions = ruleLines(sheet).find((l) => l.rule === "PRECAUTIONS");
    expect(precautions?.lost).toBe(true);
    expect(precautions?.fixes.length).toBeGreaterThan(0);
  });
});

describe("the readings check", () => {
  it("has one row per table row she wrote, and all ok when the meters agree", () => {
    const rows = checkRows(record, checkReadingsAgainstBench(record, log, divisions));
    expect(rows).toHaveLength(7);
    expect(rows.every((r) => r.ok)).toBe(true);
    expect(parallaxHint(rows)).toBe(false);
    expect(unreadSettings(rows)).toEqual([]);
  });

  it("flags the row whose voltage is more than a division from the meter, and hints at parallax", () => {
    const off = log.map((e) => (e.boxOhm === 10 ? { ...e, vShown: "0.68" } : e));
    const rows = checkRows(record, checkReadingsAgainstBench(record, off, divisions));
    const bad = rows.filter((r) => !r.ok);
    expect(bad.map((r) => r.box)).toEqual(["10"]);
    expect(bad[0]?.V).toMatchObject({ wrote: "0.57", showed: "0.68", ok: false });
    expect(bad[0]?.I.ok).toBe(true);
    expect(parallaxHint(rows)).toBe(true);
  });

  it("names the box settings she never read the meters at", () => {
    const missing = log.filter((e) => e.boxOhm !== 20);
    const rows = checkRows(record, checkReadingsAgainstBench(record, missing, divisions));
    expect(unreadSettings(rows)).toEqual(["20"]);
    expect(rows.find((r) => r.box === "20")?.ok).toBe(false);
  });

  it("leaves out rows she left empty", () => {
    const empty = emptyOhmsLawRecord("practice");
    expect(checkRows(empty, checkReadingsAgainstBench(empty, [], divisions))).toEqual([]);
  });
});

describe("her slope beside the wire", () => {
  it("reads her slope from what she wrote, to 1 d.p., and the wire's resistance to 1 d.p.", () => {
    const written = {
      ...record,
      graph: record.graph && { ...record.graph, slope_as_written: "s = ΔV/ΔI = 3.04 Ω" },
    };
    expect(slopeLine(written, 3.1234)).toEqual({ yours: "3.0", wire: "3.1" });
  });

  it("says nothing of a slope she did not write", () => {
    expect(slopeLine(emptyOhmsLawRecord("exam"), 3.1)).toEqual({ yours: null, wire: "3.1" });
  });
});
