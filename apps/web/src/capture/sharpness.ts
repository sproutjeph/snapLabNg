/**
 * Computes the variance of a 3×3 Laplacian ([0, 1, 0; 1, -4, 1; 0, 1, 0])
 * on greyscale luminance across interior pixels of `img`.
 * Used for the live "Hold steady" sharpness hint. Pure, no DOM.
 */
export function sharpness(img: ImageData): number {
  const { width, height, data } = img;
  if (width < 3 || height < 3) return 0;

  const total = width * height;
  const grey = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const r = data[idx] ?? 0;
    const g = data[idx + 1] ?? 0;
    const b = data[idx + 2] ?? 0;
    grey[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  let count = 0;
  let sum = 0;
  let sumSq = 0;

  for (let y = 1; y < height - 1; y++) {
    const rowOff = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = rowOff + x;
      const center = grey[idx] ?? 0;
      const top = grey[idx - width] ?? 0;
      const bottom = grey[idx + width] ?? 0;
      const left = grey[idx - 1] ?? 0;
      const right = grey[idx + 1] ?? 0;

      const lap = top + bottom + left + right - 4 * center;
      sum += lap;
      sumSq += lap * lap;
      count += 1;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  return Math.max(0, sumSq / count - mean * mean);
}
