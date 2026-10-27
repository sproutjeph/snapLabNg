import { describe, expect, it } from "vitest";
import { boxPath, circlePath, formatHalf, strikePath, tickPath, underlinePath } from "./inkPaths";

function parsePathPoints(path: string): Array<[number, number]> {
  const tokens = path.trim().split(/\s+/);
  const points: Array<[number, number]> = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i];
    expect(cmd === "M" || cmd === "L").toBe(true);
    const x = Number(tokens[i + 1]);
    const y = Number(tokens[i + 2]);
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
    points.push([x, y]);
    i += 3;
  }
  return points;
}

describe("inkPaths", () => {
  it("formats half and whole marks using the ½ character", () => {
    expect(formatHalf(15.5)).toBe("15½");
    expect(formatHalf(21)).toBe("21");
    expect(formatHalf(0.5)).toBe("½");
    expect(formatHalf(0)).toBe("0");
    expect(formatHalf(2.5)).toBe("2½");
  });

  it("produces deterministic SVG paths starting with M for the same seed", () => {
    const box = { x0: 0.32, y0: 0.46, x1: 0.4, y1: 0.5 };
    const aspect = 1.3333;
    const helpers = [circlePath, strikePath, underlinePath, tickPath, boxPath];

    for (const fn of helpers) {
      const a = fn(box, aspect, 42);
      const b = fn(box, aspect, 42);
      const c = fn(box, aspect, 99);
      expect(a).toBe(b);
      expect(a).not.toBe(c);
      expect(a.startsWith("M ")).toBe(true);
      expect(parsePathPoints(a).length).toBeGreaterThanOrEqual(5);
    }
  });

  it("keeps every point of every path helper within the box expanded by 15%", () => {
    const boxes = [
      { x0: 0.33, y0: 0.475, x1: 0.4, y1: 0.505 },
      { x0: 0.08, y0: 0.875, x1: 0.68, y1: 0.908 },
      { x0: 0.55, y0: 0.58, x1: 0.92, y1: 0.82 },
    ];
    const aspects = [1, 4 / 3, Math.SQRT2];
    const seeds = [1, 7, 42, 1024, 99999];
    const helpers = [circlePath, strikePath, underlinePath, tickPath, boxPath];

    for (const box of boxes) {
      for (const aspect of aspects) {
        const sx0 = box.x0;
        const sx1 = box.x1;
        const sy0 = box.y0 * aspect;
        const sy1 = box.y1 * aspect;
        const w = sx1 - sx0;
        const h = sy1 - sy0;
        const minX = sx0 - 0.15 * w - 1e-6;
        const maxX = sx1 + 0.15 * w + 1e-6;
        const minY = sy0 - 0.15 * h - 1e-6;
        const maxY = sy1 + 0.15 * h + 1e-6;

        for (const seed of seeds) {
          for (const fn of helpers) {
            const d = fn(box, aspect, seed);
            const pts = parsePathPoints(d);
            for (const [x, y] of pts) {
              expect(x).toBeGreaterThanOrEqual(minX);
              expect(x).toBeLessThanOrEqual(maxX);
              expect(y).toBeGreaterThanOrEqual(minY);
              expect(y).toBeLessThanOrEqual(maxY);
            }
          }
        }
      }
    }
  });
});
