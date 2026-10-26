import { useEffect, useState } from "react";
import * as THREE from "three";
import type { CaptureResult } from "../capture/types";
import { blurHeader } from "./headerBlur";
import { rectifyPage } from "./rectify";

interface Shots {
  upload: string;
  page: string;
  ink: string;
}

/** Reads a render target into a data URL, top row first. `alphaAsInk` draws alpha as dark ink on paper. */
function targetToDataUrl(
  gl: THREE.WebGLRenderer,
  rt: THREE.WebGLRenderTarget,
  alphaAsInk: boolean,
): string {
  const { width, height } = rt;
  const px = new Uint8Array(width * height * 4);
  gl.readRenderTargetPixels(rt, 0, 0, width, height, px);
  const img = new ImageData(width, height);
  for (let y = 0; y < height; y++) {
    const src = (height - 1 - y) * width * 4;
    const dst = y * width * 4;
    for (let x = 0; x < width * 4; x += 4) {
      if (alphaAsInk) {
        const v = 255 - (px[src + x + 3] ?? 0);
        img.data[dst + x] = v;
        img.data[dst + x + 1] = v;
        img.data[dst + x + 2] = v;
      } else {
        img.data[dst + x] = px[src + x] ?? 0;
        img.data[dst + x + 1] = px[src + x + 1] ?? 0;
        img.data[dst + x + 2] = px[src + x + 2] ?? 0;
      }
      img.data[dst + x + 3] = 255;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Preview of what happens after the corners are confirmed: the upload copy with the
 * NAME/SCHOOL header pixelated, the flattened page and its ink mask. Not product UI.
 */
export function RectifyPreview({ result }: { result: CaptureResult }) {
  const [shots, setShots] = useState<Shots | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let uploadUrl: string | null = null;
    (async () => {
      const uploadBlob = await blurHeader(
        result.photo,
        result.width,
        result.height,
        result.homography,
      );
      uploadUrl = URL.createObjectURL(uploadBlob);
      if (cancelled) {
        URL.revokeObjectURL(uploadUrl);
        return;
      }
      const bitmap = await createImageBitmap(result.photo);
      const gl = new THREE.WebGLRenderer({ canvas: document.createElement("canvas") });
      try {
        const out = rectifyPage(gl, bitmap, result.width, result.height, result.homography);
        const page = targetToDataUrl(gl, out.page, false);
        const ink = targetToDataUrl(gl, out.ink, true);
        out.dispose();
        if (!cancelled) setShots({ upload: uploadUrl, page, ink });
      } finally {
        bitmap.close();
        gl.dispose();
        gl.forceContextLoss(); // dispose() alone keeps the WebGL context alive
      }
    })().catch((e: unknown) => {
      if (!cancelled) setError(String(e));
    });
    return () => {
      cancelled = true;
      if (uploadUrl) URL.revokeObjectURL(uploadUrl);
    };
  }, [result]);

  if (error) return <p style={{ color: "#fca5a5" }}>Rectify failed: {error}</p>;
  if (!shots) return <p style={{ color: "#94a3b8" }}>Flattening the page…</p>;

  const cell = { flex: "1 1 220px", minWidth: 0 } as const;
  const img = { width: "100%", height: "auto", display: "block", borderRadius: 8 } as const;
  return (
    <section style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 20 }}>
      <figure style={{ ...cell, margin: 0 }}>
        <img src={shots.upload} alt="Upload copy with the header pixelated" style={img} />
        <figcaption>Upload copy (header hidden)</figcaption>
      </figure>
      <figure style={{ ...cell, margin: 0 }}>
        <img src={shots.page} alt="Flattened page" style={img} />
        <figcaption>Flattened page</figcaption>
      </figure>
      <figure style={{ ...cell, margin: 0 }}>
        <img src={shots.ink} alt="Ink mask" style={img} />
        <figcaption>Ink mask</figcaption>
      </figure>
    </section>
  );
}
