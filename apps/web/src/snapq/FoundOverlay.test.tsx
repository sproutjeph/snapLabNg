import type { Box, QuestionRead } from "@snaplab/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FoundOverlay, type FoundOverlayProps, formatTag, kindToName } from "./FoundOverlay";

function render(props: Partial<FoundOverlayProps> = {}): string {
  const fullProps: FoundOverlayProps = {
    photo: props.photo ?? "/samples/q3b-diagram.jpg",
    parts: props.parts ?? [],
    outlines: props.outlines ?? new Map<number, Box>(),
    highlight: props.highlight ?? null,
  };
  return renderToStaticMarkup(createElement(FoundOverlay, fullProps));
}

describe("FoundOverlay", () => {
  it("renders the student photo and container at its aspect ratio", () => {
    const html = render({ photo: "/user/snapped-circuit.jpg" });
    expect(html).toContain('data-testid="found-overlay"');
    expect(html).toContain('src="/user/snapped-circuit.jpg"');
    expect(html).toContain('alt="Your diagram"');
    expect(html).toContain('class="fo-photo"');
  });

  it("boxes use the outline when given and the Spark box otherwise", () => {
    const parts: QuestionRead["diagram"]["parts"] = [
      {
        kind: "ammeter",
        label_as_printed: "A",
        box: { x0: 0.1, y0: 0.2, x1: 0.3, y1: 0.4 },
      },
      {
        kind: "voltmeter",
        label_as_printed: "V",
        box: { x0: 0.5, y0: 0.6, x1: 0.8, y1: 0.9 },
      },
    ];

    // Part 0 has a SAM outline refinement; Part 1 only has Spark's box.
    const outlines = new Map<number, Box>([[0, { x0: 0.12, y0: 0.22, x1: 0.28, y1: 0.38 }]]);

    const html = render({ parts, outlines });

    // Part 0 uses the outline coordinates (left: 12%, top: 22%, width: 16%, height: 16%)
    expect(html).toContain('data-testid="found-box-0"');
    expect(html).toContain('data-box-source="outline"');
    expect(html).toContain("left:12%");
    expect(html).toContain("top:22%");
    expect(html).toContain("width:16%");
    expect(html).toContain("height:16%");
    // Spark box coordinates for part 0 were not used
    expect(html).not.toContain("left:10%");

    // Part 1 uses the Spark box coordinates (left: 50%, top: 60%, width: 30%, height: 30%)
    expect(html).toContain('data-testid="found-box-1"');
    expect(html).toContain('data-box-source="spark"');
    expect(html).toContain("left:50%");
    expect(html).toContain("top:60%");
    expect(html).toContain("width:30%");
    expect(html).toContain("height:30%");
  });

  it("renders SVG rects with pathLength=1 so dash animation always closes", () => {
    const parts: QuestionRead["diagram"]["parts"] = [
      {
        kind: "ammeter",
        label_as_printed: "A",
        box: { x0: 0.1, y0: 0.2, x1: 0.3, y1: 0.4 },
      },
    ];
    const html = render({ parts });
    expect(html).toContain('pathLength="1"');
  });

  it("tags show label and name", () => {
    // Check plain name mapping for all apparatus kinds
    expect(kindToName("cells")).toBe("cells");
    expect(kindToName("key")).toBe("key");
    expect(kindToName("ammeter")).toBe("ammeter");
    expect(kindToName("voltmeter")).toBe("voltmeter");
    expect(kindToName("resistance_box")).toBe("resistance box");
    expect(kindToName("wire_xy")).toBe("wire XY");
    expect(kindToName("rheostat")).toBe("rheostat");
    expect(kindToName("metre_rule")).toBe("metre rule");
    expect(kindToName("connecting_wires")).toBe("connecting wires");
    expect(kindToName("galvanometer")).toBe("galvanometer");
    expect(kindToName("other")).toBe("part");

    // Check tag formatting with and without printed labels
    expect(formatTag("A", "ammeter")).toBe("A · ammeter");
    expect(formatTag("V", "voltmeter")).toBe("V · voltmeter");
    expect(formatTag("K", "key")).toBe("K · key");
    expect(formatTag("R", "resistance_box")).toBe("R · resistance box");
    expect(formatTag("XY", "wire_xy")).toBe("XY · wire XY");
    expect(formatTag("Rh", "rheostat")).toBe("Rh · rheostat");
    expect(formatTag("G", "galvanometer")).toBe("G · galvanometer");
    expect(formatTag(null, "cells")).toBe("cells");
    expect(formatTag("", "connecting_wires")).toBe("connecting wires");
    expect(formatTag(null, "metre_rule")).toBe("metre rule");
    expect(formatTag("D", "other")).toBe("D · part");
    expect(formatTag(null, "other")).toBe("part");

    // Render multiple parts and verify tags in HTML output
    const parts: QuestionRead["diagram"]["parts"] = [
      {
        kind: "ammeter",
        label_as_printed: "A",
        box: { x0: 0.1, y0: 0.1, x1: 0.2, y1: 0.2 },
      },
      {
        kind: "resistance_box",
        label_as_printed: "R",
        box: { x0: 0.3, y0: 0.3, x1: 0.4, y1: 0.4 },
      },
      {
        kind: "cells",
        label_as_printed: null,
        box: { x0: 0.5, y0: 0.5, x1: 0.6, y1: 0.6 },
      },
      {
        kind: "wire_xy",
        label_as_printed: "XY",
        box: { x0: 0.7, y0: 0.7, x1: 0.8, y1: 0.8 },
      },
    ];

    const html = render({ parts });
    expect(html).toContain("A · ammeter");
    expect(html).toContain("R · resistance box");
    expect(html).toContain("cells");
    expect(html).toContain("XY · wire XY");
  });

  it("the highlight class is applied to the right part", () => {
    const parts: QuestionRead["diagram"]["parts"] = [
      {
        kind: "cells",
        label_as_printed: "E",
        box: { x0: 0.1, y0: 0.1, x1: 0.2, y1: 0.2 },
      },
      {
        kind: "ammeter",
        label_as_printed: "A",
        box: { x0: 0.3, y0: 0.3, x1: 0.4, y1: 0.4 },
      },
      {
        kind: "voltmeter",
        label_as_printed: "V",
        box: { x0: 0.5, y0: 0.5, x1: 0.6, y1: 0.6 },
      },
    ];

    // When part 1 is highlighted:
    const htmlWithHighlight = render({ parts, highlight: 1 });

    // Part 1 receives the highlight class and attribute
    expect(htmlWithHighlight).toMatch(/class="[^"]*highlight[^"]*"[^>]*data-testid="found-box-1"/);
    expect(htmlWithHighlight).toContain('data-testid="found-box-1"');
    expect(htmlWithHighlight).toContain('data-highlighted="1"');

    // Part 0 and Part 2 are dimmed
    expect(htmlWithHighlight).toMatch(/class="[^"]*dim[^"]*"[^>]*data-testid="found-box-0"/);
    expect(htmlWithHighlight).toMatch(/class="[^"]*dim[^"]*"[^>]*data-testid="found-box-2"/);
    expect(htmlWithHighlight).not.toContain('data-testid="found-box-0" data-highlighted="1"');
    expect(htmlWithHighlight).not.toContain('data-testid="found-box-2" data-highlighted="1"');

    // When highlight is null:
    const htmlWithoutHighlight = render({ parts, highlight: null });
    expect(htmlWithoutHighlight).not.toContain("highlight");
    expect(htmlWithoutHighlight).not.toContain("dim");
    expect(htmlWithoutHighlight).not.toContain("data-highlighted");
    expect(htmlWithoutHighlight).not.toContain("data-dimmed");
  });

  it("a growing parts list adds boxes", () => {
    // 0 parts
    const emptyHtml = render({ parts: [] });
    expect(emptyHtml.match(/data-testid="found-box-\d+"/g)).toBeNull();

    // 1 part arrives
    const part0: QuestionRead["diagram"]["parts"][number] = {
      kind: "cells",
      label_as_printed: null,
      box: { x0: 0.1, y0: 0.1, x1: 0.2, y1: 0.2 },
    };
    const oneHtml = render({ parts: [part0] });
    expect(oneHtml.match(/data-testid="found-box-\d+"/g)).toHaveLength(1);
    expect(oneHtml).toContain('data-testid="found-box-0"');

    // 2 parts arrive
    const part1: QuestionRead["diagram"]["parts"][number] = {
      kind: "key",
      label_as_printed: "K",
      box: { x0: 0.3, y0: 0.1, x1: 0.4, y1: 0.2 },
    };
    const twoHtml = render({ parts: [part0, part1] });
    expect(twoHtml.match(/data-testid="found-box-\d+"/g)).toHaveLength(2);
    expect(twoHtml).toContain('data-testid="found-box-0"');
    expect(twoHtml).toContain('data-testid="found-box-1"');

    // 3 parts arrive
    const part2: QuestionRead["diagram"]["parts"][number] = {
      kind: "ammeter",
      label_as_printed: "A",
      box: { x0: 0.5, y0: 0.1, x1: 0.6, y1: 0.2 },
    };
    const threeHtml = render({ parts: [part0, part1, part2] });
    expect(threeHtml.match(/data-testid="found-box-\d+"/g)).toHaveLength(3);
    expect(threeHtml).toContain('data-testid="found-box-2"');
  });

  it("anchors tags to the right when a box is near the right edge (x0 >= 0.6)", () => {
    const parts: QuestionRead["diagram"]["parts"] = [
      {
        kind: "key",
        label_as_printed: "K",
        box: { x0: 0.2, y0: 0.3, x1: 0.4, y1: 0.45 }, // x0 = 0.2 < 0.6
      },
      {
        kind: "voltmeter",
        label_as_printed: "V",
        box: { x0: 0.65, y0: 0.3, x1: 0.85, y1: 0.45 }, // x0 = 0.65 >= 0.6
      },
    ];

    const html = render({ parts });
    // Box 0 is left-anchored
    expect(html).not.toContain(
      'data-testid="found-box-0" data-part-index="0" data-part-kind="key" data-box-source="spark" data-edge="right"',
    );
    expect(html).not.toContain(
      'data-testid="found-box-0" data-part-index="0" data-part-kind="key" data-box-source="spark" data-edge-right="1"',
    );

    // Box 1 is right-anchored to avoid overflow: hidden clipping
    expect(html).toContain('data-edge="right"');
    expect(html).toContain('data-edge-right="1"');
  });

  it("adjusts tag position when a box is near the top edge and/or right edge", () => {
    const parts: QuestionRead["diagram"]["parts"] = [
      {
        kind: "cells",
        label_as_printed: "E",
        box: { x0: 0.1, y0: 0.02, x1: 0.3, y1: 0.15 }, // y0 = 2% < 6%, x0 = 0.1 < 0.6
      },
      {
        kind: "wire_xy",
        label_as_printed: "XY",
        box: { x0: 0.7, y0: 0.03, x1: 0.9, y1: 0.18 }, // y0 = 3% < 6%, x0 = 0.7 >= 0.6
      },
    ];

    const html = render({ parts });
    // Box 0 is near top only
    expect(html).toContain('data-edge="top"');
    expect(html).toContain('data-edge-top="1"');
    expect(html).not.toContain('data-edge-right="1" data-testid="found-box-0"');

    // Box 1 is near top and right
    expect(html).toContain('data-edge="top right"');
    expect(html).toContain('data-edge-top="1" data-edge-right="1"');
  });
});
