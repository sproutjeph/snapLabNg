/** The server accepts at most 2048 px on the long side (docs/plans/snap-question.md). */
export const MAX_LONG_SIDE = 2048;

/** The server rejects photos over 1.5 MB, so uploads stay under 1.4 MB. */
export const MAX_JPEG_BYTES = Math.floor(1.4 * 1024 * 1024);

const JPEG_QUALITY = 0.85;

/** The size `w`×`h` becomes at most `maxSide` px on its long side, aspect kept. */
export function jpegDimensions(
  w: number,
  h: number,
  maxSide: number = MAX_LONG_SIDE,
): { width: number; height: number } {
  const safeW = Math.max(1, Math.round(w));
  const safeH = Math.max(1, Math.round(h));
  const scale = Math.min(1, maxSide / Math.max(safeW, safeH));
  return {
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale)),
  };
}

async function decodeViaImage(
  blob: Blob,
): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that photo."));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decode(
  blob: Blob,
): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      // Older Safari can throw here; the <img> decode below still reads the photo.
    }
  }
  return decodeViaImage(blob);
}

function encodeJpeg(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare that photo.");
  ctx.drawImage(source, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not prepare that photo."))),
      "image/jpeg",
      quality,
    );
  });
}

/** Any image Blob re-encoded as a JPEG Blob, long side at most 2048 px and under 1.4 MB. */
export async function toJpeg(blob: Blob): Promise<Blob> {
  const { source, width, height } = await decode(blob);
  const size = jpegDimensions(width, height);
  try {
    let out = await encodeJpeg(source, size.width, size.height, JPEG_QUALITY);
    if (out.size <= MAX_JPEG_BYTES) return out;
    out = await encodeJpeg(source, size.width, size.height, 0.75);
    if (out.size <= MAX_JPEG_BYTES) return out;
    out = await encodeJpeg(source, size.width, size.height, 0.65);
    if (out.size <= MAX_JPEG_BYTES) return out;
    const smaller = jpegDimensions(width, height, 1600);
    return await encodeJpeg(source, smaller.width, smaller.height, 0.65);
  } finally {
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) source.close();
  }
}
