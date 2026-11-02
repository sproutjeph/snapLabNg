import type { OhmsLawGraph } from "@snaplab/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GraphBoard } from "./GraphBoard";
import {
  addPoint,
  emptyGraph,
  setAxisLabel,
  setAxisScale,
  setDelta,
  setLine,
  setTriangle,
} from "./model";
import { sampleGraph } from "./sample";

function render(graph: OhmsLawGraph, meaning: string | null = null): string {
  return renderToStaticMarkup(createElement(GraphBoard, { graph, meaning }));
}

describe("GraphBoard", () => {
  it("is strictly read-only with no inputs, buttons or forms", () => {
    const html = render(sampleGraph(), "The slope is the resistance of wire XY.");
    expect(html).toContain('data-testid="graph-board"');
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
  });

  it("pops points in one by one as graph.points grows and marks the newest point", () => {
    let g = setAxisScale(
      setAxisScale(
        setAxisLabel(setAxisLabel(emptyGraph(), "x", "I/A"), "y", "V/V"),
        "x",
        "2 cm to 0.1 A",
      ),
      "y",
      "1 cm to 0.1 V",
    );
    expect(render(g)).not.toContain('data-testid="graph-point-0"');

    g = addPoint(g, { x_cm: 2, y_cm: 3 });
    const one = render(g);
    expect(one.match(/data-testid="graph-point-\d+"/g)).toHaveLength(1);
    expect(one).toContain('data-testid="graph-point-0" data-latest="1"');

    g = addPoint(g, { x_cm: 6, y_cm: 9 });
    const two = render(g);
    expect(two.match(/data-testid="graph-point-\d+"/g)).toHaveLength(2);
    expect(two).toContain('data-testid="graph-point-0"');
    expect(two).not.toContain('data-testid="graph-point-0" data-latest="1"');
    expect(two).toContain('data-testid="graph-point-1" data-latest="1"');
  });

  it("draws the best-fit line only when graph.line is present", () => {
    const withoutLine = emptyGraph();
    expect(render(withoutLine)).not.toContain('data-testid="graph-line"');

    const withLine = setLine(withoutLine, { x_cm: 0, y_cm: 0 }, { x_cm: 15, y_cm: 20.8 });
    const html = render(withLine);
    expect(html).toContain('data-testid="graph-line"');
    // MARGIN.left = 2.4, MARGIN.top = 0.8, height = 24 -> (0,0) maps to (2.4, 24.8), (15, 20.8) maps to (17.4, 4)
    expect(html).toContain('x1="2.4"');
    expect(html).toContain('y1="24.8"');
    expect(html).toContain('x2="17.4"');
    expect(html).toContain('y2="4"');
  });

  it("shows the slope triangle, ΔV, ΔI, slope text and meaning exactly as given", () => {
    let g = setLine(emptyGraph(), { x_cm: 0, y_cm: 0 }, { x_cm: 15, y_cm: 22.5 });
    expect(render(g)).not.toContain('data-testid="graph-triangle"');

    g = setTriangle(g, { x_cm: 2, y_cm: 3 }, { x_cm: 14, y_cm: 21 });
    g = setDelta(g, "delta_y_as_written", "ΔV = 2.10 − 0.30 = 1.80 V");
    g = setDelta(g, "delta_x_as_written", "ΔI = 0.70 − 0.10 = 0.60 A");
    g = setDelta(g, "slope_as_written", "s = ΔV/ΔI = 1.80/0.60 = 3.0 Ω");

    const withoutMeaning = render(g, null);
    expect(withoutMeaning).toContain('data-testid="graph-triangle"');
    expect(withoutMeaning).toContain("ΔV = 2.10 − 0.30 = 1.80 V");
    expect(withoutMeaning).toContain("ΔI = 0.70 − 0.10 = 0.60 A");
    expect(withoutMeaning).toContain("s = ΔV/ΔI = 1.80/0.60 = 3.0 Ω");
    expect(withoutMeaning).not.toContain('data-testid="graph-meaning"');

    const withMeaning = render(g, "The slope is the resistance of wire XY.");
    expect(withMeaning).toContain('data-testid="graph-meaning"');
    expect(withMeaning).toContain("The slope is the resistance of wire XY.");
  });
});
