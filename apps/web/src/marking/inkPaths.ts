import type { Box } from "@snaplab/contracts";

/**
 * Deterministic 32-bit PRNG (Mulberry32).
 * Same seed always produces the exact same sequence in [0, 1).
 */
function createPrng(seed: number): () => number {
  let state = seed >>> 0 || 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SvgBox {
  sx0: number;
  sy0: number;
  sx1: number;
  sy1: number;
  w: number;
  h: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Maps a normalized 0..1 page Box into SVG user coordinates (`viewBox="0 0 1 ${aspect}"`)
 * and precomputes the 14% clamping bounds (strictly inside the 15%-expanded box).
 */
function toSvgBox(box: Box, aspect: number): SvgBox {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const sx0 = Math.min(box.x0, box.x1);
  const sx1 = Math.max(box.x0, box.x1);
  const sy0 = Math.min(box.y0, box.y1) * safeAspect;
  const sy1 = Math.max(box.y0, box.y1) * safeAspect;
  const w = Math.max(sx1 - sx0, 1e-6);
  const h = Math.max(sy1 - sy0, 1e-6);
  // Pad annotations ~10% around the box with wobble kept strictly inside 14% (< 15%).
  const pad = 0.14;
  return {
    sx0,
    sy0,
    sx1,
    sy1,
    w,
    h,
    minX: sx0 - pad * w,
    maxX: sx1 + pad * w,
    minY: sy0 - pad * h,
    maxY: sy1 + pad * h,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function fmt(n: number): string {
  return Number(n.toFixed(5)).toString();
}

function buildPolyline(points: ReadonlyArray<readonly [number, number]>, b: SvgBox): string {
  return points
    .map(([x, y], idx) => {
      const cx = fmt(clamp(x, b.minX, b.maxX));
      const cy = fmt(clamp(y, b.minY, b.maxY));
      return `${idx === 0 ? "M" : "L"} ${cx} ${cy}`;
    })
    .join(" ");
}

/**
 * Hand-inked ellipse around `box` (padded by ~10%) with a slight loop overshoot.
 */
export function circlePath(box: Box, aspect: number, seed: number): string {
  const b = toSvgBox(box, aspect);
  const rand = createPrng(seed ^ 0x1a2b3c4d);
  const cx = (b.sx0 + b.sx1) / 2;
  const cy = (b.sy0 + b.sy1) / 2;
  // Base semi-axes: 10% padding on each side => 0.60 * w and 0.60 * h
  const rx = 0.58 * b.w;
  const ry = 0.58 * b.h;
  const steps = 24;
  const startAngle = -Math.PI / 2 - 0.22 + (rand() - 0.5) * 0.12;
  const totalSweep = Math.PI * 2 + 0.38;

  const pts: Array<readonly [number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = startAngle + t * totalSweep;
    // Slight organic radial drift + per-vertex jitter within ±0.03 of box dimension
    const radialScale = 1 + (rand() - 0.5) * 0.04;
    const jx = (rand() - 0.5) * 0.02 * b.w;
    const jy = (rand() - 0.5) * 0.02 * b.h;
    const x = cx + Math.cos(theta) * rx * radialScale + jx;
    const y = cy + Math.sin(theta) * ry * radialScale + jy;
    pts.push([x, y]);
  }
  return buildPolyline(pts, b);
}

/**
 * Hand-inked horizontal strike-through across the middle of `box`.
 */
export function strikePath(box: Box, aspect: number, seed: number): string {
  const b = toSvgBox(box, aspect);
  const rand = createPrng(seed ^ 0x5f3759df);
  const steps = 8;
  const xStart = b.sx0 - 0.08 * b.w;
  const xEnd = b.sx1 + 0.08 * b.w;
  const yStart = b.sy0 + 0.54 * b.h;
  const yEnd = b.sy0 + 0.46 * b.h;

  const pts: Array<readonly [number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const arch = Math.sin(t * Math.PI) * -0.025 * b.h;
    const jx = (rand() - 0.5) * 0.015 * b.w;
    const jy = (rand() - 0.5) * 0.03 * b.h;
    const x = xStart + (xEnd - xStart) * t + jx;
    const y = yStart + (yEnd - yStart) * t + arch + jy;
    pts.push([x, y]);
  }
  return buildPolyline(pts, b);
}

/**
 * Hand-inked underline beneath `box` (within the 10% bottom pad).
 */
export function underlinePath(box: Box, aspect: number, seed: number): string {
  const b = toSvgBox(box, aspect);
  const rand = createPrng(seed ^ 0x9e3779b9);
  const steps = 8;
  const xStart = b.sx0 - 0.08 * b.w;
  const xEnd = b.sx1 + 0.08 * b.w;
  const baseY = b.sy1 + 0.08 * b.h;

  const pts: Array<readonly [number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bow = Math.sin(t * Math.PI) * 0.02 * b.h;
    const jx = (rand() - 0.5) * 0.015 * b.w;
    const jy = (rand() - 0.5) * 0.025 * b.h;
    const x = xStart + (xEnd - xStart) * t + jx;
    const y = baseY + bow + jy;
    pts.push([x, y]);
  }
  return buildPolyline(pts, b);
}

/**
 * Hand-inked check mark at the right edge of `box`, kept inside the 15%-expanded box.
 */
export function tickPath(box: Box, aspect: number, seed: number): string {
  const b = toSvgBox(box, aspect);
  const rand = createPrng(seed ^ 0x7f4a7c15);
  // Keep horizontal span proportional to height on wide boxes while never exceeding 0.24 * w.
  const spanX = Math.min(b.w * 0.24, b.h * 0.9);
  const rightX = b.sx1 + Math.min(0.11 * b.w, 0.35 * spanX);
  const leftX = rightX - spanX;
  const midX = leftX + 0.38 * spanX;

  const p0: readonly [number, number] = [
    leftX + (rand() - 0.5) * 0.02 * spanX,
    b.sy0 + 0.56 * b.h + (rand() - 0.5) * 0.03 * b.h,
  ];
  const p1: readonly [number, number] = [
    (leftX + midX) / 2 + (rand() - 0.5) * 0.02 * spanX,
    b.sy0 + 0.74 * b.h + (rand() - 0.5) * 0.03 * b.h,
  ];
  const p2: readonly [number, number] = [
    midX + (rand() - 0.5) * 0.02 * spanX,
    b.sy0 + 0.9 * b.h + (rand() - 0.5) * 0.03 * b.h,
  ];
  const p3: readonly [number, number] = [
    (midX + rightX) / 2 + (rand() - 0.5) * 0.02 * spanX,
    b.sy0 + 0.42 * b.h + (rand() - 0.5) * 0.03 * b.h,
  ];
  const p4: readonly [number, number] = [
    rightX + (rand() - 0.5) * 0.02 * spanX,
    b.sy0 - 0.08 * b.h + (rand() - 0.5) * 0.03 * b.h,
  ];

  return buildPolyline([p0, p1, p2, p3, p4], b);
}

/**
 * Hand-inked rectangular box around `box` (padded by 10% on each side).
 */
export function boxPath(box: Box, aspect: number, seed: number): string {
  const b = toSvgBox(box, aspect);
  const rand = createPrng(seed ^ 0x2c1b3c6d);
  const px0 = b.sx0 - 0.1 * b.w;
  const px1 = b.sx1 + 0.1 * b.w;
  const py0 = b.sy0 - 0.1 * b.h;
  const py1 = b.sy1 + 0.1 * b.h;

  const edges: ReadonlyArray<readonly [readonly [number, number], readonly [number, number]]> = [
    [
      [px0, py0],
      [px1, py0],
    ],
    [
      [px1, py0],
      [px1, py1],
    ],
    [
      [px1, py1],
      [px0, py1],
    ],
    [
      [px0, py1],
      [px0 + 0.03 * b.w, py0 - 0.01 * b.h],
    ],
  ];

  const segsPerEdge = 4;
  const pts: Array<readonly [number, number]> = [];
  for (const [[xA, yA], [xB, yB]] of edges) {
    for (let s = 0; s < segsPerEdge; s++) {
      const t = s / segsPerEdge;
      const jx = (rand() - 0.5) * 0.02 * b.w;
      const jy = (rand() - 0.5) * 0.02 * b.h;
      pts.push([xA + (xB - xA) * t + jx, yA + (yB - yA) * t + jy]);
    }
  }
  const endX = px0 + 0.03 * b.w;
  const endY = py0 - 0.01 * b.h;
  pts.push([endX + (rand() - 0.5) * 0.02 * b.w, endY + (rand() - 0.5) * 0.02 * b.h]);

  return buildPolyline(pts, b);
}

/**
 * Formats a mark value in halves using the Unicode vulgar fraction `½` (U+00BD).
 * Examples: `15.5 → "15½"`, `21 → "21"`, `0.5 → "½"`, `0 → "0"`.
 */
export function formatHalf(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-9) {
    return "0";
  }
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const doubled = Math.round(abs * 2);
  const whole = Math.floor(doubled / 2);
  const hasHalf = doubled % 2 === 1;
  if (hasHalf) {
    return whole === 0 ? `${sign}½` : `${sign}${whole}½`;
  }
  return `${sign}${whole}`;
}
