import { describe, expect, it } from "vitest";
import { sharpness } from "./sharpness";

function createCheckerboard(width: number, height: number, cellSize: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cx = Math.floor(x / cellSize);
      const cy = Math.floor(y / cellSize);
      const v = (cx + cy) % 2 === 0 ? 235 : 25;
      const idx = (y * width + x) * 4;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  return { width, height, data, colorSpace: "srgb" } as ImageData;
}

function boxBlur3x3(img: ImageData): ImageData {
  const { width, height, data } = img;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = Math.min(height - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) {
          const nx = Math.min(width - 1, Math.max(0, x + dx));
          sum += data[(ny * width + nx) * 4] ?? 0;
          count += 1;
        }
      }
      const v = Math.round(sum / count);
      const idx = (y * width + x) * 4;
      out[idx] = v;
      out[idx + 1] = v;
      out[idx + 2] = v;
      out[idx + 3] = 255;
    }
  }
  return { width, height, data: out, colorSpace: "srgb" } as ImageData;
}

describe("sharpness (3x3 Laplacian variance)", () => {
  it("returns a higher sharpness score for a crisp checkerboard than for the same checkerboard box-blurred", () => {
    // Variance of the Laplacian focus measure (Pech-Pacheco et al., ICPR 2000)
    const crisp = createCheckerboard(64, 64, 4);
    const blurred = boxBlur3x3(crisp);
    const crispScore = sharpness(crisp);
    const blurredScore = sharpness(blurred);

    expect(crispScore).toBeGreaterThan(blurredScore);
    expect(blurredScore).toBeGreaterThan(0);
  });
});
