import type { OhmsLawRecord } from "@snaplab/contracts";
import { describe, expect, it } from "vitest";
import { emptyOhmsLawRecord } from "../readings/record";
import {
  drawBestFitLine,
  drawTriangle,
  plotRow,
  plugMoves,
  readTriangle,
  writeField,
} from "./actor";
import type { RecordField } from "./types";

// The actor's pure edits. Expected values are plain arithmetic on the sheet (2 mm paper, an
// 18 × 24 cm sheet, "2 cm to 0.1 A" = 0.05 A per cm and "1 cm to 0.2 V" = 0.2 V per cm), and
// the box's coils are the engine's: 1, 2, 2, 5, 10, 20, 20, 50 Ω (packages/engine params.ts).

const COILS = [1, 2, 2, 5, 10, 20, 20, 50];
const ALL_IN = COILS.map(() => true);

describe("plugMoves", () => {
  it("pulls the 5 Ω plug alone for R = 5 Ω, not the 1, 2 and 2 together", () => {
    expect(plugMoves(COILS, ALL_IN, 5)).toEqual([3]);
  });

  it("needs no move for R = 0 with every plug in", () => {
    expect(plugMoves(COILS, ALL_IN, 0)).toEqual([]);
  });

  it("goes from 5 Ω to 10 Ω by moving two plugs: the 5 goes back and the 10 comes out", () => {
    const from5 = COILS.map((_, i) => i !== 3);
    expect(plugMoves(COILS, from5, 10)).toEqual([3, 4]);
  });

  it("makes 60 Ω with at most three plugs out", () => {
    const moves = plugMoves(COILS, ALL_IN, 60);
    const out = new Set(moves);
    const shown = COILS.reduce((s, c, i) => s + (out.has(i) ? c : 0), 0);
    expect(shown).toBe(60);
    expect(moves.length).toBeLessThanOrEqual(3);
  });

  it("moves nothing for a resistance the box cannot make", () => {
    expect(plugMoves(COILS, ALL_IN, 0.5)).toEqual([]);
    expect(plugMoves(COILS, ALL_IN, 1000)).toEqual([]);
  });
});

const write = (r: OhmsLawRecord, field: RecordField, text: string) => writeField(r, field, text);

function withScales(): OhmsLawRecord {
  let r = emptyOhmsLawRecord("practice");
  r = write(r, { kind: "header", col: "I" }, "I/A");
  r = write(r, { kind: "header", col: "V" }, "V/V");
  r = write(r, { kind: "graph", part: "axisX" }, "I/A");
  r = write(r, { kind: "graph", part: "axisY" }, "V/V");
  r = write(r, { kind: "graph", part: "scaleX" }, "2 cm to 0.1 A");
  r = write(r, { kind: "graph", part: "scaleY" }, "1 cm to 0.2 V");
  return r;
}

describe("writeField", () => {
  it("writes each field as typed, through the same edits her typing uses", () => {
    let r = emptyOhmsLawRecord("practice");
    r = write(r, { kind: "length" }, "56.4 cm");
    r = write(r, { kind: "header", col: "R" }, "R/Ω");
    r = write(r, { kind: "cell", row: 2, col: "I" }, "0.30");
    r = write(r, { kind: "precaution", index: 1 }, "The key was opened between readings.");
    r = write(r, { kind: "law" }, "Ohm's law");
    r = write(r, { kind: "lengthCalc" }, "L = 0.25 m");
    expect(r.length_xy?.text_as_written).toBe("56.4 cm");
    expect(r.length_xy?.value).toBeCloseTo(56.4, 10);
    expect(r.headers.R).toBe("R/Ω");
    expect(r.rows[2]?.I.value).toBeCloseTo(0.3, 10);
    expect(r.precautions[1]).toBe("The key was opened between readings.");
    expect(r.law_as_written).toBe("Ohm's law");
    expect(r.length_calc_as_written).toBe("L = 0.25 m");
  });

  it("adds a row when the cell is past the last", () => {
    const r = write(emptyOhmsLawRecord("practice"), { kind: "cell", row: 8, col: "V" }, "1.00");
    expect(r.rows).toHaveLength(9);
    expect(r.rows[8]?.V.text_as_written).toBe("1.00");
  });

  it("reads her scale in the unit of her axis: 0.05 A and 0.2 V per cm", () => {
    const g = withScales().graph;
    expect(g?.x.units_per_cm).toBeCloseTo(0.05, 10);
    expect(g?.y.units_per_cm).toBeCloseTo(0.2, 10);
  });
});

describe("plotRow", () => {
  it("puts a row at its place on her own scales: 0.30 A across is 6 cm, 0.90 V up is 4.5 cm", () => {
    let r = withScales();
    r = write(r, { kind: "cell", row: 0, col: "I" }, "0.30");
    r = write(r, { kind: "cell", row: 0, col: "V" }, "0.90");
    const p = plotRow(r, 0).graph?.points;
    expect(p).toHaveLength(1);
    expect(p?.[0]?.x_cm).toBeCloseTo(6, 10);
    expect(p?.[0]?.y_cm).toBeCloseTo(4.5, 10);
  });

  it("reads a milliampere heading on an ampere axis: 300 mA is 0.30 A", () => {
    let r = withScales();
    r = write(r, { kind: "header", col: "I" }, "I/mA");
    r = write(r, { kind: "cell", row: 0, col: "I" }, "300");
    r = write(r, { kind: "cell", row: 0, col: "V" }, "0.90");
    expect(plotRow(r, 0).graph?.points[0]?.x_cm).toBeCloseTo(6, 10);
  });

  it("does nothing before both scales are chosen, or for an empty row", () => {
    const bare = write(emptyOhmsLawRecord("practice"), { kind: "cell", row: 0, col: "I" }, "0.3");
    expect(plotRow(bare, 0)).toBe(bare);
    expect(plotRow(withScales(), 0).graph?.points).toHaveLength(0);
  });
});

