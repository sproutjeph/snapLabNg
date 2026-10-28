import { OhmsLawGraph, type OhmsLawRecord } from "@snaplab/contracts";
import { markOhmsLaw } from "@snaplab/rules";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GraphSheet } from "./GraphSheet";
import {
  addPoint,
  clientToSheet,
  emptyGraph,
  moveTriangleCorner,
  parseScale,
  parseTypedPoint,
  removePoint,
  setAxisLabel,
  setAxisScale,
  setDelta,
  setLine,
  setTriangle,
  snapMm,
  snapToLine,
  viewBoxFor,
} from "./model";
import { sampleGraph, sampleRecord, sampleTable } from "./sample";

const distToLine = (
  p: { x_cm: number; y_cm: number },
  l: { p1: { x_cm: number; y_cm: number }; p2: { x_cm: number; y_cm: number } },
) => {
  const dx = l.p2.x_cm - l.p1.x_cm;
  const dy = l.p2.y_cm - l.p1.y_cm;
  return Math.abs(dx * (l.p1.y_cm - p.y_cm) - dy * (l.p1.x_cm - p.x_cm)) / Math.hypot(dx, dy);
};

describe("tapping and typing give sheet-cm points", () => {
  const sheet = emptyGraph().sheet;
  const vb = viewBoxFor(sheet);

  it("maps a tap on the SVG to cm from the grid's bottom-left corner", () => {
    // An SVG drawn at 20 px per viewBox unit, at (100, 50) on the page.
    const rect = { left: 100, top: 50, width: vb.w * 20, height: vb.h * 20 };
    // Grid corner is MARGIN.left across and MARGIN.bottom up from the box's bottom-left.
    const corner = clientToSheet(rect, vb, sheet, 100 + 2.4 * 20, 50 + (0.8 + 24) * 20);
    expect(corner.x_cm).toBeCloseTo(0, 9);
    expect(corner.y_cm).toBeCloseTo(0, 9);
    // 6.04 cm across and 9.97 cm up
    const p = clientToSheet(rect, vb, sheet, 100 + (2.4 + 6.04) * 20, 50 + (0.8 + 24 - 9.97) * 20);
    expect(p.x_cm).toBeCloseTo(6.04, 9);
    expect(p.y_cm).toBeCloseTo(9.97, 9);
  });

  it("a tap becomes a point on the 1 mm grid", () => {
    const g = addPoint(emptyGraph(), { x_cm: 6.04, y_cm: 9.97 });
    expect(g.points).toEqual([{ x_cm: 6, y_cm: 10 }]);
  });

  it("typing x and y adds the point; typing off the sheet or text is refused", () => {
    const ok = parseTypedPoint("3.4", "12,5", sheet);
    expect(ok).toEqual({ ok: true, point: { x_cm: 3.4, y_cm: 12.5 } });
    expect(parseTypedPoint("19", "3", sheet).ok).toBe(false);
    expect(parseTypedPoint("a", "3", sheet).ok).toBe(false);
  });

  it("a point is removed by index and a repeat tap in one place adds nothing", () => {
    let g = addPoint(emptyGraph(), { x_cm: 1, y_cm: 1 });
    g = addPoint(g, { x_cm: 1.02, y_cm: 0.98 });
    expect(g.points).toHaveLength(1);
    g = addPoint(g, { x_cm: 5, y_cm: 5 });
    g = removePoint(g, 0);
    expect(g.points).toEqual([{ x_cm: 5, y_cm: 5 }]);
  });
});

describe("snapping", () => {
  it("snaps to the nearest millimetre", () => {
    expect(snapMm(3.34)).toBe(3.3);
    expect(snapMm(3.36)).toBe(3.4);
    expect(snapMm(0.04)).toBe(0);
  });

  it("keeps points on the sheet", () => {
    const g = addPoint(emptyGraph(), { x_cm: 25, y_cm: -3 });
    expect(g.points).toEqual([{ x_cm: 18, y_cm: 0 }]);
  });
});

describe("the triangle", () => {
  const base = setLine(emptyGraph(), { x_cm: 0, y_cm: 0 }, { x_cm: 15, y_cm: 22.5 });

  it("snaps its hypotenuse corners onto the line when within 2 mm", () => {
    // 1 mm off the line y = 1.5x, on both corners.
    const g = setTriangle(base, { x_cm: 2.1, y_cm: 3 }, { x_cm: 14, y_cm: 21.1 });
    const t = g.triangle;
    expect(t).not.toBeNull();
    if (!t || !g.line) return;
    expect(distToLine(t.p1, g.line)).toBeLessThan(0.01);
    expect(distToLine(t.p3, g.line)).toBeLessThan(0.01);
  });

  it("leaves a corner alone when it is more than 2 mm from the line", () => {
    const p = snapToLine({ x_cm: 5, y_cm: 9 }, base.line);
    expect(p).toEqual({ x_cm: 5, y_cm: 9 });
  });

  it("has a horizontal and a vertical leg", () => {
    const t = setTriangle(base, { x_cm: 2, y_cm: 3 }, { x_cm: 14, y_cm: 21 }).triangle;
    expect(t).toEqual({
      p1: { x_cm: 2, y_cm: 3 },
      p2: { x_cm: 14, y_cm: 3 },
      p3: { x_cm: 14, y_cm: 21 },
    });
  });

  it("keeps the legs square when a corner is dragged", () => {
    let g = setTriangle(base, { x_cm: 2, y_cm: 3 }, { x_cm: 14, y_cm: 21 });
    g = moveTriangleCorner(g, "b", { x_cm: 12, y_cm: 18 });
    const t = g.triangle;
    expect(t?.p2.y_cm).toBe(t?.p1.y_cm);
    expect(t?.p2.x_cm).toBe(t?.p3.x_cm);
    if (t && g.line) expect(distToLine(t.p3, g.line)).toBeLessThan(0.01);
  });
});

