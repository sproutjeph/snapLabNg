import { applyHomography } from "../capture/homography";
import type { Mat3, Quad } from "../capture/types";

/** Top share of the page holding NAME / SCHOOL, hidden before upload (docs/04 §2 ①, minors' privacy). */
export const HEADER_FRACTION = 0.12;
/** Mosaic block size in photo pixels. Pixelating works on every browser, unlike ctx.filter. */
const BLOCK_PX = 16;

/** The header band of the page, in photo pixels: TL, TR, then down the right and left edges. */
export function headerQuad(h: Mat3, fraction: number = HEADER_FRACTION): Quad {
  return [
    applyHomography(h, { x: 0, y: 0 }),
    applyHomography(h, { x: 1, y: 0 }),
    applyHomography(h, { x: 1, y: fraction }),
    applyHomography(h, { x: 0, y: fraction }),
  ];
}

/** Returns a copy of the JPEG with the page's header band pixelated beyond reading. */
export async function blurHeader(
  photo: Blob,
  width: number,
  height: number,
  h: Mat3,
  fraction: number = HEADER_FRACTION,
): Promise<Blob> {
  const bitmap = await createImageBitmap(photo);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(width / BLOCK_PX));
  small.height = Math.max(1, Math.round(height / BLOCK_PX));
  const smallCtx = small.getContext("2d");
  // Fail closed: never upload a readable header because a canvas was unavailable.
  if (!smallCtx) throw new Error("2D canvas is not available");
  smallCtx.drawImage(bitmap, 0, 0, small.width, small.height);
  bitmap.close();

  const q = headerQuad(h, fraction);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(q[0].x, q[0].y);
  for (const p of q.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, width, height);
  ctx.restore();

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("JPEG encode failed"))),
      "image/jpeg",
      0.8,
    ),
  );
}
