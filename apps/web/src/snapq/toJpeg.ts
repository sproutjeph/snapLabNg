/** The server accepts at most 2048 px on the long side (docs/plans/snap-question.md). */
export const MAX_LONG_SIDE = 2048;

const JPEG_QUALITY = 0.85;

/** The size `w`×`h` becomes at most `MAX_LONG_SIDE` px on its long side, aspect kept. */
export function jpegDimensions(w: number, h: number): { width: number; height: number } {
  const safeW = Math.max(1, Math.round(w));
  const safeH = Math.max(1, Math.round(h));
  const scale = Math.min(1, MAX_LONG_SIDE / Math.max(safeW, safeH));
  return {
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale)),
  };
}

async function decode(
  blob: Blob,
): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  }
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

/** Any image Blob re-encoded as a JPEG Blob, long side at most 2048 px. */
export async function toJpeg(blob: Blob): Promise<Blob> {
  const { source, width, height } = await decode(blob);
  const size = jpegDimensions(width, height);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare that photo.");
    ctx.drawImage(source, 0, 0, size.width, size.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not prepare that photo."))),
        "image/jpeg",
        JPEG_QUALITY,
      );
    });
  } finally {
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) source.close();
  }
}
