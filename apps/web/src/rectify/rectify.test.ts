import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { applyHomography, solveHomography } from "../capture/homography";
import type { Quad } from "../capture/types";
import { headerQuad } from "./headerBlur";
import { inkWeight } from "./ink";
import { toMatrix3 } from "./rectify";

const unit: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
const photoQuad: Quad = [
  { x: 298.4, y: 162.4 },
  { x: 972, y: 221.6 },
  { x: 929.6, y: 873.6 },
  { x: 239.2, y: 809.6 },
];
const h = solveHomography(unit, photoQuad);

const rgb = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16) / 255,
  Number.parseInt(hex.slice(3, 5), 16) / 255,
  Number.parseInt(hex.slice(5, 7), 16) / 255,
];
const PAPER = rgb("#f1ece0");
const paperLum = 0.299 * PAPER[0] + 0.587 * PAPER[1] + 0.114 * PAPER[2];

describe("rectify homography uniform", () => {
  it("gives the shader the same mapping as applyHomography", () => {
    // GLSL computes uH * vec3(u, v, 1); three's Matrix3.set takes row-major entries.
    const m = toMatrix3(h);
    for (const [u, v] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0.3, 0.7],
    ] as const) {
      const p = new THREE.Vector3(u, v, 1).applyMatrix3(m);
      const want = applyHomography(h, { x: u, y: v });
      expect(p.x / p.z).toBeCloseTo(want.x, 9);
      expect(p.y / p.z).toBeCloseTo(want.y, 9);
    }
  });
});

describe("header band", () => {
  it("starts at the page's top corners and runs down both edges", () => {
    const q = headerQuad(h, 0.12);
    expect(q[0].x).toBeCloseTo(298.4, 6);
    expect(q[0].y).toBeCloseTo(162.4, 6);
    expect(q[1].x).toBeCloseTo(972, 6);
    expect(q[1].y).toBeCloseTo(221.6, 6);
    // Lower edge lies 12% of the way down each side.
    expect(q[3].y).toBeGreaterThan(q[0].y);
    expect(q[3].y).toBeLessThan(q[0].y + 0.2 * (809.6 - 162.4));
  });
});

describe("ink mask", () => {
  it("keeps blue biro and pencil as ink", () => {
    expect(inkWeight(...rgb("#1d2b6b"), paperLum)).toBeGreaterThan(0.95);
    expect(inkWeight(...rgb("#2a2a2a"), paperLum)).toBeGreaterThan(0.95);
    expect(inkWeight(...rgb("#7a7a7a"), paperLum)).toBeGreaterThan(0.6); // HB pencil graph line
  });

  it("drops paper, faint ruled lines and the red margin", () => {
    expect(inkWeight(...PAPER, paperLum)).toBe(0);
    // Ruled line: rgba(90,120,200,0.6) over the paper ≈ #96a6d2.
    expect(inkWeight(...rgb("#96a6d2"), paperLum)).toBeLessThan(0.1);
    expect(inkWeight(...rgb("#d0473f"), paperLum)).toBeLessThan(0.05);
  });

  it("ignores a shadow because darkness is measured against the local paper", () => {
    const shaded: [number, number, number] = [PAPER[0] * 0.6, PAPER[1] * 0.6, PAPER[2] * 0.6];
    const shadedPaperLum = paperLum * 0.62;
    expect(inkWeight(...shaded, shadedPaperLum)).toBe(0);
    // Ink inside the shadow still counts.
    const inkInShadow = rgb("#1d2b6b").map((c) => c * 0.6) as [number, number, number];
    expect(inkWeight(...inkInShadow, shadedPaperLum)).toBeGreaterThan(0.95);
  });
});
