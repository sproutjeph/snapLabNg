import { describe, expect, it } from "vitest";
import { applyHomography, solveHomography } from "./homography";
import type { Point, Quad } from "./types";

const UNIT_SQUARE: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

function lineIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point {
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;
  const denom = dax * dby - day * dbx;
  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / denom;
  return {
    x: a1.x + t * dax,
    y: a1.y + t * day,
  };
}

describe("solveHomography and applyHomography", () => {
  it("computes a pure scale matrix from the unit square to an axis-aligned rectangle (0,0)-(800,1100)", () => {
    // 4-point projective DLT identity/scale verification (Hartley & Zisserman, Multiple View Geometry §4.1)
    const dst: Quad = [
      { x: 0, y: 0 },
      { x: 800, y: 0 },
      { x: 800, y: 1100 },
      { x: 0, y: 1100 },
    ];
    const h = solveHomography(UNIT_SQUARE, dst);
    const expected = [800, 0, 0, 0, 1100, 0, 0, 0, 1];
    for (let i = 0; i < 9; i++) {
      expect(Math.abs((h[i] ?? 0) - (expected[i] ?? 0))).toBeLessThan(1e-9);
    }
  });

  it("maps unit square corners and diagonal intersection (0.5, 0.5) accurately for a projective quad", () => {
    // Under a projective transformation, the centre (0.5, 0.5) of the unit square maps to the intersection of the quad diagonals (Hartley & Zisserman §2.2)
    const dst: Quad = [
      { x: 100, y: 80 },
      { x: 700, y: 120 },
      { x: 760, y: 980 },
      { x: 60, y: 1000 },
    ];
    const h = solveHomography(UNIT_SQUARE, dst);

    for (let i = 0; i < 4; i++) {
      const s = UNIT_SQUARE[i] ?? { x: 0, y: 0 };
      const d = dst[i] ?? { x: 0, y: 0 };
      const mapped = applyHomography(h, s);
      expect(Math.abs(mapped.x - d.x)).toBeLessThan(1e-6);
      expect(Math.abs(mapped.y - d.y)).toBeLessThan(1e-6);
    }

    const diagIntersection = lineIntersection(dst[0], dst[2], dst[1], dst[3]);
    const centerMapped = applyHomography(h, { x: 0.5, y: 0.5 });
    expect(Math.abs(centerMapped.x - diagIntersection.x)).toBeLessThan(1e-6);
    expect(Math.abs(centerMapped.y - diagIntersection.y)).toBeLessThan(1e-6);
  });

  it("throws a clear error and never returns NaN when three points of a quad are collinear", () => {
    const degenerateDst: Quad = [
      { x: 100, y: 100 },
      { x: 300, y: 200 },
      { x: 500, y: 300 }, // collinear with (100,100) and (300,200)
      { x: 120, y: 600 },
    ];
    expect(() => solveHomography(UNIT_SQUARE, degenerateDst)).toThrow(/collinear|Degenerate/i);
  });
});
