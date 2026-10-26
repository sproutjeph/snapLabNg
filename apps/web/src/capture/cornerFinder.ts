import type { Point, Quad } from "./types";

const MAX_WORK_SIDE = 256;
const MIN_BLOB_FRACTION = 0.15;
const MAX_PAPER_SATURATION = 0.48;

function isPaperPixel(r: number, g: number, b: number, lumThreshold: number): boolean {
  const lum = (77 * r + 150 * g + 29 * b) >> 8;
  if (lum < lumThreshold) return false;
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const sat = maxC > 0 ? (maxC - minC) / maxC : 0;
  return sat <= MAX_PAPER_SATURATION;
}

/**
 * Picks a brightness threshold from the image's 256-bin luminance histogram
 * using Otsu's between-class variance maximization. Returns null if the image
 * has insufficient contrast or no bright paper mode (e.g. an all-dark frame).
 */
function computeOtsuThreshold(hist: Uint32Array, totalPixels: number): number | null {
  if (totalPixels <= 0) return null;

  let totalSum = 0;
  for (let i = 0; i < 256; i++) {
    totalSum += i * (hist[i] ?? 0);
  }

  let sumB = 0;
  let wB = 0;
  let maxVariance = -1;
  let bestThreshold = 128;
  let bestMu0 = 0;
  let bestMu1 = 0;

  for (let t = 0; t < 256; t++) {
    const count = hist[t] ?? 0;
    wB += count;
    if (wB === 0) continue;

    const wF = totalPixels - wB;
    if (wF === 0) break;

    sumB += t * count;
    const mu0 = sumB / wB;
    const mu1 = (totalSum - sumB) / wF;
    const diff = mu1 - mu0;
    const betweenVar = wB * wF * diff * diff;

    if (betweenVar > maxVariance) {
      maxVariance = betweenVar;
      bestThreshold = t + 1;
      bestMu0 = mu0;
      bestMu1 = mu1;
    }
  }

  // Reject flat/all-dark images where the upper class is still dark or contrast is negligible
  if (bestMu1 < 85 || bestMu1 - bestMu0 < 25) {
    return null;
  }

  return Math.max(bestThreshold, Math.round((bestMu0 + bestMu1) * 0.5));
}

/**
 * Refines a coarse corner (cx, cy) inside a small full-resolution window of `img`
 * by finding the paper pixel optimizing `scoreFn(x, y)`.
 */
function refineCornerInSource(
  img: ImageData,
  coarseX: number,
  coarseY: number,
  lumThreshold: number,
  radius: number,
  scoreFn: (x: number, y: number) => number,
): Point {
  const { width, height, data } = img;
  const minX = Math.max(0, Math.floor(coarseX - radius));
  const maxX = Math.min(width - 1, Math.ceil(coarseX + radius));
  const minY = Math.max(0, Math.floor(coarseY - radius));
  const maxY = Math.min(height - 1, Math.ceil(coarseY + radius));

  let bestX = Math.min(width - 1, Math.max(0, Math.round(coarseX)));
  let bestY = Math.min(height - 1, Math.max(0, Math.round(coarseY)));
  let bestScore = Number.NEGATIVE_INFINITY;
  let found = false;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx] ?? 0;
      const g = data[idx + 1] ?? 0;
      const b = data[idx + 2] ?? 0;
      if (!isPaperPixel(r, g, b, lumThreshold)) continue;
      const score = scoreFn(x, y);
      if (!found || score > bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
        found = true;
      }
    }
  }

  return { x: bestX, y: bestY };
}

/**
 * Finds the four corners of an exercise-book page in `img`.
 * Downsamples to at most 256 px on the long side, thresholds bright low-saturation
 * paper pixels from the image's own histogram, keeps the largest connected blob
 * via iterative flood fill, and returns its four extreme points ordered TL, TR, BR, BL
 * in the input image's pixel coordinates. Returns `null` when the blob covers < 15%.
 */