/** The table of the Ohm's-law golden (docs: a 3.0 Ω wire), plotted on the scales above. */
function plotted(): OhmsLawRecord {
  let r = withScales();
  const rows: Array<[string, string]> = [
    ["0.71", "2.12"],
    ["0.56", "1.67"],
    ["0.30", "0.90"],
    ["0.19", "0.57"],
    ["0.11", "0.33"],
    ["0.06", "0.18"],
    ["0.04", "0.12"],
  ];
  rows.forEach(([i, v], row) => {
    r = write(r, { kind: "cell", row, col: "I" }, i);
    r = write(r, { kind: "cell", row, col: "V" }, v);
    r = plotRow(r, row);
  });
  return r;
}

describe("drawBestFitLine and drawTriangle", () => {
  it("draws one straight line through the middle of her points, running a little past them, on the sheet", () => {
    const g = drawBestFitLine(plotted()).graph;
    const line = g?.line;
    expect(line).toBeTruthy();
    if (!g || !line) return;
    const xs = g.points.map((p) => p.x_cm);
    expect(Math.min(line.p1.x_cm, line.p2.x_cm)).toBeLessThanOrEqual(Math.min(...xs));
    expect(Math.max(line.p1.x_cm, line.p2.x_cm)).toBeGreaterThanOrEqual(Math.max(...xs));
    for (const p of [line.p1, line.p2]) {
      expect(p.x_cm).toBeGreaterThanOrEqual(0);
      expect(p.x_cm).toBeLessThanOrEqual(g.sheet.width_cm);
      expect(p.y_cm).toBeGreaterThanOrEqual(0);
      expect(p.y_cm).toBeLessThanOrEqual(g.sheet.height_cm);
    }
    // Her points lie within two small squares of the line (this table is ohmic: 3.0 Ω).
    const dx = line.p2.x_cm - line.p1.x_cm;
    const dy = line.p2.y_cm - line.p1.y_cm;
    for (const p of g.points) {
      const d =
        Math.abs(dx * (line.p1.y_cm - p.y_cm) - dy * (line.p1.x_cm - p.x_cm)) / Math.hypot(dx, dy);
      expect(d).toBeLessThan(0.4);
    }
  });

  it("draws nothing with fewer than two points", () => {
    const r = withScales();
    expect(drawBestFitLine(r)).toBe(r);
  });

  it("puts a large right-angled triangle on the line: legs level and upright, corners on the line", () => {
    const g = drawTriangle(drawBestFitLine(plotted())).graph;
    const tri = g?.triangle;
    const line = g?.line;
    expect(tri && line).toBeTruthy();
    if (!tri || !line) return;
    expect(tri.p2.y_cm).toBeCloseTo(tri.p1.y_cm, 10);
    expect(tri.p2.x_cm).toBeCloseTo(tri.p3.x_cm, 10);
    const legX = Math.abs(tri.p3.x_cm - tri.p1.x_cm);
    const legY = Math.abs(tri.p3.y_cm - tri.p1.y_cm);
    expect(legX).toBeGreaterThanOrEqual(0.5 * Math.abs(line.p2.x_cm - line.p1.x_cm));
    expect(legY).toBeGreaterThanOrEqual(0.5 * Math.abs(line.p2.y_cm - line.p1.y_cm));
    const dx = line.p2.x_cm - line.p1.x_cm;
    const dy = line.p2.y_cm - line.p1.y_cm;
    for (const p of [tri.p1, tri.p3]) {
      const d =
        Math.abs(dx * (line.p1.y_cm - p.y_cm) - dy * (line.p1.x_cm - p.x_cm)) / Math.hypot(dx, dy);
      expect(d).toBeLessThanOrEqual(0.2);
    }
  });

  it("does not draw a triangle before there is a line", () => {
    const r = plotted();
    expect(drawTriangle(r)).toBe(r);
  });
});

describe("readTriangle", () => {
  function withTriangle(): OhmsLawRecord {
    const r = withScales();
    const g = r.graph;
    if (!g) throw new Error("no graph");
    // (2, 3) and (14, 21) cm: 0.10 A and 0.60 V, then 0.70 A and 4.20 V.
    return {
      ...r,
      graph: {
        ...g,
        triangle: {
          p1: { x_cm: 2, y_cm: 3 },
          p2: { x_cm: 14, y_cm: 3 },
          p3: { x_cm: 14, y_cm: 21 },
        },
      },
    };
  }

  it("reads ΔV, ΔI and s off the triangle on her scales, with units", () => {
    const r = withTriangle();
    expect(readTriangle(r, "deltaY")).toBe("ΔV = 4.20 − 0.60 = 3.60 V");
    expect(readTriangle(r, "deltaX")).toBe("ΔI = 0.70 − 0.10 = 0.60 A");
    // s = 3.60 / 0.60 = 6.00 Ω (arithmetic)
    expect(readTriangle(r, "slope")).toBe("s = ΔV/ΔI = 3.60/0.60 = 6.00 Ω");
  });

  it("gives nothing before the triangle exists", () => {
    expect(readTriangle(withScales(), "slope")).toBeNull();
  });
});
