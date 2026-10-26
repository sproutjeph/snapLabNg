import type { Mat3, Point, Quad } from "./types";

const EPSILON = 1e-9;

/**
 * Returns true iff `q` is a strictly convex, non-self-crossing quadrilateral
 * with finite coordinates (all four consecutive edge cross products share the same non-zero sign).
 */
export function isConvexQuad(q: Quad): boolean {
  for (const pt of q) {
    if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
      return false;
    }
  }
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    if (!a || !b || !c) return false;
    const e1x = b.x - a.x;
    const e1y = b.y - a.y;
    const e2x = c.x - b.x;
    const e2y = c.y - b.y;
    const cross = e1x * e2y - e1y * e2x;
    if (Math.abs(cross) <= EPSILON) {
      return false;
    }
    const currentSign = cross > 0 ? 1 : -1;
    if (sign === 0) {
      sign = currentSign;
    } else if (sign !== currentSign) {
      return false;
    }
  }
  return true;
}

function assertNonDegenerateQuad(q: Quad, label: string): void {
  for (const pt of q) {
    if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
      throw new Error(`Invalid ${label} quad: coordinates must be finite numbers`);
    }
  }
  if (!isConvexQuad(q)) {
    throw new Error(
      `Degenerate ${label} quad: corners must form a strictly convex, non-self-crossing quadrilateral`,
    );
  }
}

/**
 * Computes the 3×3 homography matrix mapping `src` quad to `dst` quad
 * using 4-point Direct Linear Transform (DLT) solved by Gaussian elimination
 * with partial pivoting. Normalises h[8] = 1.
 */
export function solveHomography(src: Quad, dst: Quad): Mat3 {
  assertNonDegenerateQuad(src, "source");
  assertNonDegenerateQuad(dst, "destination");

  // 8x9 augmented matrix [A | b] for unknowns h0..h7 with h8 = 1
  const aug: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const s = src[i];
    const d = dst[i];
    if (!s || !d) {
      throw new Error("Quad must contain 4 points");
    }
    const x = s.x;
    const y = s.y;
    const u = d.x;
    const v = d.y;

    aug.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    aug.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }

  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(aug[col]?.[col] ?? 0);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(aug[row]?.[col] ?? 0);
      if (val > maxVal) {
        maxVal = val;
        pivotRow = row;
      }
    }

    if (maxVal < 1e-11) {
      throw new Error("Degenerate quad: singular homography system");
    }

    if (pivotRow !== col) {
      const tmp = aug[col];
      const piv = aug[pivotRow];
      if (tmp && piv) {
        aug[col] = piv;
        aug[pivotRow] = tmp;
      }
    }

    const colRow = aug[col];
    if (!colRow) {
      throw new Error("Internal solver error");
    }
    const pivot = colRow[col] ?? 1;

    for (let j = col; j <= n; j++) {
      colRow[j] = (colRow[j] ?? 0) / pivot;
    }

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const targetRow = aug[row];
      if (!targetRow) continue;
      const factor = targetRow[col] ?? 0;
      if (Math.abs(factor) < 1e-15) continue;
      for (let j = col; j <= n; j++) {
        targetRow[j] = (targetRow[j] ?? 0) - factor * (colRow[j] ?? 0);
      }
    }
  }

  const h0 = aug[0]?.[8] ?? Number.NaN;
  const h1 = aug[1]?.[8] ?? Number.NaN;
  const h2 = aug[2]?.[8] ?? Number.NaN;
  const h3 = aug[3]?.[8] ?? Number.NaN;
  const h4 = aug[4]?.[8] ?? Number.NaN;
  const h5 = aug[5]?.[8] ?? Number.NaN;
  const h6 = aug[6]?.[8] ?? Number.NaN;
  const h7 = aug[7]?.[8] ?? Number.NaN;

  const result: Mat3 = [h0, h1, h2, h3, h4, h5, h6, h7, 1];
  for (const val of result) {
    if (!Number.isFinite(val)) {
      throw new Error("Degenerate quad: homography solution contains non-finite values");
    }
  }

  return result;
}

/**
 * Applies a 3×3 homography `h` to a 2D point `p` with perspective division.
 */
export function applyHomography(h: Mat3, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  if (Math.abs(w) < 1e-12) {
    throw new Error("Point maps to infinity under homography");
  }
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}
