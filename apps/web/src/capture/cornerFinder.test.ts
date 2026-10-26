import { describe, expect, it } from "vitest";
import { findPageCorners } from "./cornerFinder";
import type { Point, Quad } from "./types";

function pointInConvexQuad(p: Point, q: Quad): boolean {
  for (let i = 0; i < 4; i++) {
    const a = q[i] ?? { x: 0, y: 0 };
    const b = q[(i + 1) % 4] ?? { x: 0, y: 0 };
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross < 0) return false;
  }
  return true;
}

function makeImageData(width: number, height: number, data: Uint8ClampedArray): ImageData {
  return {
    width,
    height,
    data,
    colorSpace: "srgb",
  } as ImageData;
}

function renderSyntheticScene(options: {
  width: number;
  height: number;
  quad?: Quad;
  addNoise?: boolean;
  addRuledLines?: boolean;
  bgRgb?: [number, number, number];
  fgRgb?: [number, number, number];
}): ImageData {
  const {
    width,
    height,
    quad,
    addNoise = false,
    addRuledLines = false,
    bgRgb = [58, 38, 24],
    fgRgb = [245, 243, 238],
  } = options;

  const data = new Uint8ClampedArray(width * height * 4);
  // Deterministic LCG PRNG for reproducible tests
  let seed = 0x12345678;
  const nextRand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed & 0xffff) / 0xffff - 0.5;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const inQuad = quad ? pointInConvexQuad({ x, y }, quad) : false;

      let r = inQuad ? fgRgb[0] : bgRgb[0];
      let g = inQuad ? fgRgb[1] : bgRgb[1];
      let b = inQuad ? fgRgb[2] : bgRgb[2];

      // Draw blue horizontal ruled lines across the interior of the page (avoiding extreme corners)
      if (inQuad && addRuledLines && y % 24 === 0 && y > 95 && y < 385) {
        r = 70;
        g = 110;
        b = 205;
      }

      if (addNoise) {
        const n = Math.round(nextRand() * 18);
        r = Math.max(0, Math.min(255, r + n));
        g = Math.max(0, Math.min(255, g + n));
        b = Math.max(0, Math.min(255, b + n));
      }

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  return makeImageData(width, height, data);
}

describe("findPageCorners", () => {
  const truthQuad: Quad = [
    { x: 112, y: 64 }, // TL
    { x: 524, y: 82 }, // TR
    { x: 506, y: 416 }, // BR
    { x: 94, y: 396 }, // BL
  ];

  it("finds the four corners of a rotated white quad on a dark-brown background within 3 px in TL, TR, BR, BL order", () => {
    const img = renderSyntheticScene({
      width: 640,
      height: 480,
      quad: truthQuad,
    });
    const found = findPageCorners(img);
    expect(found).not.toBeNull();
    if (!found) return;

    for (let i = 0; i < 4; i++) {
      const f = found[i] ?? { x: 0, y: 0 };
      const t = truthQuad[i] ?? { x: 0, y: 0 };
      const dist = Math.hypot(f.x - t.x, f.y - t.y);
      expect(dist).toBeLessThanOrEqual(3);
    }
  });

  it("finds the four corners within 3 px with deterministic mild noise and blue ruled lines drawn on the white quad", () => {
    const img = renderSyntheticScene({
      width: 640,
      height: 480,
      quad: truthQuad,
      addNoise: true,
      addRuledLines: true,
    });
    const found = findPageCorners(img);
    expect(found).not.toBeNull();
    if (!found) return;

    for (let i = 0; i < 4; i++) {
      const f = found[i] ?? { x: 0, y: 0 };
      const t = truthQuad[i] ?? { x: 0, y: 0 };
      const dist = Math.hypot(f.x - t.x, f.y - t.y);
      expect(dist).toBeLessThanOrEqual(3);
    }
  });

  it("returns null for an all-dark image and for a small white square covering 5% of the frame", () => {
    const allDark = renderSyntheticScene({
      width: 640,
      height: 480,
      bgRgb: [22, 18, 16],
    });
    expect(findPageCorners(allDark)).toBeNull();

    // 5% of 640*480 = 15,360 px -> ~124x124 square
    const smallQuad: Quad = [
      { x: 258, y: 178 },
      { x: 382, y: 178 },
      { x: 382, y: 302 },
      { x: 258, y: 302 },
    ];
    const smallWhite = renderSyntheticScene({
      width: 640,
      height: 480,
      quad: smallQuad,
    });
    expect(findPageCorners(smallWhite)).toBeNull();
  });
});