export function findPageCorners(img: ImageData): Quad | null {
  const srcW = img.width;
  const srcH = img.height;
  if (srcW < 4 || srcH < 4) return null;

  const scale = Math.min(1, MAX_WORK_SIDE / Math.max(srcW, srcH));
  const sw = Math.max(1, Math.round(srcW * scale));
  const sh = Math.max(1, Math.round(srcH * scale));
  const totalWorkPixels = sw * sh;

  const workR = new Uint8Array(totalWorkPixels);
  const workG = new Uint8Array(totalWorkPixels);
  const workB = new Uint8Array(totalWorkPixels);
  const hist = new Uint32Array(256);

  const srcData = img.data;
  for (let wy = 0; wy < sh; wy++) {
    const sy = Math.min(srcH - 1, Math.floor(((wy + 0.5) * srcH) / sh));
    const srcRowOffset = sy * srcW;
    const workRowOffset = wy * sw;
    for (let wx = 0; wx < sw; wx++) {
      const sx = Math.min(srcW - 1, Math.floor(((wx + 0.5) * srcW) / sw));
      const sIdx = (srcRowOffset + sx) * 4;
      const r = srcData[sIdx] ?? 0;
      const g = srcData[sIdx + 1] ?? 0;
      const b = srcData[sIdx + 2] ?? 0;
      const wIdx = workRowOffset + wx;
      workR[wIdx] = r;
      workG[wIdx] = g;
      workB[wIdx] = b;
      const lum = (77 * r + 150 * g + 29 * b) >> 8;
      hist[lum] = (hist[lum] ?? 0) + 1;
    }
  }

  const lumThreshold = computeOtsuThreshold(hist, totalWorkPixels);
  if (lumThreshold === null) return null;

  const mask = new Uint8Array(totalWorkPixels);
  for (let i = 0; i < totalWorkPixels; i++) {
    if (isPaperPixel(workR[i] ?? 0, workG[i] ?? 0, workB[i] ?? 0, lumThreshold)) {
      mask[i] = 1;
    }
  }

  // Iterative flood fill keeping the largest connected blob.
  // Stepping up to radius 2 bridges 1-2 px ruled lines drawn across the page.
  const visited = new Uint8Array(totalWorkPixels);
  const labels = new Int32Array(totalWorkPixels);
  const stack = new Int32Array(totalWorkPixels);

  let currentLabel = 0;
  let bestLabel = -1;
  let bestCount = 0;

  for (let startIdx = 0; startIdx < totalWorkPixels; startIdx++) {
    if (mask[startIdx] !== 1 || visited[startIdx] === 1) continue;

    currentLabel += 1;
    let stackTop = 0;
    stack[stackTop++] = startIdx;
    visited[startIdx] = 1;
    labels[startIdx] = currentLabel;
    let count = 0;

    while (stackTop > 0) {
      const idx = stack[--stackTop] ?? 0;
      count += 1;
      const cx = idx % sw;
      const cy = (idx - cx) / sw;

      const minNy = Math.max(0, cy - 2);
      const maxNy = Math.min(sh - 1, cy + 2);
      const minNx = Math.max(0, cx - 2);
      const maxNx = Math.min(sw - 1, cx + 2);

      for (let ny = minNy; ny <= maxNy; ny++) {
        const rowOff = ny * sw;
        for (let nx = minNx; nx <= maxNx; nx++) {
          const nIdx = rowOff + nx;
          if (mask[nIdx] === 1 && visited[nIdx] === 0) {
            visited[nIdx] = 1;
            labels[nIdx] = currentLabel;
            stack[stackTop++] = nIdx;
          }
        }
      }
    }

    if (count > bestCount) {
      bestCount = count;
      bestLabel = currentLabel;
    }
  }

  if (bestLabel < 0 || bestCount < MIN_BLOB_FRACTION * totalWorkPixels) {
    return null;
  }

  // Extract the four extreme points of the largest blob:
  // TL = min(x + y), TR = max(x - y), BR = max(x + y), BL = min(x - y)
  let minSum = Number.POSITIVE_INFINITY;
  let maxSum = Number.NEGATIVE_INFINITY;
  let minDiff = Number.POSITIVE_INFINITY;
  let maxDiff = Number.NEGATIVE_INFINITY;

  let tlW: Point = { x: 0, y: 0 };
  let trW: Point = { x: sw - 1, y: 0 };
  let brW: Point = { x: sw - 1, y: sh - 1 };
  let blW: Point = { x: 0, y: sh - 1 };

  for (let wy = 0; wy < sh; wy++) {
    const rowOff = wy * sw;
    for (let wx = 0; wx < sw; wx++) {
      if (labels[rowOff + wx] !== bestLabel) continue;
      // Normalise coordinates by aspect so sum/diff treat x and y symmetrically
      const sum = wx + wy;
      const diff = wx - wy;
      if (sum < minSum) {
        minSum = sum;
        tlW = { x: wx, y: wy };
      }
      if (diff > maxDiff) {
        maxDiff = diff;
        trW = { x: wx, y: wy };
      }
      if (sum > maxSum) {
        maxSum = sum;
        brW = { x: wx, y: wy };
      }
      if (diff < minDiff) {
        minDiff = diff;
        blW = { x: wx, y: wy };
      }
    }
  }

  const toSrcX = (wx: number) => ((wx + 0.5) * srcW) / sw - 0.5;
  const toSrcY = (wy: number) => ((wy + 0.5) * srcH) / sh - 0.5;
  const searchRadius = Math.ceil(Math.max(srcW / sw, srcH / sh) * 2) + 2;

  const tl = refineCornerInSource(
    img,
    toSrcX(tlW.x),
    toSrcY(tlW.y),
    lumThreshold,
    searchRadius,
    (x, y) => -(x + y),
  );
  const tr = refineCornerInSource(
    img,
    toSrcX(trW.x),
    toSrcY(trW.y),
    lumThreshold,
    searchRadius,
    (x, y) => x - y,
  );
  const br = refineCornerInSource(
    img,
    toSrcX(brW.x),
    toSrcY(brW.y),
    lumThreshold,
    searchRadius,
    (x, y) => x + y,
  );
  const bl = refineCornerInSource(
    img,
    toSrcX(blW.x),
    toSrcY(blW.y),
    lumThreshold,
    searchRadius,
    (x, y) => -(x - y),
  );

  return [tl, tr, br, bl];
}