describe("the scale chooser", () => {
  it("reads 2 cm to 0.1 A as 0.05 A per cm", () => {
    expect(parseScale("2 cm to 0.1 A")).toEqual({ unitsPerCm: 0.05, unit: "A" });
  });

  it("reads the other ways she may write it", () => {
    expect(parseScale("1 cm to 0.1 V")?.unitsPerCm).toBeCloseTo(0.1, 12);
    expect(parseScale("2cm = 0.2V")?.unitsPerCm).toBeCloseTo(0.1, 12);
    expect(parseScale("0.05 A per cm")?.unitsPerCm).toBeCloseTo(0.05, 12);
    expect(parseScale("5 cm : 1")?.unitsPerCm).toBeCloseTo(0.2, 12);
  });

  it("does not read nonsense, zero or negative scales", () => {
    expect(parseScale("big")).toBeNull();
    expect(parseScale("0 cm to 0.1 A")).toBeNull();
    expect(parseScale("2 cm to 0 A")).toBeNull();
  });

  it("records her text as typed and the number beside it", () => {
    const g = setAxisScale(emptyGraph(), "x", "2 cm to 0.1 A");
    expect(g.x.scale_as_written).toBe("2 cm to 0.1 A");
    expect(g.x.units_per_cm).toBe(0.05);
    const bad = setAxisScale(emptyGraph(), "y", "2 squares");
    expect(bad.y).toMatchObject({ scale_as_written: "2 squares", units_per_cm: null });
  });
});

describe("the output", () => {
  it("is a valid OhmsLawGraph, empty and filled", () => {
    expect(OhmsLawGraph.safeParse(emptyGraph()).success).toBe(true);
    expect(OhmsLawGraph.safeParse(sampleGraph()).success).toBe(true);
  });

  it("keeps labels and Δ text exactly as typed, blank as null", () => {
    let g = setAxisLabel(emptyGraph(), "x", " I/A ");
    g = setDelta(g, "slope_as_written", "s = 3.0 Ω");
    expect(g.x.label_as_written).toBe(" I/A ");
    expect(g.slope_as_written).toBe("s = 3.0 Ω");
    expect(setAxisLabel(g, "x", "").x.label_as_written).toBeNull();
  });
});

describe("the component", () => {
  const table = sampleTable("practice");
  const render = (mode: "practice" | "exam", value = null as OhmsLawRecord["graph"]) =>
    renderToStaticMarkup(createElement(GraphSheet, { value, onChange: () => {}, mode, table }));

  it("renders the paper, the tools and the typed-position form", () => {
    const html = render("practice");
    expect(html).toContain("Mark points");
    expect(html).toContain("Slope triangle");
    expect(html).toContain("Type positions instead of tapping");
    expect(html).toContain("Zoom in");
  });

  it("shows the form of a scale in practice mode and nothing in exam mode", () => {
    expect(render("practice")).toContain("e.g. 2 cm to 0.1 A");
    const exam = render("exam");
    expect(exam).not.toContain("e.g.");
    expect(exam).not.toContain("placeholder");
  });

  it("shows her table as typed, and no slope or expected value", () => {
    const html = render("practice", sampleGraph());
    expect(html).toContain("0.71");
    // Her own typed ΔV, ΔI and s sit in her inputs only.
    expect(html).toContain('value="s = ΔV/ΔI = 1.80/0.60 = 3.0 Ω"');
  });
});

describe("marking a drawn sheet", () => {
  const graphItems = (record: OhmsLawRecord) =>
    markOhmsLaw(record).items.filter((i) => i.rule.startsWith("GRAPH-"));

  it("earns every GRAPH mark for a correctly drawn sheet", () => {
    const items = graphItems(sampleRecord("practice"));
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.outcome, item.id).toBe("earned");
    }
    // AXES 1.5 + SCALE 1 + POINTS 1.5 + LINE 1 + SLOPE 2.5 (packages/rules/src/ohmsLaw.ts header).
    expect(items.reduce((n, i) => n + i.marks_earned, 0)).toBe(7.5);
  });

  it("loses the line, slope and scale marks on an empty sheet", () => {
    const items = graphItems({ ...sampleTable("practice"), graph: emptyGraph() });
    const earned = (id: string) => items.find((i) => i.id === id)?.outcome === "earned";
    expect(earned("GRAPH-LINE")).toBe(false);
    expect(earned("GRAPH-POINTS")).toBe(false);
    expect(earned("GRAPH-SLOPE:large")).toBe(false);
  });

  it("loses the triangle mark when the corners are off her line", () => {
    const rec = sampleRecord("practice");
    const g = rec.graph;
    if (!g) throw new Error("sample has a graph");
    const off = setTriangle(
      setLine(g, { x_cm: 0, y_cm: 0 }, { x_cm: 15, y_cm: 22.5 }),
      { x_cm: 2, y_cm: 6 },
      { x_cm: 14, y_cm: 12 },
    );
    const items = graphItems({ ...rec, graph: off });
    expect(items.find((i) => i.id === "GRAPH-SLOPE:large")?.outcome).toBe("lost");
  });
});
