import type * as THREE from "three";
import { HEADER_FRACTION } from "../rectify/headerBlur";

/** Mosaic block size for the NAME/SCHOOL band on the flattened page. */
const BLOCK_PX = 16;

/**
 * The flattened page as the JPEG that is uploaded: read back from the GPU, with the top
 * HEADER_FRACTION of the page pixelated (minors' privacy, docs/04 §2 ①). Uploading the
 * flattened page means every box the models return is in page coordinates.
 */
export async function pageToUploadJpeg(
  gl: THREE.WebGLRenderer,
  page: THREE.WebGLRenderTarget,
): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = page;
  const px = new Uint8Array(width * height * 4);
  gl.readRenderTargetPixels(page, 0, 0, width, height, px);
  const img = new ImageData(width, height);
  for (let y = 0; y < height; y++) {
    // Render targets are stored bottom row first.
    img.data.set(
      px.subarray((height - 1 - y) * width * 4, (height - y) * width * 4),
      y * width * 4,
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  ctx.putImageData(img, 0, 0);

  const band = Math.ceil(height * HEADER_FRACTION);
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(width / BLOCK_PX));
  small.height = Math.max(1, Math.round(band / BLOCK_PX));
  const sctx = small.getContext("2d");
  // Fail closed: never upload a readable header.
  if (!sctx) throw new Error("2D canvas is not available");
  sctx.drawImage(canvas, 0, 0, width, band, 0, 0, small.width, small.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, small.width, small.height, 0, 0, width, band);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("JPEG encode failed"))),
      "image/jpeg",
      0.8,
    ),
  );
  return { blob, width, height };
}
