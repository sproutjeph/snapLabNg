const MAX_LONG_SIDE = 1280;
const JPEG_QUALITY = 0.8;

/**
 * Downscales `source` so its long side is at most 1280 px and encodes it as
 * a JPEG (`quality: 0.8`), using `OffscreenCanvas` when available and falling
 * back to an HTML `<canvas>`.
 */
export async function compressPhoto(
  source: CanvasImageSource,
  w: number,
  h: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const safeW = Math.max(1, Math.round(w));
  const safeH = Math.max(1, Math.round(h));
  const scale = Math.min(1, MAX_LONG_SIDE / Math.max(safeW, safeH));
  const width = Math.max(1, Math.round(safeW * scale));
  const height = Math.max(1, Math.round(safeH * scale));

  if (typeof OffscreenCanvas !== "undefined") {
    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext("2d");
    if (ctx) {
      ctx.drawImage(source, 0, 0, width, height);
      const blob = await offscreen.convertToBlob({
        type: "image/jpeg",
        quality: JPEG_QUALITY,
      });
      return { blob, width, height };
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not acquire 2D canvas context for photo compression");
  }
  ctx.drawImage(source, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas toBlob failed to encode JPEG"));
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  return { blob, width, height };
}
